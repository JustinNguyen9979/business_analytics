# FILE: backend/app/celery_worker.py (PHIÊN BẢN CÓ LỊCH TRÌNH ĐỊNH KỲ)

import os
from celery import Celery
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import crud
from cache import redis_client

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL is None:
    raise ValueError("Biến môi trường DATABASE_URL chưa được thiết lập!")

celery_app = Celery('tasks', broker='redis://cache:6379/0', backend='redis://cache:6379/0')
celery_app.conf.update(task_serializer='json', accept_content=['json'], result_serializer='json', timezone='UTC', enable_utc=True)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# === THÊM LẠI BỘ LẬP LỊCH (CELERY BEAT) ===
@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    # Thêm công việc vào lịch: Chạy process_all_brands mỗi giờ (3600 giây)
    sender.add_periodic_task(3600.0, process_all_brands.s(), name='re-calculate all brands every hour')

@celery_app.task(name="process_all_brands")
def process_all_brands():
    """
    Tác vụ định kỳ: Lấy tất cả các brand và kích hoạt tác vụ xử lý cho từng brand.
    """
    db = SessionLocal()
    try:
        brand_ids = crud.get_all_brand_ids(db)
        print(f"SCHEDULER: Bắt đầu quét định kỳ cho các brand: {brand_ids}")
        for brand_id in brand_ids:
            # Gửi từng công việc xử lý brand vào hàng đợi
            process_brand_data.delay(brand_id)
    finally:
        db.close()
# ==========================================

@celery_app.task(name="process_brand_data")
def process_brand_data(brand_id: int):
    """
    Công việc chính: Tìm tất cả các ngày có hoạt động nhưng chưa được cache,
    sau đó tính toán và cache lại chúng.
    """
    db = SessionLocal()
    try:
        all_activity_dates = crud.get_all_activity_dates(db, brand_id=brand_id)
        if not all_activity_dates:
            print(f"WORKER: Không tìm thấy ngày nào có hoạt động cho brand ID {brand_id}.")
            return

        cache_keys = [f"kpi_daily:{brand_id}:{day.isoformat()}" for day in all_activity_dates]
        existing_cache = redis_client.mget(cache_keys)
        
        dates_to_process = [
            all_activity_dates[i] for i, cached_value in enumerate(existing_cache) if cached_value is None
        ]

        if not dates_to_process:
            print(f"WORKER: Tất cả các ngày có hoạt động của brand ID {brand_id} đã được cache.")
            return

        print(f"WORKER: Sẽ tính toán cho brand ID {brand_id} vào các ngày: {[d.isoformat() for d in dates_to_process]}")
        
        for target_date in dates_to_process:
            crud.calculate_and_cache_daily_kpis(db, brand_id=brand_id, target_date=target_date)
            
        print(f"WORKER: Hoàn thành xử lý cho brand ID {brand_id}.")

    finally:
        db.close()