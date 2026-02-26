from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
import unicodedata
import re

from .base import CRUDBase
from models import Brand
from schemas import BrandCreate, BrandBase

def slugify(value: str) -> str:
    """
    Helper function để tạo slug từ tên Brand.
    """
    if not isinstance(value, str):
        value = str(value)
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore').decode('ascii')
    value = re.sub(r'[^\w\s-]', '', value).strip().lower()
    return re.sub(r'[-\s]+', '-', value)

class CRUDBrand(CRUDBase[Brand, BrandCreate, BrandBase]):
    def get_by_slug(self, db: Session, *, slug: str) -> Optional[Brand]:
        return db.query(self.model).filter(self.model.slug == slug).first()

    def get_by_name(self, db: Session, *, name: str) -> Optional[Brand]:
        return db.query(self.model).filter(self.model.name == name).first()

    def create(self, db: Session, *, obj_in: BrandCreate, owner_id: str) -> Optional[Brand]:
        """
        Override hàm create để tự động sinh slug duy nhất và gán owner_id.
        """
        clean_name = obj_in.name.strip()
        # Check trùng tên (Case insensitive)
        if db.query(self.model).filter(func.lower(self.model.name) == func.lower(clean_name)).first():
            return None
        
        # Logic tạo slug duy nhất
        base_slug = slugify(clean_name)
        unique_slug = base_slug
        counter = 1
        while db.query(self.model).filter(self.model.slug == unique_slug).first():
            unique_slug = f"{base_slug}-{counter}"
            counter += 1

        db_obj = self.model(name=clean_name, slug=unique_slug, owner_id=owner_id)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj
    
    def update_name(self, db: Session, *, brand_id: int, new_name: str) -> Optional[Brand]:
        """
        Cập nhật tên và regenerate slug.
        """
        db_brand = self.get(db, id=brand_id)
        if not db_brand:
            return None

        clean_new_name = new_name.strip()
        # Check trùng tên với brand KHÁC
        existing_brand = db.query(self.model).filter(
            func.lower(self.model.name) == func.lower(clean_new_name),
            self.model.id != brand_id
        ).first()
        if existing_brand:
            return None

        db_brand.name = clean_new_name
        
        # Regenerate slug
        base_slug = slugify(clean_new_name)
        unique_slug = base_slug
        counter = 1
        while db.query(self.model).filter(self.model.slug == unique_slug, self.model.id != brand_id).first():
            unique_slug = f"{base_slug}-{counter}"
            counter += 1
        db_brand.slug = unique_slug
        
        db.commit()
        db.refresh(db_brand)
        return db_brand

brand = CRUDBrand(Brand)
