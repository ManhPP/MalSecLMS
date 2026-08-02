import json
import os
import time
import hmac
import hashlib
import base64
import urllib.parse
from typing import Tuple, Dict, Any, List
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import padding
from app.config import settings


def get_pve_client():
    """Khởi tạo kết nối Proxmox API qua thư viện proxmoxer"""
    try:
        from proxmoxer import ProxmoxAPI
        if settings.PVE_TOKEN_VALUE and settings.PVE_TOKEN_VALUE != "mock_pve_token_value_2026":
            return ProxmoxAPI(
                settings.PVE_API_HOST,
                user=settings.PVE_API_USER,
                token_name=settings.PVE_TOKEN_NAME,
                token_value=settings.PVE_TOKEN_VALUE,
                verify_ssl=False,
                timeout=60
            )
    except Exception as e:
        print(f"[!] Warning: Could not initialize ProxmoxAPI client: {e}")
    return None

def provision_student_vm(student_username: str, lab_id: int, template_vmid: int = 101) -> Tuple[str, int]:
    """
    1. Kiểm tra xem sinh viên đã có máy ảo cho bài lab này chưa.
    2. Nếu chưa có, clone từ template.
    3. Đồng bộ MAC address để tự động gán đúng IP 10.30.0.100 trong VLAN 30.
    4. Bật máy ảo.
    """
    node = "pve01"
    student_num = int("".join(filter(str.isdigit, student_username)) or "1")
    new_vmid = 30000 + (student_num * 50) + lab_id
    
    proxmox = get_pve_client()
    ip_address = None

    if proxmox:
        try:
            # 1. Kiểm tra VM tồn tại
            vm_exists = False
            try:
                proxmox.nodes(node).qemu(new_vmid).status.current.get()
                vm_exists = True
            except Exception:
                vm_exists = False
                
            if not vm_exists:
                print(f"[+] Cloning template {template_vmid} to new VM {new_vmid} for {student_username}...")
                template_net0 = None
                try:
                    tpl_cfg = proxmox.nodes(node).qemu(template_vmid).config.get()
                    template_net0 = tpl_cfg.get("net0")
                except Exception:
                    pass

                try:
                    proxmox.nodes(node).qemu(template_vmid).clone.post(
                        newid=new_vmid,
                        name=f"lab-{lab_id}-{student_username}",
                        full=1
                    )
                except Exception as clone_err:
                    print(f"[!] Full clone failed, trying default clone: {clone_err}")
                    proxmox.nodes(node).qemu(template_vmid).clone.post(
                        newid=new_vmid,
                        name=f"lab-{lab_id}-{student_username}"
                    )
                
                # Chờ cho đến khi Proxmox nhả lock disk clone
                print(f"[+] Waiting for VM {new_vmid} disk clone to finish...")
                for _ in range(20):
                    try:
                        st = proxmox.nodes(node).qemu(new_vmid).status.current.get()
                        if not st.get("lock"):
                            break
                    except Exception:
                        pass
                    time.sleep(2)

                # Đồng bộ MAC address từ template để Windows tự động giữ nguyên IP tĩnh 10.30.0.100
                if template_net0:
                    try:
                        print(f"[+] Setting net0={template_net0} on VM {new_vmid}...")
                        proxmox.nodes(node).qemu(new_vmid).config.post(net0=template_net0)
                        print(f"[+] Successfully set MAC on VM {new_vmid}!")
                    except Exception as mac_err:
                        print(f"[!] Warning setting MAC on VM {new_vmid}: {mac_err}")


            # 2. Bật máy ảo nếu chưa chạy
            status = proxmox.nodes(node).qemu(new_vmid).status.current.get()
            if status.get("status") != "running":
                print(f"[+] Starting VM {new_vmid}...")
                proxmox.nodes(node).qemu(new_vmid).status.start.post()
                time.sleep(4)


            # 3. Lấy IP từ QEMU Guest Agent
            try:
                interfaces = proxmox.nodes(node).qemu(new_vmid).agent.network_get_interfaces.get()
                for interface in interfaces.get("result", []):
                    if interface.get("name") != "lo":
                        for ip_info in interface.get("ip-addresses", []):
                            ip = ip_info.get("ip-address")
                            if ip and ip.startswith("10.30.0."):
                                ip_address = ip
                                break
            except Exception:
                pass
        except Exception as e:
            print(f"[!] Error in Proxmox API operation: {e}")

    # Fallback IP nếu chưa lấy được qua Guest Agent hoặc chạy trên môi trường test
    if not ip_address:
        ip_address = "10.30.0.100"

    print(f"[VM-SESSION] Provisioned VM vmid={new_vmid} ip={ip_address}", flush=True)

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
    student_username: str = "sv01",
    protocol: str = "rdp", 
    username: str = "win1", 
    password: str = "KhongQuanLieu"
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
    secret_str = getattr(settings, "GUAC_JSON_SECRET", getattr(settings, "GUAC_HMAC_SECRET", "545361e2e0cdc7a516ad17d27b1ba77c")).strip()
    key = get_guacamole_secret_bytes(secret_str)
    if len(key) not in (16, 24, 32):
        key = hashlib.sha256(key).digest()
    
    expires_ms = int((time.time() + 86400) * 1000) # Hạn 24 giờ
    session_ts = int(time.time())  # Timestamp để tạo connection_name duy nhất mỗi phiên
    connection_name = f"Lab-VM-{student_username}-{session_ts}"
    

    payload = {
        "username": student_username,
        "expires": expires_ms,
        "connections": {
            connection_name: {
                "protocol": protocol,
                "parameters": {
                    "hostname": ip_address,
                    "port": "3389",
                    "username": username,
                    "password": password,
                    "ignore-cert": "true"

                }
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







def generate_guacamole_hmac_url(
    ip_address: str, 
    protocol: str = "rdp", 
    username: str = "administrator", 
    password: str = "infected"
) -> str:
    """
    Sinh URL kết nối Apache Guacamole mã hóa theo chuẩn guacamole-auth-hmac (Hỗ trợ tương thích ngược).
    """
    timestamp = str(int(time.time() * 1000))
    secret = settings.GUAC_HMAC_SECRET.encode('utf-8')
    
    params = {
        "guac.protocol": protocol,
        "guac.hostname": ip_address,
        "guac.port": "3389" if protocol == "rdp" else "5900",
        "guac.username": username,
        "guac.password": password,
        "guac.security": "any",
        "guac.ignore-cert": "true",
        "guac.width": "1920",
        "guac.height": "1080",
        "guac.dpi": "96"
    }
    
    canonical_str = timestamp + protocol
    for key in sorted(params.keys()):
        param_name = key[5:] if key.startswith("guac.") else key
        canonical_str += param_name + params[key]
        
    signature = hmac.new(secret, canonical_str.encode('utf-8'), hashlib.sha256).digest()
    signature_b64 = base64.b64encode(signature).decode('utf-8')
    
    query_params = [
        "id=HMAC",
        f"timestamp={timestamp}",
        f"signature={signature_b64}"
    ]
    for key, val in params.items():
        query_params.append(f"{key}={val}")
        
    url = f"{settings.GUAC_BASE_URL}#/client/HMAC?{'&'.join(query_params)}"
    return url


def rollback_student_vm(student_username: str, lab_id: int) -> bool:
    """Tắt và xóa VM của sinh viên để clone lại từ đầu ở lần đăng nhập tới"""
    student_num = int("".join(filter(str.isdigit, student_username)) or "1")
    new_vmid = 30000 + (student_num * 50) + lab_id
    node = "pve01"
    
    proxmox = get_pve_client()
    if proxmox:
        try:
            # Kiểm tra xem VM có tồn tại không
            try:
                status = proxmox.nodes(node).qemu(new_vmid).status.current.get()
                if status:
                    print(f"[+] Stopping VM {new_vmid} for rollback...")
                    try:
                        proxmox.nodes(node).qemu(new_vmid).status.stop.post()
                        time.sleep(3)
                    except Exception:
                        pass
                    print(f"[+] Destroying VM {new_vmid} for fresh clone...")
                    try:
                        proxmox.nodes(node).qemu(new_vmid).delete(purge=1)
                    except Exception as del_err:
                        print(f"[!] Delete VM {new_vmid} call error: {del_err}")
                    
                    # Chờ cho đến khi Proxmox xóa sạch hoàn toàn VM khỏi hệ thống
                    for _ in range(15):
                        try:
                            proxmox.nodes(node).qemu(new_vmid).status.current.get()
                            time.sleep(1)
                        except Exception:
                            print(f"[+] VM {new_vmid} purged successfully from Proxmox!")
                            break
            except Exception as vm_not_found:
                print(f"[!] VM {new_vmid} does not exist or already deleted: {vm_not_found}")
            return True

        except Exception as e:
            print(f"[!] Error rolling back VM {new_vmid}: {e}")
    return True


def get_available_templates() -> List[Dict[str, Any]]:
    """Lấy danh sách các VM Template khả dụng trên Proxmox"""
    proxmox = get_pve_client()
    templates = []
    if proxmox:
        try:
            resources = proxmox.cluster.resources.get(type="vm")
            for res in resources:
                if res.get("template") == 1:
                    templates.append({
                        "vmid": res.get("vmid"),
                        "name": res.get("name"),
                        "status": res.get("status")
                    })
        except Exception as e:
            print(f"[!] Error fetching PVE templates: {e}")
            
    if not templates:
        # Fallback danh sách template chuẩn của Malware Lab
        templates = [
            {"vmid": 101, "name": "Win-1 (Windows 10 Sandbox)", "status": "template"},
            {"vmid": 104, "name": "Win10 (Custom FLARE-VM)", "status": "template"}
        ]
    return templates
