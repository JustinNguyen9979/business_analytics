import redis
import os

# Lấy thông tin host từ biến môi trường nếu có, mặc định là 'cache'
REDIS_HOST = os.getenv("REDIS_HOST", "cache")

# Kết nối đến Redis service trong Docker
# decode_responses=True giúp kết quả trả về từ Redis là string thay vì bytes
redis_client = redis.Redis(host=REDIS_HOST, port=6379, db=0, decode_responses=True)

print("Đã kết nối đến Redis server.")