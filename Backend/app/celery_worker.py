# FILE: backend/app/celery_worker.py (PHIÊN BẢN SỬA LỖI DATABASE CONNECTION)

import os
from celery import Celery
# <<< BƯỚC 1: IMPORT THÊM CÁC TÍN HIỆU TỪ CELERY >>>
from celery.signals import worker_process_init
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import crud
from cache import redis_client

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL is None:
    raise ValueError("Biến môi trường DATABASE_URL chưa được thiết lập!")

celery_app = Celery('tasks', broker='redis://cache:6379/0', backend='redis://cache:6379/0')
celery_app.conf.update(task_serializer='json', accept_content=['json'], result_serializer='json', timezone='UTC', enable_utc=True)

# <<< BƯỚC 2: KHAI BÁO BIẾN TOÀN CỤC NHƯNG CHƯA KHỞI TẠO >>>
# Chúng ta sẽ khởi tạo chúng bên trong hàm xử lý tín hiệu
db_engine = None
SessionLocal = None

# <<< BƯỚC 3: DÙNG SIGNAL ĐỂ KHỞI TẠO ENGINE CHO TỪNG WORKER >>>
@worker_process_init.connect
def init_worker(**kwargs):
    """
    Hàm này sẽ được tự động gọi khi một tiến trình worker của Celery được khởi tạo.
    Nó đảm bảo mỗi worker có một engine và session pool riêng, tránh lỗi kết nối.
    """
    global db_engine, SessionLocal
    print("WORKER PROCESS INIT: Đang khởi tạo Database Engine...")
    db_engine = create_engine(DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=db_engine)
    print("WORKER PROCESS INIT: Khởi tạo Database Engine thành công.")
# =================================================================

@celery_app.on_after_configure.connect
def setup_periodic_tasks(sender, **kwargs):
    sender.add_periodic_task(3600.0, process_all_brands.s(), name='re-calculate all brands every hour')

@celery_app.task(name="process_all_brands")
def process_all_brands():
    """
    Tác vụ định kỳ: Lấy tất cả các brand và kích hoạt tác vụ xử lý cho từng brand.
    """
    # <<< BƯỚC 4: ĐẢM BẢO SESSIONLOCAL ĐÃ ĐƯỢC KHỞI TẠO >>>
    if SessionLocal is None:
        print("!!! LỖI: SessionLocal chưa được khởi tạo trong worker.")
        return
        
    db = SessionLocal()
    try:
        brand_ids = crud.get_all_brand_ids(db)
        print(f"SCHEDULER: Bắt đầu quét định kỳ cho các brand: {brand_ids}")
        for brand_id in brand_ids:
            process_brand_data.delay(brand_id)
    finally:
        db.close()

@celery_app.task(name="process_brand_data")
def process_brand_data(brand_id: int):
    """
    Công việc chính: Tìm tất cả các ngày có hoạt động nhưng chưa được cache,
    sau đó tính toán và cache lại chúng.
    """
    # <<< BƯỚC 4: ĐẢM BẢO SESSIONLOCAL ĐÃ ĐƯỢC KHỞI TẠO >>>
    if SessionLocal is None:
        print("!!! LỖI: SessionLocal chưa được khởi tạo trong worker.")
        return

    db = SessionLocal()
    try:
        # Lấy tất cả các ngày có hoạt động của brand
        all_activity_dates = crud.get_all_activity_dates(db, brand_id=brand_id)
        
        # --- LOGIC MỚI: TÍNH TOÁN LẠI TẤT CẢ CÁC NGÀY ---
        # Khi tác vụ này được gọi (từ nút bấm hoặc upload), nó sẽ tính toán lại
        # toàn bộ lịch sử của brand, đảm bảo dữ liệu luôn đúng.
        # Tác vụ định kỳ hàng giờ sẽ chỉ tính các ngày còn thiếu.
        
        # Để đơn giản hóa logic, chúng ta sẽ xóa cache hiện có và tính lại hết
        # Điều này đảm bảo tính nhất quán sau khi upload file mới.
        keys_to_delete = redis_client.keys(f"kpi_daily:{brand_id}:*")
        if keys_to_delete:
            redis_client.delete(*keys_to_delete)
            print(f"WORKER: Đã xóa {len(keys_to_delete)} cache keys cũ cho brand ID {brand_id} để tính lại.")

        if not all_activity_dates:
            print(f"WORKER: Không tìm thấy ngày nào có hoạt động cho brand ID {brand_id}.")
            return

        print(f"WORKER: Sẽ tính toán lại cho brand ID {brand_id} vào các ngày: {[d.isoformat() for d in all_activity_dates]}")
        
        for target_date in all_activity_dates:
            crud.calculate_and_cache_daily_kpis(db, brand_id=brand_id, target_date=target_date)
            
        print(f"WORKER: Hoàn thành xử lý cho brand ID {brand_id}.")

    finally:
        db.close()