# FILE: Backend/app/celery_worker.py (PHIÊN BẢN ĐIỀU PHỐI VIÊN HOÀN CHỈNH)

from celery import Celery
import os
import json
import traceback
from datetime import date, timedelta
from worker_utils import get_db_session
import crud
import kpi_calculator
import models
from cache import redis_client
from sqlalchemy import func

# --- Cấu hình Celery (Kết nối đến Redis) ---
REDIS_HOST = os.getenv("REDIS_HOST", "cache")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
CELERY_BROKER_URL = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:6379/1"  # Dùng DB 1 cho Broker
CELERY_RESULT_BACKEND = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:6379/2" # Dùng DB 2 cho Backend

celery_app = Celery("tasks", broker=CELERY_BROKER_URL, backend=CELERY_RESULT_BACKEND)

celery_app.conf.update(
    task_track_started=True,
    result_expires=timedelta(hours=1), # Kết quả task sẽ tự xóa sau 1 giờ
    broker_connection_retry_on_startup=True,
)

# ==============================================================================
# TASK 1: "SIÊU TASK" XỬ LÝ YÊU CẦU DỮ LIỆU BẤT ĐỒNG BỘ
# ==============================================================================
@celery_app.task(name="process_data_request")
def process_data_request(request_type: str, cache_key: str, brand_id: int, params: dict):
    """
    Task trung tâm, điều phối việc lấy dữ liệu thô và gọi hàm tính toán.
    """
    print(f"WORKER: Nhận yêu cầu '{request_type}' cho brand {brand_id}.")
    result_data = None
    try:
        with get_db_session() as db:
            start_date = date.fromisoformat(params.get("start_date"))
            end_date = date.fromisoformat(params.get("end_date"))

            # --------------------------------------------------------------
            # --- Nhánh 1: Xử lý yêu cầu KPI TỔNG HỢP (kpi_summary) ---
            # --------------------------------------------------------------
            if request_type == "kpi_summary":
                # 1. LẤY NGUYÊN LIỆU (Gọi CRUD để lấy data thô)
                all_orders = crud.get_raw_orders_in_range(db, brand_id, start_date, end_date)
                all_revenues = crud.get_raw_revenues_in_range(db, brand_id, start_date, end_date)
                all_ads = crud.get_raw_ads_in_range(db, brand_id, start_date, end_date)
                
                # 2. ĐƯA CHO "ĐẦU BẾP" TÍNH TOÁN CÁC CHỈ SỐ CƠ BẢN
                kpis = kpi_calculator.calculate_aggregated_kpis(all_orders, all_revenues, all_ads)

                # 3. WORKER LÀM CÁC VIỆC PHỨC TẠP HƠN (Cần truy vấn DB để lấy dữ liệu không cộng dồn được)
                totalCustomers = db.query(func.count(models.Order.username.distinct())).filter(
                    models.Order.brand_id == brand_id, 
                    models.Order.order_date.between(start_date, end_date)
                ).scalar() or 0
                
                subquery = db.query(
                    models.Order.username, 
                    func.min(models.Order.order_date).label('first_order_date')
                ).filter(models.Order.brand_id == brand_id).group_by(models.Order.username).subquery()
                
                newCustomers = db.query(func.count(subquery.c.username)).filter(
                    subquery.c.first_order_date.between(start_date, end_date)
                ).scalar() or 0
                
                # 4. GỘP KẾT QUẢ VÀ TÍNH CÁC CHỈ SỐ PHÁI SINH CUỐI CÙNG
                kpis['totalCustomers'] = totalCustomers
                kpis['newCustomers'] = newCustomers
                kpis['returningCustomers'] = totalCustomers - newCustomers
                
                kpis['cac'] = (kpis['adSpend'] / newCustomers) if newCustomers > 0 else 0
                kpis['retentionRate'] = (kpis['returningCustomers'] / totalCustomers) if totalCustomers > 0 else 0
                kpis['ltv'] = (kpis['profit'] / totalCustomers) if totalCustomers > 0 else 0
                
                result_data = kpis

            # --------------------------------------------------------------
            # --- Nhánh 2: Xử lý yêu cầu BIỂU ĐỒ (daily_kpis_chart) ---
            # --------------------------------------------------------------
            elif request_type == "daily_kpis_chart":
                # Logic cho biểu đồ rất đơn giản: chỉ cần gọi hàm đã có sẵn trong CRUD
                # Hàm này đã có sẵn logic check cache hàng ngày và tính toán lại nếu cần
                result_data = {"data": crud.get_daily_kpis_for_range(db, brand_id, start_date, end_date)}

            elif request_type == "top_products":
                print(f"WORKER: Đang xử lý yêu cầu '{request_type}'...")
                # Lấy tham số 'limit' từ params, nếu không có thì mặc định là 10
                limit = params.get("limit", 10)
                # Gọi hàm crud tương ứng để lấy dữ liệu
                result_data = crud.get_top_selling_products(db, brand_id, start_date, end_date, limit)

            # Nhánh 4: Xử lý yêu cầu BẢN ĐỒ
            elif request_type == "customer_map":
                print(f"WORKER: Đang xử lý yêu cầu '{request_type}'...")
                # Gọi hàm crud tương ứng để lấy dữ liệu
                result_data = crud.get_customer_distribution_with_coords(db, brand_id, start_date, end_date)

            else:
                raise ValueError(f"Loại yêu cầu không hợp lệ: {request_type}")

        # --------------------------------------------------------------
        # --- LƯU KẾT QUẢ VÀO CACHE ---
        # --------------------------------------------------------------
        if result_data is not None:
            # Lưu kết quả vào cache với thời gian sống là 1 giờ
            redis_client.setex(cache_key, timedelta(hours=1), json.dumps(result_data, default=str))
            print(f"WORKER: Đã xử lý và cache thành công kết quả cho key: {cache_key}")
            return {"status": "SUCCESS"}
        else:
            raise ValueError("Không có dữ liệu được tạo ra từ quá trình xử lý.")

    except Exception as e:
        print(f"!!! WORKER ERROR khi xử lý '{request_type}': {e}")
        traceback.print_exc()
        # Lưu thông tin lỗi vào cache để Frontend biết và hiển thị
        error_info = {"status": "FAILED", "error": str(e)}
        redis_client.setex(cache_key, timedelta(minutes=5), json.dumps(error_info))
        return error_info

