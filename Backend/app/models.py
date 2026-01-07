# FILE: Backend/app/models.py

from sqlalchemy import Column, Integer, String, ForeignKey, Date, Float, Index, UniqueConstraint, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB 
from database import Base

class Brand(Base):
    __tablename__ = "brands"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    slug = Column(String, unique=True, index=True)

    # Các mối quan hệ không thay đổi, vẫn giữ nguyên
    products = relationship("Product", back_populates="owner_brand", cascade="all, delete-orphan")
    customers = relationship("Customer", back_populates="owner_brand", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="owner_brand", cascade="all, delete-orphan")
    revenues = relationship("Revenue", back_populates="owner_brand", cascade="all, delete-orphan")
    marketing_spends = relationship("MarketingSpend", back_populates="owner_brand", cascade="all, delete-orphan")
    
    daily_stats = relationship("DailyStat", back_populates="owner_brand", cascade="all, delete-orphan")
    daily_analytics = relationship("DailyAnalytics", back_populates="owner_brand", cascade="all, delete-orphan")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, index=True)
    name = Column(String, nullable=True, index=True)
    cost_price = Column(Integer, default=0, index=True) 
    brand_id = Column(Integer, ForeignKey("brands.id"), index=True)
    
    owner_brand = relationship("Brand", back_populates="products")

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    city = Column(String, nullable=True, index=True) # Ánh xạ từ cột 'province' trong template
    
    # === THAY ĐỔI 1: GỘP 2 CỘT DISTRICT THÀNH 1 ===
    # Bỏ district_1 và district_2, thay bằng district duy nhất để khớp template
    district = Column(String, nullable=True, index=True) 
    source = Column(String, nullable=True, index=True) # Nguồn khách hàng (Shopee, TikTok...)
    
    brand_id = Column(Integer, ForeignKey("brands.id"), index=True)

    owner_brand = relationship("Brand", back_populates="customers")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)

    # --- Các cột cốt lõi giữ nguyên, đã rất chuẩn ---
    order_code = Column(String, index=True)
    order_date = Column(DateTime, nullable=True) 
    
    # === THÊM CÁC CỘT VẬN HÀNH MỚI ===
    shipped_time = Column(DateTime, nullable=True) # Thời gian bàn giao cho ĐVVC
    tracking_id = Column(String, nullable=True)    # Mã vận đơn
    delivered_date = Column(DateTime, nullable=True) # Ngày giao hàng thực tế
    
    status = Column(String, nullable=True, index=True)
    username = Column(String, index=True, nullable=True)
    total_quantity = Column(Integer, default=0)
    cogs = Column(Float, default=0.0) # Vẫn giữ lại để lưu giá vốn tại thời điểm bán
    
    # === CÁC CỘT TÀI CHÍNH TẠI THỜI ĐIỂM ĐẶT HÀNG (ESTIMATED) ===
    gmv = Column(Float, default=0.0)            # Giá gốc (Giá trị đơn hàng trước KM)
    selling_price = Column(Float, default=0.0)  # Giá bán (Khách phải trả)
    subsidy_amount = Column(Float, default=0.0) # Tổng tiền trợ giá (Sàn + Shop)

    source = Column(String, nullable=False, index=True) # Nguồn (shopee, tiktok, ...)
    brand_id = Column(Integer, ForeignKey("brands.id"), index=True)
    
    # Cột details sẽ được dùng để lưu chi tiết các item trong đơn
    details = Column(JSONB, nullable=True)

    __table_args__ = (
        Index('ix_order_brand_id_order_date', 'brand_id', 'order_date'),
        UniqueConstraint('order_code', 'brand_id', name='uq_order_brand_code')
    )
    
    owner_brand = relationship("Brand", back_populates="orders")

