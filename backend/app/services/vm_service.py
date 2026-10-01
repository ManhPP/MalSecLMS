import json
import time
import hmac
import hashlib
import base64
import urllib.parse
import ipaddress
import socket
import secrets
import re
import threading
from collections import defaultdict
from typing import Tuple, Dict, Any, List, Optional
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from app.config import settings
from app.logging_config import logger

_provision_locks = defaultdict(threading.Lock)
_provision_global_lock = threading.Lock()


def _get_provision_lock(student_username: str, lab_id: int) -> threading.Lock:
    with _provision_global_lock:
        return _provision_locks[(student_username, lab_id)]


def get_pve_client():
    """Khởi tạo kết nối Proxmox API qua thư viện proxmoxer"""
    try:
        from proxmoxer import ProxmoxAPI
        return ProxmoxAPI(
            settings.PVE_API_HOST,
            user=settings.PVE_API_USER,
            token_name=settings.PVE_TOKEN_NAME,
            token_value=settings.PVE_TOKEN_VALUE,
            verify_ssl=settings.PVE_VERIFY_SSL,
            timeout=60
        )
    except Exception as e:
        print(f"[!] Warning: Could not initialize ProxmoxAPI client: {e}")
    return None


class VMProvisionError(RuntimeError):
    """Raised when Proxmox creates no usable student VM."""


def _student_vm_name(student_username: str, lab_id: int) -> str:
    """Build a stable Proxmox-safe name used as the VM ownership key."""
    prefix = f"lab-{lab_id}-"
    normalized = re.sub(r"[^A-Za-z0-9-]", "-", student_username).strip("-")
    normalized = normalized or "student"
    plain_name = f"{prefix}{normalized}"
    if normalized == student_username and len(plain_name) <= 63:
        return plain_name

    digest = hashlib.sha256(student_username.encode("utf-8")).hexdigest()[:8]
    max_username_length = max(1, 63 - len(prefix) - len(digest) - 1)
    return f"{prefix}{normalized[:max_username_length]}-{digest}"


def _preferred_student_vmid(student_username: str, lab_id: int) -> int:
    """Return a stable VMID candidate without relying on digits in a username."""
    vmid_min = settings.STUDENT_VMID_MIN
    vmid_max = settings.STUDENT_VMID_MAX
    if vmid_min > vmid_max:
        raise VMProvisionError("Invalid student VMID range configuration")
    digest = hashlib.sha256(f"{student_username}\0{lab_id}".encode("utf-8")).digest()
    return vmid_min + int.from_bytes(digest[:8], "big") % (vmid_max - vmid_min + 1)


def _find_all_student_vms(resources, student_username: str, lab_id: int) -> List[Dict[str, Any]]:
    """Find all VMs whose name proves they belong to this student and lab."""
    expected_name = _student_vm_name(student_username, lab_id)
    return [item for item in resources if item.get("name") == expected_name]


def _find_student_vm(resources, student_username: str, lab_id: int):
    """Find the primary VM belonging to this student and lab without failing if duplicates exist."""
    matches = _find_all_student_vms(resources, student_username, lab_id)
    if not matches:
        return None
    if len(matches) > 1:
        expected_name = _student_vm_name(student_username, lab_id)
        logger.warning(
            f"[VM_ORCHESTRATION] Multiple Proxmox VMs found with ownership name '{expected_name}': "
            f"{[m.get('vmid') for m in matches]}. Prioritizing running/first VM."
        )
        # Prioritize running VM if any, else pick the first
        running_vm = next((m for m in matches if m.get("status") == "running"), None)
        return running_vm if running_vm else matches[0]
    return matches[0]


def _is_vm_owned_by_student(vm_name: str, student_username: str) -> bool:
    """Check whether a VM name belongs to this student (e.g. lab-<id>-<username>)."""
    if not vm_name:
        return False
    normalized = re.sub(r"[^A-Za-z0-9-]", "-", student_username).strip("-") or "student"
    digest = hashlib.sha256(student_username.encode("utf-8")).hexdigest()[:8]
    # Name pattern: lab-{lab_id}-{normalized} or lab-{lab_id}-{normalized_truncated}-{digest}
    if re.match(rf"^lab-\d+-{re.escape(normalized)}$", vm_name):
        return True
    if re.match(rf"^lab-\d+-.*-{re.escape(digest)}$", vm_name):
        return True
    return False


def _stop_other_running_student_vms(proxmox, node: str, resources, student_username: str, current_vmid: int):
    """
    Giới hạn tài nguyên: Mỗi sinh viên chỉ được phép có tối đa 1 máy ảo ở trạng thái RUNNING.
    Tự động tắt các máy ảo ở bài lab khác của sinh viên này trước khi bật máy ảo mới.
    """
    for res in resources:
        try:
            vmid = int(res.get("vmid", -1))
            status = res.get("status")
            name = res.get("name", "")
            # Chỉ xét trong dải VMID sinh viên và khác VM hiện tại
            if (
                settings.STUDENT_VMID_MIN <= vmid <= settings.STUDENT_VMID_MAX
                and vmid != current_vmid
                and status == "running"
                and _is_vm_owned_by_student(name, student_username)
            ):
                logger.info(
                    f"[RESOURCE_QUOTA] Auto-stopping other running VM {vmid} ({name}) "
                    f"for student {student_username} to enforce 1-VM-per-student limit"
                )
                print(
                    f"[+] [RESOURCE_QUOTA] Auto-stopping previous running VM {vmid} ({name}) "
                    f"for student {student_username}...",
                    flush=True
                )
                stop_upid = proxmox.nodes(node).qemu(vmid).status.stop.post()
                _wait_for_pve_task(proxmox, node, stop_upid, f"auto-stopping VM {vmid}")
        except Exception as exc:
            logger.warning(f"Could not auto-stop previous VM {res.get('vmid')} for {student_username}: {exc}")


def _allocate_student_vmid(resources, student_username: str, lab_id: int) -> int:
    """Resolve hash collisions by walking the configured student VMID range."""
    vmid_min = settings.STUDENT_VMID_MIN
    vmid_max = settings.STUDENT_VMID_MAX
    used_vmids = {int(item.get("vmid", -1)) for item in resources}
    preferred = _preferred_student_vmid(student_username, lab_id)
    range_size = vmid_max - vmid_min + 1
    for offset in range(range_size):
        candidate = vmid_min + ((preferred - vmid_min + offset) % range_size)
        if candidate not in used_vmids:
            return candidate
    raise VMProvisionError("No free student VMID is available")


