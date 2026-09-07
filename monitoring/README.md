# MalSec - Monitoring & Log Analytics Guide

Hệ thống giám sát và phân tích log toàn diện cho MalSec LMS:
- **Dozzle**: Trình xem log thời gian thực siêu nhẹ (Live Docker Log Viewer).
- **Grafana + Loki + Promtail**: Hệ thống lưu trữ, tìm kiếm chuyên sâu (LogQL), vẽ biểu đồ và phân tích an ninh.

---

## 🚀 Khởi chạy / Dừng hệ thống Monitor

```bash
# Khởi chạy toàn bộ cụm Monitoring (Dozzle, Loki, Promtail, Grafana)
docker compose -p malsec-monitoring -f docker-compose.monitoring.yml up -d

# Xem log các service giám sát
docker compose -p malsec-monitoring -f docker-compose.monitoring.yml logs -f

# Dừng toàn bộ cụm Monitoring
docker compose -p malsec-monitoring -f docker-compose.monitoring.yml down
```

---

## 🌐 Các cổng dịch vụ & Cách truy cập

### 1. Dozzle (Live Log Viewer - Siêu nhẹ)
- **Cổng**: `8888`
- **Truy cập nội bộ**: `http://10.0.80.55:8888`
- **Truy cập qua SSH Tunnel**:
  ```powershell
  ssh -N -L 8888:localhost:8888 ubuntu-105
  ```
  Truy cập: `http://localhost:8888`
- **Tài khoản**: `admin` / `KhongQuanLieu`

### 2. Grafana (Dashboard & LogQL chuyên sâu)
- **Cổng**: `3000`
- **Truy cập nội bộ**: `http://10.0.80.55:3000`
- **Truy cập qua SSH Tunnel**:
  ```powershell
  ssh -N -L 3000:localhost:3000 ubuntu-105
  ```
  Truy cập: `http://localhost:3000`
- **Tài khoản**: `admin` / `KhongQuanLieu`

---

## 🔍 Hướng dẫn truy vấn LogQL trong Grafana Explore

Vào mục **Explore** (biểu tượng la bàn) trong Grafana, chọn Datasource **Loki**:

1. **Xem toàn bộ log Backend**:
   ```logql
   {container="malsec-backend"}
   ```
2. **Lọc tất cả lỗi HTTP 4xx hoặc 5xx**:
   ```logql
   {container="malsec-backend"} |~ "(4[0-9]{2}|5[0-9]{2})"
   ```
3. **Lọc thao tác của một sinh viên cụ thể**:
   ```logql
   {container="malsec-backend"} |= "HE201163"
   ```
4. **Lọc tất cả các Action quan trọng (Login, VM, Nộp bài, Chấm điểm)**:
   ```logql
   {container="malsec-backend"} |= "[ACTION]"
   ```
5. **Lọc các cảnh báo an ninh (Đăng nhập sai, tài khoản bị khóa)**:
   ```logql
   {container="malsec-backend"} |= "[SECURITY]"
   ```
6. **Vẽ biểu đồ số lượng request theo thời gian**:
   ```logql
   rate({container="malsec-backend"}[1m])
   ```
