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
    # Quét tất cả các loại cache liên quan đến brand
    for key in redis_client.scan_iter(f"data_req:{brand_id}:*"):
        cache_keys_to_delete.append(key)
    
    if cache_keys_to_delete:
        redis_client.delete(*cache_keys_to_delete)
        print(f"INFO: Deleted {len(cache_keys_to_delete)} cache keys.")



def update_daily_stats(db: Session, brand_id: int, target_date: date):
    """
    Hàm này được Worker gọi.
    Nhiệm vụ: Lấy dữ liệu thô -> Gọi Calculator -> Lưu kết quả vào DailyStat.
    """
    import kpi_calculator # Import local

    # 1. Lấy dữ liệu thô
    revenues = db.query(models.Revenue).filter(
        models.Revenue.brand_id == brand_id,
        models.Revenue.transaction_date == target_date
    ).all()
    
    ads = db.query(models.Ad).filter(
        models.Ad.brand_id == brand_id,
        models.Ad.ad_date == target_date
    ).all()

    # Lấy các loại đơn hàng cần thiết
    revenue_order_codes = {r.order_code for r in revenues if r.order_code}
    orders_for_cogs = []
    if revenue_order_codes:
        orders_for_cogs = db.query(models.Order).filter(
            models.Order.brand_id == brand_id,
            models.Order.order_code.in_(revenue_order_codes)
        ).all()

    orders_created_today = db.query(models.Order).filter(
        models.Order.brand_id == brand_id, 
        models.Order.order_date == target_date
    ).all()

    # Gộp danh sách đơn hàng để tính toán
    all_orders_map = {o.order_code: o for o in orders_for_cogs}
    all_orders_map.update({o.order_code: o for o in orders_created_today})
    final_orders_list = list(all_orders_map.values())

    # 2. Gọi "Đầu bếp" tính toán, truyền vào TẬP HỢP CÁC MÃ ĐƠN TẠO HÔM NAY
    # Đây là "nguồn chân lý" cho các chỉ số vận hành trong ngày
    created_today_codes = {o.order_code for o in orders_created_today}
    kpis = kpi_calculator.calculate_daily_kpis(final_orders_list, revenues, ads, created_today_codes)

    # 3. Tìm hoặc tạo mới bản ghi DailyStat
    stat_entry = db.query(models.DailyStat).filter(
        models.DailyStat.brand_id == brand_id,
        models.DailyStat.date == target_date
    ).first()

    if not stat_entry:
        stat_entry = models.DailyStat(brand_id=brand_id, date=target_date)
        db.add(stat_entry)
    
    # 4. Map TOÀN BỘ dữ liệu từ kpi_calculator (vì nó đã được tính đúng)
    # Dùng vòng lặp để code gọn và dễ bảo trì
    if kpis:
        for key, value in kpis.items():
            # Chuyển đổi camelCase từ kpi dict sang snake_case của model
            snake_case_key = re.sub(r'(?<!^)(?=[A-Z])', '_', key).lower()
            if hasattr(stat_entry, snake_case_key):
                setattr(stat_entry, snake_case_key, value)

    db.commit()
    
    # 5. Xóa cache
    _clear_brand_cache(brand_id)

    return stat_entry

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
        models.Order.order_date.between(start_date, end_date)
    ).all()

def get_raw_ads_in_range(db: Session, brand_id: int, start_date: date, end_date: date) -> list[models.Ad]:
    """Chỉ lấy ra danh sách các bản ghi quảng cáo thô trong khoảng thời gian."""
    return db.query(models.Ad).filter(
        models.Ad.brand_id == brand_id,
        models.Ad.ad_date.between(start_date, end_date)
    ).all()

def get_all_activity_dates(db: Session, brand_id: int):
    order_dates = db.query(models.Order.order_date.label("activity_date")).filter(models.Order.brand_id == brand_id, models.Order.order_date.isnot(None))
    revenue_dates = db.query(models.Revenue.transaction_date.label("activity_date")).filter(models.Revenue.brand_id == brand_id, models.Revenue.transaction_date.isnot(None))
    ad_dates = db.query(models.Ad.ad_date.label("activity_date")).filter(models.Ad.brand_id == brand_id, models.Ad.ad_date.isnot(None))
    all_dates_union = union_all(order_dates, revenue_dates, ad_dates).alias("all_dates")
    distinct_dates_query = select(all_dates_union.c.activity_date).distinct()
    return sorted([d for d, in db.execute(distinct_dates_query).fetchall()])

