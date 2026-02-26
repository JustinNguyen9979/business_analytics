# FILE: backend/app/schemas.py

from pydantic import BaseModel, ConfigDict, field_validator
from typing import List, Optional, Dict, Any, Union
import datetime

# ==============================================================================
# === 1. CORE MIXINS (TÁI SỬ DỤNG LOGIC)                                     ===
# ==============================================================================

class ORMBase(BaseModel):
    """Base schema config for SQLAlchemy integration"""
    model_config = ConfigDict(from_attributes=True)

class CustomerContactMixin(BaseModel):
    """Thông tin liên lạc chung của khách hàng"""
    phone: Optional[str] = "---"
    email: Optional[str] = "---"
    gender: Optional[str] = "---"
    default_address: Optional[str] = "---"
    province: Optional[str] = "---"
    district: Optional[str] = "---"

class OrderCountersMixin(BaseModel):
    """Các bộ đếm đơn hàng (Snake Case cho Database logic)"""
    total_orders: int = 0
    completed_orders: int = 0
    cancelled_orders: int = 0
    bomb_orders: int = 0
    refunded_orders: int = 0

class OrderCountersCamelMixin(BaseModel):
    """Các bộ đếm đơn hàng (Camel Case cho Frontend UI)"""
    orderCount: int = 0
    successCount: int = 0
    cancelCount: int = 0
    bombOrders: int = 0
    refundedOrders: int = 0

# ==============================================================================
# === 2. PRIMITIVE SCHEMAS (INPUTS & DB MAPPING)                             ===
# ==============================================================================

class DBEntity(ORMBase):
    id: int
    brand_id: int

class SourcedDBEntity(DBEntity):
    source: str

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
class Product(ProductBase, DBEntity): pass

# --- CUSTOMER ---
class CustomerBase(OrderCountersMixin, ORMBase):
    username: str
    province: Optional[str] = None
    district: Optional[str] = None
    total_spent: float = 0.0
    aov: float = 0.0
    last_order_date: Optional[datetime.datetime] = None
    avg_repurchase_cycle: Optional[float] = 0.0

class CustomerCreate(CustomerBase): pass

class CustomerUpdate(CustomerContactMixin):
    """Schema cập nhật khách hàng - Tái sử dụng ContactMixin"""
    notes: Optional[str] = None
    tags: Optional[List[str]] = None

class Customer(CustomerBase, DBEntity): pass

# --- ORDER ---
class OrderBase(BaseModel):
    order_code: str
    order_date: Optional[datetime.datetime] = None
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
    order_refund: Optional[str] = None
    gmv: float = 0.0

    @field_validator('return_tracking_code', 'order_refund', mode='before', check_fields=False)
    @classmethod
    def clean_refund_code(cls, v):
        """Chuyển đổi các giá trị rác (0, 0.0, ---, rỗng) thành None"""
        if v in [0, "0", "0.0", "---", ""]:
            return None
        return v

class Order(OrderBase, SourcedDBEntity):
    """
    Mở rộng Order với các chỉ số tài chính computed (CamelCase để đồng bộ với OrderSearchResult/Frontend)
    """
    netProfit: Optional[float] = 0.0
    profitMargin: Optional[float] = 0.0
    takeRate: Optional[float] = 0.0
    subsidy_amount: Optional[float] = 0.0

# --- REVENUE & MARKETING ---
class RevenueBase(BaseModel):
    order_code: Optional[str]
    order_date: Optional[datetime.date] = None
    transaction_date: Optional[datetime.date]
    net_revenue: float = 0.0
    gmv: float = 0.0
    details: Optional[Dict[str, Any]] = None

class Revenue(RevenueBase, SourcedDBEntity): pass

class MarketingSpendBase(BaseModel):
    date: datetime.date
    ad_spend: float = 0.0
    cpm: float = 0.0; ctr: float = 0.0; cpa: float = 0.0; cpc: float = 0.0
    conversions: int = 0; impressions: int = 0; reach: int = 0; clicks: int = 0

class MarketingSpendCreate(MarketingSpendBase): pass
class MarketingSpend(MarketingSpendBase, SourcedDBEntity): pass

# --- BRAND ---
class BrandBase(BaseModel): name: str
class BrandInfo(BrandBase, ORMBase): id: int; slug: str
class BrandCreate(BrandBase): pass
class Brand(BrandBase, ORMBase):
    id: int; slug: str
    products: List[Product] = []; orders: List[Order] = []; revenues: List[Revenue] = []