class Revenue(Base):
    __tablename__ = "revenues"
    id = Column(Integer, primary_key=True, index=True)  

    # --- Các cột cốt lõi ---
    order_code = Column(String, index=True)
    order_date = Column(Date, nullable=True) 
    transaction_date = Column(Date, nullable=True)
    net_revenue = Column(Float, default=0.0)
    gmv = Column(Float, default=0.0)
    
    total_fees = Column(Float, default=0.0) 
    refund = Column(Float, default=0.0)     

    source = Column(String, nullable=False, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), index=True)
    details = Column(JSONB, nullable=True) 

    __table_args__ = (
        Index('ix_revenue_brand_id_transaction_date', 'brand_id', 'transaction_date'),
    )

    owner_brand = relationship("Brand", back_populates="revenues")

class DailyStat(Base):
    __tablename__ = "daily_stats"
    
    id = Column(Integer, primary_key=True, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), index=True)
    date = Column(Date, index=True)
    
    # Các chỉ số quan trọng đã được tính toán sẵn
    net_revenue = Column(Float, default=0.0)  # Doanh thu ròng (Thực nhận từ Revenue)
    provisional_revenue = Column(Float, default=0.0) # Doanh thu tạm tính (Từ Order selling_price)
    gmv = Column(Float, default=0.0)          # Tổng GMV
    profit = Column(Float, default=0.0)       # Lợi nhuận
    total_cost = Column(Float, default=0.0)   # Tổng chi phí
    ad_spend = Column(Float, default=0.0)     # Chi phí Ads
    total_orders = Column(Integer, default=0) # Tổng số đơn hàng
    cogs = Column(Float, default=0.0)            # Giá vốn hàng bán
    execution_cost = Column(Float, default=0.0)  # Chi phí thực thi (từ total_fees)

    cpm = Column(Float, default=0.0)   
    cpa = Column(Float, default=0.0)   
    ctr = Column(Float, default=0.0)   
    cpc = Column(Float, default=0.0)  
    conversions = Column(Integer, default=0)  
    impressions = Column(Integer, default=0)  
    clicks = Column(Integer, default=0)  
    reach = Column(Integer, default=0)  
    frequency = Column(Float, default=0)

    roi = Column(Float, default=0.0)
    profit_margin = Column(Float, default=0.0)
    take_rate = Column(Float, default=0.0)
    aov = Column(Float, default=0.0)
    upt = Column(Float, default=0.0)
    completion_rate = Column(Float, default=0.0)
    cancellation_rate = Column(Float, default=0.0)
    refund_rate = Column(Float, default=0.0)
    
    # === KPI VẬN HÀNH ===
    avg_processing_time = Column(Float, default=0.0) # Thời gian xử lý TB (Giờ)
    avg_shipping_time = Column(Float, default=0.0)   # Thời gian giao hàng TB (Ngày)
    
    completed_orders = Column(Integer, default=0)
    cancelled_orders = Column(Integer, default=0)
    refunded_orders = Column(Integer, default=0)
    bomb_orders = Column(Integer, default=0)     # Số đơn bom hàng
    bomb_rate = Column(Float, default=0.0)       # Tỷ lệ bom hàng (%)
    unique_skus_sold = Column(Integer, default=0)
    total_quantity_sold = Column(Integer, default=0)
    total_customers = Column(Integer, default=0)
    
    new_customers = Column(Integer, default=0)
    returning_customers = Column(Integer, default=0)

    # === CÁC CỘT JSONB MỚI (ĐỂ LƯU FULL DATA TỔNG HỢP) ===
    hourly_breakdown = Column(JSONB, nullable=True)
    payment_method_breakdown = Column(JSONB, nullable=True)
    cancel_reason_breakdown = Column(JSONB, nullable=True)
    location_distribution = Column(JSONB, nullable=True)
    top_products = Column(JSONB, nullable=True)
    top_refunded_products = Column(JSONB, nullable=True)
    frequency_distribution = Column(JSONB, nullable=True)
    customer_segment_distribution = Column(JSONB, nullable=True)

    # Đảm bảo mỗi brand chỉ có 1 dòng dữ liệu cho 1 ngày (Chống trùng lặp)
    __table_args__ = (
        UniqueConstraint('brand_id', 'date', name='uq_brand_date_stat'),
    )

    owner_brand = relationship("Brand", back_populates="daily_stats")

