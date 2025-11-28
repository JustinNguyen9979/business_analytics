# FILE: backend/app/crud.py

import models, json, schemas, traceback, re, unicodedata

from sqlalchemy.orm import Session
from sqlalchemy import func, union_all, select, and_
from datetime import date, timedelta
from cache import redis_client
from models import DailyStat
from province_centroids import PROVINCE_CENTROIDS

def _clear_brand_cache(brand_id: int):
    """Xóa các cache liên quan đến dashboard của một brand bằng cách dùng SCAN để không block Redis."""
    print(f"INFO: Clearing dashboard cache for brand_id: {brand_id}")
    # Dùng SCAN thay cho KEYS để an toàn hơn trên production
    cache_keys_to_delete = []
    
    # Quét cache request (API)
    for key in redis_client.scan_iter(f"data_req:{brand_id}:*"):
        cache_keys_to_delete.append(key)
        
    # Quét cache tính toán daily (KPI daily)
    for key in redis_client.scan_iter(f"kpi_daily:{brand_id}:*"):
        cache_keys_to_delete.append(key)
    
    if cache_keys_to_delete:
        redis_client.delete(*cache_keys_to_delete)
        print(f"INFO: Deleted {len(cache_keys_to_delete)} cache keys.")



def update_daily_stats(db: Session, brand_id: int, target_date: date):
    """
    Hàm này được Worker gọi.
    Nhiệm vụ: Lấy dữ liệu thô -> Gọi Calculator -> Lưu kết quả vào DailyStat (Tổng) và DailyAnalytics (Từng Source).
    """
    import kpi_calculator # Import local

    # 1. Lấy TOÀN BỘ dữ liệu thô trong ngày
    revenues = db.query(models.Revenue).filter(
        models.Revenue.brand_id == brand_id,
        models.Revenue.transaction_date == target_date
    ).all()
    
    marketing_spends = db.query(models.MarketingSpend).filter(
        models.MarketingSpend.brand_id == brand_id,
        models.MarketingSpend.date == target_date
    ).all()

    # Lấy orders cho revenue (cogs)
    revenue_order_codes = {r.order_code for r in revenues if r.order_code}
    orders_for_cogs = []
    if revenue_order_codes:
        orders_for_cogs = db.query(models.Order).filter(
            models.Order.brand_id == brand_id,
            models.Order.order_code.in_(revenue_order_codes)
        ).all()

    orders_created_today = db.query(models.Order).filter(
        models.Order.brand_id == brand_id, 
        func.date(models.Order.order_date) == target_date
    ).all()

    # Gộp danh sách tất cả orders liên quan trong ngày
    all_orders_map = {o.order_code: o for o in orders_for_cogs}
    all_orders_map.update({o.order_code: o for o in orders_created_today})
    final_orders_list = list(all_orders_map.values())

    # --- BƯỚC 2: XÁC ĐỊNH CÁC SOURCE CÓ HOẠT ĐỘNG TRONG NGÀY ---
    active_sources = set()
    active_sources.update({r.source for r in revenues if r.source})
    active_sources.update({o.source for o in orders_created_today if o.source})
    active_sources.update({m.source for m in marketing_spends if m.source})
    
    stat_entry_for_card = None

    # --- BƯỚC 3: TÍNH TOÁN VÀ LƯU CHO TỪNG SOURCE (Vào DailyAnalytics) ---
    for current_source in active_sources:
        # Lọc dữ liệu theo source
        filtered_revenues = [r for r in revenues if r.source == current_source]
        filtered_marketing = [m for m in marketing_spends if m.source == current_source]
        filtered_orders = [o for o in final_orders_list if o.source == current_source]
        filtered_created_orders = [o for o in orders_created_today if o.source == current_source]

        # Gọi Calculator tính toán
        created_today_codes = {o.order_code for o in filtered_created_orders}
        kpis = kpi_calculator.calculate_daily_kpis(filtered_orders, filtered_revenues, filtered_marketing, created_today_codes, db_session=db)

        # Lưu vào DailyAnalytics (Chia theo Source)
        analytics_entry = db.query(models.DailyAnalytics).filter(
            models.DailyAnalytics.brand_id == brand_id,
            models.DailyAnalytics.date == target_date,
            models.DailyAnalytics.source == current_source
        ).first()

        if not analytics_entry:
            analytics_entry = models.DailyAnalytics(brand_id=brand_id, date=target_date, source=current_source)
            db.add(analytics_entry)
        
        if kpis:
            for key, value in kpis.items():
                if hasattr(analytics_entry, key):
                    setattr(analytics_entry, key, value)

    # --- BƯỚC 4: TÍNH TOÁN TỔNG HỢP (Vào DailyStat) ---
    # Tính cho 'all' nhưng CHỈ lưu vào DailyStat
    all_created_codes = {o.order_code for o in orders_created_today}
    total_kpis = kpi_calculator.calculate_daily_kpis(final_orders_list, revenues, marketing_spends, all_created_codes, db_session=db)

    stat_entry = db.query(models.DailyStat).filter(
        models.DailyStat.brand_id == brand_id,
        models.DailyStat.date == target_date
    ).first()

    if not stat_entry:
        stat_entry = models.DailyStat(brand_id=brand_id, date=target_date)
        db.add(stat_entry)
    
    if total_kpis:
        for key, value in total_kpis.items():
            # Map vào DailyStat (Giờ đã có đủ cột JSONB để lưu full data)
            if hasattr(stat_entry, key):
                setattr(stat_entry, key, value)
    
    stat_entry_for_card = stat_entry

    db.commit()
    
    # 5. Xóa cache
    _clear_brand_cache(brand_id)

    return stat_entry_for_card

