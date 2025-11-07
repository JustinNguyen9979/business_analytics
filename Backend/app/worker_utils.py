# FILE: Backend/app/worker_utils.py

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from contextlib import contextmanager

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL is None:
    raise ValueError("Biến môi trường DATABASE_URL chưa được thiết lập!")

# Tạo engine và session factory một lần duy nhất khi module này được import
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@contextmanager
def get_db_session():
    """
    Cung cấp một session DB cho worker và tự động đóng nó.
    Đây là một "context manager", đảm bảo session luôn được đóng đúng cách.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()