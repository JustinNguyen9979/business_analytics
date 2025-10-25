from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date, Float
from sqlalchemy.orm import relationship
from .database import Base

class Brand(Base):
    __tablename__ = "brands"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    products = relationship("Product", back_populates="owner_brand", cascade="all, delete-orphan")
    customers = relationship("Customer", back_populates="owner_brand", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="owner_brand", cascade="all, delete-orphan")
    shopee_ads = relationship("ShopeeAd", cascade="all, delete-orphan")
    shopee_revenues = relationship("ShopeeRevenue", cascade="all, delete-orphan")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, index=True)
    cost_price = Column(Integer, default=0) 
    brand_id = Column(Integer, ForeignKey("brands.id"))
    
    owner_brand = relationship("Brand", back_populates="products")

class Customer(Base):
    __tablename__ = "customers"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)           # Từ 'Người Mua'
    city = Column(String, nullable=True)            # Từ 'Tỉnh/Thành phố'
    district_1 = Column(String, nullable=True)      # Từ 'TP / Quận / Huyện'
    district_2 = Column(String, nullable=True)      # Từ 'Quận'
    brand_id = Column(Integer, ForeignKey("brands.id"))

    owner_brand = relationship("Brand", back_populates="customers")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    order_code = Column(String, index=True)         # Từ 'Mã đơn hàng'
    order_date = Column(DateTime)                   # Từ 'Ngày đặt hàng'
    status = Column(String)                         # Từ 'Trạng Thái Đơn Hàng'
    sku = Column(String)                            # Từ 'SKU phân loại hàng'
    quantity = Column(Integer)                      # Từ 'Số lượng'
    brand_id = Column(Integer, ForeignKey("brands.id"))

    owner_brand = relationship("Brand", back_populates="orders")

class ShopeeAd(Base):
    __tablename__ = "shopee_ads"
    id = Column(Integer, primary_key=True, index=True)
    
    # --- CÁC CỘT MỚI ĐƯỢC THÊM VÀO ---
    campaign_name = Column(String)
    status = Column(String, nullable=True)
    ad_type = Column(String, nullable=True)
    product_id = Column(String, nullable=True)
    target_audience_settings = Column(String, nullable=True)
    ad_content = Column(String, nullable=True)
    bidding_method = Column(String, nullable=True)
    location = Column(String, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    ctr = Column(Float, default=0.0)
    conversions = Column(Integer, default=0)
    direct_conversions = Column(Integer, default=0)
    conversion_rate = Column(Float, default=0.0)
    direct_conversion_rate = Column(Float, default=0.0)
    cost_per_conversion = Column(Float, default=0.0)
    cost_per_direct_conversion = Column(Float, default=0.0)
    items_sold = Column(Integer, default=0)
    direct_items_sold = Column(Integer, default=0)
    gmv = Column(Float, default=0.0)
    direct_gmv = Column(Float, default=0.0)
    expense = Column(Float, default=0.0)
    roas = Column(Float, default=0.0)
    direct_roas = Column(Float, default=0.0)
    acos = Column(Float, default=0.0)
    direct_acos = Column(Float, default=0.0)
    product_impressions = Column(Integer, default=0)
    product_clicks = Column(Integer, default=0)
    product_ctr = Column(Float, default=0.0)
    
    brand_id = Column(Integer, ForeignKey("brands.id"))
    owner_brand = relationship("Brand", back_populates="shopee_ads")

# --- BẢNG MỚI CHO DỮ LIỆU DOANH THU ---
class ShopeeRevenue(Base):
    __tablename__ = "shopee_revenues"
    id = Column(Integer, primary_key=True, index=True)
    order_code = Column(String, index=True)
    refund_request_code = Column(String, nullable=True)
    order_date = Column(Date, nullable=True)
    payment_completed_date = Column(Date, nullable=True)
    total_payment = Column(Float, default=0.0)
    product_price = Column(Float, default=0.0)
    refund_amount = Column(Float, default=0.0)
    shipping_fee = Column(Float, default=0.0)
    buyer_paid_shipping_fee = Column(Float, default=0.0)
    actual_shipping_fee = Column(Float, default=0.0)
    shopee_subsidized_shipping_fee = Column(Float, default=0.0)
    seller_voucher_code = Column(String, nullable=True)
    fixed_fee = Column(Float, default=0.0)
    service_fee = Column(Float, default=0.0)
    payment_fee = Column(Float, default=0.0)
    commission_fee = Column(Float, default=0.0)
    affiliate_marketing_fee = Column(Float, default=0.0)
    buyer_username = Column(String, nullable=True)
    
    brand_id = Column(Integer, ForeignKey("brands.id"))
    owner_brand = relationship("Brand", back_populates="shopee_revenues")