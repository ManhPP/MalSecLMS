import os
import subprocess
import json
import re
import time
from typing import List, Dict, Any
from fastapi import UploadFile, HTTPException
from app.config import settings
from app.logging_config import logger
from app.services.vm_service import get_pve_client

PVE_SSH_HOST = "10.0.80.10"
PVE_SSH_USER = "root"
PVE_SSH_KEY = "/root/.ssh/id_pve_sync"
PVE_TOOLS_DIR = "/var/lib/vz/template/iso/tools-content"
PVE_ISO_PATH = "/var/lib/vz/template/iso/tools-1001.iso"

class IsoToolService:
    @staticmethod
    def _run_pve_ssh_command(cmd: str) -> str:
        """Thực thi câu lệnh SSH trên Proxmox node pve01 từ backend container"""
        ssh_cmd = [
            "ssh",
            "-i", PVE_SSH_KEY,
            "-o", "StrictHostKeyChecking=accept-new",
            "-o", "ConnectTimeout=10",
            f"{PVE_SSH_USER}@{PVE_SSH_HOST}",
            cmd
        ]
        try:
            res = subprocess.run(ssh_cmd, capture_output=True, text=True, timeout=90)
            if res.returncode != 0:
                logger.error(f"[ISO_SERVICE] SSH command failed: {cmd} | Stderr: {res.stderr}")
                raise RuntimeError(f"Proxmox command failed: {res.stderr or res.stdout}")
            return res.stdout
        except subprocess.TimeoutExpired:
            logger.error(f"[ISO_SERVICE] SSH command timed out: {cmd}")
            raise RuntimeError("Proxmox command timed out after 90 seconds")
        except Exception as e:
            logger.error(f"[ISO_SERVICE] SSH execution error: {e}")
            raise RuntimeError(f"SSH execution error: {str(e)}")

    @staticmethod
    def _sanitize_scope(scope: str | None) -> str:
        """Kiểm tra và chuẩn hóa phạm vi lưu trữ: 'common' hoặc 'lecturer_<username>'"""
        if not scope or scope == "common":
            return "common"
        # Validate lecturer scope format
        safe = re.sub(r'[^A-Za-z0-9_.-]', '', scope)
        if safe.startswith("lecturer_"):
            return safe
        return "common"

    @staticmethod
    def get_target_dir(scope: str | None = "common") -> str:
        safe_scope = IsoToolService._sanitize_scope(scope)
        if safe_scope == "common":
            return PVE_TOOLS_DIR
        lecturer_name = safe_scope.replace("lecturer_", "", 1)
        return f"{PVE_TOOLS_DIR}/lecturers/{lecturer_name}"

    @staticmethod
    def list_files(scope: str | None = "common") -> List[Dict[str, Any]]:
        """Lấy danh sách các file trong thư mục tools-content (chung hoặc của giảng viên) trên Proxmox"""
        target_dir = IsoToolService.get_target_dir(scope)
        safe_scope = IsoToolService._sanitize_scope(scope)
        cmd = f"mkdir -p '{target_dir}' && ls -la --time-style=full-iso '{target_dir}'"
        raw_output = IsoToolService._run_pve_ssh_command(cmd)
        
        files = []
        for line in raw_output.splitlines():
            line = line.strip()
            if not line or line.startswith("total"):
                continue
            parts = line.split(maxsplit=8)
            if len(parts) >= 9:
                perms, _, owner, group, size_str, date_str, time_str, tz_str, fname = parts
                # Bỏ qua directory và thư mục con lecturers nếu đang ở root
                if fname in (".", "..", "lecturers") or perms.startswith("d"):
                    continue
                try:
                    size_bytes = int(size_str)
                except ValueError:
                    size_bytes = 0
                
                # Format friendly date
                full_dt = f"{date_str} {time_str[:8]}"
                files.append({
                    "filename": fname,
                    "size_bytes": size_bytes,
                    "updated_at": full_dt,
                    "scope": safe_scope
                })
        return sorted(files, key=lambda x: x["filename"].lower())

    @staticmethod
    def list_all_available_files() -> List[Dict[str, Any]]:
        """Liệt kê toàn bộ file từ kho chung và tất cả không gian riêng của giảng viên (dành cho tạo lab)"""
        cmd = (
            f"mkdir -p '{PVE_TOOLS_DIR}/lecturers' && "
            f"find '{PVE_TOOLS_DIR}' -maxdepth 2 -type f -printf '%P\t%s\t%TY-%Tm-%Td %TH:%TM:%TS\n'"
        )
        raw_output = IsoToolService._run_pve_ssh_command(cmd)
        files = []
        for line in raw_output.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) >= 3:
                rel_path = parts[0]
                size_str = parts[1]
                dt_str = parts[2][:19]
                try:
                    size_bytes = int(size_str)
                except ValueError:
                    size_bytes = 0

                scope = "common"
                filename = rel_path
                if rel_path.startswith("lecturers/"):
                    subparts = rel_path.split("/", 2)
                    if len(subparts) == 3:
                        scope = f"lecturer_{subparts[1]}"
                        filename = subparts[2]
                
                files.append({
                    "filename": filename,
                    "rel_path": rel_path,
                    "size_bytes": size_bytes,
                    "updated_at": dt_str,
                    "scope": scope
                })
        return sorted(files, key=lambda x: (x["scope"], x["filename"].lower()))

    @staticmethod
    def rebuild_iso() -> None:
        """Đóng gói lại file ISO tools-1001.iso từ thư mục tools-content (loại trừ lecturers subfolder khỏi đĩa chung)"""
        cmd = (
            f"genisoimage -J -r -m lecturers -V 'LAB_TOOLS' -o {PVE_ISO_PATH} {PVE_TOOLS_DIR}"
        )
        logger.info("[ISO_SERVICE] Rebuilding tools-1001.iso on Proxmox node...")
        IsoToolService._run_pve_ssh_command(cmd)
        logger.info("[ISO_SERVICE] tools-1001.iso rebuild successfully completed.")

    @staticmethod
    def upload_file(upload_file: UploadFile, scope: str | None = "common") -> Dict[str, Any]:
        """Tải file từ Admin/Lecturer lên thư mục chung hoặc thư mục riêng của giảng viên trên Proxmox"""
        orig_name = os.path.basename(upload_file.filename)
        safe_name = re.sub(r'[^A-Za-z0-9_.-]', '_', orig_name)
        if not safe_name or safe_name.startswith('.'):
            raise HTTPException(status_code=400, detail="Invalid filename")

        target_dir = IsoToolService.get_target_dir(scope)
        safe_scope = IsoToolService._sanitize_scope(scope)

        temp_local_path = f"/tmp/upload_{int(time.time())}_{safe_name}"
        try:
            with open(temp_local_path, "wb") as f:
                while chunk := upload_file.file.read(1024 * 1024):
                    f.write(chunk)

            file_size = os.path.getsize(temp_local_path)

            # Đảm bảo target_dir trên Proxmox tồn tại
            IsoToolService._run_pve_ssh_command(f"mkdir -p '{target_dir}'")

            # Copy file sang Proxmox node qua SCP
            scp_cmd = [
                "scp",
                "-i", PVE_SSH_KEY,
                "-o", "StrictHostKeyChecking=accept-new",
                "-o", "ConnectTimeout=10",
                temp_local_path,
                f"{PVE_SSH_USER}@{PVE_SSH_HOST}:{target_dir}/{safe_name}"
            ]
            res = subprocess.run(scp_cmd, capture_output=True, text=True, timeout=120)
            if res.returncode != 0:
                raise RuntimeError(f"SCP upload failed: {res.stderr}")

            # Nếu upload vào common, đóng gói lại tools-1001.iso
            if safe_scope == "common":
                IsoToolService.rebuild_iso()
            
            return {
                "filename": safe_name, 
                "scope": safe_scope, 
                "size_bytes": file_size, 
                "message": f"Successfully uploaded {safe_name} to {safe_scope} workspace"
            }
        finally:
            if os.path.exists(temp_local_path):
                os.remove(temp_local_path)

    @staticmethod
    def delete_file(filename: str, scope: str | None = "common") -> None:
        """Xóa file khỏi kho chung hoặc kho riêng giảng viên"""
        safe_name = re.sub(r'[^A-Za-z0-9_.-]', '', filename)
        if not safe_name or "/" in safe_name or ".." in safe_name:
            raise HTTPException(status_code=400, detail="Invalid filename")

        target_dir = IsoToolService.get_target_dir(scope)
        safe_scope = IsoToolService._sanitize_scope(scope)

        cmd = f"rm -f '{target_dir}/{safe_name}'"
        IsoToolService._run_pve_ssh_command(cmd)

        if safe_scope == "common":
            IsoToolService.rebuild_iso()

    @staticmethod
    def get_lab_iso_basename(lab_id: int) -> str:
        """Trả về tên file ISO riêng của bài Lab"""
        return f"lab-{lab_id}.iso"

    @staticmethod
    def build_lab_iso(lab_id: int, selected_files: List[str]) -> str:
        """
        Tạo file ISO riêng cho bài lab lab-{lab_id}.iso chứa các file được chỉ định.
        Mỗi file có thể là file trong kho chung (filename) hoặc có prefix (rel_path như 'lecturers/user/filename').
        Sử dụng symlinks tạm trên Proxmox để tiết kiệm dung lượng.
        """
        lab_iso_dir = f"/var/lib/vz/template/iso/labs/lab-{lab_id}"
        iso_basename = IsoToolService.get_lab_iso_basename(lab_id)
        lab_iso_path = f"/var/lib/vz/template/iso/{iso_basename}"
        
        # Lọc danh sách an toàn
        safe_items = []
        for f in selected_files:
            sf = re.sub(r'[^A-Za-z0-9_./-]', '', f)
            if sf and ".." not in sf and not sf.startswith("/"):
                # Xác định basename khi đưa vào iso
                base_name = os.path.basename(sf)
                safe_items.append((sf, base_name))

        if not safe_items:
            cleanup_cmd = f"rm -rf '{lab_iso_dir}' '{lab_iso_path}'"
            IsoToolService._run_pve_ssh_command(cleanup_cmd)
            return ""

        # Tạo thư mục tạm trên Proxmox, tạo symlink tới file nguồn (từ PVE_TOOLS_DIR/<sf>), rồi chạy genisoimage
        file_links = " ".join([f"ln -sf '{PVE_TOOLS_DIR}/{src}' '{lab_iso_dir}/{dst}';" for src, dst in safe_items])
        build_cmd = (
            f"mkdir -p '{lab_iso_dir}' && "
            f"rm -rf '{lab_iso_dir}'/* && "
            f"{file_links} "
            f"genisoimage -J -r -follow-links -V 'LAB_{lab_id}_TOOLS' -o '{lab_iso_path}' '{lab_iso_dir}'"
        )
        logger.info(f"[ISO_SERVICE] Building custom ISO for Lab {lab_id} with {len(safe_items)} files...")
        IsoToolService._run_pve_ssh_command(build_cmd)
        logger.info(f"[ISO_SERVICE] Custom ISO for Lab {lab_id} built successfully at {lab_iso_path}")
        return lab_iso_path

    @staticmethod
    def sync_to_running_vms(lab_id: int | None = None, iso_name: str | None = None) -> Dict[str, Any]:
        """
        Remount ổ đĩa ide2 cho các máy ảo sinh viên đang chạy để nhận ngay file mới.
        Nếu truyền lab_id, chỉ remount cho máy ảo thuộc bài lab đó với ISO chỉ định.
        """
        proxmox = get_pve_client()
        if not proxmox:
            raise RuntimeError("Cannot connect to Proxmox API")

        node = settings.PVE_NODE
        resources = proxmox.cluster.resources.get(type="vm")
        synced_count = 0
        target_iso = iso_name or os.path.basename(PVE_ISO_PATH)

        for vm in resources:
            vmid = int(vm.get("vmid", -1))
            status = vm.get("status")
            name = vm.get("name", "")
            # Chỉ áp dụng cho máy ảo sinh viên trong dải STUDENT_VMID
            if settings.STUDENT_VMID_MIN <= vmid <= settings.STUDENT_VMID_MAX and status == "running":
                # Nếu lọc theo lab_id
                if lab_id is not None and not name.startswith(f"lab-{lab_id}-"):
                    continue
                try:
                    # Remount ide2
                    proxmox.nodes(node).qemu(vmid).config.post(
                        ide2=f"local:iso/{target_iso},media=cdrom"
                    )
                    synced_count += 1
                except Exception as e:
                    logger.warning(f"[ISO_SERVICE] Failed to remount CD-ROM on VM {vmid}: {e}")

        return {"synced_count": synced_count, "message": f"Synced Drive D: ({target_iso}) to {synced_count} active VMs"}
