# Facade Pattern: Expose service functions via crud for backward compatibility
import sys
import os

# --- 1. IMPORT NEW CRUD MODULES ---
from .crud_brand import brand
from .crud_product import product

# Alias cho backward compatibility với main.py
get_all_brands = brand.get_multi
get_brand_by_slug = brand.get_by_slug

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
    get_top_selling_products,
    get_kpis_by_platform,
    get_aggregated_location_distribution
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