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
    def list_files() -> List[Dict[str, Any]]:
        """Lấy danh sách các file trong thư mục tools-content trên Proxmox"""
        cmd = f"mkdir -p {PVE_TOOLS_DIR} && ls -la --time-style=full-iso {PVE_TOOLS_DIR}"
        raw_output = IsoToolService._run_pve_ssh_command(cmd)
        
        files = []
        for line in raw_output.splitlines():
            line = line.strip()
            if not line or line.startswith("total"):
                continue
            parts = line.split(maxsplit=8)
            if len(parts) >= 9:
                perms, _, owner, group, size_str, date_str, time_str, tz_str, fname = parts
                if fname in (".", "..") or perms.startswith("d"):
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
                    "updated_at": full_dt
                })
        return sorted(files, key=lambda x: x["filename"].lower())

    @staticmethod
    def rebuild_iso() -> None:
        """Đóng gói lại file ISO tools-1001.iso từ thư mục tools-content"""
        cmd = (
            f"genisoimage -J -r -V 'LAB_TOOLS' -o {PVE_ISO_PATH} {PVE_TOOLS_DIR}"
        )
        logger.info("[ISO_SERVICE] Rebuilding tools-1001.iso on Proxmox node...")
        IsoToolService._run_pve_ssh_command(cmd)
        logger.info("[ISO_SERVICE] tools-1001.iso rebuild successfully completed.")

    @staticmethod
    def upload_file(upload_file: UploadFile) -> Dict[str, Any]:
        """Tải file từ Admin lên thư mục tools-content trên Proxmox và đóng gói lại ISO"""
        orig_name = os.path.basename(upload_file.filename)
        # Sanitize filename: chỉ cho phép chữ cái, số, dấu chấm, gạch dưới, gạch ngang
        safe_name = re.sub(r'[^A-Za-z0-9_.-]', '_', orig_name)
        if not safe_name or safe_name.startswith('.'):
            raise HTTPException(status_code=400, detail="Invalid filename")

        temp_local_path = f"/tmp/upload_{int(time.time())}_{safe_name}"
        try:
            with open(temp_local_path, "wb") as f:
                while chunk := upload_file.file.read(1024 * 1024):
                    f.write(chunk)

            file_size = os.path.getsize(temp_local_path)

            # Copy file sang Proxmox node qua SCP
            scp_cmd = [
                "scp",
                "-i", PVE_SSH_KEY,
                "-o", "StrictHostKeyChecking=accept-new",
                "-o", "ConnectTimeout=10",
                temp_local_path,
                f"{PVE_SSH_USER}@{PVE_SSH_HOST}:{PVE_TOOLS_DIR}/{safe_name}"
            ]
            res = subprocess.run(scp_cmd, capture_output=True, text=True, timeout=120)
            if res.returncode != 0:
                raise RuntimeError(f"SCP upload failed: {res.stderr}")

            # Đóng gói lại ISO
            IsoToolService.rebuild_iso()
            return {"filename": safe_name, "size_bytes": file_size, "message": f"Successfully added {safe_name} to Drive D:"}
        finally:
            if os.path.exists(temp_local_path):
                os.remove(temp_local_path)

    @staticmethod
    def delete_file(filename: str) -> None:
        """Xóa file khỏi thư mục tools-content và đóng gói lại ISO"""
        safe_name = re.sub(r'[^A-Za-z0-9_.-]', '', filename)
        if not safe_name or "/" in safe_name or ".." in safe_name:
            raise HTTPException(status_code=400, detail="Invalid filename")

        cmd = f"rm -f '{PVE_TOOLS_DIR}/{safe_name}'"
        IsoToolService._run_pve_ssh_command(cmd)
        IsoToolService.rebuild_iso()

    @staticmethod
    def get_lab_iso_basename(lab_id: int) -> str:
        """Trả về tên file ISO riêng của bài Lab"""
        return f"lab-{lab_id}.iso"

    @staticmethod
    def build_lab_iso(lab_id: int, selected_files: List[str]) -> str:
        """
        Tạo file ISO riêng cho bài lab lab-{lab_id}.iso chứa các file được chỉ định từ PVE_TOOLS_DIR.
        Sử dụng symlinks / hardlinks tạm trên Proxmox để tiết kiệm dung lượng và biên dịch tức thì.
        """
        lab_iso_dir = f"/var/lib/vz/template/iso/labs/lab-{lab_id}"
        lab_iso_path = f"/var/lib/vz/template/iso/labs/{IsoToolService.get_lab_iso_basename(lab_id)}"
        
        # Lọc danh sách an toàn
        safe_files = []
        for f in selected_files:
            sf = re.sub(r'[^A-Za-z0-9_.-]', '', f)
            if sf and "/" not in sf and ".." not in sf:
                safe_files.append(sf)

        if not safe_files:
            # Nếu không có file nào được chọn, dọn dẹp thư mục và file ISO nếu có
            cleanup_cmd = f"rm -rf '{lab_iso_dir}' '{lab_iso_path}'"
            IsoToolService._run_pve_ssh_command(cleanup_cmd)
            return ""

        # Tạo thư mục tạm trên Proxmox, tạo symlink tới các file nguồn trong tools-content, rồi chạy genisoimage
        file_links = " ".join([f"ln -sf '{PVE_TOOLS_DIR}/{f}' '{lab_iso_dir}/{f}';" for f in safe_files])
        build_cmd = (
            f"mkdir -p '{lab_iso_dir}' && "
            f"rm -rf '{lab_iso_dir}'/* && "
            f"{file_links} "
            f"genisoimage -J -r -follow-links -V 'LAB_{lab_id}_TOOLS' -o '{lab_iso_path}' '{lab_iso_dir}'"
        )
        logger.info(f"[ISO_SERVICE] Building custom ISO for Lab {lab_id} with {len(safe_files)} files...")
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
