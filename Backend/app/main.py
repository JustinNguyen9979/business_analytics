import json
import redis
import crud, models, schemas, shopee_parser
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Response, status
from sqlalchemy.orm import Session
from typing import List, Optional
from database import SessionLocal, engine
from datetime import date
from cache import redis_client
from celery_worker import process_brand_data, calculate_customer_distribution
from schemas import CustomerMapDistributionItem 

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

@app.get("/brands/{brand_id}", response_model=schemas.BrandWithKpis)
def read_brand(
    brand_id: int, 
    start_date: date, 
    end_date: date, 
    db: Session = Depends(get_db)
):
    # <<< THAY ĐỔI LOGIC Ở ĐÂY >>>

    # Hàm crud giờ trả về một tuple (brand_data, cache_was_missing)
    db_brand, cache_was_missing = crud.get_brand_details(
        db, brand_id=brand_id, start_date=start_date, end_date=end_date
    )

    if not db_brand: 
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand")
    
    # Nếu cờ cache_was_missing là True, kích hoạt worker ở đây
    if cache_was_missing:
        print(f"API: Phát hiện cache lỗi thời cho brand ID {brand_id}. Kích hoạt worker tự sửa chữa.")
        process_brand_data.delay(brand_id)

    return db_brand

@app.post("/brands/{brand_id}/recalculate", status_code=status.HTTP_200_OK) # Đổi status code thành 200 OK
def recalculate_brand_data(brand_id: int, db: Session = Depends(get_db)):
    """
    Endpoint để tính toán lại toàn bộ dữ liệu của một brand một cách ĐỒNG BỘ.
    Hàm này sẽ block cho đến khi tính toán xong.
    """
    # 1. Kiểm tra xem brand có tồn tại không
    if not crud.get_brand(db, brand_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand")

    # 2. Gọi hàm tính toán đồng bộ mới từ crud.py
    # Hàm này sẽ tự xóa cache, tính toán và lưu lại cache mới.
    result = crud.recalculate_brand_data_sync(db, brand_id=brand_id)
    
    # 3. Trả về kết quả sau khi đã chạy xong
    return result

@app.get("/brands/{brand_id}/top-products", response_model=List[schemas.TopProduct])
def read_top_products(
    brand_id: int,
    start_date: date,
    end_date: date,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """
    Endpoint để lấy top N sản phẩm bán chạy nhất.
    """
    # Kiểm tra brand có tồn tại không
    if not crud.get_brand(db, brand_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand")

    try:
        top_products = crud.get_top_selling_products(
            db, 
            brand_id=brand_id, 
            start_date=start_date, 
            end_date=end_date, 
            limit=limit
        )
        return top_products
    except Exception as e:
        # Nếu có lỗi không mong muốn, trả về lỗi server thay vì làm crash
        print(f"!!! LỖI ENDPOINT TOP PRODUCTS: {e}")
        raise HTTPException(status_code=500, detail="Lỗi server khi xử lý yêu cầu.")

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

@app.post("/brands/{brand_id}/async-customer-distribution", status_code=status.HTTP_202_ACCEPTED)
def request_customer_distribution_calculation(
    brand_id: int,
    start_date: date,
    end_date: date
):
    """
    Endpoint để yêu cầu worker tính toán phân bổ khách hàng.
    Trả về ngay lập tức.
    """
    calculate_customer_distribution.delay(
        brand_id=brand_id, 
        start_date_iso=start_date.isoformat(), 
        end_date_iso=end_date.isoformat()
    )
    return {"message": "Yêu cầu tính toán đã được tiếp nhận."}

@app.get("/brands/{brand_id}/customer-distribution", response_model=List[schemas.CustomerDistributionItem])
def read_customer_distribution(
    brand_id: int,
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db) # Giữ lại db để phòng trường hợp cần fallback
):
    """
    Endpoint để lấy dữ liệu phân bổ khách hàng TỪ CACHE.
    """
    # Tạo cache key giống hệt như trong worker
    cache_key = f"dist:{brand_id}:{start_date.isoformat()}:{end_date.isoformat()}"
    
    cached_result = redis_client.get(cache_key)
    
    if cached_result:
        # Nếu tìm thấy trong cache, giải mã JSON và trả về
        return json.loads(cached_result)
    else:
        # Nếu chưa có trong cache, trả về một danh sách rỗng
        # Frontend sẽ hiểu là dữ liệu đang được tính toán
        return []

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

@app.get("/brands/{brand_id}/daily-kpis", response_model=schemas.DailyKpiResponse)
def read_brand_daily_kpis(
    brand_id: int, 
    start_date: date, 
    end_date: date, 
    db: Session = Depends(get_db)
):
    """Endpoint để lấy dữ liệu KPI hàng ngày cho việc vẽ biểu đồ."""
    if not crud.get_brand(db, brand_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand")
    
    daily_data = crud.get_daily_kpis_for_range(db, brand_id, start_date, end_date)
    return {"data": daily_data}

@app.get("/brands/{brand_id}/customer-map-distribution", response_model=List[schemas.CustomerMapDistributionItem])
def read_customer_map_distribution(
    brand_id: int,
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db)
):
    """
    API mới: Lấy dữ liệu phân bổ khách hàng theo tỉnh/thành,
    kèm theo tọa độ và số lượng khách hàng đã được tổng hợp.
    """
    if not crud.get_brand(db, brand_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand")
    
    distribution_data = crud.get_customer_distribution_with_coords(db, brand_id, start_date, end_date)
    return distribution_data