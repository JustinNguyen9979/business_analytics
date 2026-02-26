import os
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from dotenv import load_dotenv

load_dotenv()

# Cấu hình băm mật khẩu
# Thêm truncate=True để xử lý giới hạn 72 chars của bcrypt và tránh lỗi ValueError
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Cấu hình JWT
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-fallback")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 43200)) # 30 ngày

def verify_password(plain_password, hashed_password):
    """Kiểm tra mật khẩu khớp với bản băm"""
    # Encode sang bytes, cắt 72 bytes, rồi decode ngược lại thành string để passlib xử lý an toàn
    safe_password = plain_password.encode('utf-8')[:72].decode('utf-8', 'ignore')
    return pwd_context.verify(safe_password, hashed_password)

def get_password_hash(password):
    """Băm mật khẩu để lưu vào DB"""
    # Encode sang bytes, cắt 72 bytes, rồi decode ngược lại thành string để passlib xử lý an toàn
    safe_password = password.encode('utf-8')[:72].decode('utf-8', 'ignore')
    return pwd_context.hash(safe_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Tạo Token JWT"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    # role sẽ được lấy từ data dict truyền vào
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt
