from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import func
import traceback

import kpi_utils
import models
from cache import redis_client

def clear_brand_cache(brand_id: int):
    """
    Xóa cache Redis liên quan đến brand.
    Sử dụng SCAN để tránh block Redis server.
    """
    try:
        print(f"INFO: Clearing dashboard cache for brand_id: {brand_id}")
        cache_keys_to_delete = []
        
        # Quét cache request
        for key in redis_client.scan_iter(f"data_req:{brand_id}:*"):
            cache_keys_to_delete.append(key)
            
        # Quét cache kpi daily
        for key in redis_client.scan_iter(f"kpi_daily:{brand_id}:*"):
            cache_keys_to_delete.append(key)
        
        if cache_keys_to_delete:
            redis_client.delete(*cache_keys_to_delete)
            print(f"INFO: Deleted {len(cache_keys_to_delete)} cache keys.")
    except Exception as e:
        print(f"WARNING: Redis clear cache failed: {e}")

def update_daily_stats(db: Session, brand_id: int, target_date: date):
    """
    Worker function: Tính toán lại KPI cho một ngày cụ thể và lưu vào DB.
    """
    # 1. Lấy dữ liệu thô
    marketing_spends = db.query(models.MarketingSpend).filter(
        models.MarketingSpend.brand_id == brand_id,
        models.MarketingSpend.date == target_date
    ).all()

    orders_created_today = db.query(models.Order).filter(
        models.Order.brand_id == brand_id, 
        func.date(models.Order.order_date) == target_date
    ).all()

    # Lấy Revenue liên quan (để tính KPI tài chính chính xác)
    created_today_codes = {o.order_code for o in orders_created_today}
    revenues = []
    if created_today_codes:
        revenues = db.query(models.Revenue).filter(
            models.Revenue.brand_id == brand_id,
            models.Revenue.order_code.in_(created_today_codes)
        ).all()

    # 2. Xác định các source cần tính toán
    active_sources = set()
    active_sources.update({o.source for o in orders_created_today if o.source})
    active_sources.update({m.source for m in marketing_spends if m.source})

    # 3. Tính toán và lưu chi tiết từng source (DailyAnalytics)
    for current_source in active_sources:
        # Filter data in memory
        filtered_revenues = [r for r in revenues if r.source == current_source]
        filtered_marketing = [m for m in marketing_spends if m.source == current_source]
        filtered_orders = [o for o in orders_created_today if o.source == current_source]
        filtered_codes = {o.order_code for o in filtered_orders}

        kpis = kpi_utils.calculate_daily_kpis(
            filtered_orders, filtered_revenues, filtered_marketing, 
            filtered_codes, target_date, db_session=db,
            brand_id=brand_id, source=current_source
        )

        analytics_entry = db.query(models.DailyAnalytics).filter(
            models.DailyAnalytics.brand_id == brand_id,
            models.DailyAnalytics.date == target_date,
            models.DailyAnalytics.source == current_source
        ).first()

        if not analytics_entry:
            analytics_entry = models.DailyAnalytics(brand_id=brand_id, date=target_date, source=current_source)
            db.add(analytics_entry)
            db.flush()

        if kpis:
            for key, value in kpis.items():
                if hasattr(analytics_entry, key):
                    setattr(analytics_entry, key, value)
            db.add(analytics_entry)

    # 4. Tính toán tổng hợp (DailyStat)
    total_kpis = kpi_utils.calculate_daily_kpis(
        orders_created_today, revenues, marketing_spends, 
        created_today_codes, target_date, db_session=db,
        brand_id=brand_id
    )
    
    # # DEBUG CHURN RATE
    # if total_kpis and 'churn_rate' in total_kpis:
    #     print(f"[DEBUG] Date: {target_date} | Churn Rate: {total_kpis['churn_rate']}% | Total Orders: {len(orders_created_today)}")

    stat_entry = db.query(models.DailyStat).filter(
        models.DailyStat.brand_id == brand_id,
        models.DailyStat.date == target_date
    ).first()

    if not stat_entry:
        stat_entry = models.DailyStat(brand_id=brand_id, date=target_date)
        db.add(stat_entry)
        db.flush()

    if total_kpis:
        for key, value in total_kpis.items():
            if hasattr(stat_entry, key):
                setattr(stat_entry, key, value)
        db.add(stat_entry)
    
    # Commit handled by caller or worker logic usually, but here we add objects to session.
    # Worker utils usually commit.
    return stat_entry

def delete_brand_data_in_range(db: Session, brand_id: int, start_date: date, end_date: date, source: str = None):
    """
    Xóa dữ liệu Brand theo khoảng thời gian và Source (Optional).
    Logic xóa dây chuyền: Revenue -> Order -> Customer -> Stats.
    """
    try:
        # 1. Xác định danh sách Order Code cần xóa (Từ Revenue + Order)
        target_order_codes = set()

        # Từ Revenue
        rev_q = db.query(models.Revenue.order_code).filter(
            models.Revenue.brand_id == brand_id,
            models.Revenue.transaction_date.between(start_date, end_date)
        )
        if source: rev_q = rev_q.filter(models.Revenue.source == source)
        target_order_codes.update({r[0] for r in rev_q.distinct().all() if r[0]})

        # Từ Order
        ord_q = db.query(models.Order.order_code).filter(
            models.Order.brand_id == brand_id,
            func.date(models.Order.order_date).between(start_date, end_date)
        )
        if source: ord_q = ord_q.filter(models.Order.source == source)
        target_order_codes.update({r[0] for r in ord_q.distinct().all() if r[0]})

        # 2. Xóa Orders
        if target_order_codes:
            db.query(models.Order).filter(
                models.Order.brand_id == brand_id,
                models.Order.order_code.in_(target_order_codes)
            ).delete(synchronize_session=False)

        # 3. Xóa Revenue
        del_rev = db.query(models.Revenue).filter(
            models.Revenue.brand_id == brand_id,
            models.Revenue.transaction_date.between(start_date, end_date)
        )
        if source: del_rev = del_rev.filter(models.Revenue.source == source)
        del_rev.delete(synchronize_session=False)

        # 5. Xóa Marketing Spend
        del_mkt = db.query(models.MarketingSpend).filter(
            models.MarketingSpend.brand_id == brand_id,
            models.MarketingSpend.date.between(start_date, end_date)
        )
        if source: del_mkt = del_mkt.filter(models.MarketingSpend.source == source)
        del_mkt.delete(synchronize_session=False)

        # 6. Xóa Stats & Analytics
        # Nếu xóa all source -> Xóa hết DailyStat
        # Nếu xóa 1 source -> Chỉ xóa DailyAnalytics của source đó, DailyStat sẽ sai (Cần tính lại - nhưng logic hiện tại chấp nhận xóa luôn DailyStat để re-calculate sau)
        del_analytics = db.query(models.DailyAnalytics).filter(
            models.DailyAnalytics.brand_id == brand_id,
            models.DailyAnalytics.date.between(start_date, end_date)
        )
        if source: del_analytics = del_analytics.filter(models.DailyAnalytics.source == source)
        del_analytics.delete(synchronize_session=False)

        # Luôn xóa DailyStat để trigger tính lại (hoặc clear data cũ)
        db.query(models.DailyStat).filter(
            models.DailyStat.brand_id == brand_id,
            models.DailyStat.date.between(start_date, end_date)
        ).delete(synchronize_session=False)

        db.commit()
        
        # Clear Cache
        clear_brand_cache(brand_id)
        
    except Exception as e:
        db.rollback()
        print(f"ERROR: Failed to delete data: {e}")
        traceback.print_exc()
        raise e
