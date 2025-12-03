from slowapi import Limiter
from slowapi.util import get_remote_address
import os

# Lấy thông tin Redis giống như trong cache.py
REDIS_HOST = os.getenv("REDIS_HOST", "cache")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")

# Tạo chuỗi kết nối Redis chuẩn (URI)
# Format: redis://[:password@]host:port/db
if REDIS_PASSWORD:
    REDIS_URL = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:6379/0"
else:
    REDIS_URL = f"redis://{REDIS_HOST}:6379/0"

# Khởi tạo Limiter
# key_func=get_remote_address: Giới hạn dựa trên địa chỉ IP của người gọi
limiter = Limiter(key_func=get_remote_address, storage_uri=REDIS_URL, default_limits=["60/minute"])
