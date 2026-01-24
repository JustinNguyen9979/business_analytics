# FILE: Backend/app/celery_worker.py

from celery import Celery
import os
import json
import traceback
from datetime import date, timedelta
from worker_utils import get_db_session
import crud
import kpi_utils
import models
from services import dashboard_service, data_service
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
                    func.sum(models.DailyStat.net_revenue).label('net_revenue'),
                    func.sum(models.DailyStat.gmv).label('gmv'),
                    func.sum(models.DailyStat.profit).label('profit'),
                    func.sum(models.DailyStat.total_cost).label('total_cost'),
                    func.sum(models.DailyStat.ad_spend).label('ad_spend'),
                    func.sum(models.DailyStat.total_orders).label('total_orders'),
                    func.sum(models.DailyStat.cogs).label('cogs'),
                    func.sum(models.DailyStat.execution_cost).label('execution_cost'),
                    func.sum(models.DailyStat.aov).label('aov'),
                    func.sum(models.DailyStat.upt).label('upt'),
                    func.sum(models.DailyStat.completion_rate).label('completion_rate'),
                    func.sum(models.DailyStat.cancellation_rate).label('cancellation_rate'),
                    func.sum(models.DailyStat.refund_rate).label('refund_rate'),
                    func.sum(models.DailyStat.completed_orders).label('completed_orders'),
                    func.sum(models.DailyStat.cancelled_orders).label('cancelled_orders'),
                    func.sum(models.DailyStat.refunded_orders).label('refunded_orders'),
                    func.sum(models.DailyStat.unique_skus_sold).label('unique_skus_sold'),
                    func.sum(models.DailyStat.total_quantity_sold).label('total_quantity_sold'),
                    func.sum(models.DailyStat.total_customers).label('total_customers'),
                    func.sum(models.DailyStat.new_customers).label('new_customers'),
                    func.sum(models.DailyStat.returning_customers).label('returning_customers')
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
                        'net_revenue': 0, 'gmv': 0, 'profit': 0, 'total_cost': 0, 'ad_spend': 0,
                        'total_orders': 0, 'cogs': 0, 'execution_cost': 0, 
                        'completed_orders': 0, 'cancelled_orders': 0, 'refunded_orders': 0,
                        'unique_skus_sold': 0, 'total_quantity_sold': 0, 'total_customers': 0,
                        'new_customers': 0, 'returning_customers': 0
                    }

                # BƯỚC 3: TÍNH TOÁN LẠI CÁC TỶ LỆ (%) DỰA TRÊN TỔNG
                # ROI = Lợi nhuận / Tổng chi phí
                d['roi'] = (d['profit'] / d['total_cost']) if d['total_cost'] > 0 else 0
                
                # Profit Margin = Lợi nhuận / Doanh thu ròng
                d['profit_margin'] = (d['profit'] / d['net_revenue']) if d['net_revenue'] != 0 else 0
                
                # Take Rate = Phí thực thi / GMV
                d['take_rate'] = (d['execution_cost'] / d['gmv']) if d['gmv'] > 0 else 0
                
                # AOV = GMV / Đơn thành công
                d['aov'] = (d['gmv'] / d['completed_orders']) if d['completed_orders'] > 0 else 0
                
                # UPT = Tổng số lượng bán / Đơn thành công
                d['upt'] = (d['total_quantity_sold'] / d['completed_orders']) if d['completed_orders'] > 0 else 0
                
                # Tỷ lệ hoàn thành = Đơn thành công / Tổng đơn
                d['completion_rate'] = (d['completed_orders'] / d['total_orders']) if d['total_orders'] > 0 else 0
                
                # Tỷ lệ hủy = Đơn hủy / Tổng đơn
                d['cancellation_rate'] = (d['cancelled_orders'] / d['total_orders']) if d['total_orders'] > 0 else 0
                
                # Tỷ lệ hoàn = Đơn hoàn / Tổng đơn
                d['refund_rate'] = (d['refunded_orders'] / d['total_orders']) if d['total_orders'] > 0 else 0

                # Gán vào result_data
                result_data = d
                
                # CÁC CHỈ SỐ MỚI (TÍNH TOÁN NHANH) VẪN GIỮ LẠI
                result_data['cac'] = (result_data['ad_spend'] / result_data['new_customers']) if result_data['new_customers'] > 0 else 0
                result_data['retention_rate'] = (result_data['returning_customers'] / result_data['total_customers']) if result_data['total_customers'] > 0 else 0
                result_data['ltv'] = (result_data['profit'] / result_data['total_customers']) if result_data['total_customers'] > 0 else 0
                result_data['cpo'] = (result_data['ad_spend'] / result_data['total_orders']) if result_data['total_orders'] else 0
                result_data['roas'] = (result_data['gmv'] / result_data['ad_spend']) if result_data['ad_spend'] else 0


            # --------------------------------------------------------------
            # --- Nhánh 2: BIỂU ĐỒ ---
            # --------------------------------------------------------------
            elif request_type == "daily_kpis_chart":
                # Lấy danh sách source từ params gửi lên (Frontend sẽ gửi list hoặc string)
                req_source = params.get("source")

                # Chuẩn hóa thành list nếu cần
                source_list = None
                if req_source is not None: # SỬA: Dùng is not None để chấp nhận list rỗng []
                    if isinstance(req_source, list):
                        source_list = req_source
                    else:
                        source_list = [req_source]

                result_data = {
                    "data": dashboard_service.get_daily_kpis_for_range(
                        db, brand_id, start_date, end_date, source_list=source_list
                    )
                }

            # --------------------------------------------------------------
            # --- Nhánh 3: TOP SẢN PHẨM (Vẫn cần Raw Data Order Items) ---
            # --------------------------------------------------------------
            elif request_type == "top_products":
                limit = params.get("limit", 10)
                result_data = dashboard_service.get_top_selling_products(db, brand_id, start_date, end_date, limit)

            # --------------------------------------------------------------
            # --- Nhánh 4: TOP KHÁCH HÀNG THEO KỲ (DYNAMIC) ---
            # --------------------------------------------------------------
            elif request_type == "top_customers_period":
                # Frontend gửi: limit (là page_size), page
                page_size = int(params.get("limit", 20)) 
                page = int(params.get("page", 1))
                
                # Xử lý source param
                req_source = params.get("source")
                source_list = None
                if req_source is not None:
                    if isinstance(req_source, list):
                        source_list = req_source
                    else:
                        source_list = [req_source]
                
                result_data = crud.customer.get_top_customers_in_period(
                    db, 
                    brand_id, 
                    start_date, 
                    end_date, 
                    limit=20000, # Max calculation limit (Hard cap)
                    page=page,
                    page_size=page_size,
                    source_list=source_list
                )

            # --------------------------------------------------------------
            # --- Nhánh 5: KPI THEO PLATFORM ---
            # --------------------------------------------------------------
            elif request_type == "kpis_by_platform":
                # Vì DailyStat hiện tại chưa lưu cột 'source', ta vẫn dùng logic cũ cho phần này
                result_data = dashboard_service.get_kpis_by_platform(db, brand_id, start_date, end_date)

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
            # BƯỚC MỚI: Xóa tất cả các bản ghi DailyStat và DailyAnalytics cũ của brand này
            print(f"WORKER: [1/4] Đang xóa dữ liệu cũ (Stats & Analytics) cho brand {brand_id}...")
            db.query(models.DailyStat).filter(models.DailyStat.brand_id == brand_id).delete(synchronize_session=False)
            db.query(models.DailyAnalytics).filter(models.DailyAnalytics.brand_id == brand_id).delete(synchronize_session=False)
            
            # QUAN TRỌNG: Commit ngay lập tức để xác nhận việc xóa
            db.commit() 
            print(f"WORKER: [2/4] Đã xóa xong và Commit dữ liệu cũ.")

            # 1. Lấy tất cả các ngày có hoạt động (Query trực tiếp để tránh lỗi Import CRUD)
            print(f"WORKER: [3/4] Đang quét các ngày có hoạt động...")
            from sqlalchemy import union_all, select
            
            q1 = select(func.date(models.Order.order_date)).filter(models.Order.brand_id == brand_id).where(models.Order.order_date.isnot(None))
            q2 = select(models.Revenue.transaction_date).filter(models.Revenue.brand_id == brand_id).where(models.Revenue.transaction_date.isnot(None))
            q3 = select(models.MarketingSpend.date).filter(models.MarketingSpend.brand_id == brand_id).where(models.MarketingSpend.date.isnot(None))
            
            combined_query = union_all(q1, q2, q3).subquery()
            # Thực thi query từ subquery
            # Lưu ý: Khi select từ subquery, ta cần chỉ định cột cụ thể hoặc dùng combined_query.c[0]
            results = db.execute(select(combined_query.c[0]).distinct().order_by(combined_query.c[0])).all()
            all_activity_dates = [r[0] for r in results if r[0]]
            
            if not all_activity_dates:
                print(f"WORKER: Brand {brand_id} không có dữ liệu hoạt động nào.")
                crud.clear_brand_cache(brand_id)
                return
            
            # 2. Tính toán và lưu vào DailyStat từng ngày
            print(f"WORKER: [4/4] Đang tính toán lại cho {len(all_activity_dates)} ngày...")
            count = 0
            for target_date in all_activity_dates:
                try:
                    data_service.update_daily_stats(db, brand_id, target_date)
                    count += 1
                    if count % 10 == 0:
                        print(f"WORKER: ...đã xử lý {count}/{len(all_activity_dates)} ngày.")
                except Exception as inner_e:
                    print(f"WORKER ERROR tại ngày {target_date}: {inner_e}")
                    # Tiếp tục chạy các ngày khác chứ không dừng hẳn
            
            # 3. Commit dữ liệu mới
            print("WORKER: Đang commit dữ liệu mới...")
            db.commit()
            print("WORKER: Commit thành công. Hoàn tất!")

            # 4. Xóa cache MỘT LẦN DUY NHẤT
            data_service.clear_brand_cache(brand_id)
                
    except Exception as e:
        print(f"WORKER RECALCULATE ERROR: {e}")
        traceback.print_exc()
        
    print(f"WORKER: Hoàn thành RECALCULATE cho brand ID {brand_id}.")

