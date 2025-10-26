from sqlalchemy.orm import Session
import models, schemas
from datetime import datetime
import pandas as pd

# (Các hàm của Brand, Product không đổi)
def get_brand(db: Session, brand_id: int): return db.query(models.Brand).filter(models.Brand.id == brand_id).first()
def get_brand_by_name(db: Session, name: str): return db.query(models.Brand).filter(models.Brand.name == name).first()

def create_brand(db: Session, brand: schemas.BrandCreate):
    clean_name = brand.name.strip()
    if db.query(models.Brand).filter(models.Brand.name == clean_name).first():
        return None # Báo hiệu tên đã tồn tại
    db_brand = models.Brand(name=clean_name)
    db.add(db_brand)
    db.commit()
    db.refresh(db_brand)
    return db_brand

def get_or_create_product(db: Session, sku: str, brand_id: int):
    db_product = db.query(models.Product).filter(models.Product.sku == sku, models.Product.brand_id == brand_id).first()
    if not db_product: db_product = models.Product(sku=sku, brand_id=brand_id); db.add(db_product); db.commit(); db.refresh(db_product)
    return db_product
def update_product_cost_price(db: Session, product_id: int, cost_price: int): # Nhận vào int
    db.query(models.Product).filter(models.Product.id == product_id).update({"cost_price": cost_price}); db.commit()

# --- HÀM GHI DỮ LIỆU CUSTOMER ---
def get_or_create_customer(db: Session, customer_data: dict, brand_id: int):
    username = customer_data.get('Người Mua')
    if not username: return None

    db_customer = db.query(models.Customer).filter(models.Customer.username == username, models.Customer.brand_id == brand_id).first()
    
    if not db_customer:
        db_customer = models.Customer(
            username=username,
            city=customer_data.get('Tỉnh/Thành phố'),
            district_1=customer_data.get('TP / Quận / Huyện'),
            district_2=customer_data.get('Quận'),
            brand_id=brand_id
        )
        db.add(db_customer)
        db.commit()
        db.refresh(db_customer)
    return db_customer

# --- HÀM GHI DỮ LIỆU ORDER ---
def create_order_entry(db: Session, order_data: dict, brand_id: int):
    status = order_data.get('Trạng Thái Đơn Hàng')
    final_status = 'Đã hủy' if status == 'Đã hủy' else 'Đang giao'

    new_order = models.Order(
        order_code=order_data.get("Mã đơn hàng"),
        order_date=order_data.get("Ngày đặt hàng"),
        status=final_status,
        sku=order_data.get("SKU phân loại hàng"),
        quantity=int(order_data.get("Số lượng", 0)),
        username=order_data.get("Người Mua"),
        brand_id=brand_id
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order

# --- HÀM GHI DỮ LIỆU QUẢNG CÁO ---
def create_ad_entry(db: Session, ad_data: dict, brand_id: int):
    new_ad = models.ShopeeAd(**ad_data, brand_id=brand_id)
    db.add(new_ad)
    db.commit()
    db.refresh(new_ad)
    return new_ad

# --- HÀM GHI DỮ LIỆU DOANH THU ---
def create_revenue_entry(db: Session, revenue_data: dict, brand_id: int):
    new_revenue = models.ShopeeRevenue(**revenue_data, brand_id=brand_id)
    db.add(new_revenue)
    db.commit()
    db.refresh(new_revenue)
    return new_revenue

# --- CÁC HÀM MỚI CHO VIỆC XÓA DỮ LIỆU ---
def delete_orders_in_date_range(db: Session, brand_id: int, start_date, end_date):
    db.query(models.Order).filter(models.Order.brand_id == brand_id, models.Order.order_date.between(start_date, end_date)).delete()
    db.commit()

def delete_ads_in_date_range(db: Session, brand_id: int, start_date, end_date):
    db.query(models.ShopeeAd).filter(models.ShopeeAd.brand_id == brand_id, models.ShopeeAd.start_date.between(start_date, end_date)).delete()
    db.commit()

def delete_revenues_in_date_range(db: Session, brand_id: int, start_date, end_date):
    db.query(models.ShopeeRevenue).filter(models.ShopeeRevenue.brand_id == brand_id, models.ShopeeRevenue.payment_completed_date.between(start_date, end_date)).delete()
    db.commit()

def delete_data_by_type(db: Session, brand_id: int, data_type: str):
    if data_type == 'orders': db.query(models.Order).filter(models.Order.brand_id == brand_id).delete()
    elif data_type == 'ads': db.query(models.ShopeeAd).filter(models.ShopeeAd.brand_id == brand_id).delete()
    elif data_type == 'revenues': db.query(models.ShopeeRevenue).filter(models.ShopeeRevenue.brand_id == brand_id).delete()
    elif data_type == 'products': db.query(models.Product).filter(models.Product.brand_id == brand_id).delete()
    db.commit()

def delete_brand_by_id(db: Session, brand_id: int):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if db_brand:
        db.delete(db_brand)
        db.commit()
    return db_brand

def update_brand_name(db: Session, brand_id: int, new_name: str):
    db_brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if db_brand:
        clean_new_name = new_name.strip() 
        existing_brand = db.query(models.Brand).filter(models.Brand.name == clean_new_name, models.Brand.id != brand_id).first()
        if existing_brand:
            return None
        db_brand.name = clean_new_name
        db.commit()
        db.refresh(db_brand)
    return db_brand

def clone_brand(db: Session, brand_id: int):
    original_brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if not original_brand:
        return None
    
    # Tạo tên mới, kiểm tra nếu tên đã tồn tại thì thêm số
    copy_number = 1
    new_name = f"{original_brand.name} - Copy"
    while db.query(models.Brand).filter(models.Brand.name == new_name).first():
        copy_number += 1
        new_name = f"{original_brand.name} - Copy {copy_number}"
        
    cloned_brand = models.Brand(name=new_name)
    db.add(cloned_brand)
    db.commit()
    db.refresh(cloned_brand)
    # Lưu ý: Hiện tại chỉ nhân bản tên. Nếu muốn nhân bản cả dữ liệu, logic sẽ phức tạp hơn.
    return cloned_brand