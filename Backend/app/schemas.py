# FILE: backend/app/schemas.py

from pydantic import BaseModel, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import date, datetime

# ==========================================
# === 1. CORE BASE CLASSES (ABSTRACTIONS) ===
# ==========================================

class ORMBase(BaseModel):
    """Base schema config for SQLAlchemy integration"""
    model_config = ConfigDict(from_attributes=True)

class DBEntity(ORMBase):
    """Standard DB Entity with ID and Brand linkage"""
    id: int
    brand_id: int

class SourcedDBEntity(DBEntity):
    """Entity that tracks data source (e.g., shopee, tiktok)"""
    source: str

# ==========================================
# === 2. PRIMITIVE SCHEMAS (INPUTS)      ===
# ==========================================

class DataRequest(BaseModel):
    brand_slug: str
    request_type: str
    params: Dict[str, Any]

# --- PRODUCT ---
class ProductBase(BaseModel):
    sku: str
    name: Optional[str] = None
    cost_price: Optional[int] = 0

class ProductCreate(ProductBase): pass

class Product(ProductBase, DBEntity): 
    pass

# --- CUSTOMER ---
class CustomerBase(BaseModel):
    username: str
    province: Optional[str] = None
    district: Optional[str] = None
    total_spent: float = 0.0
    aov: float = 0.0
    total_orders: int = 0
    completed_orders: int = 0
    cancelled_orders: int = 0
    bomb_orders: int = 0
    refunded_orders: int = 0
    last_order_date: Optional[datetime] = None
    avg_repurchase_cycle: Optional[float] = 0.0

class CustomerCreate(CustomerBase): pass

class Customer(CustomerBase, DBEntity): 
    pass

# --- ORDER ---
class OrderBase(BaseModel):
    order_code: str
    order_date: Optional[datetime] = None
    status: Optional[str] = None
    username: Optional[str] = None
    total_quantity: int = 0
    cogs: float = 0.0
    details: Optional[Dict[str, Any]] = None
    original_price: float = 0.0
    sku_price: float = 0.0
    net_revenue: float = 0.0
    total_fees: float = 0.0
    category: Optional[str] = None
    tracking_id: Optional[str] = None
    return_tracking_code: Optional[str] = None
    gmv: float = 0.0

class Order(OrderBase, SourcedDBEntity): 
    pass

# --- REVENUE ---
class RevenueBase(BaseModel):
    order_code: Optional[str]
    order_date: Optional[date] = None
    transaction_date: Optional[date]
    net_revenue: float = 0.0
    gmv: float = 0.0
    details: Optional[Dict[str, Any]] = None

class Revenue(RevenueBase, SourcedDBEntity): 
    pass

# --- MARKETING SPEND ---
class MarketingSpendBase(BaseModel):
    date: date
    ad_spend: float = 0.0
    cpm: float = 0.0; ctr: float = 0.0; cpa: float = 0.0; cpc: float = 0.0
    conversions: int = 0; impressions: int = 0; reach: int = 0; clicks: int = 0

class MarketingSpendCreate(MarketingSpendBase): pass

class MarketingSpend(MarketingSpendBase, SourcedDBEntity): 
    pass

# --- BRAND ---
class BrandBase(BaseModel): 
    name: str

class BrandInfo(BrandBase, ORMBase):
    id: int
    slug: str

class BrandCreate(BrandBase): pass

class Brand(BrandBase, ORMBase):
    id: int
    slug: str
    products: List[Product] = []
    orders: List[Order] = []
    revenues: List[Revenue] = []

# ==========================================
# === 3. SHARED & COMPOSITE ITEMS        ===
# ==========================================

class ProductItem(ORMBase):
    sku: str
    name: Optional[str] = "Unknown"
    quantity: int = 0
    total_quantity: int = 0
    revenue: float = 0.0

class LocationItem(ORMBase):
    province: str
    orders: int = 0
    revenue: float = 0.0
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    metrics: Optional[Dict[str, Any]] = {}
    completed: int = 0; cancelled: int = 0; bomb: int = 0; refunded: int = 0

class FinancialEventItem(BaseModel):
    date: str; type: str; amount: float; order_code: Optional[str] = None; note: Optional[str] = None

# --- METRIC MIXINS ---
class FinanceMetricsMixin(BaseModel):
    net_revenue: float = 0; gmv: float = 0
    total_cost: float = 0; cogs: float = 0; execution_cost: float = 0; subsidy_amount: float = 0
    profit: float = 0; roi: float = 0; profit_margin: float = 0; take_rate: float = 0

class MarketingMetricsMixin(BaseModel):
    ad_spend: float = 0; roas: float = 0; cpo: float = 0; ctr: float = 0
    cpc: float = 0; cpm: float = 0; cpa: float = 0
    impressions: int = 0; clicks: int = 0; conversions: int = 0; reach: int = 0
    frequency: float = 0; conversion_rate: float = 0

