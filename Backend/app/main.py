import json
import redis
import crud, models, schemas, shopee_parser
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Response, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from database import SessionLocal, engine
from datetime import date
from cache import redis_client

models.Base.metadata.create_all(bind=engine)
app = FastAPI(title="CEO Dashboard API by Julice")
def get_db(): 
    db = SessionLocal(); 
    try: 
        yield db 
    finally: 
        db.close()

@app.get("/")
def read_root(): return {"message": "Chào mừng đến với CEO Dashboard API!"}

@app.get("/brands/", response_model=List[schemas.BrandInfo])
def read_brands(db: Session = Depends(get_db)): return db.query(models.Brand).all()

@app.post("/brands/", response_model=schemas.BrandInfo)
def create_brand_api(brand: schemas.BrandCreate, db: Session = Depends(get_db)):
    new_brand = crud.create_brand(db=db, brand=brand)
    if not new_brand:
         raise HTTPException(status_code=400, detail="Brand đã tồn tại")
    return new_brand

# @app.get("/brands/{brand_id}", response_model=schemas.Brand)
# def read_brand(brand_id: int, db: Session = Depends(get_db)):
#     db_brand = crud.get_brand(db, brand_id=brand_id)
#     if not db_brand: raise HTTPException(status_code=404, detail="Không tìm thấy Brand")
#     return db_brand

@app.get("/brands/{brand_id}") # BỎ response_model=schemas.Brand
def read_brand(brand_id: int, start_date: date, end_date: date, db: Session = Depends(get_db)):
    cache_key = f"brand_details:{brand_id}:{start_date.isoformat()}:{end_date.isoformat()}"
    
    try:
        cached_data = redis_client.get(cache_key)
        if cached_data:
            print(f"CACHE HIT: Trả về dữ liệu từ cache cho key: {cache_key}")
            return json.loads(cached_data)
    except redis.exceptions.ConnectionError as e:
        print(f"Lỗi kết nối Redis khi GET: {e}. Bỏ qua cache.")

    print(f"CACHE MISS: Query database cho key: {cache_key}")
    db_brand = crud.get_brand_details(db, brand_id=brand_id, start_date=start_date, end_date=end_date)
    if not db_brand: 
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand")

    brand_pydantic = schemas.Brand.model_validate(db_brand)
    brand_dict = json.loads(brand_pydantic.model_dump_json()) # Chuyển thành dict

    try:
        # Lưu chuỗi JSON vào cache
        redis_client.setex(cache_key, 600, json.dumps(brand_dict, default=str))
    except redis.exceptions.ConnectionError as e:
        print(f"Lỗi kết nối Redis khi SET: {e}. Không thể lưu cache.")

    # LUÔN TRẢ VỀ DICTIONARY
    return brand_dict

@app.post("/upload/{platform}/{brand_id}")
async def upload_platform_data(
    platform: str, 
    brand_id: int, 
    db: Session = Depends(get_db),
    cost_file: Optional[UploadFile] = File(None), 
    order_file: Optional[UploadFile] = File(None),
    ad_file: Optional[UploadFile] = File(None), 
    revenue_file: Optional[UploadFile] = File(None)
):
    """
    API Endpoint tổng quát để xử lý việc upload file từ nhiều nền tảng khác nhau.
    - platform: Tên của nền tảng (ví dụ: "shopee", "tiktok").
    - brand_id: ID của brand đang được xử lý.
    """
    # 1. Kiểm tra Brand có tồn tại không (giữ nguyên)
    if not crud.get_brand(db, brand_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand")

    results = {}
    
    # 2. Phân luồng xử lý dựa trên 'platform'
    if platform.lower() == "shopee":
        # Nếu là Shopee, gọi các hàm xử lý của shopee_parser
        # Lưu ý: file giá vốn (cost_file) là file chung, không cần truyền source
        if cost_file:
            results['cost_file'] = shopee_parser.process_cost_file(db, await cost_file.read(), brand_id)
        
        # Các file còn lại cần truyền 'source' để gắn nhãn cho dữ liệu
        if order_file:
            results['order_file'] = shopee_parser.process_order_file(db, await order_file.read(), brand_id, source=platform)
        if ad_file:
            results['ad_file'] = shopee_parser.process_ad_file(db, await ad_file.read(), brand_id, source=platform)
        if revenue_file:
            results['revenue_file'] = shopee_parser.process_revenue_file(db, await revenue_file.read(), brand_id, source=platform)
    
    elif platform.lower() == "tiktok":
        # Đây là nơi để gọi các hàm xử lý cho TikTok trong tương lai
        # Ví dụ: results['order_file'] = tiktok_parser.process_order_file(...)
        # Hiện tại chưa có nên ta có thể báo lỗi hoặc không làm gì cả
        raise HTTPException(status_code=501, detail="Chức năng upload cho TikTok chưa được triển khai.")
        
    else:
        # Nếu platform không được hỗ trợ, báo lỗi
        raise HTTPException(status_code=400, detail=f"Nền tảng '{platform}' không được hỗ trợ.")

    # Kiểm tra xem có file nào được xử lý không
    if not results:
        raise HTTPException(status_code=400, detail="Không có file nào được cung cấp để xử lý.")

    return {"message": f"Xử lý file cho nền tảng '{platform}' hoàn tất!", "results": results}


@app.delete("/brands/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_brand_api(brand_id: int, db: Session = Depends(get_db)):
    deleted_brand = crud.delete_brand_by_id(db, brand_id=brand_id)
    if not deleted_brand:
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand để xóa")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.put("/brands/{brand_id}", response_model=schemas.BrandInfo)
def update_brand_api(brand_id: int, brand_update: schemas.BrandCreate, db: Session = Depends(get_db)):
    updated_brand = crud.update_brand_name(db, brand_id=brand_id, new_name=brand_update.name)
    if not updated_brand:
        raise HTTPException(status_code=400, detail="Không thể đổi tên. Brand không tồn tại hoặc tên mới đã bị trùng.")
    return updated_brand

@app.post("/brands/{brand_id}/clone", response_model=schemas.BrandInfo)
def clone_brand_api(brand_id: int, db: Session = Depends(get_db)):
    cloned = crud.clone_brand(db, brand_id=brand_id)
    if not cloned:
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand để nhân bản")
    return cloned