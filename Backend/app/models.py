from sqlalchemy import Column, Integer, String, ForeignKey, Date, Float, Index, UniqueConstraint, DateTime, Boolean, func, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB 
from database import Base

# ==========================================
# MIXINS (Lớp dùng chung để tránh lặp code)
# ==========================================

class FinancialMetricsMixin:
    """Các chỉ số tài chính cơ bản"""
    gmv = Column(Float, default=0.0)             # Tổng GMV
    net_revenue = Column(Float, default=0.0)     # Doanh thu ròng (Thực nhận từ Revenue)
    profit = Column(Float, default=0.0)          # Lợi nhuận
    total_cost = Column(Float, default=0.0)      # Tổng chi phí
    cogs = Column(Float, default=0.0)            # Giá vốn hàng bán
    execution_cost = Column(Float, default=0.0)  # Chi phí thực thi (từ total_fees)

class MarketingMetricsMixin:
    """Các chỉ số Marketing cơ bản"""
    ad_spend = Column(Float, default=0.0)
    cpm = Column(Float, default=0.0)
    ctr = Column(Float, default=0.0)
    cpa = Column(Float, default=0.0)
    cpc = Column(Float, default=0.0)
    conversions = Column(Integer, default=0)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    reach = Column(Integer, default=0)

class OperationalMetricsMixin:
    """Các chỉ số vận hành và đơn hàng"""
    total_orders = Column(Integer, default=0)
    completed_orders = Column(Integer, default=0)
    cancelled_orders = Column(Integer, default=0)
    refunded_orders = Column(Integer, default=0)
    bomb_orders = Column(Integer, default=0)
    bomb_rate = Column(Float, default=0.0)
    
    cancellation_rate = Column(Float, default=0.0)
    refund_rate = Column(Float, default=0.0)
    
    unique_skus_sold = Column(Integer, default=0)
    total_quantity_sold = Column(Integer, default=0)
    
    avg_processing_time = Column(Float, default=0.0)
    avg_shipping_time = Column(Float, default=0.0)
    avg_repurchase_cycle = Column(Float, default=0.0)

class CustomerMetricsMixin:
    """Các chỉ số về khách hàng"""
    new_customers = Column(Integer, default=0)
    returning_customers = Column(Integer, default=0)
    churn_rate = Column(Float, default=0.0)
    aov = Column(Float, default=0.0)
    upt = Column(Float, default=0.0)

class JsonBreakdownMixin:
    """Các cột JSON lưu dữ liệu phân tích chi tiết"""
    hourly_breakdown = Column(JSONB, nullable=True)
    payment_method_breakdown = Column(JSONB, nullable=True)
    cancel_reason_breakdown = Column(JSONB, nullable=True)
    location_distribution = Column(JSONB, nullable=True)
    top_products = Column(JSONB, nullable=True)
    top_refunded_products = Column(JSONB, nullable=True)
    frequency_distribution = Column(JSONB, nullable=True)
    customer_segment_distribution = Column(JSONB, nullable=True)

# ==========================================
# MODELS
# ==========================================

class Brand(Base):
    __tablename__ = "brands"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    slug = Column(String, unique=True, index=True)

    products = relationship("Product", back_populates="owner_brand", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="owner_brand", cascade="all, delete-orphan")
    revenues = relationship("Revenue", back_populates="owner_brand", cascade="all, delete-orphan")
    marketing_spends = relationship("MarketingSpend", back_populates="owner_brand", cascade="all, delete-orphan")
    
    daily_stats = relationship("DailyStat", back_populates="owner_brand", cascade="all, delete-orphan")
    daily_analytics = relationship("DailyAnalytics", back_populates="owner_brand", cascade="all, delete-orphan")
    import_logs = relationship("ImportLog", back_populates="owner_brand", cascade="all, delete-orphan")
    
    customers = relationship("Customer", back_populates="owner_brand", cascade="all, delete-orphan")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, index=True)
    name = Column(String, nullable=True, index=True)
    cost_price = Column(Integer, default=0, index=True) 
    brand_id = Column(Integer, ForeignKey("brands.id"), index=True)
    
    owner_brand = relationship("Brand", back_populates="products")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)

    order_code = Column(String, index=True)
    order_date = Column(DateTime, nullable=True, index=True) 
    
    shipped_time = Column(DateTime, nullable=True)
    tracking_id = Column(String, nullable=True, index=True)    
    delivered_date = Column(DateTime, nullable=True) 
    
    status = Column(String, nullable=True, index=True)
    username = Column(String, index=True, nullable=True)
    total_quantity = Column(Integer, default=0)
    cogs = Column(Float, default=0.0) 
    
    original_price = Column(Float, default=0.0)            
    sku_price = Column(Float, default=0.0)  
    subsidy_amount = Column(Float, default=0.0) 

    source = Column(String, nullable=False, index=True) 
    brand_id = Column(Integer, ForeignKey("brands.id"), index=True)
    
    details = Column(JSONB, nullable=True)

    __table_args__ = (
        Index('ix_order_brand_id_order_date', 'brand_id', 'order_date'),
        UniqueConstraint('order_code', 'brand_id', name='uq_order_brand_code')
    )
    
    owner_brand = relationship("Brand", back_populates="orders")