def _wait_for_pve_task(proxmox, node: str, upid: str, action: str) -> None:
    """Wait for an asynchronous Proxmox task and surface its exit status."""
    if not upid or not isinstance(upid, str):
        raise VMProvisionError(f"Proxmox did not return a task id for {action}")

    deadline = time.monotonic() + settings.VM_CLONE_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        try:
            task = proxmox.nodes(node).tasks(upid).status.get()
        except Exception as exc:
            raise VMProvisionError(f"Cannot read Proxmox task for {action}: {exc}") from exc

        if task.get("status") == "stopped":
            exit_status = task.get("exitstatus")
            if exit_status != "OK":
                raise VMProvisionError(
                    f"Proxmox task failed while {action}: {exit_status or 'unknown error'}"
                )
            return
        time.sleep(2)

    raise VMProvisionError(
        f"Timed out after {settings.VM_CLONE_TIMEOUT_SECONDS}s while {action}"
    )


def _get_guest_vlan_ip(proxmox, node: str, vmid: int) -> str | None:
    """Return a VLAN 30 IPv4 address when QEMU Guest Agent is available."""
    try:
        interfaces = (
            proxmox.nodes(node)
            .qemu(vmid)
            .agent("network-get-interfaces")
            .get()
        )
    except Exception:
        return None

    for interface in interfaces.get("result", []):
        if interface.get("name") == "lo":
            continue
        for ip_info in interface.get("ip-addresses", []):
            ip = ip_info.get("ip-address")
            if not ip:
                continue
            try:
                candidate = ipaddress.ip_address(ip)
            except ValueError:
                continue
            if candidate in settings.LAB_NETWORK:
                return str(candidate)
    return None


def _wait_for_guest_vlan_ip(proxmox, node: str, vmid: int) -> str:
    """Wait for QEMU Guest Agent to report the VM's unique VLAN 30 address."""
    deadline = time.monotonic() + settings.VM_AGENT_TIMEOUT_SECONDS
    while time.monotonic() < deadline:
        ip_address = _get_guest_vlan_ip(proxmox, node, vmid)
        if ip_address:
            return ip_address
        time.sleep(3)
    raise VMProvisionError(
        f"VM {vmid} did not report a VLAN 30 IP through QEMU Guest Agent "
        f"within {settings.VM_AGENT_TIMEOUT_SECONDS}s"
    )


def _net0_with_unique_mac(source_net0: str) -> str:
    """Preserve model/bridge/VLAN settings while assigning a unique local MAC."""
    parts = source_net0.split(",")
    model = parts[0].split("=", 1)[0]
    mac_bytes = bytes([0x02]) + secrets.token_bytes(5)
    mac_address = ":".join(f"{byte:02X}" for byte in mac_bytes)
    parts[0] = f"{model}={mac_address}"
    return ",".join(parts)


def _ensure_fakenet_rdp_whitelist(proxmox, node: str, vmid: int) -> None:
    """
    Tự động kiểm tra và thêm BlackListPortsTCP (3389, 22) và HostBlackList (Guacamole IP, Gateway)
    vào file cấu hình FakeNet-NG nếu tồn tại trong VM Windows.
    Giúp sinh viên/giảng viên mở FakeNet mà không bao giờ bị ngắt kết nối VDI/RDP làm đóng băng máy ảo.
    """
    try:
        fix_ps = (
            "$p='C:\\Tools\\fakenet\\fakenet3.5\\configs\\default.ini';"
            "if(Test-Path $p){"
            "$c=Get-Content $p -Raw;"
            "if($c -notmatch 'BlackListPortsTCP.*3389'){"
            "$c=$c -replace 'BlackListPortsTCP:.*', 'BlackListPortsTCP: 139, 3389, 22';"
            "$c=$c -replace '#?\\s*HostBlackList:.*', 'HostBlackList: 10.30.0.50, 10.30.0.1, 10.0.80.50';"
            "Set-Content -Path $p -Value $c -NoNewline"
            "}"
            "}"
        )
        proxmox.nodes(node).qemu(vmid).agent("exec").post(
            command=["powershell", "-ExecutionPolicy", "Bypass", "-Command", fix_ps]
        )
    except Exception as e:
        logger.warning(f"Could not check/patch FakeNet RDP whitelist on VM {vmid}: {e}")


def _wait_for_connection(
    ip_address: str, vmid: int, protocol: str, port: int
) -> None:
    """Do not advertise a Guacamole session until the configured service is ready."""
    deadline = time.monotonic() + settings.VM_CONNECTION_TIMEOUT_SECONDS
    last_error = "not ready"
    while time.monotonic() < deadline:
        try:
            with socket.create_connection((ip_address, port), timeout=3):
                return
        except OSError as exc:
            last_error = str(exc)
            time.sleep(3)

    raise VMProvisionError(
        f"VM {vmid} is running, but {protocol.upper()} {ip_address}:{port} "
        f"did not become ready within {settings.VM_CONNECTION_TIMEOUT_SECONDS}s "
        f"({last_error})"
    )


