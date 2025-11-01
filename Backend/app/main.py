import json
import redis
import crud, models, schemas, shopee_parser
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Response, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import SessionLocal, engine
from datetime import date
from cache import redis_client
from celery_worker import process_brand_data

models.Base.metadata.create_all(bind=engine)
app = FastAPI(title="CEO Dashboard API by Julice")
def get_db(): 
    db = SessionLocal(); 
    try: yield db 
    finally: db.close()


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

@app.get("/brands/{brand_id}", response_model=schemas.BrandWithKpis) # Dùng schema mới
def read_brand(
    brand_id: int, 
    start_date: date, 
    end_date: date, 
    db: Session = Depends(get_db)
):
    db_brand = crud.get_brand_details(db, brand_id=brand_id, start_date=start_date, end_date=end_date)
    if not db_brand: 
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand")
    return db_brand

@app.post("/brands/{brand_id}/recalculate", status_code=status.HTTP_202_ACCEPTED)
def recalculate_brand_data(brand_id: int, db: Session = Depends(get_db)):
    """
    Endpoint để xóa cache của một brand và kích hoạt worker tính toán lại.
    """
    # 1. Kiểm tra xem brand có tồn tại không
    if not crud.get_brand(db, brand_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand")

    # 2. Xóa tất cả các cache key liên quan đến brand này
    # Lấy tất cả các key có dạng "kpi_daily:brand_id:*"
    keys_to_delete = redis_client.keys(f"kpi_daily:{brand_id}:*")
    if keys_to_delete:
        redis_client.delete(*keys_to_delete)
        print(f"RECALC: Đã xóa {len(keys_to_delete)} cache keys cho brand ID {brand_id}.")

    # 3. Kích hoạt worker để tính toán lại từ đầu
    process_brand_data.delay(brand_id)
    print(f"RECALC: Đã kích hoạt worker tính toán lại cho brand ID {brand_id}.")

    return {"message": "Yêu cầu tính toán lại đã được gửi. Dữ liệu sẽ được cập nhật sau vài phút."}

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

    process_brand_data.delay(brand_id)
    print(f"MAIN: Đã kích hoạt worker xử lý dữ liệu cho brand ID {brand_id}")

    return {"message": f"Xử lý file cho nền tảng '{platform}' hoàn tất! Dữ liệu đang được tính toán nền.", "results": results}


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