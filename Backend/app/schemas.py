# FILE: backend/app/schemas.py (PHIÊN BẢN ĐỒNG BỘ HÓA KEY)

from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import date

# --- CÁC SCHEMA CƠ SỞ (Không thay đổi) ---
class ProductBase(BaseModel):
    sku: str; name: Optional[str] = None; cost_price: Optional[int] = 0
class Product(ProductBase):
    id: int; brand_id: int; model_config = ConfigDict(from_attributes=True)
class CustomerBase(BaseModel):
    username: str; city: Optional[str] = None; district_1: Optional[str] = None; district_2: Optional[str] = None
class Customer(CustomerBase):
    id: int; brand_id: int; model_config = ConfigDict(from_attributes=True)
class OrderBase(BaseModel):
    order_code: str; order_date: Optional[date] = None; status: Optional[str] = None; username: Optional[str] = None
    total_quantity: int = 0; cogs: float = 0.0; details: Optional[Dict[str, Any]] = None
class Order(OrderBase):
    id: int; brand_id: int; source: str; model_config = ConfigDict(from_attributes=True)
class AdBase(BaseModel):
    campaign_name: Optional[str]; ad_date: Optional[date]; impressions: int = 0; clicks: int = 0
    expense: float = 0.0; orders: int = 0; gmv: float = 0.0; details: Optional[Dict[str, Any]] = None
class Ad(AdBase):
    id: int; brand_id: int; source: str; model_config = ConfigDict(from_attributes=True)
class RevenueBase(BaseModel):
    order_code: Optional[str]; transaction_date: Optional[date]; net_revenue: float = 0.0
    gmv: float = 0.0; details: Optional[Dict[str, Any]] = None
class Revenue(RevenueBase):
    id: int; brand_id: int; source: str; model_config = ConfigDict(from_attributes=True)

# --- CÁC SCHEMA LIÊN QUAN ĐẾN BRAND (Không thay đổi) ---
class BrandBase(BaseModel):
    name: str
class BrandInfo(BrandBase):
    id: int; model_config = ConfigDict(from_attributes=True)
class BrandCreate(BrandBase):
    pass
class Brand(BrandBase):
    id: int; products: List[Product] = []; customers: List[Customer] = []; orders: List[Order] = []
    ads: List[Ad] = []; revenues: List[Revenue] = []; model_config = ConfigDict(from_attributes=True)

# === SỬA LỖI Ở ĐÂY: ĐỒNG BỘ HÓA TÊN KEY SANG camelCase ===

class KpiSet(BaseModel):
    # Tài chính
    netRevenue: float = 0
    gmv: float = 0
    totalCost: float = 0
    cogs: float = 0
    executionCost: float = 0
    profit: float = 0
    roi: float = 0
    profitMargin: float = 0
    takeRate: float = 0
    # Marketing
    adSpend: float = 0
    roas: float = 0
    cpo: float = 0
    ctr: float = 0
    cpc: float = 0
    conversionRate: float = 0
    # Vận hành
    totalOrders: int = 0
    completedOrders: int = 0
    cancelledOrders: int = 0
    refundedOrders: int = 0
    aov: float = 0
    upt: float = 0
    uniqueSkusSold: int = 0
    completionRate: float = 0
    refundRate: float = 0
    cancellationRate: float = 0
    # Khách hàng
    totalCustomers: int = 0
    newCustomers: int = 0
    returningCustomers: int = 0
    cac: float = 0
    retentionRate: float = 0
    ltv: float = 0

class BrandWithKpis(BrandInfo):
    kpis: KpiSet
    model_config = ConfigDict(from_attributes=True)