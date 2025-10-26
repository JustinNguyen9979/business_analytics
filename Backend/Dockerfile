# FILE: backend/Dockerfile (PHIÊN BẢN HOÀN CHỈNH)

FROM python:3.9-slim

# Thiết lập thư mục làm việc là /app
WORKDIR /app

# Sao chép file requirements.txt vào /app
# Lưu ý: file này nằm ở thư mục gốc của context (tức là backend/)
COPY requirements.txt .

# Cài đặt các thư viện
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Sao chép TOÀN BỘ NỘI DUNG của thư mục app (tức là backend/app/*)
# vào thư mục làm việc hiện tại (/app)
COPY ./app .