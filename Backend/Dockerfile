# FILE: Backend/Dockerfile (PHIÊN BẢN CÓ CÔNG CỤ BIÊN DỊCH)

FROM python:3.10-slim

# === PHẦN SỬA ĐỔI BẮT ĐẦU ===

# Chuyển sang user root để có quyền cài đặt
USER root

# Cài đặt các gói cần thiết cho việc biên dịch
# - build-essential: Chứa các công cụ cơ bản như gcc, make
# - python3-dev: Chứa các header file của Python cần cho việc biên dịch các extension C
# - libffi-dev: Một thư viện phụ thuộc của gevent
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# === PHẦN SỬA ĐỔI KẾT THÚC ===

# Thiết lập thư mục làm việc là /app
WORKDIR /app

# Sao chép file requirements.txt vào /app
COPY requirements.txt .

# Cài đặt các thư viện Python
# Lệnh này giờ sẽ chạy thành công vì đã có công cụ biên dịch
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Sao chép toàn bộ code ứng dụng
COPY ./app .