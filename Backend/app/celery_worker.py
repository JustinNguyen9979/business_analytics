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
                # TỐI ƯU: Chỉ cần một truy vấn SUM tất cả các cột từ DailyStat
                summary_query = db.query(
                    func.sum(models.DailyStat.net_revenue).label('netRevenue'),
                    func.sum(models.DailyStat.gmv).label('gmv'),
                    func.sum(models.DailyStat.profit).label('profit'),
                    func.sum(models.DailyStat.total_cost).label('totalCost'),
                    func.sum(models.DailyStat.ad_spend).label('adSpend'),
                    func.sum(models.DailyStat.total_orders).label('totalOrders'),
                    func.sum(models.DailyStat.cogs).label('cogs'),
                    func.sum(models.DailyStat.execution_cost).label('executionCost'),
                    func.sum(models.DailyStat.aov).label('aov'),
                    func.sum(models.DailyStat.upt).label('upt'),
                    func.sum(models.DailyStat.completion_rate).label('completionRate'),
                    func.sum(models.DailyStat.cancellation_rate).label('cancellationRate'),
                    func.sum(models.DailyStat.refund_rate).label('refundRate'),
                    func.sum(models.DailyStat.completed_orders).label('completedOrders'),
                    func.sum(models.DailyStat.cancelled_orders).label('cancelledOrders'),
                    func.sum(models.DailyStat.refunded_orders).label('refundedOrders'),
                    func.sum(models.DailyStat.unique_skus_sold).label('uniqueSkusSold'),
                    func.sum(models.DailyStat.total_quantity_sold).label('totalQuantitySold'),
                    func.sum(models.DailyStat.total_customers).label('totalCustomers')
                ).filter(
                    models.DailyStat.brand_id == brand_id,
                    models.DailyStat.date.between(start_date, end_date)
                ).first()

                # Chuyển kết quả từ SQLAlchemy Row thành dictionary
                if summary_query:
                    # Chuyển Row thành Dict và ép kiểu về số (tránh None)
                    d = {key: (value or 0) for key, value in summary_query._mapping.items()}
                else:
                    d = {
                        'netRevenue': 0, 'gmv': 0, 'profit': 0, 'totalCost': 0, 'adSpend': 0,
                        'totalOrders': 0, 'cogs': 0, 'executionCost': 0, 
                        'completedOrders': 0, 'cancelledOrders': 0, 'refundedOrders': 0,
                        'uniqueSkusSold': 0, 'totalQuantitySold': 0, 'totalCustomers': 0
                    }

                # BƯỚC 3: TÍNH TOÁN LẠI CÁC TỶ LỆ (%) DỰA TRÊN TỔNG
                # ROI = Lợi nhuận / Tổng chi phí
                d['roi'] = (d['profit'] / d['totalCost']) if d['totalCost'] > 0 else 0
                
                # Profit Margin = Lợi nhuận / Doanh thu ròng
                d['profitMargin'] = (d['profit'] / d['netRevenue']) if d['netRevenue'] != 0 else 0
                
                # Take Rate = Phí thực thi / GMV
                d['takeRate'] = (d['executionCost'] / d['gmv']) if d['gmv'] > 0 else 0
                
                # AOV = GMV / Đơn thành công
                d['aov'] = (d['gmv'] / d['completedOrders']) if d['completedOrders'] > 0 else 0
                
                # UPT = Tổng số lượng bán / Đơn thành công
                d['upt'] = (d['totalQuantitySold'] / d['completedOrders']) if d['completedOrders'] > 0 else 0
                
                # Tỷ lệ hoàn thành = Đơn thành công / Tổng đơn
                d['completionRate'] = (d['completedOrders'] / d['totalOrders']) if d['totalOrders'] > 0 else 0
                
                # Tỷ lệ hủy = Đơn hủy / Tổng đơn
                d['cancellationRate'] = (d['cancelledOrders'] / d['totalOrders']) if d['totalOrders'] > 0 else 0
                
                # Tỷ lệ hoàn = Đơn hoàn / Tổng đơn
                d['refundRate'] = (d['refundedOrders'] / d['totalOrders']) if d['totalOrders'] > 0 else 0

                # Gán vào result_data
                result_data = d
                
                # CÁC CHỈ SỐ MỚI (TÍNH TOÁN NHANH) VẪN GIỮ LẠI
                # Đếm khách hàng mới (New Customers)
                first_order_subquery = db.query(
                    models.Order.username, 
                    func.min(models.Order.order_date).label('first_order_date')
                ).filter(models.Order.brand_id == brand_id).group_by(models.Order.username).subquery()
                
                newCustomers = db.query(func.count(first_order_subquery.c.username)).filter(
                    first_order_subquery.c.first_order_date.between(start_date, end_date)
                ).scalar() or 0

                returningCustomers = result_data['totalCustomers'] - newCustomers
                
                result_data['newCustomers'] = newCustomers
                result_data['returningCustomers'] = returningCustomers if returningCustomers > 0 else 0
                result_data['cac'] = (result_data['adSpend'] / newCustomers) if newCustomers > 0 else 0
                result_data['retentionRate'] = (returningCustomers / result_data['totalCustomers']) if result_data['totalCustomers'] > 0 else 0
                result_data['ltv'] = (result_data['profit'] / result_data['totalCustomers']) if result_data['totalCustomers'] > 0 else 0
                result_data['cpo'] = (result_data['adSpend'] / result_data['totalOrders']) if result_data['totalOrders'] else 0
                result_data['roas'] = (result_data['gmv'] / result_data['adSpend']) if result_data['adSpend'] else 0


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
            # BƯỚC MỚI: Xóa tất cả các bản ghi DailyStat cũ của brand này
            print(f"WORKER: Đang xóa các bản ghi DailyStat cũ cho brand {brand_id}...")
            db.query(models.DailyStat).filter(models.DailyStat.brand_id == brand_id).delete(synchronize_session=False)
            print(f"WORKER: Đã xóa xong DailyStat cũ.")

            # 1. Lấy tất cả các ngày có hoạt động
            all_activity_dates = crud.get_all_activity_dates(db, brand_id=brand_id)
            
            if not all_activity_dates:
                print(f"WORKER: Brand {brand_id} không có dữ liệu.")
                # Xóa cache lần cuối rồi kết thúc
                crud._clear_brand_cache(brand_id)
                return
            
            # 2. Tính toán và lưu vào DailyStat từng ngày
            print(f"WORKER: Đang cập nhật {len(all_activity_dates)} ngày vào DailyStat...")
            for target_date in all_activity_dates:
                crud.update_daily_stats(db, brand_id, target_date)
                
    except Exception as e:
        print(f"WORKER RECALCULATE ERROR: {e}")
        traceback.print_exc()
        
    print(f"WORKER: Hoàn thành RECALCULATE cho brand ID {brand_id}.")