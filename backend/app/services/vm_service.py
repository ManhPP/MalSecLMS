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
from typing import Tuple, Dict, Any, List
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from app.config import settings


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


def _find_student_vm(resources, student_username: str, lab_id: int):
    """Find only the VM whose name proves it belongs to this student and lab."""
    expected_name = _student_vm_name(student_username, lab_id)
    matches = [item for item in resources if item.get("name") == expected_name]
    if len(matches) > 1:
        raise VMProvisionError(
            f"Multiple Proxmox VMs have the ownership name {expected_name}"
        )
    return matches[0] if matches else None


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
) -> Tuple[str, int]:
    """
    1. Kiểm tra xem sinh viên đã có máy ảo cho bài lab này chưa.
    2. Nếu chưa có, clone từ template.
    3. Gán MAC riêng và lấy IP DHCP thật qua QEMU Guest Agent.
    4. Bật máy ảo.
    """
    node = settings.PVE_NODE
    proxmox = get_pve_client()
    if not proxmox:
        raise VMProvisionError("Cannot connect to the Proxmox API")
    new_vmid = _preferred_student_vmid(student_username, lab_id)

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

            print(
                f"[+] Cloning source VM {template_vmid} to VM {new_vmid} "
                f"for {student_username}...",
                flush=True,
            )
            source_config = proxmox.nodes(node).qemu(template_vmid).config.get()
            source_net0 = source_config.get("net0")
            if not source_net0:
                raise VMProvisionError(f"Source VM {template_vmid} has no net0 adapter")

            clone_upid = proxmox.nodes(node).qemu(template_vmid).clone.post(
                newid=new_vmid,
                name=_student_vm_name(student_username, lab_id),
                full=1,
            )
            _wait_for_pve_task(
                proxmox,
                node,
                clone_upid,
                f"cloning source VM {template_vmid} to VM {new_vmid}",
            )

            proxmox.nodes(node).qemu(new_vmid).config.post(
                net0=_net0_with_unique_mac(source_net0),
                agent="enabled=1",
            )

        status = proxmox.nodes(node).qemu(new_vmid).status.current.get()
        if status.get("status") != "running":
            print(f"[+] Starting VM {new_vmid}...", flush=True)
            start_upid = proxmox.nodes(node).qemu(new_vmid).status.start.post()
            _wait_for_pve_task(proxmox, node, start_upid, f"starting VM {new_vmid}")

        ip_address = _wait_for_guest_vlan_ip(proxmox, node, new_vmid)
        if settings.VM_VERIFY_CONNECTION:
            _wait_for_connection(ip_address, new_vmid, protocol, port)
        else:
            print(
                f"[+] Waiting {settings.VM_BOOT_WAIT_SECONDS}s for guest VM "
                f"{new_vmid} to finish booting...",
                flush=True,
            )
            time.sleep(settings.VM_BOOT_WAIT_SECONDS)
    except VMProvisionError:
        raise
    except Exception as exc:
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
    return url

def rollback_student_vm(student_username: str, lab_id: int) -> bool:
    """Tắt và xóa VM của sinh viên để clone lại từ đầu ở lần đăng nhập tới"""
    node = settings.PVE_NODE

    
    proxmox = get_pve_client()
    if not proxmox:
        raise VMProvisionError("Cannot connect to the Proxmox API")
    new_vmid = _preferred_student_vmid(student_username, lab_id)

    try:
        resources = proxmox.cluster.resources.get(type="vm")
        existing_vm = _find_student_vm(resources, student_username, lab_id)
        if not existing_vm:
            return True
        new_vmid = int(existing_vm["vmid"])

        status = proxmox.nodes(node).qemu(new_vmid).status.current.get()
        if status.get("status") == "running":
            print(f"[+] Stopping VM {new_vmid} for rollback...", flush=True)
            stop_upid = proxmox.nodes(node).qemu(new_vmid).status.stop.post()
            _wait_for_pve_task(proxmox, node, stop_upid, f"stopping VM {new_vmid}")

        print(f"[+] Destroying VM {new_vmid} for rollback...", flush=True)
        destroy_upid = proxmox.nodes(node).qemu(new_vmid).delete(purge=1)
        _wait_for_pve_task(proxmox, node, destroy_upid, f"destroying VM {new_vmid}")
        print(f"[+] VM {new_vmid} purged successfully from Proxmox!", flush=True)
        return True
    except VMProvisionError:
        raise
    except Exception as exc:
        raise VMProvisionError(f"Rollback failed for VM {new_vmid}: {exc}") from exc


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
        print(
            f"[SECURITY BLOCKED] Từ chối thao tác trên VMID {vmid} ngoài dải "
            f"sinh viên ({settings.STUDENT_VMID_MIN} - {settings.STUDENT_VMID_MAX})!"
        )
        return {
            "success": False, 
            "message": (
                f"BẢO VỆ AN TOÀN HỆ THỐNG: từ chối thao tác VMID {vmid} "
                f"ngoài dải {settings.STUDENT_VMID_MIN} - {settings.STUDENT_VMID_MAX}!"
            )
        }

    node = settings.PVE_NODE
    proxmox = get_pve_client()
    if not proxmox:
        return {"success": False, "message": "Không thể kết nối Proxmox VE API"}

    try:
        if action == "start":
            proxmox.nodes(node).qemu(vmid).status.start.post()
            return {"success": True, "message": f"Đã gửi lệnh bật máy ảo sinh viên {vmid}"}
        elif action == "stop":
            proxmox.nodes(node).qemu(vmid).status.stop.post()
            return {"success": True, "message": f"Đã gửi lệnh tắt máy ảo sinh viên {vmid}"}
        elif action in ["purge", "delete"]:
            try:
                proxmox.nodes(node).qemu(vmid).status.stop.post()
                time.sleep(2)
            except Exception:
                pass
            proxmox.nodes(node).qemu(vmid).delete(purge=1)
            return {"success": True, "message": f"Đã xóa hoàn toàn máy ảo sinh viên {vmid} khỏi Proxmox cluster"}
        else:
            return {"success": False, "message": "Hành động không hợp lệ"}
    except Exception as e:
        return {"success": False, "message": f"Lỗi thao tác máy ảo {vmid}: {str(e)}"}