def slugify(value: str) -> str:
    """
    Normalizes string, converts to lowercase, removes non-alpha characters,
    and converts spaces to hyphens.
    """
    if not isinstance(value, str):
        value = str(value)
    # Chuyển đổi ký tự có dấu thành không dấu (ví dụ: 'á' -> 'a')
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode('ascii')
    # Xóa các ký tự không phải là chữ, số, khoảng trắng hoặc dấu gạch ngang
    value = re.sub(r'[^\w\s-]', '', value).strip().lower()
    # Thay thế khoảng trắng hoặc nhiều dấu gạch ngang bằng một dấu gạch ngang duy nhất
    return re.sub(r'[-\s]+', '-', value)


def get_raw_revenues_in_range(db: Session, brand_id: int, start_date: date, end_date: date) -> list[models.Revenue]:
    """Chỉ lấy ra danh sách các bản ghi doanh thu thô trong khoảng thời gian."""
    return db.query(models.Revenue).filter(
        models.Revenue.brand_id == brand_id,
        models.Revenue.transaction_date.between(start_date, end_date)
    ).all()

def get_raw_orders_in_range(db: Session, brand_id: int, start_date: date, end_date: date) -> list[models.Order]:
    """Chỉ lấy ra danh sách các bản ghi đơn hàng thô trong khoảng thời gian."""
    return db.query(models.Order).filter(
        models.Order.brand_id == brand_id,
        func.date(models.Order.order_date).between(start_date, end_date)
    ).all()

def get_all_activity_dates(db: Session, brand_id: int):
    order_dates = db.query(func.date(models.Order.order_date).label("activity_date")).filter(models.Order.brand_id == brand_id, models.Order.order_date.isnot(None))
    revenue_dates = db.query(models.Revenue.transaction_date.label("activity_date")).filter(models.Revenue.brand_id == brand_id, models.Revenue.transaction_date.isnot(None))
    marketing_dates = db.query(models.MarketingSpend.date.label("activity_date")).filter(models.MarketingSpend.brand_id == brand_id, models.MarketingSpend.date.isnot(None))
    all_dates_union = union_all(order_dates, revenue_dates, marketing_dates).alias("all_dates")
    distinct_dates_query = select(all_dates_union.c.activity_date).distinct()
    return sorted([d for d, in db.execute(distinct_dates_query).fetchall()])

