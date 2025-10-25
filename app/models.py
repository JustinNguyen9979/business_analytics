from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .database import Base

class Brand(Base):
    __tablename__ = "brands"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)

    # Một brand có thể có nhiều sản phẩm, khách hàng, đơn hàng
    products = relationship("Product", back_populates="owner_brand")
    customers = relationship("Customer", back_populates="owner_brand")
    orders = relationship("Order", back_populates="owner_brand")

class Product(Base):
    __tablename__ = "products"
    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String, index=True)
    cost_price = Column(Integer, default=0) # SỬA LỖI: Chuyển sang Integer để không có .0
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