def get_daily_kpis_for_range(db: Session, brand_id: int, start_date: date, end_date: date) -> list:
    """
    Phiên bản mới: Đọc trực tiếp từ bảng DailyStat.
    Tốc độ cực nhanh, không cần tính toán lại, không sợ quá tải DB.
    """
    # Truy vấn thẳng vào bảng tổng hợp
    stats = db.query(models.DailyStat).filter(
        models.DailyStat.brand_id == brand_id,
        models.DailyStat.date.between(start_date, end_date)
    ).order_by(models.DailyStat.date).all()

    # Chuyển đổi format để trả về cho Frontend (giữ nguyên format cũ để Frontend không bị lỗi)
    results = []
    
    # Tạo một map để điền những ngày thiếu (nếu có)
    stats_map = {s.date: s for s in stats}
    
    # Loop qua từng ngày trong khoảng để đảm bảo biểu đồ liên tục
    current_date = start_date
    while current_date <= end_date:
        stat = stats_map.get(current_date)
        
        if stat:
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
                "profitMargin": stat.profit_margin,
                "takeRate": stat.take_rate,
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
                "totalCustomers": stat.total_customers,
            })
        else:
            # Nếu ngày đó chưa có dữ liệu (Worker chưa chạy xong hoặc không có đơn), trả về 0
            results.append({
                "date": current_date.isoformat(),
                "netRevenue": 0, "gmv": 0, "profit": 0, "totalCost": 0, "adSpend": 0,
                "cogs": 0, "executionCost": 0, "roi": 0, "profitMargin": 0, "takeRate": 0,
                "completedOrders": 0, "cancelledOrders": 0, "refundedOrders": 0, "aov": 0,
                "upt": 0, "uniqueSkusSold": 0, "totalQuantitySold": 0,
                "completionRate": 0, "cancellationRate": 0, "refundRate": 0,
                "totalCustomers": 0,
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
    
    # 1. Lấy revenues và ads cho ngày mục tiêu
    revenues = db.query(models.Revenue).filter(models.Revenue.brand_id == brand_id, models.Revenue.transaction_date == target_date).all()
    ads = db.query(models.Ad).filter(models.Ad.brand_id == brand_id, models.Ad.ad_date == target_date).all()

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
        models.Order.order_date == target_date
    ).all()

    # 5. Gộp và loại bỏ trùng lặp để có danh sách đầy đủ nhất
    all_orders_map = {o.order_code: o for o in orders_for_revenue}
    all_orders_map.update({o.order_code: o for o in orders_created_today})
    orders = list(all_orders_map.values())

    daily_kpis = kpi_calculator.calculate_daily_kpis(orders, revenues, ads)

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

def get_customer_distribution_with_coords(db: Session, brand_id: int, start_date: date, end_date: date):
    """
    Lấy dữ liệu phân bổ khách hàng kèm tọa độ, truy vấn trực tiếp từ DB.
    Hàm này đã được sửa lỗi `NameError` và không còn phụ thuộc vào hàm đã bị xóa.
    """
    try:
        # BƯỚC 1: Truy vấn để đếm số khách hàng duy nhất theo từng tỉnh/thành phố
        # Query này join bảng Order và Customer, lọc theo brand, khoảng thời gian
        # và nhóm theo `city` để đếm `username` duy nhất.
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

        results_with_coords = []
        # BƯỚC 2: Duyệt qua kết quả thô và kết hợp với tọa độ
        for city_name, customer_count in raw_counts:
            if not city_name or not customer_count:
                continue

            # Lấy tọa độ trung tâm từ dictionary đã import
            centroid = PROVINCE_CENTROIDS.get(city_name)
            
            if centroid:
                # Thêm vào danh sách kết quả
                results_with_coords.append({
                    "city": city_name,
                    "customer_count": customer_count,
                    "coords": centroid 
                })

        # Sắp xếp theo số lượng khách hàng giảm dần
        return sorted(results_with_coords, key=lambda item: item['customer_count'], reverse=True)

    except Exception as e:
        print(f"!!! LỖI KHI LẤY DỮ LIỆU BẢN ĐỒ: {e}")
        traceback.print_exc()
        return [] # Trả về danh sách rỗng nếu có lỗi để tránh crash frontend

def get_kpis_by_platform(db: Session, brand_id: int, start_date: date, end_date: date):
    """
    Tính toán và tổng hợp các chỉ số KPI, phân tách theo từng nền tảng (platform/source).
    """
    import kpi_calculator # Tránh circular import

    # 1. Lấy toàn bộ dữ liệu trong khoảng thời gian đã chọn một lần duy nhất
    all_orders = get_raw_orders_in_range(db, brand_id, start_date, end_date)
    all_revenues = get_raw_revenues_in_range(db, brand_id, start_date, end_date)
    all_ads = get_raw_ads_in_range(db, brand_id, start_date, end_date)

    # 2. Tìm tất cả các 'source' (nền tảng) duy nhất từ dữ liệu đã lấy
    all_sources = sorted(list(
        {o.source for o in all_orders if o.source}
        .union({r.source for r in all_revenues if r.source})
        .union({a.source for a in all_ads if a.source})
    ))

    results = []

    # 3. Tính toán dòng "Tổng cộng" cho tất cả các sàn
    # Chỉ tính nếu có bất kỳ hoạt động nào
    if all_orders or all_revenues or all_ads:
        total_kpis = kpi_calculator.calculate_aggregated_kpis(all_orders, all_revenues, all_ads)
        if total_kpis:
            total_kpis['platform'] = 'Tổng cộng'
            results.append(total_kpis)

    # 4. Lặp qua từng sàn và tính toán KPI riêng cho sàn đó
    for source in all_sources:
        # Lọc dữ liệu theo 'source' hiện tại
        orders_for_source = [o for o in all_orders if o.source == source]
        revenues_for_source = [r for r in all_revenues if r.source == source]
        ads_for_source = [a for a in all_ads if a.source == source]

        # Chỉ tính toán nếu có dữ liệu cho sàn này
        if orders_for_source or revenues_for_source or ads_for_source:
            kpis_for_source = kpi_calculator.calculate_aggregated_kpis(orders_for_source, revenues_for_source, ads_for_source)
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
        ad_sources = db.query(models.Ad.source.label('source_column')).filter(models.Ad.brand_id == brand_id, models.Ad.source.isnot(None))

        all_sources_union = union_all(order_sources, revenue_sources, ad_sources).alias("all_sources")
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
    Deletes transactional data, checks if any source is now empty, and returns a list of such sources.
    """
    try:
        # BƯỚC 0: Xác định các source sẽ bị ảnh hưởng TRƯỚC KHI xóa
        sources_to_check = []
        if source:
            sources_to_check.append(source)
        else:
            # Lấy tất cả các source hiện có của brand
            sources_to_check = get_sources_for_brand(db, brand_id)

        # --- LOGIC XÓA HIỆN TẠI (GIỮ NGUYÊN) ---
        orders_to_delete_query = db.query(models.Order).filter(
            models.Order.brand_id == brand_id,
            models.Order.order_date.between(start_date, end_date)
        )
        if source:
            orders_to_delete_query = orders_to_delete_query.filter(models.Order.source == source)

        usernames_in_deleted_orders = {
            row.username for row in orders_to_delete_query.with_entities(models.Order.username).distinct() if row.username
        }

        if usernames_in_deleted_orders:
            remaining_orders_subquery = db.query(models.Order.username).filter(
                models.Order.brand_id == brand_id,
                models.Order.username.in_(usernames_in_deleted_orders)
            )
            if source:
                 remaining_orders_subquery = remaining_orders_subquery.filter(
                    (models.Order.order_date.between(start_date, end_date) == False) |
                    (models.Order.source != source)
                )
            else:
                 remaining_orders_subquery = remaining_orders_subquery.filter(
                    models.Order.order_date.between(start_date, end_date) == False
                )
            users_with_remaining_orders = {
                row.username for row in remaining_orders_subquery.distinct().all()
            }
            users_to_delete = usernames_in_deleted_orders - users_with_remaining_orders
            if users_to_delete:
                db.query(models.Customer).filter(
                    models.Customer.brand_id == brand_id,
                    models.Customer.username.in_(list(users_to_delete))
                ).delete(synchronize_session=False)
                print(f"INFO: Đã xóa {len(users_to_delete)} khách hàng không còn đơn hàng nào.")

        # Delete Ads, Revenues, Orders
        for model_class in [models.Ad, models.Revenue, models.Order]:
            date_column = getattr(model_class, 'ad_date' if model_class == models.Ad else 'transaction_date' if model_class == models.Revenue else 'order_date')
            query = db.query(model_class).filter(
                getattr(model_class, 'brand_id') == brand_id,
                date_column.between(start_date, end_date)
            )
            if source:
                query = query.filter(getattr(model_class, 'source') == source)
            query.delete(synchronize_session=False)

        if not source:
            db.query(models.DailyStat).filter(
                models.DailyStat.brand_id == brand_id,
                models.DailyStat.date.between(start_date, end_date)
            ).delete(synchronize_session=False)
            print(f"INFO: Đã xóa DailyStat cho brand {brand_id} từ {start_date} đến {end_date}.")

        db.commit()

        # BƯỚC MỚI: Kiểm tra xem source nào đã bị xóa hoàn toàn
        fully_deleted_sources = []
        if sources_to_check:
            for src in sources_to_check:
                # Đếm xem source này còn bản ghi nào trong cả 3 bảng không
                remaining_count = 0
                for model_class in [models.Order, models.Revenue, models.Ad]:
                    count = db.query(model_class).filter(
                        getattr(model_class, 'brand_id') == brand_id,
                        getattr(model_class, 'source') == src
                    ).count()
                    remaining_count += count
                    if remaining_count > 0: # Tối ưu: nếu đã tìm thấy > 0 thì không cần đếm nữa
                        break
                
                if remaining_count == 0:
                    fully_deleted_sources.append(src)
        
        print(f"INFO: Các source đã bị xóa hoàn toàn: {fully_deleted_sources}")

        _clear_brand_cache(brand_id)

        return fully_deleted_sources # Trả về danh sách các source đã bị xóa sạch
    except Exception as e:
        db.rollback()
        print(f"Error deleting data for brand {brand_id}: {e}")
        traceback.print_exc()
        raise e