class Revenue(Base):
    __tablename__ = "revenues"
    id = Column(Integer, primary_key=True, index=True)  

    order_code = Column(String, index=True)
    order_date = Column(Date, nullable=True) 
    transaction_date = Column(Date, nullable=True)
    net_revenue = Column(Float, default=0.0)
    gmv = Column(Float, default=0.0)
    
    total_fees = Column(Float, default=0.0) 
    refund = Column(Float, default=0.0)     
    order_refund = Column(Float, default=0.0) # Added new column

    source = Column(String, nullable=False, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), index=True)
    details = Column(JSONB, nullable=True) 

    __table_args__ = (
        Index('ix_revenue_brand_id_transaction_date', 'brand_id', 'transaction_date'),
    )

    owner_brand = relationship("Brand", back_populates="revenues")

class MarketingSpend(Base, MarketingMetricsMixin):
    __tablename__ = "marketing_spends"

    id = Column(Integer, primary_key=True, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), nullable=False, index=True)
    source = Column(String, nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    
    owner_brand = relationship("Brand", back_populates="marketing_spends")

    __table_args__ = (UniqueConstraint('brand_id', 'source', 'date', name='_brand_source_date_uc'),)

class DailyStat(Base, FinancialMetricsMixin, MarketingMetricsMixin, OperationalMetricsMixin, CustomerMetricsMixin, JsonBreakdownMixin):
    __tablename__ = "daily_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), index=True)
    date = Column(Date, index=True)
    
    # === CÁC CỘT RIÊNG ===
    frequency = Column(Float, default=0.0)
    roi = Column(Float, default=0.0)
    profit_margin = Column(Float, default=0.0)
    take_rate = Column(Float, default=0.0)
    completion_rate = Column(Float, default=0.0)
    
    total_customers = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint('brand_id', 'date', name='uq_brand_date_stat'),
    )

    owner_brand = relationship("Brand", back_populates="daily_stats")

class DailyAnalytics(Base, FinancialMetricsMixin, MarketingMetricsMixin, OperationalMetricsMixin, CustomerMetricsMixin, JsonBreakdownMixin):
    __tablename__ = "daily_analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), index=True)
    date = Column(Date, index=True)
    source = Column(String, nullable=False, index=True)

    # === CÁC CỘT RIÊNG ===
    frequency = Column(Float, default=0.0)
    roi = Column(Float, default=0.0)
    conversion_rate = Column(Float, default=0.0)
    
    avg_fulfillment_time = Column(Float, default=0.0) 
    
    new_customer_revenue = Column(Float, default=0.0) 
    returning_customer_revenue = Column(Float, default=0.0)

    financial_events = Column(JSONB, nullable=True)

    __table_args__ = (
        UniqueConstraint('brand_id', 'date', 'source', name='uq_daily_analytics'),
    )

    owner_brand = relationship("Brand", back_populates="daily_analytics")

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), index=True)

    # Định danh & Thông tin cơ bản
    source = Column(String, nullable=True, index=True) # Nguồn khách hàng (Shopee, Lazada...)
    username = Column(String, index=True, nullable=True)
    phone = Column(String, index=True, nullable=True)
    email = Column(String, nullable=True)
    gender = Column(String, nullable=True)

    # CRM & Chăm sóc
    rank = Column(String, default="Member") # Member, Silver, Gold, Diamond...
    tags = Column(JSONB, default=list)      # ["KOL", "Bom hàng", ...]
    notes = Column(Text, nullable=True)     # Ghi chú nội bộ

    # Chỉ số tích lũy (Aggregated Metrics)
    total_spent = Column(Float, default=0.0)   # Tổng chi tiêu (LTV)
    total_orders = Column(Integer, default=0)
    success_orders = Column(Integer, default=0)
    canceled_orders = Column(Integer, default=0)
    refunded_orders = Column(Integer, default=0)
    bomb_orders = Column(Integer, default=0) # Added bomb_orders
    profit = Column(Float, default=0.0)        # Lợi nhuận tích lũy (Net Rev - COGS)
    aov = Column(Float, default=0.0)           # Giá trị trung bình đơn

    # Địa chỉ mặc định
    default_province = Column(String, nullable=True)
    default_address = Column(String, nullable=True)

    owner_brand = relationship("Brand", back_populates="customers")

class ImportLog(Base):
    __tablename__ = "import_logs"

    id = Column(Integer, primary_key=True, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), index=True)
    source = Column(String, index=True)
    file_name = Column(String)
    file_hash = Column(String, index=True)
    status = Column(String) # PROCESSING, SUCCESS, FAILED
    log = Column(String, nullable=True)
    created_at = Column(DateTime, default=func.now())

    owner_brand = relationship("Brand", back_populates="import_logs")