from sqlalchemy.orm import Session
from .base import CRUDBase
from models import Customer
from schemas import CustomerBase, CustomerCreate
from typing import Optional

class CRUDCustomer(CRUDBase[Customer, CustomerCreate, CustomerBase]):
    def get_by_username(self, db: Session, *, brand_id: int, username: str) -> Optional[Customer]:
        """
        Tìm kiếm khách hàng theo username và brand_id.
        """
        return db.query(self.model).filter(
            self.model.brand_id == brand_id, 
            self.model.username == username
        ).first()

    def get_or_create(self, db: Session, *, brand_id: int, customer_data: dict) -> Customer:
        """
        Tìm customer theo username + brand_id.
        - Nếu có: Cập nhật thông tin (city, district) nếu thiếu hoặc thay đổi.
        - Nếu không: Tạo mới.
        """
        username = customer_data.get("username")
        if not username:
            return None # Should probably raise an error or handle this case

        db_customer = self.get_by_username(db, brand_id=brand_id, username=username)
        
        city = customer_data.get("city")
        district = customer_data.get("district")
        source = customer_data.get("source")

        if db_customer:
            # Update info if provided and different (basic logic, can be improved)
            if city and db_customer.city != city:
                db_customer.city = city
            if district and db_customer.district != district:
                db_customer.district = district
            if source and not db_customer.source: # Chỉ update source nếu chưa có (first touch)
                db_customer.source = source
        else:
            # Create new
            db_customer = self.model(
                brand_id=brand_id,
                username=username,
                city=city,
                district=district,
                source=source
            )
            db.add(db_customer)
            # Tương tự như product, ta chưa commit ở đây để caller quản lý transaction lớn.
        
        return db_customer

customer = CRUDCustomer(Customer)
