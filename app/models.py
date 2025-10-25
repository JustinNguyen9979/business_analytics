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
    campaign_name = Column(String)
    start_date = Column(DateTime, nullable=True)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    ctr = Column(Float, default=0.0) # Tỷ Lệ Click
    conversions = Column(Integer, default=0)
    items_sold = Column(Integer, default=0)
    gmv = Column(Float, default=0.0) # Gross Merchandise Value
    expense = Column(Float, default=0.0) # Chi phí
    roas = Column(Float, default=0.0) # Return on Ad Spend
    brand_id = Column(Integer, ForeignKey("brands.id"))

# --- BẢNG MỚI CHO DỮ LIỆU DOANH THU ---
class ShopeeRevenue(Base):
    __tablename__ = "shopee_revenues"
    id = Column(Integer, primary_key=True, index=True)
    order_code = Column(String, index=True)
    payment_completed_date = Column(Date, nullable=True)
    total_payment = Column(Float, default=0.0) # Tổng tiền đã thanh toán
    fixed_fee = Column(Float, default=0.0) # Phí cố định
    service_fee = Column(Float, default=0.0) # Phí Dịch Vụ
    payment_fee = Column(Float, default=0.0) # Phí thanh toán
    brand_id = Column(Integer, ForeignKey("brands.id"))