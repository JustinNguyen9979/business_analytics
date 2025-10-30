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
    campaign_name: Optional[str] = None
    status: Optional[str] = None
    ad_type: Optional[str] = None
    product_id: Optional[str] = None
    target_audience_settings: Optional[str] = None
    ad_content: Optional[str] = None
    bidding_method: Optional[str] = None
    location: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    impressions: int = 0
    clicks: int = 0
    ctr: float = 0.0
    conversions: int = 0
    direct_conversions: int = 0
    conversion_rate: float = 0.0
    direct_conversion_rate: float = 0.0
    cost_per_conversion: float = 0.0
    cost_per_direct_conversion: float = 0.0
    items_sold: int = 0
    direct_items_sold: int = 0
    gmv: float = 0.0
    direct_gmv: float = 0.0
    expense: float = 0.0
    roas: float = 0.0
    direct_roas: float = 0.0
    acos: float = 0.0
    direct_acos: float = 0.0
    product_impressions: int = 0
    product_clicks: int = 0
    product_ctr: float = 0.0
    source: str 
class Ad(AdBase):
    id: int; brand_id: int
    class Config: { 'orm_mode': True }

# --- SCHEMA MỚI CHO DOANH THU ---
class RevenueBase(BaseModel):
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
    source: str 

class Revenue(RevenueBase):
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
    ads: List[Ad] = []
    revenues: List[Revenue] = []
    class Config:
        orm_mode = True
    