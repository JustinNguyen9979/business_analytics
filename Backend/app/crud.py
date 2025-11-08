# FILE: backend/app/crud.py (PHIÊN BẢN CUỐI CÙNG - ỔN ĐỊNH)

import json
from sqlalchemy.orm import Session
from sqlalchemy import func, union_all, select, or_, cast, Integer, String, and_
from sqlalchemy.dialects.postgresql import JSONB
import models, schemas
from datetime import date, timedelta
from cache import redis_client
import math as Math
import math
import pandas as pd
import random
from vietnam_address_mapping import NEW_PROVINCES, get_new_province_name
from province_centroids import PROVINCE_CENTROIDS 


def parseFloat(value): # Hàm helper
    try: return float(str(value).replace(',', ''))
    except (ValueError, TypeError): return 0.0

def _calculate_daily_kpis_from_db(db: Session, brand_id: int, target_date: date):
    """Hàm tính toán KPI cho MỘT ngày duy nhất, với logic đã được sửa lại hoàn toàn."""
    try:
        # Lấy dữ liệu thô theo từng dòng thời gian
        orders_placed_in_day = db.query(models.Order).filter(models.Order.brand_id == brand_id, models.Order.order_date == target_date).all()
        revenues_in_day = db.query(models.Revenue).filter(models.Revenue.brand_id == brand_id, models.Revenue.transaction_date == target_date).all()
        ads_in_day = db.query(models.Ad).filter(models.Ad.brand_id == brand_id, models.Ad.ad_date == target_date).all()

        # === KHỐI TÍNH TOÁN TÀI CHÍNH (Dựa trên ngày giao dịch) ===
        gmv = sum(r.gmv for r in revenues_in_day)
        netRevenue = sum(r.net_revenue for r in revenues_in_day)
        
        order_codes_from_revenues = {r.order_code for r in revenues_in_day if r.order_code}
        cogs = 0
        if order_codes_from_revenues:
            financial_orders = db.query(models.Order).filter(models.Order.brand_id == brand_id, models.Order.order_code.in_(order_codes_from_revenues)).all()
            cogs = sum(o.cogs for o in financial_orders)

        total_fees_and_subsidies = sum(
            parseFloat(r.details.get('Phí cố định', 0)) +
            parseFloat(r.details.get('Phí Dịch Vụ', 0)) +
            parseFloat(r.details.get('Phí thanh toán', 0)) +
            parseFloat(r.details.get('Phí vận chuyển thực tế', 0)) +
            parseFloat(r.details.get('Mã ưu đãi do Người Bán chịu', 0)) +
            parseFloat(r.details.get('Phí hoa hồng Tiếp thị liên kết', 0)) +
            parseFloat(r.details.get('Phí trả hàng', 0)) +
            parseFloat(r.details.get('Phí trả hàng cho người bán', 0)) +
            parseFloat(r.details.get('Phí dịch vụ PiShip', 0)) +
            parseFloat(r.details.get('Phí vận chuyển được trợ giá từ Shopee', 0)) +
            parseFloat(r.details.get('Phí vận chuyển được hoàn bởi PiShip', 0))
            for r in revenues_in_day if r.details is not None
        )
        # Chi phí thực thi là giá trị dương của tổng các khoản phí
        executionCost = abs(total_fees_and_subsidies)
        
        # === KHỐI TÍNH TOÁN MARKETING (Dựa trên ngày quảng cáo) ===
        adSpend = sum(a.expense for a in ads_in_day)
        # (Các chỉ số marketing khác sẽ được bổ sung ở đây khi có đủ dữ liệu)
        
        # === KHỐI TÍNH TOÁN VẬN HÀNH (Dựa trên ngày đặt hàng) ===
        totalOrders = len(set(o.order_code for o in orders_placed_in_day))
        
        # 1. Xác định các mã đơn hàng bị hủy và hoàn trong ngày
        cancelled_order_codes = {
            o.order_code for o in orders_placed_in_day 
            if o.status and ( 'hủy' in o.status.lower() or 'cancel' in o.status.lower() )
        }
        
        refunded_order_codes = {
            r.order_code for r in revenues_in_day 
            if r.details and r.details.get('Mã yêu cầu hoàn tiền') not in (None, 'nan', '')
        }

        # 2. Tính số lượng đơn hàng
        cancelledOrders = len(cancelled_order_codes)
        refundedOrders = len(refunded_order_codes)
        completedOrders = max(0, totalOrders - cancelledOrders - refundedOrders)

        # Tính AOV, UPT, Unique SKUs Sold
        totalQuantitySoldInCompletedOrders = 0
        unique_skus_sold_set = set()
        
        # 4. Lặp qua các đơn hàng đặt trong ngày để lấy dữ liệu cho đơn chốt
        for order in orders_placed_in_day:
            # Chỉ xét các đơn hàng không bị hủy và không bị hoàn
            if order.order_code not in cancelled_order_codes and order.order_code not in refunded_order_codes:
                # Cộng dồn tổng số lượng sản phẩm từ các đơn chốt
                totalQuantitySoldInCompletedOrders += order.total_quantity
                
                # Trích xuất SKU từ `details` để đếm số SKU duy nhất
                if order.details and 'items' in order.details:
                    for item in order.details['items']:
                        if item.get('sku'):
                            unique_skus_sold_set.add(item['sku'])

        # 5. Tính toán các chỉ số mới
        aov = (gmv / completedOrders) if completedOrders > 0 else 0
        upt = (totalQuantitySoldInCompletedOrders / completedOrders) if completedOrders > 0 else 0
        uniqueSkusSold = len(unique_skus_sold_set)
        # ==========================================================

        # === KHỐI TÍNH TOÁN KHÁCH HÀNG (Dựa trên ngày đặt hàng) ===
        # 1. Lấy danh sách khách hàng duy nhất có đơn trong ngày
        usernames_today = {o.username for o in orders_placed_in_day if o.username}
        totalCustomers = len(usernames_today)
        newCustomers = 0
        
        if usernames_today:
            # 2. Với mỗi khách, tìm ngày đặt hàng đầu tiên của họ
            # Đây là một truy vấn tối ưu, lấy ngày đầu tiên cho TẤT CẢ các khách hàng trong 1 lần gọi DB
            first_order_dates_query = db.query(
                models.Order.username,
                func.min(models.Order.order_date).label('first_date')
            ).filter(
                models.Order.brand_id == brand_id,
                models.Order.username.in_(usernames_today)
            ).group_by(models.Order.username).all()

            first_order_map = {username: first_date for username, first_date in first_order_dates_query}

            # 3. Đếm xem có bao nhiêu khách hàng có ngày đầu tiên là hôm nay
            for username in usernames_today:
                if first_order_map.get(username) == target_date:
                    newCustomers += 1

        # 4. Tính các chỉ số còn lại
        returningCustomers = totalCustomers - newCustomers
        
        # === KHỐI TỔNG HỢP & TÍNH CÁC CHỈ SỐ PHỤ THUỘC ===
        totalCost = cogs + executionCost + adSpend
        profit = netRevenue - totalCost
        
        # 5. Tính các chỉ số phái sinh từ Khách hàng
        cac = (adSpend / newCustomers) if newCustomers > 0 else 0
        retentionRate = (returningCustomers / totalCustomers) if totalCustomers > 0 else 0
        ltv = (profit / totalCustomers) if totalCustomers > 0 else 0

        # === KHỐI TỔNG HỢP & TÍNH CÁC CHỈ SỐ PHỤ THUỘC ===
        totalCost = cogs + executionCost + adSpend
        profit = netRevenue - cogs  # Lợi nhuận gộp = Doanh thu ròng - Giá vốn
        
        # Công thức tính ROI, Tỷ suất lợi nhuận, Take Rate
        roi = (profit / totalCost) if totalCost > 0 else 0
        profitMargin = (profit / netRevenue) if netRevenue != 0 else 0
        takeRate = (executionCost / gmv) if gmv > 0 else 0
        
        # --- BƯỚC 2: TẠO DICTIONARY KẾT QUẢ ---
        daily_kpis = {field: 0 for field in schemas.KpiSet.model_fields.keys()}
        daily_kpis.update({
            # Tài chính
            "gmv": gmv,
            "netRevenue": netRevenue,
            "cogs": cogs,
            "executionCost": executionCost,
            "adSpend": adSpend,
            "totalCost": totalCost,
            "profit": profit,

            # Tỷ lệ tài chính
            "roi": roi,
            "profitMargin": profitMargin,
            "takeRate": takeRate,

            # Vận hành
            "totalOrders": totalOrders,
            "completedOrders": completedOrders,
            "cancelledOrders": cancelledOrders,
            "refundedOrders": refundedOrders,
            "aov": aov,
            "upt": upt,
            "uniqueSkusSold": uniqueSkusSold,

            "totalQuantitySold": totalQuantitySoldInCompletedOrders,

            # Khách hàng
            "totalCustomers": totalCustomers,
            "newCustomers": newCustomers,
            "returningCustomers": returningCustomers,
            "cac": cac,
            "retentionRate": retentionRate,
            "ltv": ltv,
        })
        return daily_kpis
        
    except Exception as e:
        print(f"!!! LỖI NGHIÊM TRỌNG KHI TÍNH TOÁN KPI CHO NGÀY {target_date}: {e}")
        return {field: 0 for field in schemas.KpiSet.model_fields.keys()}

