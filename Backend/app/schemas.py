# FILE: backend/app/schemas.py

from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import date, datetime

class DataRequest(BaseModel):
    brand_slug: str
    request_type: str
    params: Dict[str, Any]

class ProductBase(BaseModel):
    sku: str; name: Optional[str] = None; cost_price: Optional[int] = 0

class Product(ProductBase):
    id: int; brand_id: int; model_config = ConfigDict(from_attributes=True)

class CustomerBase(BaseModel):
    username: str
    city: Optional[str] = None
    district: Optional[str] = None

class Customer(CustomerBase):
    id: int
    brand_id: int
    model_config = ConfigDict(from_attributes=True)

class OrderBase(BaseModel):
    order_code: str; order_date: Optional[datetime] = None; status: Optional[str] = None; username: Optional[str] = None
    total_quantity: int = 0; cogs: float = 0.0; details: Optional[Dict[str, Any]] = None

class Order(OrderBase):
    id: int; brand_id: int; source: str; model_config = ConfigDict(from_attributes=True)

class RevenueBase(BaseModel):
    order_code: Optional[str]; order_date: Optional[date] = None; transaction_date: Optional[date]; net_revenue: float = 0.0
    gmv: float = 0.0; details: Optional[Dict[str, Any]] = None
    
class Revenue(RevenueBase):
    id: int; brand_id: int; source: str; model_config = ConfigDict(from_attributes=True)

class MarketingSpendBase(BaseModel):
    date: date
    ad_spend: float = 0.0
    cpm: float = 0.0
    ctr: float = 0.0
    cpa: float = 0.0
    cpc: float = 0.0
    conversions: int = 0
    impressions: int = 0
    reach: int = 0
    clicks: int = 0

class MarketingSpendCreate(MarketingSpendBase):
    pass

class MarketingSpend(MarketingSpendBase):
    id: int
    brand_id: int
    source: str
    model_config = ConfigDict(from_attributes=True)

# --- CÁC SCHEMA LIÊN QUAN ĐẾN BRAND ---
class BrandBase(BaseModel):
    name: str
class BrandInfo(BrandBase):
    id: int
    slug: str
    model_config = ConfigDict(from_attributes=True)
class BrandCreate(BrandBase):
    pass
class Brand(BrandBase):
    id: int
    slug: str
    products: List[Product] = []
    customers: List[Customer] = []
    orders: List[Order] = []
    revenues: List[Revenue] = []
    model_config = ConfigDict(from_attributes=True)

class ProductItem(BaseModel):
    sku: str
    name: Optional[str] = ""
    quantity: int
    revenue: float = 0.0

class LocationItem(BaseModel):
    city: str
    orders: int
    revenue: float = 0.0
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class FinancialEventItem(BaseModel):
    date: str
    type: str # 'income' | 'refund' | 'fee' | 'deduction'
    amount: float
    order_code: Optional[str] = None
    note: Optional[str] = None

class KpiSet(BaseModel):
    # --- 1. TÀI CHÍNH (Finance) ---
    net_revenue: float = 0
    provisional_revenue: float = 0
    gmv: float = 0
    total_cost: float = 0
    cogs: float = 0
    execution_cost: float = 0
    subsidy_amount: float = 0       
    profit: float = 0
    roi: float = 0
    profit_margin: float = 0
    take_rate: float = 0
    
    # --- 2. MARKETING ---
    ad_spend: float = 0
    roas: float = 0
    cpo: float = 0 
    ctr: float = 0
    cpc: float = 0
    cpm: float = 0        
    cpa: float = 0        
    impressions: int = 0  
    clicks: int = 0       
    conversions: int = 0  
    reach: int = 0        
    frequency: float = 0  
    conversion_rate: float = 0
    
    # --- 3. VẬN HÀNH (Operations) ---
    total_orders: int = 0
    completed_orders: int = 0
    cancelled_orders: int = 0
    refunded_orders: int = 0
    bomb_orders: int = 0   
    
    aov: float = 0
    upt: float = 0
    unique_skus_sold: int = 0
    total_quantity_sold: int = 0
    
    completion_rate: float = 0
    refund_rate: float = 0
    cancellation_rate: float = 0
    bomb_rate: float = 0   
    
    avg_processing_time: float = 0 
    avg_shipping_time: float = 0   

    # --- 4. KHÁCH HÀNG (Customer) ---
    total_customers: int = 0
    new_customers: int = 0
    returning_customers: int = 0
    cac: float = 0
    retention_rate: float = 0
    ltv: float = 0
    
    # --- 5. BREAKDOWNS (Biểu đồ chi tiết - JSONB) ---
    hourly_breakdown: Optional[Dict[str, int]] = {}             
    payment_method_breakdown: Optional[Dict[str, int]] = {}      
    cancel_reason_breakdown: Optional[Dict[str, int]] = {}       
    location_distribution: Optional[List[LocationItem]] = []    
    top_products: Optional[List[ProductItem]] = []              
    
    # --- 6. LOG TÀI CHÍNH (Chỉ có ở DailyAnalytics) ---
    financial_events: Optional[List[FinancialEventItem]] = []

    model_config = ConfigDict(from_attributes=True)
class BrandWithKpis(BrandInfo):
    kpis: KpiSet
    model_config = ConfigDict(from_attributes=True)

class DailyKpi(BaseModel):
    """Định nghĩa dữ liệu KPI cho một ngày duy nhất để vẽ biểu đồ."""
    date: date
    net_revenue: float = 0
    profit: float = 0

class DailyKpiResponse(BaseModel):
    """Cấu trúc dữ liệu trả về cho API biểu đồ."""
    data: List[DailyKpi]

class TopProduct(BaseModel):
    sku: str
    name: Optional[str] = None
    total_quantity: int

    model_config = ConfigDict(from_attributes=True)

class CustomerDistributionItem(BaseModel):
    city: str
    customer_count: int
    model_config = ConfigDict(from_attributes=True)

class CustomerMapDistributionItem(BaseModel):
    city: str
    orders: int
    revenue: float = 0.0
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)

class OperationKpisResponse(BaseModel):
    avg_processing_time: float
    avg_shipping_time: float
    completion_rate: float
    cancellation_rate: float
    avg_daily_orders: float
    refund_rate: float
    bomb_rate: float

    class config:
        from_attributes = True