def provision_student_vm(
    student_username: str,
    lab_id: int,
    template_vmid: int,
    protocol: str,
    port: int,
    is_linked_clone: bool = True,
    iso_filename: str | None = None,
    cpu_cores: int | None = None,
    ram_mb: int | None = None,
    is_exam_mode: bool = False,
) -> Tuple[str, int]:
    """
    1. Kiểm tra xem sinh viên đã có máy ảo cho bài lab này chưa.
    2. Nếu chưa có, clone từ template (Linked Clone hoặc Full Clone tùy cấu hình lab).
    3. Gán MAC riêng và cấu hình RAM/CPU nếu có.
    4. Bật máy ảo và phục hồi Exam Workspace (nếu có bản backup).
    """
    node = settings.PVE_NODE
    proxmox = get_pve_client()
    if not proxmox:
        raise VMProvisionError("Cannot connect to the Proxmox API")
    new_vmid = _preferred_student_vmid(student_username, lab_id)

    # Acquire lock for this specific student and lab to prevent concurrent duplicate clones
    lock = _get_provision_lock(student_username, lab_id)
    with lock:
        try:
            resources = proxmox.cluster.resources.get(type="vm")
            existing_vm = _find_student_vm(resources, student_username, lab_id)
            new_vmid = (
                int(existing_vm["vmid"])
                if existing_vm
                else _allocate_student_vmid(resources, student_username, lab_id)
            )

            if not existing_vm:
                source = next(
                    (item for item in resources if int(item.get("vmid", -1)) == template_vmid),
                    None,
                )
                if not source:
                    raise VMProvisionError(f"Source VM {template_vmid} does not exist")
                if source.get("status") == "running":
                    raise VMProvisionError(
                        f"Source VM {template_vmid} is running; stop it before cloning"
                    )

                clone_type_str = "Linked Clone (full=0)" if is_linked_clone else "Full Clone (full=1)"
                print(
                    f"[+] Cloning source VM {template_vmid} ({clone_type_str}) to VM {new_vmid} "
                    f"for {student_username}...",
                    flush=True,
                )
                source_config = proxmox.nodes(node).qemu(template_vmid).config.get()
                source_net0 = source_config.get("net0")
                if not source_net0:
                    raise VMProvisionError(f"Source VM {template_vmid} has no net0 adapter")

                clone_start = time.perf_counter()
                clone_upid = proxmox.nodes(node).qemu(template_vmid).clone.post(
                    newid=new_vmid,
                    name=_student_vm_name(student_username, lab_id),
                    full=0 if is_linked_clone else 1,
                )
                _wait_for_pve_task(
                    proxmox,
                    node,
                    clone_upid,
                    f"cloning source VM {template_vmid} to VM {new_vmid}",
                )
                clone_duration = time.perf_counter() - clone_start
                logger.info(f"[VM_ORCHESTRATION] CLONE_COMPLETE | User: {student_username} | Template: {template_vmid} -> VMID: {new_vmid} | Mode: {clone_type_str} | Duration: {clone_duration:.1f}s")

                post_config = {
                    "net0": _net0_with_unique_mac(source_net0),
                    "agent": "enabled=1",
                }
                if iso_filename:
                    post_config["ide2"] = f"local:iso/{iso_filename},media=cdrom"
                if cpu_cores and cpu_cores > 0:
                    post_config["cores"] = cpu_cores
                if ram_mb and ram_mb >= 512:
                    post_config["memory"] = ram_mb

                proxmox.nodes(node).qemu(new_vmid).config.post(**post_config)
            else:
                # Nếu VM đã tồn tại, kiểm tra và đảm bảo mount đúng ISO của bài lab nếu được chỉ định
                if iso_filename:
                    try:
                        current_cfg = proxmox.nodes(node).qemu(new_vmid).config.get()
                        expected_ide2 = f"local:iso/{iso_filename},media=cdrom"
                        if current_cfg.get("ide2") != expected_ide2:
                            proxmox.nodes(node).qemu(new_vmid).config.post(ide2=expected_ide2)
                    except Exception as e:
                        logger.warning(f"[VM_ORCHESTRATION] Failed to update ide2 on existing VM {new_vmid}: {e}")

            # 1-VM-per-student limit: Tự động tắt bất kỳ VM nào khác đang chạy của sinh viên này
            _stop_other_running_student_vms(proxmox, node, resources, student_username, new_vmid)

            status = proxmox.nodes(node).qemu(new_vmid).status.current.get()
            boot_start = time.perf_counter()
            is_already_running = (status.get("status") == "running")
            if not is_already_running:
                # Cập nhật RAM/Cores nếu có cấu hình tùy chỉnh
                hw_updates = {}
                if cpu_cores and cpu_cores > 0:
                    hw_updates["cores"] = cpu_cores
                if ram_mb and ram_mb >= 512:
                    hw_updates["memory"] = ram_mb
                if hw_updates:
                    try:
                        proxmox.nodes(node).qemu(new_vmid).config.post(**hw_updates)
                    except Exception as hw_e:
                        logger.warning(f"Could not apply hardware updates to VM {new_vmid}: {hw_e}")

                print(f"[+] Starting VM {new_vmid}...", flush=True)
                start_upid = proxmox.nodes(node).qemu(new_vmid).status.start.post()
                _wait_for_pve_task(proxmox, node, start_upid, f"starting VM {new_vmid}")

            # Lấy IP từ QEMU guest agent (nếu VM đang chạy sẵn, hàm này trả về ngay tức thì)
            ip_address = _wait_for_guest_vlan_ip(proxmox, node, new_vmid)

            # Chỉ áp dụng độ trễ boot và cấu hình whitelist nếu VM vừa mới được bật lên
            if not is_already_running:
                if settings.VM_VERIFY_CONNECTION:
                    _wait_for_connection(ip_address, new_vmid, protocol, port)
                else:
                    print(
                        f"[+] Waiting {settings.VM_BOOT_WAIT_SECONDS}s for guest VM "
                        f"{new_vmid} to finish booting...",
                        flush=True,
                    )
                    time.sleep(settings.VM_BOOT_WAIT_SECONDS)
                # Tự động đảm bảo FakeNet không chặn RDP 3389 và Guacamole IP khi vừa khởi động
                if protocol.lower() == "rdp" or port == 3389:
                    _ensure_fakenet_rdp_whitelist(proxmox, node, new_vmid)

                # Tự động khởi tạo hoặc phục hồi Exam_Workspace cho sinh viên
                try:
                    restore_vm_workspace(new_vmid, student_username, lab_id)
                except Exception as ws_err:
                    logger.warning(f"[EXAM_WORKSPACE] Workspace restore skipped/failed on VM {new_vmid}: {ws_err}")

            boot_duration = time.perf_counter() - boot_start
            logger.info(f"[VM_ORCHESTRATION] VM_ONLINE | User: {student_username} | VMID: {new_vmid} | IP: {ip_address} | {protocol.upper()}:{port} | Status: {'warm_hit' if is_already_running else 'cold_boot'} | Duration: {boot_duration:.1f}s")
        except VMProvisionError:
            raise
        except Exception as exc:
            logger.error(f"[VM_ORCHESTRATION] FAILED on VMID {new_vmid} for User {student_username}: {exc}", exc_info=True)
            raise VMProvisionError(f"Proxmox operation failed for VM {new_vmid}: {exc}") from exc

        print(
            f"[VM-SESSION] Provisioned VM vmid={new_vmid} ip={ip_address} guest=started",
            flush=True,
        )
        return ip_address, new_vmid




