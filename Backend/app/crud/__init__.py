# Facade Pattern: Expose service functions via crud for backward compatibility
import sys
import os

# --- 1. IMPORT NEW CRUD MODULES ---
from .crud_brand import brand
from .crud_product import product
from .crud_customer import customer

# Alias cho backward compatibility với main.py
get_all_brands = brand.get_multi
get_brand_by_slug = brand.get_by_slug
upsert_product = product.upsert
create_brand = brand.create
update_brand_name = brand.update_name

def delete_brand_by_id(db, brand_id: int):
    """
    Xóa brand và xóa cache liên quan.
    """
    # 1. Xóa trong DB (Cascade sẽ xóa hết các bảng con)
    deleted_brand = brand.remove(db=db, id=brand_id)
    
    # 2. Xóa Cache Redis
    if deleted_brand:
        clear_brand_cache(brand_id)
        
    return deleted_brand

def clone_brand(db, brand_id: int):
    """
    Hàm nhân bản Brand (Logic đơn giản: Copy tên + ' - Copy')
    """
    original = brand.get(db, id=brand_id)
    if not original:
        return None
    
    from schemas import BrandCreate
    new_name = f"{original.name} - Copy"
    
    # Xử lý trùng tên đơn giản
    count = 1
    while brand.get_by_name(db, name=new_name):
        count += 1
        new_name = f"{original.name} - Copy {count}"
        
    return brand.create(db, obj_in=BrandCreate(name=new_name))

def recalculate_brand_data_sync(db, brand_id: int):
    """
    Tính toán lại dữ liệu đồng bộ (cho nút Recalculate trên UI).
    """
    dates = get_all_activity_dates(db, brand_id)
    count = 0
    for d in dates:
        update_daily_stats(db, brand_id, d)
        count += 1
    
    clear_brand_cache(brand_id)
    return {"message": f"Đã tính toán lại dữ liệu cho {count} ngày.", "days_processed": count}

def get_or_create_customer(*args, **kwargs):
    """Legacy dummy function: Table 'customers' is deprecated."""
    return None

def get_sources_for_brand(db, brand_id):
    """
    Lấy danh sách các nguồn dữ liệu (shopee, tiktok...) có phát sinh đơn hàng của brand.
    """
    from models import Order
    from sqlalchemy import select
    results = db.execute(select(Order.source).filter(Order.brand_id == brand_id).distinct()).all()
    return [r[0] for r in results if r[0]]

# --- 2. HOT SWAP SERVICES (Instead of legacy file) ---
# We map the legacy function names to the new service implementations

from services.dashboard_service import (
    get_daily_kpis_for_range,
    get_aggregated_operation_kpis,
    get_aggregated_customer_kpis,
    get_top_selling_products,
    get_kpis_by_platform,
    get_aggregated_location_distribution,
    get_brand_details
)
from services.data_service import (
    update_daily_stats,
    delete_brand_data_in_range,
    clear_brand_cache
)

# Thêm alias cho các hàm mà worker có thể gọi (nếu cần)
def get_all_activity_dates(db, brand_id):
    """
    Dời logic lấy ngày hoạt động vào đây hoặc gọi từ service.
    """
    from models import Order, Revenue, MarketingSpend
    from sqlalchemy import func, union_all, select
    
    # Kết hợp các ngày từ 3 bảng
    q1 = select(func.date(Order.order_date)).filter(Order.brand_id == brand_id)
    q2 = select(Revenue.transaction_date).filter(Revenue.brand_id == brand_id)
    q3 = select(MarketingSpend.date).filter(MarketingSpend.brand_id == brand_id)
    
    combined = union_all(q1, q2, q3)
    results = db.execute(select(combined).distinct().order_by(combined)).all()
    
    return [r[0] for r in results if r[0]]