# ==============================================================================
# TASK 3: TÍNH TOÁN LẠI THEO NGÀY CỤ THỂ (OPTIMIZED INCREMENTAL UPDATE)
# ==============================================================================
@celery_app.task(name="recalculate_brand_data_specific_dates")
def recalculate_brand_data_specific_dates(brand_id: int, target_dates_iso: list):
    """
    Task chạy ngầm: Chỉ tính toán lại các ngày được chỉ định (affected_dates).
    Giúp tối ưu hiệu năng, tránh xóa toàn bộ dữ liệu lịch sử.
    """
    if not target_dates_iso:
        print("WORKER: Không có ngày nào cần tính toán lại.")
        return

    print(f"WORKER: Bắt đầu RECALCULATE (Incremental) cho brand ID {brand_id} với {len(target_dates_iso)} ngày.")
    
    try:
        # Convert string ISO dates back to date objects
        target_dates = [date.fromisoformat(d) for d in target_dates_iso]
        
        with get_db_session() as db:
            # 1. Xóa dữ liệu cũ (DailyStat & DailyAnalytics) CHỈ TRONG NHỮNG NGÀY NÀY
            # Lưu ý: Cần xóa để đảm bảo số liệu mới đè lên số liệu cũ sạch sẽ
            print(f"WORKER: [1/3] Đang xóa dữ liệu cũ của {len(target_dates)} ngày...")
            
            db.query(models.DailyStat).filter(
                models.DailyStat.brand_id == brand_id,
                models.DailyStat.date.in_(target_dates)
            ).delete(synchronize_session=False)
            
            db.query(models.DailyAnalytics).filter(
                models.DailyAnalytics.brand_id == brand_id,
                models.DailyAnalytics.date.in_(target_dates)
            ).delete(synchronize_session=False)
            
            db.commit()

            # 2. Tính toán lại cho từng ngày
            print(f"WORKER: [2/3] Đang tính toán lại...")
            count = 0
            for target_date in target_dates:
                try:
                    data_service.update_daily_stats(db, brand_id, target_date)
                    count += 1
                except Exception as inner_e:
                    print(f"WORKER ERROR tại ngày {target_date}: {inner_e}")
            
            # 3. Commit và Clear Cache
            print("WORKER: [3/3] Đang commit và xóa cache...")
            db.commit()
            
            # Xóa cache để dashboard cập nhật
            data_service.clear_brand_cache(brand_id)
            
    except Exception as e:
        print(f"WORKER INCREMENTAL ERROR: {e}")
        traceback.print_exc()
        
    print(f"WORKER: Hoàn thành RECALCULATE (Incremental) cho brand ID {brand_id}.")