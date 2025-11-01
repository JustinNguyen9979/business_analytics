# FILE: backend/app/crud.py (PHIÊN BẢN CUỐI CÙNG - ỔN ĐỊNH)

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
import models, schemas
from datetime import date

# === HÀM get_brand_details ĐÃ ĐƯỢC VIẾT LẠI HOÀN TOÀN THEO CÁCH ỔN ĐỊNH ===
def get_brand_details(db: Session, brand_id: int, start_date: date, end_date: date):
    """
    Sử dụng lại logic truy vấn "siêu tập hợp" ổn định và hiệu quả nhất.
    Toàn bộ logic cache đã được chuyển ra ngoài main.py.
    """
    # Lấy danh sách order_code từ các giao dịch tài chính trong kỳ
    financial_order_codes_query = db.query(models.Revenue.order_code).filter(
        models.Revenue.brand_id == brand_id,
        models.Revenue.transaction_date.between(start_date, end_date)
    ).distinct()
    financial_order_codes = [code for code, in financial_order_codes_query]

    # Lấy đối tượng Brand và eager-load các mối quan hệ đã được lọc
    brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if not brand:
        return None

    # Tải "siêu tập hợp" các đơn hàng liên quan
    brand.orders = db.query(models.Order).filter(
        models.Order.brand_id == brand_id,
        or_(
            models.Order.order_date.between(start_date, end_date),
            models.Order.order_code.in_(financial_order_codes)
        )
    ).all()

    # Tải các doanh thu trong kỳ
    brand.revenues = db.query(models.Revenue).filter(
        models.Revenue.brand_id == brand_id,
        models.Revenue.transaction_date.between(start_date, end_date)
    ).all()

    # Tải các quảng cáo trong kỳ
    brand.ads = db.query(models.Ad).filter(
        models.Ad.brand_id == brand_id,
        models.Ad.ad_date.between(start_date, end_date)
    ).all()
    
    # Tải các dữ liệu không cần lọc
    brand.products = db.query(models.Product).filter(models.Product.brand_id == brand_id).all()
    brand.customers = db.query(models.Customer).filter(models.Customer.brand_id == brand_id).all()

    return brand


# --- CÁC HÀM CÒN LẠI GIỮ NGUYÊN ---
def get_brand(db: Session, brand_id: int):
    return db.query(models.Brand).filter(models.Brand.id == brand_id).first()

def get_brand_by_name(db: Session, name: str):
    return db.query(models.Brand).filter(models.Brand.name == name).first()

def create_brand(db: Session, brand: schemas.BrandCreate):
    clean_name = brand.name.strip()
    if db.query(models.Brand).filter(models.Brand.name == clean_name).first():
        return None
    db_brand = models.Brand(name=clean_name)
    db.add(db_brand)
    db.commit()
    db.refresh(db_brand)
    return db_brand

def get_or_create_product(db: Session, sku: str, brand_id: int):
    db_product = db.query(models.Product).filter(models.Product.sku == sku, models.Product.brand_id == brand_id).first()
    if not db_product:
        db_product = models.Product(sku=sku, brand_id=brand_id)
        db.add(db_product)
        db.commit()
        db.refresh(db_product)
    return db_product

def update_product_details(db: Session, product_id: int, name: str, cost_price: int):
    db.query(models.Product).filter(models.Product.id == product_id).update({
        "name": name,
        "cost_price": cost_price
    })
    db.commit()

def get_or_create_customer(db: Session, customer_data: dict, brand_id: int):
    username = customer_data.get('Người Mua')
    if not username:
        return None
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

def create_order_entry(db: Session, order_data: dict, brand_id: int, source: str):
    new_order = models.Order(**order_data, brand_id=brand_id, source=source)
    db.add(new_order)
    db.commit()
    db.refresh(new_order)
    return new_order

def create_ad_entry(db: Session, ad_data: dict, brand_id: int, source: str):
    new_ad = models.Ad(**ad_data, brand_id=brand_id, source=source)
    db.add(new_ad)
    db.commit()
    db.refresh(new_ad)
    return new_ad

def create_revenue_entry(db: Session, revenue_data: dict, brand_id: int, source: str):
    new_revenue = models.Revenue(**revenue_data, brand_id=brand_id, source=source)
    db.add(new_revenue)
    db.commit()
    db.refresh(new_revenue)
    return new_revenue

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
    base_name = original_brand.name.split(' - Copy')[0]
    copy_number = 1
    new_name = f"{base_name} - Copy"
    while db.query(models.Brand).filter(models.Brand.name == new_name).first():
        copy_number += 1
        new_name = f"{base_name} - Copy {copy_number}"
    cloned_brand = models.Brand(name=new_name)
    db.add(cloned_brand)
    db.commit()
    db.refresh(cloned_brand)
    return cloned_brand