def get_daily_kpis_for_range(db: Session, brand_id: int, start_date: date, end_date: date) -> list:
    """
    Lấy dữ liệu KPI tổng hợp cho Dashboard.
    Đọc trực tiếp từ bảng DailyStat (nơi chứa dữ liệu tổng hợp đầy đủ).
    """
    # Truy vấn bảng DailyStat
    stats = db.query(models.DailyStat).filter(
        models.DailyStat.brand_id == brand_id,
        models.DailyStat.date.between(start_date, end_date)
    ).order_by(models.DailyStat.date).all()

    results = []
    stats_map = {s.date: s for s in stats}
    
    current_date = start_date
    while current_date <= end_date:
        stat = stats_map.get(current_date)
        
        if stat:
            # Map từ cột model (snake_case) sang format JSON frontend (camelCase)
            results.append({
                "date": current_date.isoformat(),
                "netRevenue": stat.net_revenue,
                "gmv": stat.gmv,
                "profit": stat.profit,
                "totalCost": stat.total_cost,
                "adSpend": stat.ad_spend,
                "cogs": stat.cogs,
                "executionCost": stat.execution_cost,
                "roi": stat.roi,
                # "profitMargin": stat.profit_margin,
                # "takeRate": stat.take_rate,
                "completedOrders": stat.completed_orders,
                "cancelledOrders": stat.cancelled_orders,
                "refundedOrders": stat.refunded_orders,
                "aov": stat.aov,
                "upt": stat.upt,
                "uniqueSkusSold": stat.unique_skus_sold,
                "totalQuantitySold": stat.total_quantity_sold,
                "completionRate": stat.completion_rate,
                "cancellationRate": stat.cancellation_rate,
                "refundRate": stat.refund_rate,
                "totalCustomers": stat.total_customers, # Đã có cột này trong DailyStat
                "impressions": stat.impressions,
                "clicks": stat.clicks,
                "conversions": stat.conversions,
                "cpc": stat.cpc,
                "cpm": stat.cpm,
                "ctr": stat.ctr,
                "cpa": stat.cpa,
                "reach": stat.reach,
                "frequency": stat.frequency,
                
                # Các trường JSONB (Giờ đã có trong DailyStat)
                "hourlyBreakdown": stat.hourly_breakdown,
                "topProducts": stat.top_products,
                "locationDistribution": stat.location_distribution,
                "paymentMethodBreakdown": stat.payment_method_breakdown,
                "cancelReasonBreakdown": stat.cancel_reason_breakdown,
            })
        else:
            # Trả về 0 nếu không có dữ liệu
            results.append({
                "date": current_date.isoformat(),
                "netRevenue": 0, "gmv": 0, "profit": 0, "totalCost": 0, "adSpend": 0,
                "cogs": 0, "executionCost": 0, "roi": 0, 
                # "profitMargin": 0, "takeRate": 0,
                "completedOrders": 0, "cancelledOrders": 0, "refundedOrders": 0, "aov": 0,
                "upt": 0, "uniqueSkusSold": 0, "totalQuantitySold": 0,
                "completionRate": 0, "cancellationRate": 0, "refundRate": 0,
                "totalCustomers": 0,
                "impressions": 0, "clicks": 0, "conversions": 0, "cpc": 0,
                "cpa": 0, "cpm": 0, "ctr": 0, "reach": 0, "frequency": 0,
                "hourlyBreakdown": {}, "topProducts": [], "locationDistribution": [], "paymentMethodBreakdown": {}, "cancelReasonBreakdown": {}
            })            
        current_date += timedelta(days=1)

    return results

def get_all_brands(db: Session):
    """Lấy danh sách tất cả các brand."""
    return db.query(models.Brand).all()

def get_all_brands(db: Session):
    """Lấy danh sách tất cả các brand."""
    return db.query(models.Brand).all()

def get_brand(db: Session, brand_id: int):
    return db.query(models.Brand).filter(models.Brand.id == brand_id).first()

def get_brand_by_slug(db: Session, slug: str):
    return db.query(models.Brand).filter(models.Brand.slug == slug).first()

