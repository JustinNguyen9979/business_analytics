from sqlalchemy import Column, Integer, String, ForeignKey, Date, Float
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import JSONB # 
from database import Base

class Brand(Base):
    __tablename__ = "brands"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    products = relationship("Product", back_populates="owner_brand", cascade="all, delete-orphan")
    customers = relationship("Customer", back_populates="owner_brand", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="owner_brand", cascade="all, delete-orphan")
    ads = relationship("Ad", back_populates="owner_brand", cascade="all, delete-orphan")
    revenues = relationship("Revenue", back_populates="owner_brand", cascade="all, delete-orphan")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, index=True)
    name = Column(String, nullable=True)
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
    order_date = Column(Date, nullable=True)        # Từ 'Ngày đặt hàng'
    status = Column(String)                         # Từ 'Trạng Thái Đơn Hàng'
    sku = Column(String)                            # Từ 'SKU phân loại hàng'
    quantity = Column(Integer)                      # Từ 'Số lượng'
    username = Column(String, index=True, nullable=True)
    source = Column(String, nullable=False, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"))

    owner_brand = relationship("Brand", back_populates="orders")

class Ad(Base):
    __tablename__ = "ads"
    id = Column(Integer, primary_key=True, index=True)
    # --- Cột cốt lõi ---
    campaign_name = Column(String, index=True)
    ad_date = Column(Date, nullable=True, index=True)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    expense = Column(Float, default=0.0)
    orders = Column(Integer, default=0) # Tên chung cho "conversions"
    gmv = Column(Float, default=0.0)
    source = Column(String, nullable=False, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"))
    # --- Cột JSONB ---
    details = Column(JSONB, nullable=True)
    
    owner_brand = relationship("Brand", back_populates="ads")

# --- BẢNG MỚI CHO DỮ LIỆU DOANH THU ---
class Revenue(Base):
    __tablename__ = "revenues"
    id = Column(Integer, primary_key=True, index=True)
    # --- Cột cốt lõi ---
    order_code = Column(String, index=True)
    transaction_date = Column(Date, nullable=True, index=True)
    net_revenue = Column(Float, default=0.0)
    gmv = Column(Float, default=0.0)
    source = Column(String, nullable=False, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"))
    # --- Cột JSONB ---
    details = Column(JSONB, nullable=True)

    owner_brand = relationship("Brand", back_populates="revenues")