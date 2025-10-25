from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from . import crud, models, schemas, shopee_parser
from .database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)
app = FastAPI(title="CEO Dashboard API by Julice")
def get_db(): 
    db = SessionLocal(); 
    try: 
        yield db 
    finally: 
        db.close()

@app.get("/")
def read_root(): return {"message": "Chào mừng anh đến với CEO Dashboard API!"}

@app.get("/brands/", response_model=List[schemas.Brand])
def read_brands(db: Session = Depends(get_db)): return db.query(models.Brand).all()

@app.post("/brands/", response_model=schemas.Brand)
def create_brand_api(brand: schemas.BrandCreate, db: Session = Depends(get_db)):
    if crud.get_brand_by_name(db, name=brand.name): raise HTTPException(status_code=400, detail="Brand đã tồn tại")
    return crud.create_brand(db=db, brand=brand)

@app.get("/brands/{brand_id}", response_model=schemas.Brand)
def read_brand(brand_id: int, db: Session = Depends(get_db)):
    db_brand = crud.get_brand(db, brand_id=brand_id)
    if not db_brand: raise HTTPException(status_code=404, detail="Không tìm thấy Brand")
    return db_brand

@app.post("/upload/shopee/{brand_id}")
async def upload_shopee_data(brand_id: int, db: Session = Depends(get_db),
    cost_file: Optional[UploadFile] = File(None), order_file: Optional[UploadFile] = File(None),
    ad_file: Optional[UploadFile] = File(None), revenue_file: Optional[UploadFile] = File(None)):
    
    if not crud.get_brand(db, brand_id): raise HTTPException(status_code=404, detail="Không tìm thấy Brand")
    results = {}
    if cost_file: results['cost_file'] = shopee_parser.process_cost_file(db, await cost_file.read(), brand_id)
    if order_file: results['order_file'] = shopee_parser.process_order_file(db, await order_file.read(), brand_id)
    if ad_file: results['ad_file'] = shopee_parser.process_ad_file(db, await ad_file.read(), brand_id)
    if revenue_file: results['revenue_file'] = shopee_parser.process_revenue_file(db, await revenue_file.read(), brand_id)
    return {"message": "Xử lý hoàn tất!", "results": results}

# --- API MỚI ĐỂ XÓA DỮ LIỆU ---
class DataToDelete(BaseModel):
    data_types: List[str]

@app.post("/brands/{brand_id}/delete-data")
def delete_brand_data(brand_id: int, data: DataToDelete, db: Session = Depends(get_db)):
    if not crud.get_brand(db, brand_id): raise HTTPException(status_code=404, detail="Không tìm thấy Brand")
    
    deleted_types = []
    for data_type in data.data_types:
        crud.delete_data_by_type(db, brand_id, data_type)
        deleted_types.append(data_type)
    
    return {"message": f"Đã xóa thành công dữ liệu cho các loại: {', '.join(deleted_types)}"}