def get_all_activity_dates(db: Session, brand_id: int):
    order_dates = db.query(models.Order.order_date.label("activity_date")).filter(models.Order.brand_id == brand_id, models.Order.order_date.isnot(None))
    revenue_dates = db.query(models.Revenue.transaction_date.label("activity_date")).filter(models.Revenue.brand_id == brand_id, models.Revenue.transaction_date.isnot(None))
    ad_dates = db.query(models.Ad.ad_date.label("activity_date")).filter(models.Ad.brand_id == brand_id, models.Ad.ad_date.isnot(None))
    all_dates_union = union_all(order_dates, revenue_dates, ad_dates).alias("all_dates")
    distinct_dates_query = select(all_dates_union.c.activity_date).distinct()
    return sorted([d for d, in db.execute(distinct_dates_query).fetchall()])

def get_all_brand_ids(db: Session):
    """Lấy danh sách ID của tất cả các brand."""
    return [id for id, in db.query(models.Brand.id).all()]

def calculate_and_cache_daily_kpis(db: Session, brand_id: int, target_date: date):
    daily_kpis = _calculate_daily_kpis_from_db(db, brand_id, target_date)
    cache_key = f"kpi_daily:{brand_id}:{target_date.isoformat()}"
    redis_client.setex(cache_key, timedelta(days=90), json.dumps(daily_kpis))
    print(f"WORKER: Đã cache xong KPI cho key: {cache_key}")

