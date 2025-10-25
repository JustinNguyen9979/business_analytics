# Sử dụng một ảnh Python chính thức làm nền
FROM python:3.9-slim

# Thiết lập thư mục làm việc bên trong container
WORKDIR /code

# Sao chép file requirements và cài đặt các thư viện
COPY ./requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /app/requirements.txt

# Sao chép toàn bộ code từ thư mục hiện tại vào thư mục /app trong container
COPY ./app /app