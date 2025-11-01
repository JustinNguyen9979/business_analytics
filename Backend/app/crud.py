# FILE: backend/app/crud.py (PHIÊN BẢN CUỐI CÙNG - ỔN ĐỊNH)

import json
from sqlalchemy.orm import Session
from sqlalchemy import func, union_all, select
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
        # (Các chỉ số vận hành khác sẽ được bổ sung ở đây)

        # === KHỐI TÍNH TOÁN KHÁCH HÀNG (Dựa trên ngày đặt hàng) ===
        # (Các chỉ số khách hàng sẽ được bổ sung ở đây)

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
            "gmv": gmv,
            "netRevenue": netRevenue,
            "cogs": cogs,
            "executionCost": executionCost,
            "adSpend": adSpend,
            "totalCost": totalCost,
            "profit": profit,
            "totalOrders": totalOrders,
            "roi": roi,
            "profitMargin": profitMargin,
            "takeRate": takeRate,
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
    final_kpis = {field: 0 for field in schemas.KpiSet.model_fields.keys()}
    days_to_calculate_live = []

    for i, daily_kpi_json in enumerate(cached_daily_kpis_json):
        if daily_kpi_json:
            try:
                daily_kpi = json.loads(daily_kpi_json)
                for key, value in daily_kpi.items():
                    if key in final_kpis: final_kpis[key] += value
            except (json.JSONDecodeError, TypeError):
                days_to_calculate_live.append(all_days[i])
        else:
            days_to_calculate_live.append(all_days[i])

    if days_to_calculate_live:
        print(f"API: Cache miss cho các ngày: {[d.isoformat() for d in days_to_calculate_live]}. Tính toán 'sống'...")
        for day in days_to_calculate_live:
            live_kpis = _calculate_daily_kpis_from_db(db, brand_id, day)
            cache_key = f"kpi_daily:{brand_id}:{day.isoformat()}"
            redis_client.setex(cache_key, timedelta(days=1), json.dumps(live_kpis))
            for key, value in live_kpis.items():
                if key in final_kpis: final_kpis[key] += value
        
        # === KÍCH HOẠT WORKER NGẦM ===
        # Nếu phát hiện có ngày bị thiếu trong cache, ra lệnh cho worker chạy nền
        # để kiểm tra và tính toán lại toàn bộ dữ liệu cho brand này.
        print(f"API: Phát hiện cache lỗi thời cho brand ID {brand_id}. Kích hoạt worker tự sửa chữa.")
        process_brand_data.delay(brand_id)
        # ==============================
    
    brand.kpis = final_kpis
    return brand

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