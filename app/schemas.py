from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# --- Product Schema ---
class ProductBase(BaseModel):
    sku: str
    cost_price: Optional[int] = 0 # SỬA LỖI: Chuyển sang int
class Product(ProductBase):
    id: int; brand_id: int
    class Config: { 'orm_mode': True }

# --- Customer Schema ---
class CustomerBase(BaseModel):
    username: str
    city: Optional[str] = None
    district_1: Optional[str] = None
    district_2: Optional[str] = None
class Customer(CustomerBase):
    id: int; brand_id: int
    class Config: { 'orm_mode': True }

# --- Order Schema ---
class OrderBase(BaseModel):
    order_code: str
    order_date: datetime
    status: str
    sku: str
    quantity: int
class Order(OrderBase):
    id: int; brand_id: int
    class Config: { 'orm_mode': True }

# --- Brand Schema ---
class BrandBase(BaseModel): name: str
class BrandCreate(BrandBase): pass
class Brand(BrandBase):
    id: int
    products: List[Product] = []
    customers: List[Customer] = []
    orders: List[Order] = []
    class Config: { 'orm_mode': True }