class MarketingSpend(Base):
    __tablename__ = "marketing_spends"

    id = Column(Integer, primary_key=True, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), nullable=False, index=True)
    source = Column(String, nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    
    ad_spend = Column(Float, default=0.0)
    cpm = Column(Float, default=0.0)
    ctr = Column(Float, default=0.0)
    cpa = Column(Float, default=0.0)
    cpc = Column(Float, default=0.0)
    conversions = Column(Integer, default=0)
    impressions = Column(Integer, default=0)
    reach = Column(Integer, default=0)
    clicks = Column(Integer, default=0)

    owner_brand = relationship("Brand", back_populates="marketing_spends")

    __table_args__ = (UniqueConstraint('brand_id', 'source', 'date', name='_brand_source_date_uc'),)

class DailyAnalytics(Base):
    __tablename__ = "daily_analytics"
    
    id = Column(Integer, primary_key=True, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), index=True)
    date = Column(Date, index=True)
    source = Column(String, nullable=False, index=True) # Shopee, Lazada, TikTok, Offline...

    # ==========================================
    # 1. FINANCE & PROFITABILITY (Tài chính & Lợi nhuận)
    # ==========================================
    gmv = Column(Float, default=0.0)             # Tổng giá trị đơn hàng (chưa trừ gì hết)
    net_revenue = Column(Float, default=0.0)     # Doanh thu thực (GMV - Phí sàn)
    provisional_revenue = Column(Float, default=0.0) # Doanh thu tạm tính (Từ Order selling_price)
    profit = Column(Float, default=0.0)          # Lợi nhuận gộp (Net Revenue - Giá vốn) - Đổi từ gross_profit
    # net_profit = Column(Float, default=0.0)      # Lợi nhuận ròng (Trừ hết sạch chi phí) - Tạm thời chưa dùng
    
    # --- Cấu trúc chi phí chi tiết ---
    total_cost = Column(Float, default=0.0)        # Tổng chi phí
    cogs = Column(Float, default=0.0)            # Giá vốn hàng bán
    execution_cost = Column(Float, default=0.0)   # Phí sàn (Payment fee, Fixed fee...)
    # commission_fees = Column(Float, default=0.0) # Phí hoa hồng (Affiliate...)
    # voucher_cost = Column(Float, default=0.0)    # Chi phí mã giảm giá shop chịu
    # shipping_cost = Column(Float, default=0.0)   # Phí vận chuyển shop chịu
    # other_costs = Column(Float, default=0.0)     # Chi phí phát sinh khác

    # ==========================================
    # 2. MARKETING PERFORMANCE (Hiệu quả Quảng cáo)
    # ==========================================
    ad_spend = Column(Float, default=0.0)        # Chi phí quảng cáo
    roi = Column(Float, default=0.0)             # Return on Investment 
    clicks = Column(Integer, default=0)          # Số lượt click
    impressions = Column(Integer, default=0)     # Số lượt hiển thị
    ctr = Column(Float, default=0.0)             # Click-through Rate (%)
    conversions = Column(Integer, default=0)     # Số lượt chuyển đổi ra đơn
    cpc = Column(Float, default=0.0)             # Cost Per Click
    reach = Column(Integer, default=0)           # Lượt tiếp cận
    cpm = Column(Float, default=0.0)             # Chi phí cho 1.000 lần hiển thị
    cpa = Column(Float, default=0.0)             # Chi phí mỗi lượt chuyển đổi.
    frequency = Column(Float, default=0.0)       # Tần suất
    conversion_rate = Column(Float, default=0.0) # Tỷ lệ chuyển đổi (snake_case)

    # ==========================================
    # 3. OPERATIONS & HEALTH (Vận hành & Sức khỏe Shop)
    # ==========================================
    total_orders = Column(Integer, default=0)     # Tổng số đơn phát sinh
    completed_orders = Column(Integer, default=0) # Số đơn thành công
    cancelled_orders = Column(Integer, default=0) # Số đơn bị hủy
    refunded_orders = Column(Integer, default=0)  # Số đơn bị hoàn trả (Đổi từ returned_orders)
    bomb_orders = Column(Integer, default=0)     # Số đơn bom hàng
    bomb_rate = Column(Float, default=0.0)       # Tỷ lệ bom hàng (%)
    
    cancellation_rate = Column(Float, default=0.0) # Tỷ lệ hủy (%)
    refund_rate = Column(Float, default=0.0)       # Tỷ lệ hoàn (%) (Đổi từ return_rate)
    
    # === KPI VẬN HÀNH (THÊM MỚI / CHỈNH SỬA) ===
    avg_processing_time = Column(Float, default=0.0)  # Thời gian xử lý TB (Giờ)
    avg_shipping_time = Column(Float, default=0.0)    # Thời gian giao hàng TB (Ngày)
    avg_fulfillment_time = Column(Float, default=0.0) # (Legacy) Giữ lại nếu chưa muốn xóa ngay, hoặc xóa luôn cũng được. Em cứ để tạm.

    # ==========================================
    # 4. CUSTOMER INSIGHTS (Chân dung khách hàng)
    # ==========================================
    new_customers = Column(Integer, default=0)        # Số khách mua lần đầu
    returning_customers = Column(Integer, default=0)  # Số khách quay lại mua
    new_customer_revenue = Column(Float, default=0.0) # Doanh thu từ khách mới
    returning_customer_revenue = Column(Float, default=0.0) # Doanh thu từ khách cũ
    
    aov = Column(Float, default=0.0)             # Average Order Value (Giá trị đơn TB)
    upt = Column(Float, default=0.0)             # Units Per Transaction (Số SP/đơn TB)
    unique_skus_sold = Column(Integer, default=0) # Độ đa dạng SP (Mới bổ sung)
    total_quantity_sold = Column(Integer, default=0) # Tổng số lượng sản phẩm bán ra

    # ==========================================
    # 5. COMPLEX ANALYTICS (Dữ liệu phức tạp - JSONB)
    # ==========================================
    # Phân bổ khung giờ đặt hàng: {"0": 5, "1": 2, ..., "20": 50}
    hourly_breakdown = Column(JSONB, nullable=True)
    
    # Phân bổ phương thức thanh toán: {"cod": 60, "online_payment": 40}
    payment_method_breakdown = Column(JSONB, nullable=True)
    
    # Phân bổ lý do hủy đơn: {"bom_hang": 5, "doi_y": 2, ...}
    cancel_reason_breakdown = Column(JSONB, nullable=True)
    
    # Top tỉnh thành mua nhiều (Phân bổ khách hàng): [{"city": "Hanoi", "orders": 10, "revenue": 5000000}, ...]
    location_distribution = Column(JSONB, nullable=True)
    
    # Top sản phẩm bán chạy (Top SKU): [{"sku": "ABC", "name": "Áo thun", "quantity": 10, "revenue": 2000000}, ...]
    top_products = Column(JSONB, nullable=True)
    
    # Top sản phẩm hoàn (Mới)
    top_refunded_products = Column(JSONB, nullable=True)
    
    frequency_distribution = Column(JSONB, nullable=True)
    customer_segment_distribution = Column(JSONB, nullable=True)

    # Nhật ký tài chính chi tiết (Log tiền về/hoàn tiền theo ngày thực tế):
    # [{"date": "2023-12-18", "type": "income", "amount": 150000, "order_code": "A"}, ...]
    financial_events = Column(JSONB, nullable=True)

    # Ràng buộc duy nhất: Một Brand, một Ngày, một Nguồn chỉ có 1 dòng dữ liệu
    __table_args__ = (
        UniqueConstraint('brand_id', 'date', 'source', name='uq_daily_analytics'),
    )

    owner_brand = relationship("Brand", back_populates="daily_analytics")