# MalSec - Monitoring & Log Tracking Guide

Hệ thống theo dõi log và giám sát container cho MalSec LMS sử dụng **Dozzle**.

## 🚀 Khởi chạy / Dừng hệ thống Monitor

```bash
# Khởi chạy Dozzle chạy nền
docker compose -f docker-compose.monitoring.yml up -d

# Xem log của Dozzle
docker compose -f docker-compose.monitoring.yml logs -f

# Dừng Dozzle
docker compose -f docker-compose.monitoring.yml down
```

## 🔐 Tài khoản đăng nhập
- **URL nội bộ**: `http://10.0.80.55:8888` hoặc qua SSH tunnel `http://localhost:8888`
- **Username**: `admin`
- **Mật khẩu**: Khởi tạo theo `monitoring/data/users.yml`

## 🌐 Cách truy cập an toàn từ máy tính cá nhân (SSH Tunnel)
Nếu máy bạn không ở cùng dải mạng nội bộ `10.0.80.0/24`:
Mở terminal trên máy Windows/Mac và chạy:
```powershell
ssh -N -L 8888:localhost:8888 ubuntu-105
```
Sau đó mở trình duyệt truy cập: **`http://localhost:8888`**

## 🛠️ Đổi mật khẩu hoặc tạo user mới
```bash
docker run --rm amir20/dozzle:latest generate --name "Admin" --password "MatKhauMoi" admin > monitoring/data/users.yml
docker restart malsec-dozzle
```