def get_guacamole_secret_bytes(secret_str: str) -> bytes:

    """
    Khớp chính xác với cách Guacamole Java (Crypto.java) giải mã json-secret-key:
    Nếu secret_str là chuỗi Hex 32 ký tự (128-bit) hoặc 64 ký tự (256-bit),
    Guacamole giải mã chuỗi hex ra byte nhị phân trực tiếp (Hex.decodeHex).
    Nếu không phải hex, Guacamole mã hóa UTF-8 bytes.
    """
    secret_str = secret_str.strip()
    if len(secret_str) in (32, 64):
        try:
            return bytes.fromhex(secret_str)
        except ValueError:
            pass
    return secret_str.encode('utf-8')

def generate_guacamole_auth_json_url(
    ip_address: str, 
    student_username: str,
    protocol: str,
    port: int,
    username: str | None = None,
    password: str | None = None,
    disable_vm_copy: bool = False,
    disable_vm_paste: bool = False,
    is_exam_mode: bool = False,
) -> str:
    """
    Sinh URL kết nối Apache Guacamole mã hóa theo chuẩn guacamole-auth-json (Encrypted JSON Authentication v1.6.0).
    Thuật toán chuẩn xác từ Bytecode Guacamole 1.6.0:
    1. json_bytes = JSON payload
    2. signature = HMAC-SHA256(key, json_bytes) (32 bytes)
    3. raw_payload = signature (32B) + json_bytes
    4. ciphertext = AES-CBC-Encrypt(key, NULL_IV, PKCS7(raw_payload))
    5. URL = /#/client/{connection_name}?data=urllib.parse.quote(Base64(ciphertext))
    """
    secret_str = settings.GUAC_JSON_SECRET.strip()
    key = get_guacamole_secret_bytes(secret_str)
    if len(key) not in (16, 24, 32):
        key = hashlib.sha256(key).digest()
    
    expires_ms = int((time.time() + settings.GUAC_SESSION_TTL_SECONDS) * 1000)
    session_ts = int(time.time())  # Timestamp để tạo connection_name duy nhất mỗi phiên
    connection_name = f"Lab-VM-{student_username}-{session_ts}"
    

    protocol = protocol.lower()
    if protocol not in {"rdp", "vnc", "ssh"}:
        raise ValueError(f"Unsupported Guacamole protocol: {protocol}")

    parameters = {
        "hostname": ip_address,
        "port": str(port),
    }
    if username:
        parameters["username"] = username
    if password:
        parameters["password"] = password
    if protocol == "rdp":
        should_disable_copy = bool(disable_vm_copy or is_exam_mode)
        should_disable_paste = bool(disable_vm_paste or is_exam_mode)
        parameters.update({
            "ignore-cert": str(settings.GUAC_RDP_IGNORE_CERT).lower(),
            "security": settings.GUAC_RDP_SECURITY,
            "server-layout": settings.GUAC_RDP_SERVER_LAYOUT,
            "enable-wallpaper": str(settings.GUAC_RDP_ENABLE_WALLPAPER).lower(),
            "enable-theming": str(settings.GUAC_RDP_ENABLE_THEMING).lower(),
            "enable-font-smoothing": str(
                settings.GUAC_RDP_ENABLE_FONT_SMOOTHING
            ).lower(),
            "enable-full-window-drag": str(
                settings.GUAC_RDP_ENABLE_FULL_WINDOW_DRAG
            ).lower(),
            "enable-menu-animations": str(
                settings.GUAC_RDP_ENABLE_MENU_ANIMATIONS
            ).lower(),
            "enable-desktop-composition": str(
                settings.GUAC_RDP_ENABLE_DESKTOP_COMPOSITION
            ).lower(),
            "disable-copy": "true" if should_disable_copy else "false",
            "disable-paste": "true" if should_disable_paste else "false",
        })
    elif protocol == "ssh":
        parameters.update({
            "ignore-host-key": str(settings.GUAC_SSH_IGNORE_HOST_KEY).lower()
        })

    payload = {
        "username": student_username,
        "expires": expires_ms,
        "connections": {
            connection_name: {
                "protocol": protocol,
                "parameters": parameters
            }
        }
    }
    
    json_bytes = json.dumps(payload).encode('utf-8')
    
    # 1. Chữ ký HMAC-SHA256 (32 bytes) tính TRÊN THÔ NỘI DUNG JSON
    hmac_obj = hmac.new(key, json_bytes, hashlib.sha256)
    signature = hmac_obj.digest()
    
    # 2. Ghép Signature (32 bytes) + Nội dung JSON
    raw_payload = signature + json_bytes
    
    # 3. PKCS7 padding (block size 128 bits = 16 bytes)
    padder = padding.PKCS7(128).padder()
    padded_data = padder.update(raw_payload) + padder.finalize()
    
    # 4. Mã hóa AES-CBC với NULL_IV (16 byte 0x00)
    iv = bytes(16)
    cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
    encryptor = cipher.encryptor()
    ciphertext = encryptor.update(padded_data) + encryptor.finalize()

    # 5. Base64 & URL Encode
    data_b64 = base64.b64encode(ciphertext).decode('utf-8')
    quoted_data = urllib.parse.quote(data_b64, safe='')
    
    base_url = settings.GUAC_BASE_URL.rstrip('/')
    url = f"{base_url}/#/client/c/{connection_name}?data={quoted_data}"
    logger.info(f"[VDI] SESSION_ISSUED | User: {student_username} | Target: {ip_address}:{port} ({protocol.upper()}) | TTL: {settings.GUAC_SESSION_TTL_SECONDS}s")
    return url

