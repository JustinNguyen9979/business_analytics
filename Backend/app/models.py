# FILE: Backend/app/models.py

from sqlalchemy import Column, Integer, String, ForeignKey, Date, Float, Index, UniqueConstraint
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
    ads = relationship("Ad", back_populates="owner_brand", cascade="all, delete-orphan")
    revenues = relationship("Revenue", back_populates="owner_brand", cascade="all, delete-orphan")

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
    
    brand_id = Column(Integer, ForeignKey("brands.id"), index=True)

    owner_brand = relationship("Brand", back_populates="customers")

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)

    # --- Các cột cốt lõi giữ nguyên, đã rất chuẩn ---
    order_code = Column(String, index=True)
    order_date = Column(Date, nullable=True)
    status = Column(String, nullable=True, index=True)
    username = Column(String, index=True, nullable=True)
    total_quantity = Column(Integer, default=0)
    cogs = Column(Float, default=0.0) # Vẫn giữ lại để lưu giá vốn tại thời điểm bán
    source = Column(String, nullable=False, index=True) # Nguồn (shopee, tiktok, ...)
    brand_id = Column(Integer, ForeignKey("brands.id"), index=True)
    
    # Cột details sẽ được dùng để lưu chi tiết các item trong đơn
    details = Column(JSONB, nullable=True)

    __table_args__ = (
        Index('ix_order_brand_id_order_date', 'brand_id', 'order_date'),
        UniqueConstraint('order_code', 'brand_id', name='uq_order_brand_code')
    )
    
    owner_brand = relationship("Brand", back_populates="orders")

class Ad(Base):
    __tablename__ = "ads"
    id = Column(Integer, primary_key=True, index=True)
    
    # Cấu trúc đã rất phù hợp với template, giữ nguyên
    campaign_name = Column(String, index=True)
    ad_date = Column(Date, nullable=True)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    expense = Column(Float, default=0.0)
    orders = Column(Integer, default=0) 
    gmv = Column(Float, default=0.0)
    source = Column(String, nullable=False, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), index=True)
    details = Column(JSONB, nullable=True)

    __table_args__ = (
        Index('ix_ad_brand_id_ad_date', 'brand_id', 'ad_date'),
    )
    
    owner_brand = relationship("Brand", back_populates="ads")

class Revenue(Base):
    __tablename__ = "revenues"
    id = Column(Integer, primary_key=True, index=True)

    # --- Các cột cốt lõi ---
    order_code = Column(String, index=True)
    transaction_date = Column(Date, nullable=True)
    net_revenue = Column(Float, default=0.0)
    gmv = Column(Float, default=0.0)
    
    # === THAY ĐỔI 2: THÊM CÁC CỘT MỚI TỪ TEMPLATE ===
    total_fees = Column(Float, default=0.0) # Thêm cột để lưu "Tổng Chi Phí"
    refund = Column(Float, default=0.0)     # Thêm cột để lưu "Hoàn Tiền"

    source = Column(String, nullable=False, index=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), index=True)
    details = Column(JSONB, nullable=True) # Vẫn giữ lại để lưu các thông tin phụ khác

    __table_args__ = (
        Index('ix_revenue_brand_id_transaction_date', 'brand_id', 'transaction_date'),
    )

    owner_brand = relationship("Brand", back_populates="revenues")