class OperationMetricsMixin(BaseModel):
    total_orders: int = 0; completed_orders: int = 0; cancelled_orders: int = 0
    refunded_orders: int = 0; bomb_orders: int = 0
    aov: float = 0; upt: float = 0
    unique_skus_sold: int = 0; total_quantity_sold: int = 0
    completion_rate: float = 0; refund_rate: float = 0; cancellation_rate: float = 0; bomb_rate: float = 0
    avg_processing_time: float = 0; avg_shipping_time: float = 0
    avg_daily_orders: float = 0

class CustomerMetricsMixin(BaseModel):
    total_customers: int = 0; new_customers: int = 0; returning_customers: int = 0
    cac: float = 0; retention_rate: float = 0; churn_rate: float = 0
    ltv: float = 0; arpu: float = 0; avg_repurchase_cycle: float = 0

class BreakdownMetricsMixin(BaseModel):
    hourly_breakdown: Optional[Dict[str, int]] = {}
    payment_method_breakdown: Optional[Dict[str, int]] = {}
    cancel_reason_breakdown: Optional[Dict[str, int]] = {}
    location_distribution: Optional[List[LocationItem]] = []
    top_products: Optional[List[ProductItem]] = []
    top_refunded_products: Optional[Dict[str, List[Dict[str, Any]]]] = {}
    frequency_distribution: Optional[Dict[str, int]] = {}
    customer_segment_distribution: Optional[List[Dict[str, Any]]] = []
    financial_events: Optional[List[FinancialEventItem]] = []


# ==========================================
# === 4. RESPONSE SCHEMAS (VIEW MODELS)  ===
# ==========================================

class KpiSet(FinanceMetricsMixin, MarketingMetricsMixin, OperationMetricsMixin, CustomerMetricsMixin, BreakdownMetricsMixin, ORMBase):
    pass

class BrandWithKpis(BrandInfo):
    kpis: KpiSet

class DailyKpi(FinanceMetricsMixin, MarketingMetricsMixin, OperationMetricsMixin, CustomerMetricsMixin, ORMBase):
    date: date

class DailyKpiResponse(BaseModel):
    data: List[DailyKpi]

class OperationKpisResponse(OperationMetricsMixin, BreakdownMetricsMixin, ORMBase):
    platform_comparison: List[Dict[str, Any]] = []

class CustomerKpisResponse(CustomerMetricsMixin, ORMBase):
    trend_data: List[DailyKpi] = []
    segment_data: List[Dict[str, Any]] = []
    frequency_data: List[Dict[str, Any]] = []
    previous_period: Optional[Dict[str, Any]] = {}

class CustomerAnalyticsItem(BaseModel):
    username: str
    total_spent: float = 0
    total_orders: int = 0
    completed_orders: int = 0
    cancelled_orders: int = 0
    bomb_orders: int = 0
    aov: float = 0
    last_order_date: Optional[date] = None
    province: Optional[str] = None
    district: Optional[str] = None

class CustomerAnalyticsResponse(BaseModel):
    data: List[CustomerAnalyticsItem]

class CustomerPaginationResponse(BaseModel):
    data: List[CustomerAnalyticsItem]
    total: int = 0
    page: int = 1
    limit: int = 20

# Optimized Flat Structure for Customer Detail (Unified with Search)
class CustomerDetailResponse(BaseModel):
    id: str
    type: str = "customer"
    source: Optional[str] = "---"
    name: Optional[str] = "Khách vãng lai"
    phone: Optional[str] = "---"
    email: Optional[str] = "---"
    gender: Optional[str] = "---"
    defaultAddress: Optional[str] = "---"
    province: Optional[str] = "---"
    district: Optional[str] = "---"
    lastLogin: Optional[str] = "Gần đây"
    tags: List[str] = []
    notes: Optional[str] = "---"
    lastOrderDate: Optional[datetime] = None
    
    # --- Metrics ---
    rank: Optional[str] = "MEMBER"
    nextRank: Optional[str] = "MAX"
    rankProgress: float = 0.0
    
    ltv: float = 0.0
    totalProfit: float = 0.0
    totalFees: float = 0.0
    aov: float = 0.0
    
    orderCount: int = 0
    successCount: int = 0
    refundedOrders: int = 0
    cancelCount: int = 0
    bombOrders: int = 0
    avgRepurchaseCycle: float = 0.0
    
    # --- List ---
    recentOrders: List[Order] = []

    model_config = ConfigDict(from_attributes=True)


# Aliases for backward compatibility if needed in frontend
TopProduct = ProductItem
CustomerMapDistributionItem = LocationItem
CustomerDistributionItem = LocationItem