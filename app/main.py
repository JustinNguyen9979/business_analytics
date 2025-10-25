from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from typing import List

from . import crud, models, schemas, shopee_parser
from .database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="CEO Dashboard API by Julice")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/")
def read_root():
    return {"message": "Chào mừng anh đến với CEO Dashboard API!"}

# === API cho Brand ===
@app.post("/brands/", response_model=schemas.Brand)
def create_brand_api(brand: schemas.BrandCreate, db: Session = Depends(get_db)):
    db_brand = crud.get_brand_by_name(db, name=brand.name)
    if db_brand:
        raise HTTPException(status_code=400, detail="Brand đã tồn tại")
    return crud.create_brand(db=db, brand=brand)

@app.get("/brands/{brand_id}", response_model=schemas.Brand)
def read_brand(brand_id: int, db: Session = Depends(get_db)):
    db_brand = crud.get_brand(db, brand_id=brand_id)
    if db_brand is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand")
    return db_brand

# === API Upload cho Shopee (Chế độ Hoạt động chính thức) ===
# Thêm vào file app/main.py

@app.get("/brands/", response_model=List[schemas.Brand])
def read_brands(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    brands = db.query(models.Brand).offset(skip).limit(limit).all()
    return brands

async def upload_shopee_data(
    brand_id: int, 
    cost_file: UploadFile = File(...),
    order_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    brand = crud.get_brand(db, brand_id)
    if not brand:
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand")
    
    cost_content = await cost_file.read()
    order_content = await order_file.read()
    
    # Xử lý file giá vốn
    cost_result = shopee_parser.process_cost_file(db, cost_content, brand_id)
    if cost_result["status"] == "error":
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý file giá vốn: {cost_result['message']}")
        
    # Xử lý file đơn hàng với logic mới và chính xác
    order_result = shopee_parser.process_order_file(db, order_content, brand_id)
    if order_result["status"] == "error":
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý file đơn hàng: {order_result['message']}")

    return {
        "brand_name": brand.name,
        "cost_file_result": cost_result,
        "order_file_result": order_result
    }