def rollback_student_vm(student_username: str, lab_id: int) -> bool:
    """Tắt và xóa sạch TẤT CẢ các bản VM của sinh viên ở bài lab này (kể cả khi bị tạo trùng lặp nhiều VM)"""
    node = settings.PVE_NODE
    proxmox = get_pve_client()
    if not proxmox:
        raise VMProvisionError("Cannot connect to the Proxmox API")

    try:
        resources = proxmox.cluster.resources.get(type="vm")
        matching_vms = _find_all_student_vms(resources, student_username, lab_id)
        if not matching_vms:
            return True

        for vm in matching_vms:
            target_vmid = int(vm["vmid"])
            # Security guard: never operate outside student VMID boundary
            if not (settings.STUDENT_VMID_MIN <= target_vmid <= settings.STUDENT_VMID_MAX):
                logger.error(
                    f"[SECURITY_ALERT] Target VMID {target_vmid} ({vm.get('name')}) is OUTSIDE "
                    f"student boundary [{settings.STUDENT_VMID_MIN}, {settings.STUDENT_VMID_MAX}]. Skipped."
                )
                continue

            try:
                status = proxmox.nodes(node).qemu(target_vmid).status.current.get()
                if status.get("status") == "running":
                    # Tự động sao lưu Exam_Workspace trước khi xóa máy ảo để không mất bài làm
                    try:
                        backup_vm_workspace(target_vmid, student_username, lab_id)
                        logger.info(f"[EXAM_WORKSPACE] Auto-backed up workspace for {student_username} before rollback on VM {target_vmid}")
                    except Exception as ws_err:
                        logger.warning(f"[EXAM_WORKSPACE] Auto-backup failed before rollback on VM {target_vmid}: {ws_err}")

                    print(f"[+] Stopping VM {target_vmid} for rollback...", flush=True)
                    stop_upid = proxmox.nodes(node).qemu(target_vmid).status.stop.post()
                    _wait_for_pve_task(proxmox, node, stop_upid, f"stopping VM {target_vmid}")

                print(f"[+] Destroying VM {target_vmid} for rollback...", flush=True)
                destroy_upid = proxmox.nodes(node).qemu(target_vmid).delete(purge=1)
                _wait_for_pve_task(proxmox, node, destroy_upid, f"destroying VM {target_vmid}")
                logger.info(f"[VM_ORCHESTRATION] ROLLBACK | User: {student_username} | LabID: {lab_id} | Purged VMID: {target_vmid}")
                print(f"[+] VM {target_vmid} purged successfully from Proxmox!", flush=True)
            except Exception as single_err:
                logger.warning(f"Could not purge VM {target_vmid} during rollback: {single_err}")

        return True
    except VMProvisionError:
        raise
    except Exception as exc:
        logger.error(f"[VM_ORCHESTRATION] ROLLBACK_FAILED for User {student_username} on Lab {lab_id}: {exc}", exc_info=True)
        raise VMProvisionError(f"Rollback failed: {exc}") from exc


def get_available_templates() -> List[Dict[str, Any]]:
    """Lấy danh sách VM nguồn trong dải VMID template đã cấu hình."""
    proxmox = get_pve_client()
    templates = []
    min_vmid = settings.TEMPLATE_VMID_MIN
    max_vmid = settings.TEMPLATE_VMID_MAX

    if proxmox:
        try:
            resources = proxmox.cluster.resources.get(type="vm")
            for res in resources:
                vmid = int(res.get("vmid"))
                name = res.get("name", f"VM {vmid}")
                is_template = res.get("template") in [1, True, "1"]

                if min_vmid <= vmid <= max_vmid:
                    templates.append({
                        "vmid": vmid,
                        "name": f"{name} ({'Template' if is_template else 'Base VM'})",
                        "status": "template" if is_template else res.get("status")
                    })
        except Exception as e:
            print(f"[!] Error fetching PVE templates: {e}")
            
    return sorted(templates, key=lambda item: item["vmid"])




def list_lab_vms(lab_id: int, students: List[Any]) -> List[Dict[str, Any]]:
    """Lấy thông tin và trạng thái thực tế của tất cả máy ảo sinh viên thuộc về bài lab này"""
    node = settings.PVE_NODE
    proxmox = get_pve_client()
    vm_list = []
    resources = []
    if proxmox:
        try:
            resources = proxmox.cluster.resources.get(type="vm")
        except Exception as exc:
            print(f"[!] Error fetching student VMs from Proxmox: {exc}")

    for student in students:
        student_username = student.username
        existing_vm = _find_student_vm(resources, student_username, lab_id)
        vmid = (
            int(existing_vm["vmid"])
            if existing_vm
            else _preferred_student_vmid(student_username, lab_id)
        )


        vm_item = {
            "student_id": student.id,
            "student_username": student_username,
            "student_full_name": student.full_name,
            "vmid": vmid,
            "ip_address": None,
            "status": "not_created",
            "name": _student_vm_name(student_username, lab_id),
            "cpu": 0,
            "mem": 0,
            "maxmem": 0,
            "uptime": 0
        }

        if proxmox and existing_vm:
            try:
                st = proxmox.nodes(node).qemu(vmid).status.current.get()
                vm_item["status"] = st.get("status", "stopped")
                vm_item["cpu"] = round(st.get("cpu", 0) * 100, 1)
                vm_item["mem"] = round(st.get("mem", 0) / (1024 * 1024), 0)
                vm_item["maxmem"] = round(st.get("maxmem", 0) / (1024 * 1024), 0)
                vm_item["uptime"] = st.get("uptime", 0)
                if st.get("status") == "running":
                    ip_address = _get_guest_vlan_ip(proxmox, node, vmid)
                    if ip_address:
                        vm_item["ip_address"] = ip_address
            except Exception:
                vm_item["status"] = "not_created"

        vm_list.append(vm_item)

    return vm_list

