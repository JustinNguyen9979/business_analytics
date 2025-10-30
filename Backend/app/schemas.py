from pydantic import BaseModel, Json
from typing import List, Optional, Dict, Any
from datetime import date

# --- Product Schema ---
class ProductBase(BaseModel):
    sku: str
    # THÊM DÒNG NÀY VÀO
    name: Optional[str] = None
    cost_price: Optional[int] = 0

class Product(ProductBase):
    id: int; brand_id: int
    class Config: orm_mode = True

class BrandInfo(BaseModel):
    id: int
    name: str

    class Config:
        orm_mode = True

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
    order_date: Optional[date] = None
    status: str
    sku: str
    quantity: int
    source: str
    username: Optional[str] = None
class Order(OrderBase):
    id: int; brand_id: int
    class Config: { 'orm_mode': True }

class AdBase(BaseModel):
    campaign_name: Optional[str]
    ad_date: Optional[date]
    impressions: int = 0
    clicks: int = 0
    expense: float = 0.0
    orders: int = 0
    gmv: float = 0.0
    details: Optional[Dict[str, Any]] = None

class Ad(AdBase):
    id: int; brand_id: int; source: str
    class Config: orm_mode = True

# --- SCHEMA MỚI CHO DOANH THU ---
class RevenueBase(BaseModel):
    order_code: Optional[str]
    transaction_date: Optional[date]
    net_revenue: float = 0.0
    gmv: float = 0.0
    details: Optional[Dict[str, Any]] = None

class Revenue(RevenueBase):
    id: int; brand_id: int; source: str
    class Config: orm_mode = True

# --- Brand Schema ---
class BrandBase(BaseModel): name: str
class BrandCreate(BrandBase): pass
class Brand(BrandBase):
    id: int
    products: List[Product] = []
    customers: List[Customer] = []
    orders: List[Order] = []
    ads: List[Ad] = []
    revenues: List[Revenue] = []
    class Config: orm_mode = True

    