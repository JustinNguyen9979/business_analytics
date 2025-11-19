# FILE: Backend/app/celery_worker.py

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
from sqlalchemy import func, distinct

# --- Cấu hình Celery (Kết nối đến Redis) ---
REDIS_HOST = os.getenv("REDIS_HOST", "cache")
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD")
CELERY_BROKER_URL = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:6379/1"
CELERY_RESULT_BACKEND = f"redis://:{REDIS_PASSWORD}@{REDIS_HOST}:6379/2"

celery_app = Celery("tasks", broker=CELERY_BROKER_URL, backend=CELERY_RESULT_BACKEND)

celery_app.conf.update(
    task_track_started=True,
    result_expires=timedelta(hours=1),
    broker_connection_retry_on_startup=True,
)

# ==============================================================================
# TASK 1: "SIÊU TASK" XỬ LÝ YÊU CẦU DỮ LIỆU (ĐÃ TỐI ƯU VỚI DAILY STATS)
# ==============================================================================
@celery_app.task(name="process_data_request")
def process_data_request(request_type: str, cache_key: str, brand_id: int, params: dict):
    """
    Task trung tâm. Đã được nâng cấp để sử dụng bảng DailyStat cho tốc độ tối đa.
    """
    print(f"WORKER: Nhận yêu cầu '{request_type}' cho brand {brand_id}.")
    result_data = None
    try:
        with get_db_session() as db:
            start_date = date.fromisoformat(params.get("start_date"))
            end_date = date.fromisoformat(params.get("end_date"))

            # --------------------------------------------------------------
            # --- Nhánh 1: KPI TỔNG HỢP (ĐÃ TỐI ƯU HÓA) ---
            # --------------------------------------------------------------
            if request_type == "kpi_summary":
                # BƯỚC 1: Lấy các chỉ số TÀI CHÍNH từ bảng DailyStat (Siêu nhanh)
                # Thay vì load 50.000 dòng đơn hàng, ta chỉ sum khoảng 30 dòng từ DailyStat
                summary_query = db.query(
                    func.sum(models.DailyStat.net_revenue).label('netRevenue'),
                    func.sum(models.DailyStat.gmv).label('gmv'),
                    func.sum(models.DailyStat.profit).label('profit'),
                    func.sum(models.DailyStat.total_cost).label('totalCost'),
                    func.sum(models.DailyStat.ad_spend).label('adSpend'),
                    func.sum(models.DailyStat.total_orders).label('totalOrders'),
                    func.sum(models.DailyStat.cogs).label('cogs'),
                    func.sum(models.DailyStat.execution_cost).label('executionCost'),
                ).filter(
                    models.DailyStat.brand_id == brand_id,
                    models.DailyStat.date.between(start_date, end_date)
                ).first()

                # Khởi tạo dict KPI cơ bản
                kpis = {
                    "netRevenue": summary_query.netRevenue or 0,
                    "gmv": summary_query.gmv or 0,
                    "profit": summary_query.profit or 0,
                    "totalCost": summary_query.totalCost or 0,
                    "adSpend": summary_query.adSpend or 0,
                    "totalOrders": summary_query.totalOrders or 0,
                    "cogs": summary_query.cogs or 0,
                    "executionCost": summary_query.executionCost or 0,
                    "completedOrders": 0, 
                    "cancelledOrders": 0, 
                    "refundedOrders": 0
                }
                
                # 2.1. Đếm số khách hàng (Total Customers)
                totalCustomers = db.query(func.count(models.Order.username.distinct())).filter(
                    models.Order.brand_id == brand_id, 
                    models.Order.order_date.between(start_date, end_date)
                ).scalar() or 0

                # 2.2. Đếm khách hàng mới (New Customers)
                # Logic: Khách có đơn hàng đầu tiên nằm trong khoảng thời gian này
                first_order_subquery = db.query(
                    models.Order.username, 
                    func.min(models.Order.order_date).label('first_order_date')
                ).filter(models.Order.brand_id == brand_id).group_by(models.Order.username).subquery()
                
                newCustomers = db.query(func.count(first_order_subquery.c.username)).filter(
                    first_order_subquery.c.first_order_date.between(start_date, end_date)
                ).scalar() or 0
                
                # Lấy số lượng đơn hoàn/hủy từ DB (Query nhẹ hơn load all)
                cancelled_count = db.query(func.count(models.Order.id)).filter(
                    models.Order.brand_id == brand_id,
                    models.Order.order_date.between(start_date, end_date),
                    models.Order.status.in_(['hủy', 'cancel', 'đã hủy', 'cancelled'])
                ).scalar() or 0
                
                # Số đơn hoàn thành (xấp xỉ) = Tổng đơn - Đơn hủy (Giản lược cho nhanh)
                completed_orders_approx = kpis['totalOrders'] - cancelled_count
                if completed_orders_approx < 0: completed_orders_approx = 0

                kpis['completedOrders'] = completed_orders_approx
                kpis['cancelledOrders'] = cancelled_count
                kpis['refundedOrders'] = 0 # Tạm thời để 0 hoặc cần query bảng Revenue để count dòng có refund

                # BƯỚC 3: Tính các chỉ số PHÁI SINH (Derived Metrics)
                
                # Tài chính
                kpis['profitMargin'] = (kpis['profit'] / kpis['netRevenue']) if kpis['netRevenue'] else 0
                kpis['roi'] = (kpis['profit'] / kpis['totalCost']) if kpis['totalCost'] else 0
                kpis['takeRate'] = ((kpis['totalCost'] - kpis['adSpend'] - 0) / kpis['gmv']) if kpis['gmv'] else 0 # Ước lượng Execution Cost = Total - Ad - COGS(ẩn)
                
                # Marketing
                kpis['cpo'] = (kpis['adSpend'] / kpis['totalOrders']) if kpis['totalOrders'] else 0
                kpis['roas'] = (kpis['gmv'] / kpis['adSpend']) if kpis['adSpend'] else 0
                
                # Vận hành
                kpis['aov'] = (kpis['gmv'] / kpis['completedOrders']) if kpis['completedOrders'] else 0
                kpis['cancellationRate'] = (kpis['cancelledOrders'] / kpis['totalOrders']) if kpis['totalOrders'] else 0
                kpis['completionRate'] = (kpis['completedOrders'] / kpis['totalOrders']) if kpis['totalOrders'] else 0

                # Khách hàng
                kpis['totalCustomers'] = totalCustomers
                kpis['newCustomers'] = newCustomers
                kpis['returningCustomers'] = totalCustomers - newCustomers
                kpis['cac'] = (kpis['adSpend'] / newCustomers) if newCustomers > 0 else 0
                kpis['retentionRate'] = (kpis['returningCustomers'] / totalCustomers) if totalCustomers > 0 else 0
                kpis['ltv'] = (kpis['profit'] / totalCustomers) if totalCustomers > 0 else 0
                
                result_data = kpis

            # --------------------------------------------------------------
            # --- Nhánh 2: BIỂU ĐỒ (Đã tối ưu bên CRUD) ---
            # --------------------------------------------------------------
            elif request_type == "daily_kpis_chart":
                # Gọi hàm crud mới đã sửa để lấy từ DailyStat
                result_data = {"data": crud.get_daily_kpis_for_range(db, brand_id, start_date, end_date)}

            # --------------------------------------------------------------
            # --- Nhánh 3: TOP SẢN PHẨM (Vẫn cần Raw Data Order Items) ---
            # --------------------------------------------------------------
            elif request_type == "top_products":
                limit = params.get("limit", 10)
                result_data = crud.get_top_selling_products(db, brand_id, start_date, end_date, limit)

            # --------------------------------------------------------------
            # --- Nhánh 4: BẢN ĐỒ (Vẫn cần Raw Data Customer City) ---
            # --------------------------------------------------------------
            elif request_type == "customer_map":
                result_data = crud.get_customer_distribution_with_coords(db, brand_id, start_date, end_date)

            # --------------------------------------------------------------
            # --- Nhánh 5: KPI THEO PLATFORM (Chưa tối ưu DailyStat, dùng logic cũ) ---
            # --------------------------------------------------------------
            elif request_type == "kpis_by_platform":
                # Vì DailyStat hiện tại chưa lưu cột 'source', ta vẫn dùng logic cũ cho phần này
                result_data = crud.get_kpis_by_platform(db, brand_id, start_date, end_date)

            else:
                raise ValueError(f"Loại yêu cầu không hợp lệ: {request_type}")

        # --------------------------------------------------------------
        # --- LƯU KẾT QUẢ VÀO CACHE ---
        # --------------------------------------------------------------
        if result_data is not None:
            redis_client.setex(cache_key, timedelta(hours=1), json.dumps(result_data, default=str))
            print(f"WORKER: Đã cache kết quả thành công: {cache_key}")
            return {"status": "SUCCESS"}
        else:
            raise ValueError("Không có dữ liệu được tạo ra.")

    except Exception as e:
        print(f"!!! WORKER ERROR '{request_type}': {e}")
        traceback.print_exc()
        error_info = {"status": "FAILED", "error": str(e)}
        redis_client.setex(cache_key, timedelta(minutes=5), json.dumps(error_info))
        return error_info