# ==============================================================================
# TASK 2: TASK TÍNH TOÁN LẠI TOÀN BỘ (DÙNG SAU KHI UPLOAD)
# ==============================================================================
@celery_app.task(name="recalculate_all_brand_data")
def recalculate_all_brand_data(brand_id: int):
    """
    Xóa cache KPI hàng ngày và tính toán lại toàn bộ cho một brand.
    Đây là task "tính toán trước" (pre-computation).
    """
    print(f"WORKER: Bắt đầu TÍNH TOÁN LẠI TOÀN BỘ cho brand ID {brand_id}.")
    with get_db_session() as db:
        # 1. Xóa cache cũ
        keys_to_delete = redis_client.keys(f"kpi_daily:{brand_id}:*")
        if keys_to_delete:
            redis_client.delete(*keys_to_delete)
            print(f"WORKER: Đã xóa {len(keys_to_delete)} cache KPI hàng ngày cũ.")

        # 2. Lấy tất cả các ngày có hoạt động của brand
        all_activity_dates = crud.get_all_activity_dates(db, brand_id=brand_id)
        if not all_activity_dates:
            print(f"WORKER: Brand {brand_id} không có dữ liệu để tính toán.")
            return
        
        # 3. Lặp qua từng ngày và tính toán lại KPI cho ngày đó
        print(f"WORKER: Sẽ tính toán lại cho {len(all_activity_dates)} ngày.")
        for target_date in all_activity_dates:
            # Gọi hàm tiện ích trong crud để thực hiện chuỗi logic:
            # Lấy data thô -> gọi kpi_calculator -> cache kết quả
            crud._calculate_and_cache_single_day(db, brand_id, target_date)
            
    print(f"WORKER: Hoàn thành TÍNH TOÁN LẠI TOÀN BỘ cho brand ID {brand_id}.") 