# ==============================================================================
# === 3. METRIC MIXINS (DASHBOARD LOGIC)                                     ===
# ==============================================================================

class FinanceMetricsMixin(BaseModel):
    net_revenue: float = 0; gmv: float = 0
    total_cost: float = 0; cogs: float = 0; execution_cost: float = 0; subsidy_amount: float = 0
    profit: float = 0; roi: float = 0; profit_margin: float = 0; take_rate: float = 0

class MarketingMetricsMixin(BaseModel):
    ad_spend: float = 0; roas: float = 0; cpo: float = 0; ctr: float = 0
    cpc: float = 0; cpm: float = 0; cpa: float = 0
    impressions: int = 0; clicks: int = 0; conversions: int = 0; reach: int = 0
    frequency: float = 0; conversion_rate: float = 0

class OperationMetricsMixin(OrderCountersMixin):
    """Kế thừa Counters đã định nghĩa ở Bước 1"""
    aov: float = 0; upt: float = 0
    unique_skus_sold: int = 0; total_quantity_sold: int = 0
    completion_rate: float = 0; refund_rate: float = 0; cancellation_rate: float = 0; bomb_rate: float = 0
    avg_processing_time: float = 0; avg_shipping_time: float = 0
    avg_daily_orders: float = 0

class CustomerMetricsMixin(BaseModel):
    total_customers: int = 0; new_customers: int = 0; returning_customers: int = 0
    cac: float = 0; retention_rate: float = 0; churn_rate: float = 0
    ltv: float = 0; arpu: float = 0; avg_repurchase_cycle: float = 0

class ProductItem(ORMBase):
    sku: str; name: Optional[str] = "Unknown"; quantity: int = 0; total_quantity: int = 0; revenue: float = 0.0

class KpiBase(ORMBase):
    """Base class for all KPI sets to manage the date field consistently"""
    date: Optional[datetime.date] = None

class PlatformComparisonItem(BaseModel):
    platform: str
    net_revenue: float = 0.0; gmv: float = 0.0; profit: float = 0.0
    total_cost: float = 0.0; ad_spend: float = 0.0; cogs: float = 0.0; execution_cost: float = 0.0
    completed_orders: int = 0; total_orders: int = 0; cancelled_orders: int = 0
    refunded_orders: int = 0; bomb_orders: int = 0
    avg_processing_time: float = 0.0; avg_shipping_time: float = 0.0
    roi: float = 0.0; profit_margin: float = 0.0; take_rate: float = 0.0

class TopProduct(ORMBase):
    sku: str; name: Optional[str] = "Unknown"; total_quantity: int = 0; revenue: float = 0.0

class LocationItem(ORMBase):
    province: str; orders: int = 0; revenue: float = 0.0
    latitude: Optional[float] = None; longitude: Optional[float] = None
    metrics: Optional[Dict[str, Any]] = {}

class CustomerMapDistributionItem(ORMBase):
    province: str; orders: int = 0; revenue: float = 0.0
    completed: int = 0; cancelled: int = 0; bomb: int = 0; refunded: int = 0
    latitude: Optional[float] = None; longitude: Optional[float] = None

class BreakdownMetricsMixin(BaseModel):
    hourly_breakdown: Optional[Dict[str, int]] = {}
    payment_method_breakdown: Optional[Dict[str, int]] = {}
    cancel_reason_breakdown: Optional[Dict[str, int]] = {}
    location_distribution: Optional[List[LocationItem]] = []
    top_products: Optional[List[ProductItem]] = []
    top_refunded_products: Optional[Dict[str, List[Dict[str, Any]]]] = {}
    frequency_distribution: Optional[Dict[str, int]] = {}
    customer_segment_distribution: Optional[List[Dict[str, Any]]] = []
    financial_events: Optional[List[Dict[str, Any]]] = []

# ==============================================================================
# === 4. RESPONSE SCHEMAS (VIEW MODELS)  ===
# ==============================================================================

class KpiSet(KpiBase, FinanceMetricsMixin, MarketingMetricsMixin, OperationMetricsMixin, CustomerMetricsMixin, BreakdownMetricsMixin):
    pass

