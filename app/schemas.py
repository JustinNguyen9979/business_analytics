from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date

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

class ShopeeAdBase(BaseModel):
    campaign_name: str
    start_date: Optional[datetime] = None
    impressions: int; clicks: int; ctr: float; conversions: int
    items_sold: int; gmv: float; expense: float; roas: float
class ShopeeAd(ShopeeAdBase):
    id: int; brand_id: int
    class Config: { 'orm_mode': True }

# --- SCHEMA MỚI CHO DOANH THU ---
class ShopeeRevenueBase(BaseModel):
    order_code: str
    refund_request_code: Optional[str] = None
    order_date: Optional[date] = None
    payment_completed_date: Optional[date] = None
    total_payment: float = 0.0
    product_price: float = 0.0
    refund_amount: float = 0.0
    shipping_fee: float = 0.0
    buyer_paid_shipping_fee: float = 0.0
    actual_shipping_fee: float = 0.0
    shopee_subsidized_shipping_fee: float = 0.0
    seller_voucher_code: Optional[str] = None
    fixed_fee: float = 0.0
    service_fee: float = 0.0
    payment_fee: float = 0.0
    commission_fee: float = 0.0
    affiliate_marketing_fee: float = 0.0
    buyer_username: Optional[str] = None

class ShopeeRevenue(ShopeeRevenueBase):
    id: int
    brand_id: int
    class Config:
        orm_mode = True

# --- Brand Schema ---
class BrandBase(BaseModel): name: str
class BrandCreate(BrandBase): pass
class Brand(BrandBase):
    id: int
    products: List[Product] = []
    customers: List[Customer] = []
    orders: List[Order] = []
    shopee_ads: List[ShopeeAd] = []
    shopee_revenues: List[ShopeeRevenue] = []
    class Config:
        orm_mode = True
    