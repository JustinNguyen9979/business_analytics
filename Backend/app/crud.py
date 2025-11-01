# FILE: backend/app/crud.py (PHIÊN BẢN CUỐI CÙNG - ỔN ĐỊNH)

import json
from sqlalchemy.orm import Session
from sqlalchemy import func, union_all, select, or_
import models, schemas
from datetime import date, timedelta
from cache import redis_client
import math as Math


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
    from celery_worker import process_brand_data
    brand = get_brand(db, brand_id)
    if not brand: return None

    all_days = [start_date + timedelta(days=x) for x in range((end_date - start_date).days + 1)]
    cache_keys = [f"kpi_daily:{brand_id}:{day.isoformat()}" for day in all_days]
    
    cached_daily_kpis_json = redis_client.mget(cache_keys)
    
    # <<< SỬA LỖI 1 & 2: CHỈ CỘNG DỒN CÁC CHỈ SỐ GỐC, LOẠI BỎ AOV/UPT/SKU VÀ THÊM totalQuantitySold >>>
    aggregated_base_kpis = {
        # Tài chính
        "gmv": 0, "netRevenue": 0, "cogs": 0, "executionCost": 0,
        "adSpend": 0, "totalCost": 0, "profit": 0,
        # Vận hành
        "totalOrders": 0, "completedOrders": 0, "cancelledOrders": 0, "refundedOrders": 0,
        "totalQuantitySold": 0 # Chỉ số gốc mới để tính UPT
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

    if days_to_calculate_live:
        # ... (phần code xử lý cache miss giữ nguyên)
        print(f"API: Cache miss cho các ngày: {[d.isoformat() for d in days_to_calculate_live]}. Tính toán 'sống'...")
        for day in days_to_calculate_live:
            live_kpis = _calculate_daily_kpis_from_db(db, brand_id, day)
            cache_key = f"kpi_daily:{brand_id}:{day.isoformat()}"
            redis_client.setex(cache_key, timedelta(days=1), json.dumps(live_kpis))
            for key in aggregated_base_kpis.keys():
                aggregated_base_kpis[key] += live_kpis.get(key, 0)
        
        print(f"API: Phát hiện cache lỗi thời cho brand ID {brand_id}. Kích hoạt worker tự sửa chữa.")
        process_brand_data.delay(brand_id)

    final_kpis = schemas.KpiSet.model_validate(aggregated_base_kpis).model_dump()

    totalCustomers = db.query(func.count(models.Order.username.distinct()))\
        .filter(
            models.Order.brand_id == brand_id,
            models.Order.order_date.between(start_date, end_date)
        ).scalar() or 0

    # 1.2. Lấy số khách hàng mới trong giai đoạn (khách có đơn đầu tiên trong giai đoạn này)
    # Dùng subquery để tìm ngày đầu tiên của mỗi khách hàng, sau đó lọc những ai có ngày đầu tiên trong giai đoạn đang xét
    subquery = db.query(
        models.Order.username,
        func.min(models.Order.order_date).label('first_order_date')
    ).filter(models.Order.brand_id == brand_id).group_by(models.Order.username).subquery()

    newCustomers = db.query(func.count(subquery.c.username)).filter(
        subquery.c.first_order_date.between(start_date, end_date)
    ).scalar() or 0
    
    
    total_profit_final = final_kpis['profit']
    total_adspend_final = final_kpis['adSpend']

    # 1.3. Tính các chỉ số còn lại
    returningCustomers = totalCustomers - newCustomers
    cac = (total_adspend_final / newCustomers) if newCustomers > 0 else 0
    retentionRate = (returningCustomers / totalCustomers) if totalCustomers > 0 else 0
    ltv = (total_profit_final / totalCustomers) if totalCustomers > 0 else 0
    
    # Lấy các giá trị đã tổng hợp
    gmv = final_kpis['gmv']
    completed_orders_final = final_kpis['completedOrders']
    total_quantity_sold_final = final_kpis['totalQuantitySold']
    total_orders_final = final_kpis['totalOrders']

    # Tính toán lại các tỷ lệ tài chính
    final_kpis['roi'] = (final_kpis['profit'] / final_kpis['totalCost']) if final_kpis['totalCost'] > 0 else 0
    final_kpis['profitMargin'] = (final_kpis['profit'] / final_kpis['netRevenue']) if final_kpis['netRevenue'] != 0 else 0
    final_kpis['takeRate'] = (final_kpis['executionCost'] / gmv) if gmv > 0 else 0

    # Tính lại các tỷ lệ vận hành
    final_kpis['completionRate'] = (completed_orders_final / total_orders_final) if total_orders_final > 0 else 0
    final_kpis['cancellationRate'] = (final_kpis['cancelledOrders'] / total_orders_final) if total_orders_final > 0 else 0
    final_kpis['refundRate'] = (final_kpis['refundedOrders'] / total_orders_final) if total_orders_final > 0 else 0

    # Tính lại AOV và UPT dựa trên tổng số liệu
    final_kpis['aov'] = (gmv / completed_orders_final) if completed_orders_final > 0 else 0
    final_kpis['upt'] = (total_quantity_sold_final / completed_orders_final) if completed_orders_final > 0 else 0

    final_kpis['totalCustomers'] = totalCustomers
    final_kpis['newCustomers'] = newCustomers
    final_kpis['returningCustomers'] = returningCustomers
    final_kpis['cac'] = cac
    final_kpis['retentionRate'] = retentionRate
    final_kpis['ltv'] = ltv

    # Phần tính lại số SKU duy nhất bằng truy vấn DB đã rất chính xác, giữ nguyên
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
    return brand

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