def control_student_vm(vmid: int, action: str) -> Dict[str, Any]:
    """Bật / Tắt / Xóa sạch máy ảo sinh viên trên Proxmox"""
    # Chỉ cho phép thao tác trong dải VMID dành riêng cho sinh viên.
    if not (settings.STUDENT_VMID_MIN <= vmid <= settings.STUDENT_VMID_MAX):
        logger.warning(
            f"[SECURITY BLOCKED] Operation denied on VMID {vmid} outside allowed student range "
            f"({settings.STUDENT_VMID_MIN} - {settings.STUDENT_VMID_MAX})!"
        )
        return {
            "success": False, 
            "message": (
                f"SECURITY GUARD: Operation denied on VMID {vmid} outside student boundary "
                f"({settings.STUDENT_VMID_MIN} - {settings.STUDENT_VMID_MAX})!"
            )
        }

    node = settings.PVE_NODE
    proxmox = get_pve_client()
    if not proxmox:
        return {"success": False, "message": "Không thể kết nối Proxmox VE API"}

    try:
        if action == "start":
            proxmox.nodes(node).qemu(vmid).status.start.post()
            msg = f"Đã gửi lệnh bật máy ảo sinh viên {vmid}"
            logger.info(f"[VM_ORCHESTRATION] CONTROL | Action: START | VMID: {vmid}")
            return {"success": True, "message": msg}
        elif action == "stop":
            proxmox.nodes(node).qemu(vmid).status.stop.post()
            msg = f"Đã gửi lệnh tắt máy ảo sinh viên {vmid}"
            logger.info(f"[VM_ORCHESTRATION] CONTROL | Action: STOP | VMID: {vmid}")
            return {"success": True, "message": msg}
        elif action in ["purge", "delete"]:
            try:
                vm_stat = proxmox.nodes(node).qemu(vmid).status.current.get()
                if vm_stat.get("status") == "running":
                    logger.info(f"[VM_ORCHESTRATION] VM {vmid} is running, stopping before purge...")
                    stop_upid = proxmox.nodes(node).qemu(vmid).status.stop.post()
                    try:
                        _wait_for_pve_task(proxmox, node, stop_upid, f"stopping VM {vmid} for purge")
                    except Exception as stop_err:
                        logger.warning(f"Could not cleanly wait for stop on VM {vmid}: {stop_err}")
                        time.sleep(3)
            except Exception as stat_err:
                logger.warning(f"Failed to check status before purge on VM {vmid}: {stat_err}")
                try:
                    proxmox.nodes(node).qemu(vmid).status.stop.post()
                    time.sleep(2)
                except Exception:
                    pass

            destroy_upid = proxmox.nodes(node).qemu(vmid).delete(purge=1)
            try:
                _wait_for_pve_task(proxmox, node, destroy_upid, f"purging VM {vmid}")
            except Exception:
                pass

            msg = f"Đã xóa hoàn toàn máy ảo sinh viên {vmid} khỏi Proxmox cluster"
            logger.info(f"[VM_ORCHESTRATION] CONTROL | Action: PURGE | VMID: {vmid}")
            return {"success": True, "message": msg}
        else:
            return {"success": False, "message": "Hành động không hợp lệ"}
    except Exception as e:
        logger.error(f"[VM_ORCHESTRATION] CONTROL_ERROR on VMID {vmid} ({action}): {e}", exc_info=True)
        return {"success": False, "message": f"Lỗi thao tác máy ảo {vmid}: {str(e)}"}


def clean_orphaned_student_vms(active_lab_ids: List[int]) -> Dict[str, Any]:
    """
    Quét toàn bộ cluster Proxmox tìm và xóa sạch các máy ảo sinh viên
    có tiền tố lab-<id>-... mà lab_id không còn nằm trong active_lab_ids.
    Chỉ tác động trong dải STUDENT_VMID_MIN đến STUDENT_VMID_MAX.
    """
    proxmox = get_pve_client()
    if not proxmox:
        return {"success": False, "message": "Không thể kết nối Proxmox VE API", "purged_count": 0, "details": []}

    node = settings.PVE_NODE
    purged = []
    failed = []

    try:
        resources = proxmox.cluster.resources.get(type="vm")
        active_set = set(active_lab_ids)

        for res in resources:
            vmid = int(res.get("vmid", -1))
            vm_name = res.get("name", "")

            # Security Boundary Guard: Chỉ quét dải máy ảo sinh viên
            if not (settings.STUDENT_VMID_MIN <= vmid <= settings.STUDENT_VMID_MAX):
                continue

            # Kiểm tra tên định dạng: lab-{lab_id}-... hoặc lab-{lab_id}
            if vm_name.startswith("lab-"):
                parts = vm_name.split("-")
                if len(parts) >= 2 and parts[1].isdigit():
                    vm_lab_id = int(parts[1])
                    # Nếu lab không còn tồn tại trên hệ thống
                    if vm_lab_id not in active_set:
                        try:
                            logger.info(f"[ORPHAN_CLEANUP] Found orphaned VM {vmid} ('{vm_name}') for non-existent Lab {vm_lab_id}. Purging...")
                            res_control = control_student_vm(vmid, "purge")
                            if res_control.get("success"):
                                purged.append({"vmid": vmid, "name": vm_name, "lab_id": vm_lab_id})
                            else:
                                failed.append({"vmid": vmid, "name": vm_name, "error": res_control.get("message")})
                        except Exception as exc:
                            failed.append({"vmid": vmid, "name": vm_name, "error": str(exc)})

        return {
            "success": True,
            "message": f"Đã dọn dẹp thành công {len(purged)} máy ảo mồ côi." if purged else "Không phát hiện máy ảo mồ côi nào cần dọn dẹp.",
            "purged_count": len(purged),
            "purged": purged,
            "failed": failed
        }
    except Exception as e:
        logger.error(f"[ORPHAN_CLEANUP] Failed to scan or clean orphaned VMs: {e}", exc_info=True)
        return {"success": False, "message": f"Lỗi quét máy ảo: {str(e)}", "purged_count": 0, "details": []}


