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
    
    if cost_file:
        content = await cost_file.read()
        results['cost_file'] = shopee_parser.process_cost_file(db, content, brand_id)
    if order_file:
        content = await order_file.read()
        results['order_file'] = shopee_parser.process_order_file(db, content, brand_id)
    if ad_file:
        content = await ad_file.read()
        results['ad_file'] = shopee_parser.process_ad_file(db, content, brand_id)
    if revenue_file:
        content = await revenue_file.read()
        results['revenue_file'] = shopee_parser.process_revenue_file(db, content, brand_id)
        
    return {"message": "Xử lý hoàn tất!", "results": results}