class BrandWithKpis(Brand):
    kpis: Optional[KpiSet] = None

class DailyKpi(KpiBase, FinanceMetricsMixin, MarketingMetricsMixin, OperationMetricsMixin, CustomerMetricsMixin):
    pass

class DailyKpiResponse(BaseModel):
    data: List[DailyKpi]

class OperationKpisResponse(OperationMetricsMixin, BreakdownMetricsMixin, ORMBase):
    platform_comparison: List[PlatformComparisonItem] = []

class CustomerKpisResponse(CustomerMetricsMixin, ORMBase):
    trend_data: List[DailyKpi] = []; segment_data: List[Dict[str, Any]] = []
    frequency_data: List[Dict[str, Any]] = []; previous_period: Optional[Dict[str, Any]] = {}

class CustomerAnalyticsItem(OrderCountersMixin):
    """Tái sử dụng OrderCountersMixin cho danh sách khách hàng"""
    username: str
    total_spent: float = 0; aov: float = 0
    last_order_date: Optional[datetime.date] = None
    province: Optional[str] = None; district: Optional[str] = None

class CustomerPaginationResponse(BaseModel):
    data: List[CustomerAnalyticsItem]; total: int = 0; page: int = 1; limit: int = 20

# Optimized Flat Structure for Customer Detail (Unified with Search)
class CustomerDetailResponse(OrderCountersCamelMixin, ORMBase):
    """Kế thừa CamelCase Counters cho UI"""
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
    lastOrderDate: Optional[datetime.datetime] = None
    
    # Metrics
    rank: Optional[str] = "MEMBER"; nextRank: Optional[str] = "MAX"; rankProgress: float = 0.0
    ltv: float = 0.0; totalProfit: float = 0.0; totalFees: float = 0.0; aov: float = 0.0
    avgRepurchaseCycle: float = 0.0
    
    recentOrders: List[Order] = []

# ==============================================================================
# === 5. SEARCH & DISCOVERY SCHEMAS      ===
# ==============================================================================

class SearchSuggestionItem(BaseModel):
    type: str; value: str; label: str; sub_label: Optional[str] = None

class OrderSearchResult(BaseModel):
    type: str = "order"
    id: str; status: str; createdDate: str
    shippedDate: Optional[str] = None; deliveredDate: Optional[str] = None
    paymentMethod: str; source: str; trackingCode: str; orderCode: str
    return_tracking_code: Optional[str] = "---"; carrier: str
    
    customer: Dict[str, Any]; items: List[Dict[str, Any]]
    
    original_price: float = 0.0; subsidy_amount: float = 0.0; sku_price: float = 0.0
    totalCollected: float = 0.0; cogs: float = 0.0; netProfit: float = 0.0
    netRevenue: float = 0.0; totalFees: float = 0.0; profitMargin: float = 0.0; takeRate: float = 0.0

GlobalSearchResult = Union[OrderSearchResult, CustomerDetailResponse]

# ==============================================================================
# === 6. COMMON UTILITY SCHEMAS (MESSAGES & TASKS)                           ===
# ==============================================================================

class MessageResponse(BaseModel):
    """Thông báo phản hồi đơn giản"""
    message: str

class TaskResponse(BaseModel):
    """Phản hồi khi kích hoạt một background task (Celery)"""
    task_id: str
    status: str
    cache_key: Optional[str] = None

class RecalculationResponse(MessageResponse):
    """Kết quả tính toán lại dữ liệu"""
    days_processed: int

class DeleteDataResponse(MessageResponse):
    """Kết quả sau khi xóa dữ liệu trong một khoảng thời gian"""
    fully_deleted_sources: List[str]

class SearchNotFoundResponse(MessageResponse):

    """Phản hồi khi không tìm thấy kết quả tìm kiếm"""

    status: str = "not_found"



class TaskStatusResponse(BaseModel):
    """Phản hồi trạng thái xử lý của task"""
    status: str
    data: Optional[Any] = None
    error: Optional[str] = None

from models import UserRole

# --- USER & AUTH ---
class UserBase(BaseModel):
    username: str
    email: str
    full_name: Optional[str] = None
    role: Optional[UserRole] = UserRole.VIEWER

class UserCreate(UserBase):
    password: str

class User(UserBase, ORMBase):
    id: str
    is_active: bool
    created_at: datetime.datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str