def get_brand_details(db: Session, brand_id: int, start_date: date, end_date: date):
    """
    Lấy thông tin chi tiết của Brand cùng với các chỉ số KPI đã được tổng hợp.
    Hàm này sẽ trả về một tuple: (brand_object, cache_was_missing_flag).
    """
    brand = get_brand(db, brand_id)
    if not brand:
        # Trả về tuple (None, False) nếu không tìm thấy brand
        return None, False

    all_days = [start_date + timedelta(days=x) for x in range((end_date - start_date).days + 1)]
    cache_keys = [f"kpi_daily:{brand_id}:{day.isoformat()}" for day in all_days]
    
    cached_daily_kpis_json = redis_client.mget(cache_keys)
    
    aggregated_base_kpis = {
        # Tài chính
        "gmv": 0, "netRevenue": 0, "cogs": 0, "executionCost": 0,
        "adSpend": 0, "totalCost": 0, "profit": 0,
        # Vận hành
        "totalOrders": 0, "completedOrders": 0, "cancelledOrders": 0, "refundedOrders": 0,
        "totalQuantitySold": 0 
    }

    days_to_calculate_live = []
    for i, daily_kpi_json in enumerate(cached_daily_kpis_json):
        if daily_kpi_json:
            try:
                daily_kpi = json.loads(daily_kpi_json)
                for key in aggregated_base_kpis.keys():
                    aggregated_base_kpis[key] += daily_kpi.get(key, 0)
            except (json.JSONDecodeError, TypeError):
                days_to_calculate_live.append(all_days[i])
        else:
            days_to_calculate_live.append(all_days[i])

    # Tạo một cờ để báo hiệu cho lớp API biết là cache có bị lỗi/thiếu hay không
    cache_was_missing = False
    if days_to_calculate_live:
        cache_was_missing = True # Đặt cờ thành True
        print(f"CRUD: Cache miss cho các ngày: {[d.isoformat() for d in days_to_calculate_live]}. Tính toán 'sống'...")
        for day in days_to_calculate_live:
            live_kpis = _calculate_daily_kpis_from_db(db, brand_id, day)
            cache_key = f"kpi_daily:{brand_id}:{day.isoformat()}"
            # Cache lại kết quả vừa tính, nhưng với thời gian ngắn (1 ngày)
            redis_client.setex(cache_key, timedelta(days=1), json.dumps(live_kpis))
            for key in aggregated_base_kpis.keys():
                aggregated_base_kpis[key] += live_kpis.get(key, 0)
        
        # <<< LỖI ĐÃ ĐƯỢC SỬA: XÓA DÒNG GỌI WORKER KHỎI ĐÂY >>>
        # Dòng `process_brand_data.delay(brand_id)` đã được gỡ bỏ.
        # Nhiệm vụ này sẽ do endpoint trong `main.py` thực hiện.

    final_kpis = schemas.KpiSet.model_validate(aggregated_base_kpis).model_dump()

    # --- Phần tính toán các chỉ số phái sinh ---
    # (Toàn bộ logic này giữ nguyên vì đã đúng)

    totalCustomers = db.query(func.count(models.Order.username.distinct()))\
        .filter(
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
    
    total_profit_final = final_kpis['profit']
    total_adspend_final = final_kpis['adSpend']

    returningCustomers = totalCustomers - newCustomers
    cac = (total_adspend_final / newCustomers) if newCustomers > 0 else 0
    retentionRate = (returningCustomers / totalCustomers) if totalCustomers > 0 else 0
    ltv = (total_profit_final / totalCustomers) if totalCustomers > 0 else 0
    
    gmv = final_kpis['gmv']
    completed_orders_final = final_kpis['completedOrders']
    total_quantity_sold_final = final_kpis['totalQuantitySold']
    total_orders_final = final_kpis['totalOrders']

    final_kpis['roi'] = (final_kpis['profit'] / final_kpis['totalCost']) if final_kpis['totalCost'] > 0 else 0
    final_kpis['profitMargin'] = (final_kpis['profit'] / final_kpis['netRevenue']) if final_kpis['netRevenue'] != 0 else 0
    final_kpis['takeRate'] = (final_kpis['executionCost'] / gmv) if gmv > 0 else 0
    final_kpis['completionRate'] = (completed_orders_final / total_orders_final) if total_orders_final > 0 else 0
    final_kpis['cancellationRate'] = (final_kpis['cancelledOrders'] / total_orders_final) if total_orders_final > 0 else 0
    final_kpis['refundRate'] = (final_kpis['refundedOrders'] / total_orders_final) if total_orders_final > 0 else 0
    final_kpis['aov'] = (gmv / completed_orders_final) if completed_orders_final > 0 else 0
    final_kpis['upt'] = (total_quantity_sold_final / completed_orders_final) if completed_orders_final > 0 else 0

    final_kpis['totalCustomers'] = totalCustomers
    final_kpis['newCustomers'] = newCustomers
    final_kpis['returningCustomers'] = returningCustomers
    final_kpis['cac'] = cac
    final_kpis['retentionRate'] = retentionRate
    final_kpis['ltv'] = ltv

    refunded_codes_in_period = {
        code for code, in db.query(models.Revenue.order_code)\
            .filter(
                models.Revenue.brand_id == brand_id,
                models.Revenue.transaction_date.between(start_date, end_date),
                models.Revenue.details['Mã yêu cầu hoàn tiền'].as_string() != 'nan',
                models.Revenue.details['Mã yêu cầu hoàn tiền'].as_string() != ''
            ).all()
    }
    completed_orders_in_period = db.query(models.Order)\
        .filter(
            models.Order.brand_id == brand_id,
            models.Order.order_date.between(start_date, end_date),
            ~or_(
                models.Order.status.ilike('%hủy%'),
                models.Order.status.ilike('%cancel%')
            ),
            ~models.Order.order_code.in_(refunded_codes_in_period)
        ).all()
        
    unique_skus_in_period = set()
    for order in completed_orders_in_period:
        if order.details and 'items' in order.details:
            for item in order.details['items']:
                if item.get('sku'):
                    unique_skus_in_period.add(item['sku'])
    
    final_kpis['uniqueSkusSold'] = len(unique_skus_in_period)
    
    brand.kpis = final_kpis
    
    # Trả về một tuple chứa object brand và cờ báo hiệu cache
    return brand, cache_was_missing

def recalculate_brand_data_sync(db: Session, brand_id: int):
    """
    Hàm này chạy đồng bộ: Xóa cache, tính toán lại và lưu cache mới.
    Được gọi trực tiếp từ API endpoint.
    """
    print(f"SYNC RECALC: Bắt đầu tính toán lại đồng bộ cho brand ID {brand_id}.")
    
    # 1. Xóa tất cả cache cũ của brand này
    keys_to_delete = redis_client.keys(f"kpi_daily:{brand_id}:*")
    if keys_to_delete:
        redis_client.delete(*keys_to_delete)
        print(f"SYNC RECALC: Đã xóa {len(keys_to_delete)} cache keys cho brand ID {brand_id}.")

    # 2. Lấy tất cả các ngày có hoạt động
    all_activity_dates = get_all_activity_dates(db, brand_id=brand_id)
    if not all_activity_dates:
        print(f"SYNC RECALC: Không tìm thấy ngày nào có hoạt động cho brand ID {brand_id}.")
        return {"message": f"Brand ID {brand_id} không có dữ liệu để tính toán."}
    
    # 3. Lặp qua từng ngày và tính toán lại (giống hệt worker)
    print(f"SYNC RECALC: Sẽ tính toán lại cho brand ID {brand_id} vào {len(all_activity_dates)} ngày.")
    for target_date in all_activity_dates:
        # Tái sử dụng hàm `calculate_and_cache_daily_kpis`
        calculate_and_cache_daily_kpis(db, brand_id=brand_id, target_date=target_date)
        
    print(f"SYNC RECALC: Hoàn thành tính toán lại đồng bộ cho brand ID {brand_id}.")
    return {"message": "Dữ liệu đã được tính toán lại và làm mới thành công!"}

def get_brand(db: Session, brand_id: int):
    return db.query(models.Brand).filter(models.Brand.id == brand_id).first()

def get_brand_by_name(db: Session, name: str):
    return db.query(models.Brand).filter(models.Brand.name == name).first()

def create_brand(db: Session, brand: schemas.BrandCreate):
    clean_name = brand.name.strip()
    if db.query(models.Brand).filter(models.Brand.name == clean_name).first():
        return None
    db_brand = models.Brand(name=clean_name)
    db.add(db_brand)
    db.commit()
    db.refresh(db_brand)
    return db_brand

def get_or_create_product(db: Session, sku: str, brand_id: int):
    db_product = db.query(models.Product).filter(models.Product.sku == sku, models.Product.brand_id == brand_id).first()
    if not db_product:
        db_product = models.Product(sku=sku, brand_id=brand_id)
        db.add(db_product)
        db.commit()
        db.refresh(db_product)
    return db_product

def update_product_details(db: Session, product_id: int, name: str, cost_price: int):
    db.query(models.Product).filter(models.Product.id == product_id).update({
        "name": name,
        "cost_price": cost_price
    })
    db.commit()

def get_or_create_customer(db: Session, customer_data: dict, brand_id: int):
    username = customer_data.get('Người Mua')
    if not username:
        return None
    db_customer = db.query(models.Customer).filter(models.Customer.username == username, models.Customer.brand_id == brand_id).first()
    if not db_customer:
        db_customer = models.Customer(
            username=username,
            city=customer_data.get('Tỉnh/Thành phố'),
            district_1=customer_data.get('TP / Quận / Huyện'),
            district_2=customer_data.get('Quận'),
            brand_id=brand_id
        )
        db.add(db_customer)
        db.commit()
        db.refresh(db_customer)
    return db_customer

def create_order_entry(db: Session, order_data: dict, brand_id: int, source: str):
    new_order = models.Order(**order_data, brand_id=brand_id, source=source)
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order

def create_ad_entry(db: Session, ad_data: dict, brand_id: int, source: str):
    new_ad = models.Ad(**ad_data, brand_id=brand_id, source=source)
    db.add(new_ad)
    db.commit()
    db.refresh(new_ad)
    return new_ad

def create_revenue_entry(db: Session, revenue_data: dict, brand_id: int, source: str):
    new_revenue = models.Revenue(**revenue_data, brand_id=brand_id, source=source)
    db.add(new_revenue)
    db.commit()
    db.refresh(new_revenue)
    return new_revenue

def delete_brand_by_id(db: Session, brand_id: int):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if db_brand:
        db.delete(db_brand)
        db.commit()
    return db_brand

def update_brand_name(db: Session, brand_id: int, new_name: str):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if db_brand:
        clean_new_name = new_name.strip()
        existing_brand = db.query(models.Brand).filter(models.Brand.name == clean_new_name, models.Brand.id != brand_id).first()
        if existing_brand:
            return None
        db_brand.name = clean_new_name
        db.commit()
        db.refresh(db_brand)
    return db_brand

def clone_brand(db: Session, brand_id: int):
    original_brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if not original_brand:
        return None
    base_name = original_brand.name.split(' - Copy')[0]
    copy_number = 1
    new_name = f"{base_name} - Copy"
    while db.query(models.Brand).filter(models.Brand.name == new_name).first():
        copy_number += 1
        new_name = f"{base_name} - Copy {copy_number}"
    cloned_brand = models.Brand(name=new_name)
    db.add(cloned_brand)
    db.commit()
    db.refresh(cloned_brand)
    return cloned_brand

def get_daily_kpis_for_range(db: Session, brand_id: int, start_date: date, end_date: date):
    """
    Lấy danh sách KPI hàng ngày cho một brand trong một khoảng thời gian.
    Hàm này sẽ ưu tiên lấy từ cache, nếu không có sẽ tính toán trực tiếp.
    """
    all_days = [start_date + timedelta(days=x) for x in range((end_date - start_date).days + 1)]
    cache_keys = [f"kpi_daily:{brand_id}:{day.isoformat()}" for day in all_days]
    
    cached_data = redis_client.mget(cache_keys)
    daily_kpi_list = []

    for i, daily_kpi_json in enumerate(cached_data):
        target_date = all_days[i]
        if daily_kpi_json:
            try:
                kpis = json.loads(daily_kpi_json)
                daily_kpi_list.append({
                    "date": target_date,
                    "netRevenue": kpis.get("netRevenue", 0),
                    "profit": kpis.get("profit", 0)
                })
            except (json.JSONDecodeError, TypeError):
                # Nếu cache bị lỗi, tính toán lại
                live_kpis = _calculate_daily_kpis_from_db(db, brand_id, target_date)
                daily_kpi_list.append({
                    "date": target_date,
                    "netRevenue": live_kpis.get("netRevenue", 0),
                    "profit": live_kpis.get("profit", 0)
                })
        else:
            # Nếu cache miss, tính toán lại
            live_kpis = _calculate_daily_kpis_from_db(db, brand_id, target_date)
            daily_kpi_list.append({
                "date": target_date,
                "netRevenue": live_kpis.get("netRevenue", 0),
                "profit": live_kpis.get("profit", 0)
            })
            # Cache lại kết quả vừa tính
            calculate_and_cache_daily_kpis(db, brand_id, target_date)

    return daily_kpi_list

def get_top_selling_products(db: Session, brand_id: int, start_date: date, end_date: date, limit: int = 10):
    """
    Lấy danh sách các sản phẩm bán chạy nhất.
    """
    try:
        # Bước 1: Chỉ truy vấn lấy các đơn hàng cần thiết, không xử lý JSON ở đây
        orders_in_range = db.query(models.Order).filter(
            models.Order.brand_id == brand_id,
            models.Order.order_date.between(start_date, end_date)
        ).all()

        if not orders_in_range:
            return []

        # Bước 2: Dùng Python để duyệt và trích xuất dữ liệu item một cách an toàn
        all_items = []
        for order in orders_in_range:
            # Kiểm tra an toàn: `details` có tồn tại, có key 'items', và 'items' là một list
            if order.details and isinstance(order.details.get('items'), list):
                for item in order.details['items']:
                    # Kiểm tra an toàn: item là dict và có đủ key 'sku', 'quantity'
                    if isinstance(item, dict) and item.get('sku') and item.get('quantity'):
                        try:
                            # Chuyển đổi số lượng sang integer, nếu lỗi thì bỏ qua item này
                            quantity = int(item['quantity'])
                            all_items.append({'sku': str(item['sku']), 'quantity': quantity})
                        except (ValueError, TypeError):
                            continue # Bỏ qua nếu quantity không phải là số

        if not all_items:
            return []
            
        # Bước 3: Dùng Pandas để tổng hợp dữ liệu một cách hiệu quả
        df = pd.DataFrame(all_items)
        top_products_df = df.groupby('sku')['quantity'].sum().nlargest(limit).reset_index()
        
        # Chuyển DataFrame kết quả thành danh sách dictionary
        top_skus_list = top_products_df.to_dict('records')
        top_skus_map = {item['sku']: item['quantity'] for item in top_skus_list}
        skus_to_query = list(top_skus_map.keys())

        # Bước 4: Lấy tên sản phẩm từ bảng Product
        products_info = db.query(models.Product.sku, models.Product.name).filter(
            models.Product.brand_id == brand_id,
            models.Product.sku.in_(skus_to_query)
        ).all()
        product_name_map = {sku: name for sku, name in products_info}

        # Bước 5: Kết hợp kết quả và trả về
        final_results = []
        for sku_item in top_skus_list:
            sku = sku_item['sku']
            final_results.append({
                "sku": sku,
                "total_quantity": int(sku_item['quantity']), # Ép kiểu về int cho an toàn
                "name": product_name_map.get(sku, sku) # Nếu không có tên, dùng SKU làm tên
            })
        
        return final_results

    except Exception as e:
        print(f"!!! LỖI NGHIÊM TRỌNG KHI LẤY TOP PRODUCTS: {e}")
        return []

def normalize_city_name(city_name: str):
    """
    Hàm chuẩn hóa tên thành phố/tỉnh một cách thông minh.
    Nó sẽ cố gắng khớp tên đầu vào với danh sách tỉnh/thành chuẩn từ VietMap.
    """
    if not city_name:
        return None

    # Chuyển thành chữ thường, bỏ dấu, và bỏ các tiền tố phổ biến
    normalized_input = unidecode(city_name).lower().strip()
    normalized_input = normalized_input.replace('thanh pho', '').replace('tp', '').replace('tinh', '').strip()
    
    # Ưu tiên 1: Tìm kiếm khớp chính xác (sau khi đã chuẩn hóa)
    for code, details in PROVINCE_DATA.items():
        # So sánh slug (đã bỏ dấu)
        if details["slug"].replace('-', '') == normalized_input.replace(' ', ''):
            # Trả về tên chuẩn có dấu
            return details["name"]
        # So sánh tên không dấu
        if unidecode(details["name"]).lower() == normalized_input:
            return details["name"]

    # Ưu tiên 2: Tìm kiếm xem tên chuẩn có nằm trong chuỗi đầu vào không
    # Ví dụ: "Thành phố Huế" -> "Huế"
    for name in PROVINCE_NAMES:
        if name in city_name:
            return name
            
    # Nếu không tìm thấy, trả về None để có thể bỏ qua
    return None

def get_customer_distribution(db: Session, brand_id: int, start_date: date, end_date: date):
    """
    Lấy dữ liệu phân bổ khách hàng, tổng hợp theo 34 tỉnh/thành mới.
    1. Lấy số lượng khách hàng duy nhất theo từng tên tỉnh/thành phố có trong DB.
    2. Ánh xạ mỗi tên tỉnh cũ sang tỉnh mới tương ứng.
    3. Cộng dồn số lượng khách hàng vào các tỉnh mới.
    """
    # Bước 1: Vẫn truy vấn như cũ để lấy dữ liệu thô
    raw_counts = db.query(
        models.Customer.city,
        func.count(models.Order.username.distinct()).label('unique_customers')
    ).join(
        models.Customer,
        and_(
            models.Order.username == models.Customer.username,
            models.Order.brand_id == models.Customer.brand_id
        )
    ).filter(
        models.Order.brand_id == brand_id,
        models.Order.order_date.between(start_date, end_date),
        models.Customer.city.isnot(None),
        models.Customer.city != ''
    ).group_by(
        models.Customer.city
    ).all()

    # Bước 2: Chuẩn bị một "xô" chứa số đếm cho 34 tỉnh mới
    new_province_counts = {province_name: 0 for province_name in NEW_PROVINCES.keys()}

    # Bước 3: Duyệt qua dữ liệu thô, ánh xạ và cộng dồn
    for old_city_name, count in raw_counts:
        new_province = get_new_province_name(old_city_name)
        
        if new_province and new_province in new_province_counts:
            new_province_counts[new_province] += count
    
    # Bước 4: Chuyển đổi kết quả về định dạng API mong muốn
    final_distribution = [
        {"city": name, "customer_count": count}
        for name, count in new_province_counts.items()
        if count > 0 # Chỉ trả về các tỉnh có khách
    ]
    
    return sorted(final_distribution, key=lambda item: item['customer_count'], reverse=True)


def get_customer_distribution_with_coords(db: Session, brand_id: int, start_date: date, end_date: date):
    """
    Lấy dữ liệu phân bổ khách hàng kèm theo tọa độ trung tâm của tỉnh/thành.
    """
    # Bước 1: Lấy dữ liệu phân bổ đã tính toán (city, customer_count)
    distribution_data = get_customer_distribution(db, brand_id, start_date, end_date)

    results_with_coords = []
    for item in distribution_data:
        city_name = item.get("city")
        customer_count = item.get("customer_count")

        if not city_name or not customer_count:
            continue

        # Bước 2: Lấy tọa độ trung tâm từ dictionary đã có
        centroid = PROVINCE_CENTROIDS.get(city_name)
        
        if centroid:
            # Bước 3: Thêm vào danh sách kết quả
            results_with_coords.append({
                "city": city_name,
                "customer_count": customer_count,
                "coords": centroid # centroid đã là một list [lon, lat]
            })

    return results_with_coords