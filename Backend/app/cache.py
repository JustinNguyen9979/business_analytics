# FILE: backend/app/cache.py

import redis
import os

# Lấy thông tin host từ biến môi trường nếu có, mặc định là 'cache'
REDIS_HOST = os.getenv("REDIS_HOST", "cache")
# <<< Lấy mật khẩu Redis từ biến môi trường >>>
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")

# <<< Thêm tham số `password` vào kết nối >>>
redis_client = redis.Redis(
    host=REDIS_HOST, 
    port=6379, 
    db=0, 
    decode_responses=True,
    password=REDIS_PASSWORD
)

print("Đã kết nối đến Redis server.")