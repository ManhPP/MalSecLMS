FROM python:3.11-slim

WORKDIR /app

# Cài đặt các gói hệ thống cần thiết cho psycopg2 và nén/giải nén
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Sao chép và cài đặt các thư viện Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Tạo thư mục lưu file upload của sinh viên
RUN mkdir -p /app/uploads

# Sao chép toàn bộ mã nguồn backend
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