def get_brand_by_name(db: Session, name: str):
    return db.query(models.Brand).filter(models.Brand.name == name).first()

def create_brand(db: Session, brand: schemas.BrandCreate):
    clean_name = brand.name.strip()
    if db.query(models.Brand).filter(func.lower(models.Brand.name) == func.lower(clean_name)).first():
        return None
    
    # Tạo slug và đảm bảo nó là duy nhất
    base_slug = slugify(clean_name)
    unique_slug = base_slug
    counter = 1
    while db.query(models.Brand).filter(models.Brand.slug == unique_slug).first():
        unique_slug = f"{base_slug}-{counter}"
        counter += 1

    db_brand = models.Brand(name=clean_name, slug=unique_slug)
    db.add(db_brand)
    db.commit()
    db.refresh(db_brand)
    return db_brand

def upsert_product(db: Session, brand_id: int, sku: str, name: str, cost_price: int) -> models.Product:
    """
    Tìm một sản phẩm bằng SKU.
    - Nếu tìm thấy, CẬP NHẬT name và cost_price của nó.
    - Nếu không tìm thấy, TẠO MỚI sản phẩm với đầy đủ thông tin.
    """
    # Cố gắng tìm sản phẩm đã tồn tại
    db_product = db.query(models.Product).filter(
        models.Product.brand_id == brand_id, 
        models.Product.sku == sku
    ).first()

    if db_product:
        # TÌM THẤY -> CẬP NHẬT
        db_product.name = name
        db_product.cost_price = cost_price
    else:
        # KHÔNG TÌM THẤY -> TẠO MỚI với đầy đủ thông tin ngay từ đầu
        db_product = models.Product(
            brand_id=brand_id,
            sku=sku,
            name=name,
            cost_price=cost_price
        )
        db.add(db_product)
    return db_product

def upsert_marketing_spend(db: Session, brand_id: int, source: str, spend_data: schemas.MarketingSpendCreate) -> models.MarketingSpend:
    """
    Creates or updates a marketing spend record for a specific brand, source, and date.
    - If a record for the given brand, source, and date exists, it's updated.
    - Otherwise, a new record is created.
    """
    # Find existing record
    db_spend = db.query(models.MarketingSpend).filter(
        models.MarketingSpend.brand_id == brand_id,
        models.MarketingSpend.source == source,
        models.MarketingSpend.date == spend_data.date
    ).first()

    spend_data_dict = spend_data.model_dump()

    if db_spend:
        # Update existing record
        for key, value in spend_data_dict.items():
            setattr(db_spend, key, value)
    else:
        # Create new record
        db_spend = models.MarketingSpend(
            **spend_data_dict,
            brand_id=brand_id,
            source=source
        )
        db.add(db_spend)
    
    # The commit will be handled by the calling function (process_standard_file)
    
    return db_spend

def get_or_create_customer(db: Session, customer_data: dict, brand_id: int):
    username = customer_data.get('username') # SỬA: 'Người Mua' -> 'username'
    if not username:
        return None
    
    db_customer = db.query(models.Customer).filter(models.Customer.username == username, models.Customer.brand_id == brand_id).first()
    
    if not db_customer:
        db_customer = models.Customer(
            username=username,
            city=customer_data.get('city'), 
            district=customer_data.get('district'),
            source=customer_data.get('source'), # Lưu nguồn khách hàng
            brand_id=brand_id
        )
        db.add(db_customer)
        
    return db_customer

def delete_brand_by_id(db: Session, brand_id: int):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if db_brand:
        db.delete(db_brand)
        db.commit()
    return db_brand

