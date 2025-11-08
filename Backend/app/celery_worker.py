# FILE: Backend/app/celery_worker.py

import os
from celery import Celery
import crud
from cache import redis_client
import json
from datetime import date
from worker_utils import get_db_session 

REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
REDIS_URL = f"redis://:{REDIS_PASSWORD}@cache:6379/0"

celery_app = Celery('tasks', broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.update(task_serializer='json', accept_content=['json'], result_serializer='json', timezone='UTC', enable_utc=True)

@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    sender.add_periodic_task(3600.0, process_all_brands.s(), name='re-calculate all brands every hour')

@celery_app.task(name="process_all_brands")
def process_all_brands():
    """Tác vụ định kỳ: Lấy tất cả brand ID và kích hoạt tác vụ xử lý cho từng brand."""
    # <<< SỬ DỤNG get_db_session() >>>
    with get_db_session() as db:
        brand_ids = crud.get_all_brand_ids(db)
        print(f"SCHEDULER: Bắt đầu quét định kỳ cho các brand: {brand_ids}")
        for brand_id in brand_ids:
            process_brand_data.delay(brand_id)

@celery_app.task(name="process_brand_data")
def process_brand_data(brand_id: int):
    """Công việc chính: Tính toán lại và cache KPI hàng ngày cho một brand."""
    # <<< SỬ DỤNG get_db_session() >>>
    with get_db_session() as db:
        print(f"WORKER (KPI): Bắt đầu xử lý cho brand ID {brand_id}.")
        crud.recalculate_brand_data_sync(db, brand_id=brand_id)
        print(f"WORKER (KPI): Hoàn thành xử lý cho brand ID {brand_id}.")


# <<< SỬA LẠI TÁC VỤ TÍNH PHÂN BỔ KHÁCH HÀNG >>>
@celery_app.task(name="calculate_customer_distribution")
def calculate_customer_distribution(brand_id: int, start_date_iso: str, end_date_iso: str):
    """Tác vụ worker: Tính toán phân bổ khách hàng và lưu kết quả vào Redis."""
    # <<< SỬ DỤNG get_db_session() >>>
    with get_db_session() as db:
        start_date = date.fromisoformat(start_date_iso)
        end_date = date.fromisoformat(end_date_iso)

        print(f"WORKER (DIST): Bắt đầu tính phân bổ khách hàng cho brand {brand_id} từ {start_date} đến {end_date}")

        distribution_data = crud.get_customer_distribution(db, brand_id, start_date, end_date)

        cache_key = f"dist:{brand_id}:{start_date_iso}:{end_date_iso}"
        
        # Lưu kết quả vào Redis, đặt thời gian hết hạn là 1 giờ
        redis_client.setex(cache_key, 3600, json.dumps(distribution_data))
        
        print(f"WORKER (DIST): Đã tính xong và cache vào key: {cache_key}")