# ==============================================================================
# TASK 2: TÍNH TOÁN LẠI TOÀN BỘ (WORKER GHI DB)
# ==============================================================================
@celery_app.task(name="recalculate_all_brand_data")
def recalculate_all_brand_data(brand_id: int):
    """
    Task chạy ngầm: Quét dữ liệu thô và cập nhật bảng DailyStat.
    """
    print(f"WORKER: Bắt đầu RECALCULATE (DailyStat) cho brand ID {brand_id}.")
    try:
        with get_db_session() as db:
            # 1. Lấy tất cả các ngày có hoạt động
            all_activity_dates = crud.get_all_activity_dates(db, brand_id=brand_id)
            
            if not all_activity_dates:
                print(f"WORKER: Brand {brand_id} không có dữ liệu.")
                return
            
            # 2. Tính toán và lưu vào DailyStat từng ngày
            print(f"WORKER: Đang cập nhật {len(all_activity_dates)} ngày vào DailyStat...")
            for target_date in all_activity_dates:
                crud.update_daily_stats(db, brand_id, target_date)
                
    except Exception as e:
        print(f"WORKER RECALCULATE ERROR: {e}")
        traceback.print_exc()
        
    print(f"WORKER: Hoàn thành RECALCULATE cho brand ID {brand_id}.")