def capture_vm_screenshot(vmid: int) -> bytes:
    """
    Chụp ảnh màn hình máy ảo (QEMU screendump) trực tiếp từ Proxmox node và nén thành JPEG.
    """
    import subprocess
    import io
    from PIL import Image

    # Validate VMID boundary
    if not ((settings.STUDENT_VMID_MIN <= vmid <= settings.STUDENT_VMID_MAX) or (settings.TEMPLATE_VMID_MIN <= vmid <= settings.TEMPLATE_VMID_MAX) or (2100 <= vmid <= 2199)):
        raise ValueError(f"VMID {vmid} is outside allowed screenshot range")

    pve_cmd = f"TMP=$(mktemp /tmp/sc_XXXXXX.ppm); echo screendump $TMP | qm monitor {vmid} >/dev/null 2>&1; cat $TMP; rm -f $TMP"
    ssh_cmd = [
        "ssh", "-i", "/root/.ssh/id_pve_sync",
        "-o", "StrictHostKeyChecking=accept-new",
        "-o", "ConnectTimeout=8",
        f"root@{settings.PVE_API_HOST}",
        pve_cmd
    ]
    try:
        res = subprocess.run(ssh_cmd, capture_output=True, timeout=15)
        raw = res.stdout
        ppm_idx = raw.find(b"P6")
        if ppm_idx == -1:
            err_msg = res.stderr.decode("utf-8", errors="ignore")
            logger.error(f"[SCREENSHOT] PPM magic P6 not found for VM {vmid}. Stderr: {err_msg}")
            raise RuntimeError("Máy ảo chưa khởi động hoặc không thể chụp ảnh màn hình từ Proxmox.")
        
        ppm_data = raw[ppm_idx:]
        img = Image.open(io.BytesIO(ppm_data))
        out_buf = io.BytesIO()
        img.save(out_buf, format="JPEG", quality=88)
        return out_buf.getvalue()
    except subprocess.TimeoutExpired:
        raise RuntimeError("Yêu cầu chụp ảnh màn hình máy ảo quá thời gian chờ (15s)")
    except Exception as exc:
        logger.error(f"[SCREENSHOT] Error capturing screenshot for VM {vmid}: {exc}")
        raise RuntimeError(f"Lỗi chụp ảnh màn hình máy ảo: {str(exc)}")


def save_vm_screenshot_to_desktop(vmid: int, is_windows: bool = True) -> Dict[str, Any]:
    """
    Chụp ảnh màn hình máy ảo và lưu trực tiếp file ảnh vào Desktop bên trong máy ảo.
    - Không tải file ra ngoài máy thật.
    - Giữ trọn vẹn an toàn sandbox khi chế độ chặn copy (disable_vm_copy) được bật.
    """
    import subprocess
    import base64
    import time

    jpg_bytes = capture_vm_screenshot(vmid)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    filename = f"Screenshot_{timestamp}.jpg"
    b64_str = base64.b64encode(jpg_bytes).decode("ascii")

    if is_windows:
        # Lưu vào Desktop của user đang đăng nhập (hoặc C:\Users\admin\Desktop)
        ps_script = f"""
$u = (Get-Process explorer -IncludeUserName -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty UserName)
if ($u -and $u -match '\\\\(.+)') {{ $name = $matches[1] }} else {{ $name = 'admin' }}
$desk = Join-Path 'C:\\Users' (Join-Path $name 'Desktop')
if (-not (Test-Path -LiteralPath $desk)) {{ $desk = 'C:\\Users\\admin\\Desktop' }}
$dest = Join-Path $desk '{filename}'
[System.IO.File]::WriteAllBytes($dest, [System.Convert]::FromBase64String([Console]::In.ReadToEnd()))
"""
        ps_b64 = base64.b64encode(ps_script.encode("utf-16le")).decode("ascii")
        pve_exec_cmd = f"qm guest exec {vmid} --pass-stdin 1 powershell -- -NoProfile -EncodedCommand {ps_b64}"
    else:
        # Lưu vào Desktop Linux (/home/*/Desktop hoặc /root/Desktop)
        sh_cmd = f"cat - | base64 -d > ~/Desktop/{filename} 2>/dev/null || cat - | base64 -d > /tmp/{filename}"
        pve_exec_cmd = f"qm guest exec {vmid} --pass-stdin 1 -- sh -c \"{sh_cmd}\""

    remote_ssh = [
        "ssh", "-i", "/root/.ssh/id_pve_sync",
        "-o", "StrictHostKeyChecking=accept-new",
        "-o", "ConnectTimeout=10",
        f"root@{settings.PVE_API_HOST}",
        pve_exec_cmd
    ]
    try:
        res = subprocess.run(remote_ssh, input=b64_str, capture_output=True, text=True, timeout=20)
        logger.info(f"[SCREENSHOT] Saved {filename} to VM {vmid} Desktop. Output: {res.stdout.strip()}")
        return {
            "success": True,
            "filename": filename,
            "saved_location": f"Desktop\\{filename}",
            "size_bytes": len(jpg_bytes),
            "message": f"Đã chụp và lưu ảnh vào Desktop của máy ảo ({filename})"
        }
    except Exception as exc:
        logger.error(f"[SCREENSHOT] Failed to save screenshot into VM {vmid}: {exc}")
        raise RuntimeError(f"Lỗi ghi ảnh vào máy ảo: {str(exc)}")


