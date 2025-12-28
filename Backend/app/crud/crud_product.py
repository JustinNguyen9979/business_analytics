from sqlalchemy.orm import Session
from .base import CRUDBase
from models import Product
from schemas import ProductBase, ProductItem
from typing import Optional

class CRUDProduct(CRUDBase[Product, ProductBase, ProductBase]):
    def get_by_sku(self, db: Session, *, brand_id: int, sku: str) -> Optional[Product]:
        """
        Tìm kiếm sản phẩm theo mã SKU duy nhất trong phạm vi một Brand.
        """
        return db.query(self.model).filter(
            self.model.brand_id == brand_id, 
            self.model.sku == sku
        ).first()

    def get_multi_by_brand(self, db: Session, *, brand_id: int, skip: int = 0, limit: int = 100) -> list[Product]:
        """
        Lấy danh sách các sản phẩm thuộc về một Brand cụ thể (hỗ trợ phân trang).
        """
        return db.query(self.model).filter(self.model.brand_id == brand_id).offset(skip).limit(limit).all()

    def upsert(self, db: Session, *, brand_id: int, sku: str, name: str, cost_price: int) -> Product:
        """
        Tìm sản phẩm bằng SKU và Brand ID.
        - Nếu có: Update tên và giá vốn.
        - Nếu không: Tạo mới.
        """
        db_product = db.query(self.model).filter(
            self.model.brand_id == brand_id, 
            self.model.sku == sku
        ).first()

        if db_product:
            # Update
            db_product.name = name
            db_product.cost_price = cost_price
        else:
            # Create
            db_product = self.model(
                brand_id=brand_id,
                sku=sku,
                name=name,
                cost_price=cost_price
            )
            db.add(db_product)
        
        # Lưu ý: Hàm này thường được gọi trong loop lớn, nên để caller commit db thì tốt hơn.
        # Nhưng để giữ behavior cũ của hàm upsert_product trong crud_legacy, ta chưa commit ngay ở đây 
        # (trong code cũ upsert_product cũng ko commit, chỉ add/update object, caller sẽ commit).
        
        return db_product

product = CRUDProduct(Product)