def update_brand_name(db: Session, brand_id: int, new_name: str):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if not db_brand:
        return None # Brand không tồn tại

    clean_new_name = new_name.strip()
    # Kiểm tra xem tên mới có bị trùng với brand khác không (không phân biệt hoa thường)
    existing_brand = db.query(models.Brand).filter(
        func.lower(models.Brand.name) == func.lower(clean_new_name),
        models.Brand.id != brand_id
    ).first()
    if existing_brand:
        return None # Tên đã tồn tại

    db_brand.name = clean_new_name
    
    # Cập nhật slug và đảm bảo nó là duy nhất
    base_slug = slugify(clean_new_name)
    unique_slug = base_slug
    counter = 1
    while db.query(models.Brand).filter(models.Brand.slug == unique_slug, models.Brand.id != brand_id).first():
        unique_slug = f"{base_slug}-{counter}"
        counter += 1
    db_brand.slug = unique_slug
    
    db.commit()
    db.refresh(db_brand)
    return db_brand

def clone_brand(db: Session, brand_id: int):
    original_brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if not original_brand:
        return None
        
    base_name = original_brand.name.split(' - Copy')[0].strip()
    copy_number = 1
    new_name = f"{base_name} - Copy"
    while db.query(models.Brand).filter(func.lower(models.Brand.name) == func.lower(new_name)).first():
        copy_number += 1
        new_name = f"{base_name} - Copy {copy_number}"

    # Tạo slug cho brand mới và đảm bảo duy nhất
    base_slug = slugify(new_name)
    unique_slug = base_slug
    counter = 1
    while db.query(models.Brand).filter(models.Brand.slug == unique_slug).first():
        unique_slug = f"{base_slug}-{counter}"
        counter += 1

    cloned_brand = models.Brand(name=new_name, slug=unique_slug)
    db.add(cloned_brand)
    db.commit()
    db.refresh(cloned_brand)
    return cloned_brand

def _calculate_and_cache_single_day(db: Session, brand_id: int, target_date: date) -> dict:
    """Hàm nội bộ: Lấy data thô, gọi calculator, và cache kết quả cho một ngày."""
    import kpi_calculator # Import local để tránh circular import
    
    # 1. Lấy revenues và marketing_spends cho ngày mục tiêu
    revenues = db.query(models.Revenue).filter(models.Revenue.brand_id == brand_id, models.Revenue.transaction_date == target_date).all()
    marketing_spends = db.query(models.MarketingSpend).filter(models.MarketingSpend.brand_id == brand_id, models.MarketingSpend.date == target_date).all()

    # 2. Lấy các mã đơn hàng từ revenues của ngày hôm nay
    order_codes_from_revenues = {r.order_code for r in revenues}
    
    # 3. Lấy các đơn hàng có doanh thu hôm nay (bất kể ngày đặt)
    orders_for_revenue = []
    if order_codes_from_revenues:
        orders_for_revenue = db.query(models.Order).filter(
            models.Order.brand_id == brand_id,
            models.Order.order_code.in_(order_codes_from_revenues)
        ).all()

    # 4. Lấy các đơn hàng được TẠO hôm nay
    orders_created_today = db.query(models.Order).filter(
        models.Order.brand_id == brand_id,
        func.date(models.Order.order_date) == target_date
    ).all()

    # 5. Gộp và loại bỏ trùng lặp để có danh sách đầy đủ nhất
    all_orders_map = {o.order_code: o for o in orders_for_revenue}
    all_orders_map.update({o.order_code: o for o in orders_created_today})
    orders = list(all_orders_map.values())

    # Tạo set chứa mã đơn hàng được tạo hôm nay để truyền vào calculator
    created_today_codes = {o.order_code for o in orders_created_today}

    daily_kpis = kpi_calculator.calculate_daily_kpis(orders, revenues, marketing_spends, created_today_codes, db_session=db)

    cache_key = f"kpi_daily:{brand_id}:{target_date.isoformat()}"
    redis_client.setex(cache_key, timedelta(days=90), json.dumps(daily_kpis, default=str))
    
    return daily_kpis

