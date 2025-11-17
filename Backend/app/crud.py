# FILE: backend/app/crud.py

import models, json, schemas, traceback
import pandas as pd

from sqlalchemy.orm import Session
from sqlalchemy import func, union_all, select, and_
from datetime import date, timedelta
from cache import redis_client
from province_centroids import PROVINCE_CENTROIDS


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
    Lấy danh sách KPI hàng ngày cho biểu đồ, ưu tiên từ cache.
    Nếu cache miss hoặc lỗi, sẽ tính toán lại cho ngày đó.
    """
    all_days = [start_date + timedelta(days=x) for x in range((end_date - start_date).days + 1)]
    cache_keys = [f"kpi_daily:{brand_id}:{day.isoformat()}" for day in all_days]
    
    cached_data = redis_client.mget(cache_keys)
    daily_kpi_list = []

    for i, daily_kpi_json in enumerate(cached_data):
        target_date = all_days[i]
        kpis_for_day = None
        
        if daily_kpi_json:
            try:
                kpis_for_day = json.loads(daily_kpi_json)
            except (json.JSONDecodeError, TypeError):
                # Cache bị lỗi, sẽ tính lại ở dưới
                pass
        
        # Nếu cache miss hoặc cache bị lỗi, tính toán lại
        if kpis_for_day is None:
            kpis_for_day = _calculate_and_cache_single_day(db, brand_id, target_date)

        # Chỉ lấy các trường cần thiết cho biểu đồ
        daily_kpi_list.append({
            "date": target_date.isoformat(), # Trả về dạng chuỗi ISO cho an toàn
            "netRevenue": kpis_for_day.get("netRevenue", 0),
            "profit": kpis_for_day.get("profit", 0)
        })

    return daily_kpi_list

def get_all_brand_ids(db: Session):
    """Lấy danh sách ID của tất cả các brand."""
    return [id for id, in db.query(models.Brand.id).all()]

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
    """Deletes transactional data for a brand within a date range, optionally filtered by source."""
    try:
        # Delete Ads
        ads_query = db.query(models.Ad).filter(
            models.Ad.brand_id == brand_id,
            models.Ad.ad_date.between(start_date, end_date)
        )
        if source:
            ads_query = ads_query.filter(models.Ad.source == source)
        ads_query.delete(synchronize_session=False)
        
        # Delete Revenues
        revenues_query = db.query(models.Revenue).filter(
            models.Revenue.brand_id == brand_id,
            models.Revenue.transaction_date.between(start_date, end_date)
        )
        if source:
            revenues_query = revenues_query.filter(models.Revenue.source == source)
        revenues_query.delete(synchronize_session=False)

        # Delete Orders
        orders_query = db.query(models.Order).filter(
            models.Order.brand_id == brand_id,
            models.Order.order_date.between(start_date, end_date)
        )
        if source:
            orders_query = orders_query.filter(models.Order.source == source)
        orders_query.delete(synchronize_session=False)

        db.commit()
        return {"message": f"Successfully deleted data for brand {brand_id} between {start_date} and {end_date}."}
    except Exception as e:
        db.rollback()
        print(f"Error deleting data for brand {brand_id}: {e}")
        traceback.print_exc()
        raise e