def backup_vm_workspace(vmid: int, student_username: str, lab_id: int) -> Optional[str]:
    """
    Sao lưu toàn bộ thư mục C:\\Users\\<Student>\\Desktop\\Exam_Workspace từ VM về server MalSec.
    Dùng khi sinh viên bấm Rollback VM hoặc nộp bài thi.
    Trả về đường dẫn file zip trên server nếu có dữ liệu bài làm, hoặc None nếu rỗng.
    """
    import os
    import json
    import base64
    import subprocess

    ps_script = """
$u = (Get-Process explorer -IncludeUserName -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty UserName)
if ($u -and $u -match '\\\\(.+)') { $name = $matches[1] } else { $name = 'admin' }
$desk = Join-Path 'C:\\Users' (Join-Path $name 'Desktop')
if (-not (Test-Path -LiteralPath $desk)) { $desk = 'C:\\Users\\admin\\Desktop' }
$ws = Join-Path $desk 'Exam_Workspace'
if (Test-Path -LiteralPath $ws) {
    $files = Get-ChildItem -LiteralPath $ws -Recurse -File | Where-Object { $_.Name -notin @('Instructions.txt', 'HuongDan_NopBai.txt') }
    if ($files -and $files.Count -gt 0) {
        $zipPath = "C:\\Windows\\Temp\\ws_backup_$((Get-Date).Ticks).zip"
        if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
        Compress-Archive -Path "$ws\\*" -DestinationPath $zipPath -Force
        if (Test-Path -LiteralPath $zipPath) {
            $bytes = [System.IO.File]::ReadAllBytes($zipPath)
            Remove-Item -LiteralPath $zipPath -Force
            [System.Convert]::ToBase64String($bytes)
        } else {
            Write-Output "ZIP_FAILED"
        }
    } else {
        Write-Output "EMPTY_WORKSPACE"
    }
} else {
    New-Item -ItemType Directory -Path $ws -Force | Out-Null
    Write-Output "NO_WORKSPACE"
}
"""
    ps_b64 = base64.b64encode(ps_script.encode("utf-16le")).decode("ascii")
    pve_exec_cmd = f"qm guest exec {vmid} --pass-stdin 1 powershell -- -NoProfile -EncodedCommand {ps_b64}"
    remote_ssh = [
        "ssh", "-i", "/root/.ssh/id_pve_sync",
        "-o", "StrictHostKeyChecking=accept-new",
        "-o", "ConnectTimeout=10",
        f"root@{settings.PVE_API_HOST}",
        pve_exec_cmd
    ]
    try:
        res = subprocess.run(remote_ssh, input="", capture_output=True, text=True, timeout=40)
        out_raw = res.stdout.strip()
        data = json.loads(out_raw) if out_raw.startswith("{") else {}
        out_data = data.get("out-data", "").strip()

        if not out_data or out_data in ("EMPTY_WORKSPACE", "NO_WORKSPACE", "ZIP_FAILED"):
            logger.info(f"[EXAM_WORKSPACE] VM {vmid} workspace status: {out_data or 'empty'}")
            return None

        # out_data chứa chuỗi base64 của file zip
        zip_bytes = base64.b64decode(out_data)
        if len(zip_bytes) < 50:
            return None

        backup_dir = os.path.join(settings.UPLOAD_DIR, "exam_workspaces", f"lab_{lab_id}")
        os.makedirs(backup_dir, exist_ok=True)
        backup_path = os.path.join(backup_dir, f"student_{student_username}_workspace.zip")
        with open(backup_path, "wb") as f:
            f.write(zip_bytes)

        logger.info(f"[EXAM_WORKSPACE] Successfully backed up {len(zip_bytes)} bytes for {student_username} on Lab {lab_id} to {backup_path}")
        return backup_path
    except Exception as e:
        logger.error(f"[EXAM_WORKSPACE] Error backing up workspace from VM {vmid}: {e}")
        return None


def restore_vm_workspace(vmid: int, student_username: str, lab_id: int) -> bool:
    """
    Phục hồi thư mục Exam_Workspace từ server MalSec vào VM sau khi rollback hoặc khi khởi động.
    Nếu chưa có backup, tự động tạo sẵn thư mục Exam_Workspace trên Desktop kèm file hướng dẫn.
    """
    import os
    import json
    import base64
    import subprocess

    backup_path = os.path.join(settings.UPLOAD_DIR, "exam_workspaces", f"lab_{lab_id}", f"student_{student_username}_workspace.zip")
    zip_b64 = ""
    if os.path.exists(backup_path):
        try:
            with open(backup_path, "rb") as f:
                zip_b64 = base64.b64encode(f.read()).decode("ascii")
        except Exception as read_err:
            logger.warning(f"[EXAM_WORKSPACE] Failed to read backup file {backup_path}: {read_err}")

    ps_script = """
$b64 = [Console]::In.ReadToEnd().Trim()
$u = (Get-Process explorer -IncludeUserName -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty UserName)
if ($u -and $u -match '\\\\(.+)') { $name = $matches[1] } else { $name = 'admin' }
$desk = Join-Path 'C:\\Users' (Join-Path $name 'Desktop')
if (-not (Test-Path -LiteralPath $desk)) { $desk = 'C:\\Users\\admin\\Desktop' }
$ws = Join-Path $desk 'Exam_Workspace'
if (-not (Test-Path -LiteralPath $ws)) { New-Item -ItemType Directory -Path $ws -Force | Out-Null }

if ($b64.Length -gt 50) {
    $tempZip = "C:\\Windows\\Temp\\ws_restore_$((Get-Date).Ticks).zip"
    try {
        [System.IO.File]::WriteAllBytes($tempZip, [System.Convert]::FromBase64String($b64))
        Expand-Archive -LiteralPath $tempZip -DestinationPath $ws -Force
        Remove-Item -LiteralPath $tempZip -Force
        Write-Output "RESTORED_OK"
    } catch {
        Write-Output "RESTORE_ERROR: $_"
    }
} else {
    Write-Output "INITIALIZED_DIR"
}

$hdPath = Join-Path $ws 'Instructions.txt'
if (-not (Test-Path -LiteralPath $hdPath)) {
    $guide = @"
MALSEC EXAM WORKSPACE
===============================================================
Please save your exam report (.docx) and any practical analysis
files directly inside this directory (Exam_Workspace).

IMPORTANT NOTES:
- You may click "Rollback Clean VM" on the MalSec toolbar anytime.
  The system will automatically backup this folder and restore it
  intact when the clean VM starts.
- When finished, click the green "Submit Exam Report" icon on the
  MalSec toolbar to submit your Word report to your instructor.
===============================================================
"@
    Set-Content -LiteralPath $hdPath -Value $guide -Encoding UTF8
}
"""
    ps_b64 = base64.b64encode(ps_script.encode("utf-16le")).decode("ascii")
    pve_exec_cmd = f"qm guest exec {vmid} --pass-stdin 1 powershell -- -NoProfile -EncodedCommand {ps_b64}"
    remote_ssh = [
        "ssh", "-i", "/root/.ssh/id_pve_sync",
        "-o", "StrictHostKeyChecking=accept-new",
        "-o", "ConnectTimeout=10",
        f"root@{settings.PVE_API_HOST}",
        pve_exec_cmd
    ]
    try:
        res = subprocess.run(remote_ssh, input=zip_b64, capture_output=True, text=True, timeout=40)
        logger.info(f"[EXAM_WORKSPACE] Restored/Initialized workspace for {student_username} on VM {vmid}. Output: {res.stdout.strip()}")
        return True
    except Exception as e:
        logger.error(f"[EXAM_WORKSPACE] Error restoring workspace into VM {vmid}: {e}")
        return False