def get_top_selling_products(db: Session, brand_id: int, start_date: date, end_date: date, limit: int = 10):
    import pandas as pd
    """
    Lấy danh sách các sản phẩm bán chạy nhất.
    """
    try:
        # Bước 1: Chỉ truy vấn lấy các đơn hàng cần thiết, không xử lý JSON ở đây
        orders_in_range = db.query(models.Order).filter(
            models.Order.brand_id == brand_id,
            func.date(models.Order.order_date).between(start_date, end_date)
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

def get_aggregated_location_distribution(db: Session, brand_id: int, start_date: date, end_date: date):
    """
    Lấy dữ liệu phân bổ khách hàng từ bảng DailyAnalytics (đã tính sẵn) và cộng dồn.
    Nhanh hơn nhiều so với việc query raw Orders + Customers.
    """
    try:
        # 1. Lấy các bản ghi DailyAnalytics trong khoảng thời gian (chỉ lấy source tổng 'all')
        daily_records = db.query(models.DailyAnalytics.location_distribution).filter(
            models.DailyAnalytics.brand_id == brand_id,
            models.DailyAnalytics.date.between(start_date, end_date),
            models.DailyAnalytics.source == 'all'
        ).all()

        if not daily_records:
            return []

        # 2. Cộng dồn dữ liệu (Aggregation)
        # Cấu trúc mong muốn: {"Hanoi": 150, "Ho Chi Minh": 120}
        city_stats = defaultdict(int)

        for record in daily_records:
            # record là tuple, record[0] là json location_distribution
            loc_dist = record[0]
            if loc_dist and isinstance(loc_dist, list):
                for item in loc_dist:
                    city = item.get('city')
                    orders = item.get('orders', 0) # Hoặc customer_count tùy vào logic lưu
                    # Lưu ý: KPI calculator đang lưu key là "orders", nhưng map frontend cần đếm số khách
                    # Tạm thời ta cộng dồn số lượng này.
                    if city:
                        city_stats[city] += orders

        # 3. Gắn tọa độ và Format đầu ra
        results_with_coords = []
        for city_name, count in city_stats.items():
            centroid = PROVINCE_CENTROIDS.get(city_name)
            if centroid:
                results_with_coords.append({
                    "city": city_name,
                    "customer_count": count, # Frontend đang dùng key này
                    "coords": centroid 
                })

        # 4. Sắp xếp giảm dần
        return sorted(results_with_coords, key=lambda item: item['customer_count'], reverse=True)

    except Exception as e:
        print(f"!!! LỖI KHI LẤY DỮ LIỆU BẢN ĐỒ TỪ ANALYTICS: {e}")
        traceback.print_exc()
        return []

def get_kpis_by_platform(db: Session, brand_id: int, start_date: date, end_date: date):
    """
    Tính toán và tổng hợp các chỉ số KPI, phân tách theo từng nền tảng (platform/source).
    """
    import kpi_calculator # Tránh circular import

    # 1. Lấy toàn bộ dữ liệu trong khoảng thời gian đã chọn một lần duy nhất
    all_orders = get_raw_orders_in_range(db, brand_id, start_date, end_date)
    all_revenues = get_raw_revenues_in_range(db, brand_id, start_date, end_date)
    all_marketing_spends = db.query(models.MarketingSpend).filter(
        models.MarketingSpend.brand_id == brand_id,
        models.MarketingSpend.date.between(start_date, end_date)
    ).all()

    # 2. Tìm tất cả các 'source' (nền tảng) duy nhất từ dữ liệu đã lấy
    all_sources = sorted(list(
        {o.source for o in all_orders if o.source}
        .union({r.source for r in all_revenues if r.source})
        .union({m.source for m in all_marketing_spends if m.source})
    ))

    results = []

    # 3. Tính toán dòng "Tổng cộng" cho tất cả các sàn
    # Chỉ tính nếu có bất kỳ hoạt động nào
    if all_orders or all_revenues or all_marketing_spends:
        total_kpis = kpi_calculator.calculate_aggregated_kpis(all_orders, all_revenues, all_marketing_spends)
        if total_kpis:
            total_kpis['platform'] = 'Tổng cộng'
            results.append(total_kpis)

    # 4. Lặp qua từng sàn và tính toán KPI riêng cho sàn đó
    for source in all_sources:
        # Lọc dữ liệu theo 'source' hiện tại
        orders_for_source = [o for o in all_orders if o.source == source]
        revenues_for_source = [r for r in all_revenues if r.source == source]
        marketing_for_source = [m for m in all_marketing_spends if m.source == source]

        # Chỉ tính toán nếu có dữ liệu cho sàn này
        if orders_for_source or revenues_for_source or marketing_for_source:
            kpis_for_source = kpi_calculator.calculate_aggregated_kpis(orders_for_source, revenues_for_source, marketing_for_source)
            if kpis_for_source:
                # Viết hoa chữ cái đầu của tên sàn cho đẹp
                kpis_for_source['platform'] = source.capitalize()
                results.append(kpis_for_source)

    return results

def get_sources_for_brand(db: Session, brand_id: int) -> list[str]:
    """Lấy danh sách tất cả các 'source' duy nhất cho một brand."""
    try:
        print(f"DEBUG: get_sources_for_brand called for brand_id: {brand_id}")
        order_sources = db.query(models.Order.source.label('source_column')).filter(models.Order.brand_id == brand_id, models.Order.source.isnot(None))
        revenue_sources = db.query(models.Revenue.source.label('source_column')).filter(models.Revenue.brand_id == brand_id, models.Revenue.source.isnot(None))
        marketing_sources = db.query(models.MarketingSpend.source.label('source_column')).filter(models.MarketingSpend.brand_id == brand_id, models.MarketingSpend.source.isnot(None))

        all_sources_union = union_all(order_sources, revenue_sources, marketing_sources).alias("all_sources")
        distinct_sources_query = select(all_sources_union.c.source_column).distinct()
        
        raw_sources = db.execute(distinct_sources_query).fetchall()
        print(f"DEBUG: Raw sources fetched for brand {brand_id}: {raw_sources}")
        
        return sorted([s for s, in raw_sources])
    except Exception as e:
        print(f"!!! LỖI KHI LẤY SOURCES CHO BRAND {brand_id}: {e}")
        traceback.print_exc() # Print full traceback
        return [] # Return empty list on error

def delete_brand_data_in_range(db: Session, brand_id: int, start_date: date, end_date: date, source: str = None):
    """
    Xóa dữ liệu theo logic Revenue-Driven (Dựa vào Transaction Date của Revenue làm chuẩn).
    """
    try:
        # BƯỚC 0: Xác định các source cần kiểm tra sạch sẽ sau khi xóa
        sources_to_check = []
        if source:
            sources_to_check.append(source)
        else:
            sources_to_check = get_sources_for_brand(db, brand_id)

        # BƯỚC 1: Lấy danh sách order_code bị ảnh hưởng (Kết hợp cả Revenue và Order)
        target_order_codes = set()

        # 1.1. Từ Revenue (theo Transaction Date)
        revenue_query = db.query(models.Revenue.order_code).filter(
            models.Revenue.brand_id == brand_id,
            models.Revenue.transaction_date.between(start_date, end_date)
        )
        if source:
            revenue_query = revenue_query.filter(models.Revenue.source == source)
        target_order_codes.update({row[0] for row in revenue_query.distinct().all() if row[0]})

        # 1.2. Từ Order (theo Order Date) -> Để bắt các đơn chưa có doanh thu hoặc đơn hủy
        order_query = db.query(models.Order.order_code).filter(
            models.Order.brand_id == brand_id,
            func.date(models.Order.order_date).between(start_date, end_date)
        )
        if source:
            order_query = order_query.filter(models.Order.source == source)
        target_order_codes.update({row[0] for row in order_query.distinct().all() if row[0]})

        # BƯỚC 2: Xử lý Xóa Customer (Nếu khách không còn đơn hàng nào khác)
        if target_order_codes:
            # Lấy danh sách khách hàng liên quan đến các đơn hàng sắp bị xóa
            affected_users_query = db.query(models.Order.username).filter(
                models.Order.brand_id == brand_id,
                models.Order.order_code.in_(target_order_codes)
            )
            affected_usernames = {row[0] for row in affected_users_query.distinct().all() if row[0]}

            if affected_usernames:
                # Tìm những khách hàng này CÒN đơn hàng nào KHÁC không
                # (Tức là đơn hàng có order_code KHÔNG nằm trong target_order_codes)
                users_with_other_orders_query = db.query(models.Order.username).filter(
                    models.Order.brand_id == brand_id,
                    models.Order.username.in_(affected_usernames),
                    ~models.Order.order_code.in_(target_order_codes) # NOT IN
                )
                users_keeping_orders = {row[0] for row in users_with_other_orders_query.distinct().all()}
                
                # Khách hàng cần xóa = Khách bị ảnh hưởng - Khách vẫn còn đơn giữ lại
                users_to_delete = affected_usernames - users_keeping_orders
                
                if users_to_delete:
                    db.query(models.Customer).filter(
                        models.Customer.brand_id == brand_id,
                        models.Customer.username.in_(list(users_to_delete))
                    ).delete(synchronize_session=False)
                    print(f"INFO: Đã xóa {len(users_to_delete)} khách hàng không còn đơn hàng nào.")

            # BƯỚC 3: Xóa ORDERS (Dựa trên danh sách order_code lấy từ Revenue)
            db.query(models.Order).filter(
                models.Order.brand_id == brand_id,
                models.Order.order_code.in_(target_order_codes)
            ).delete(synchronize_session=False)
            print(f"INFO: Đã xóa {len(target_order_codes)} đơn hàng liên quan đến Revenue trong khoảng thời gian.")

        # BƯỚC 4: Xóa REVENUE (Dựa trên transaction_date)
        rev_delete_query = db.query(models.Revenue).filter(
            models.Revenue.brand_id == brand_id,
            models.Revenue.transaction_date.between(start_date, end_date)
        )
        if source:
            rev_delete_query = rev_delete_query.filter(models.Revenue.source == source)
        rev_delete_query.delete(synchronize_session=False)

        # BƯỚC 5: Xóa MARKETING SPEND (Dựa trên date)
        mkt_delete_query = db.query(models.MarketingSpend).filter(
            models.MarketingSpend.brand_id == brand_id,
            models.MarketingSpend.date.between(start_date, end_date)
        )
        if source:
            mkt_delete_query = mkt_delete_query.filter(models.MarketingSpend.source == source)
        mkt_delete_query.delete(synchronize_session=False)

        # BƯỚC 6: Xóa DAILY ANALYTICS
        analytics_query = db.query(models.DailyAnalytics).filter(
            models.DailyAnalytics.brand_id == brand_id,
            models.DailyAnalytics.date.between(start_date, end_date)
        )
        if source:
            analytics_query = analytics_query.filter(models.DailyAnalytics.source == source)
        analytics_query.delete(synchronize_session=False)

        # BƯỚC 7: Xóa DAILY STAT (Luôn xóa để đảm bảo tính nhất quán)
        # Vì nếu xóa 1 phần dữ liệu gốc (1 source), số liệu tổng hợp trong DailyStat sẽ không còn đúng nữa.
        db.query(models.DailyStat).filter(
            models.DailyStat.brand_id == brand_id,
            models.DailyStat.date.between(start_date, end_date)
        ).delete(synchronize_session=False)

        db.commit()
        print(f"INFO: Đã hoàn tất xóa dữ liệu brand {brand_id} từ {start_date} đến {end_date} (Source: {source}).")

        # BƯỚC 8: Kiểm tra xem source nào đã bị xóa hoàn toàn (Logic cũ)
        fully_deleted_sources = []
        if sources_to_check:
            for src in sources_to_check:
                remaining_count = 0
                for model_class in [models.Order, models.Revenue, models.MarketingSpend]:
                    count = db.query(model_class).filter(
                        getattr(model_class, 'brand_id') == brand_id,
                        getattr(model_class, 'source') == src
                    ).count()
                    remaining_count += count
                    if remaining_count > 0: break
                
                if remaining_count == 0:
                    fully_deleted_sources.append(src)

        _clear_brand_cache(brand_id)
        return fully_deleted_sources

    except Exception as e:
        db.rollback()
        print(f"Error deleting data for brand {brand_id}: {e}")
        traceback.print_exc()
        raise e
