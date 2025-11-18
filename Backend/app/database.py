import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Code sẽ đọc biến môi trường DATABASE_URL được truyền từ docker-compose
DATABASE_URL = os.getenv("DATABASE_URL")

# Đoạn code kiểm tra để đảm bảo biến môi trường đã được thiết lập
if DATABASE_URL is None:
    raise ValueError("Biến môi trường DATABASE_URL chưa được thiết lập!")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
engine = create_engine(
    DATABASE_URL,
    pool_size=20,       # Tăng số lượng kết nối thường trực (mặc định là 5)
    max_overflow=10,    # Số kết nối được phép tràn khi cao điểm
    pool_pre_ping=True  # Kiểm tra kết nối sống trước khi dùng
)