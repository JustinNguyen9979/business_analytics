# FILE: Backend/app/main.py

import json, redis, crud, models, schemas, standard_parser
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Response, status, Query, Body
from fastapi.responses import ORJSONResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from database import SessionLocal, engine
from datetime import date
from cache import redis_client
from celery_worker import process_data_request, recalculate_all_brand_data

models.Base.metadata.create_all(bind=engine)
app = FastAPI(
    title="CEO Dashboard API by Julice",
    default_response_class=ORJSONResponse 
)

# --- Dependency ---
def get_db(): 
    db = SessionLocal()
    try: 
        yield db 
    finally: 
        db.close()

# ==============================================================================
# === 1. ENDPOINTS QUẢN LÝ THƯƠNG HIỆU (BRAND MANAGEMENT) ===
# ==============================================================================

@app.get("/")
def read_root(): 
    return {"message": "Chào mừng đến với CEO Dashboard API!"}

@app.get("/brands/", response_model=List[schemas.BrandInfo])
def read_brands(db: Session = Depends(get_db)): 
    return db.query(models.Brand).all()

@app.post("/brands/", response_model=schemas.BrandInfo)
def create_brand_api(brand: schemas.BrandCreate, db: Session = Depends(get_db)):
    new_brand = crud.create_brand(db=db, brand=brand)
    if not new_brand:
         raise HTTPException(status_code=400, detail="Brand với tên này đã tồn tại.")
    return new_brand

@app.put("/brands/{brand_id}", response_model=schemas.BrandInfo)
def update_brand_api(brand_id: int, brand_update: schemas.BrandCreate, db: Session = Depends(get_db)):
    updated_brand = crud.update_brand_name(db, brand_id=brand_id, new_name=brand_update.name)
    if not updated_brand:
        raise HTTPException(status_code=400, detail="Không thể đổi tên. Brand không tồn tại hoặc tên mới đã bị trùng.")
    return updated_brand

@app.delete("/brands/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_brand_api(brand_id: int, db: Session = Depends(get_db)):
    deleted_brand = crud.delete_brand_by_id(db, brand_id=brand_id)
    if not deleted_brand:
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand để xóa.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@app.post("/brands/{brand_id}/clone", response_model=schemas.BrandInfo)
def clone_brand_api(brand_id: int, db: Session = Depends(get_db)):
    cloned = crud.clone_brand(db, brand_id=brand_id)
    if not cloned:
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand để nhân bản.")
    return cloned

# ==============================================================================
# === 2. ENDPOINTS XỬ LÝ DỮ LIỆU (DATA PROCESSING) ===
# ==============================================================================

@app.post("/brands/{brand_id}/upload-standard-file", status_code=status.HTTP_202_ACCEPTED)
async def upload_standard_file(
    brand_id: int, platform: str, db: Session = Depends(get_db), file: UploadFile = File(...)
):
    """Nhận file, xử lý và kích hoạt worker tính toán lại toàn bộ."""
    if not crud.get_brand(db, brand_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand.")
    
    result = standard_parser.process_standard_file(db, await file.read(), brand_id, platform)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))
    
    # Kích hoạt task tính toán lại toàn bộ
    recalculate_all_brand_data.delay(brand_id)
    return {"message": "Upload thành công! Dữ liệu đang được tính toán lại trong nền."}

@app.post("/brands/{brand_id}/recalculate-and-wait", status_code=status.HTTP_200_OK)
def recalculate_and_wait(brand_id: int, db: Session = Depends(get_db)):
    """
    Kích hoạt Worker để tính toán lại và BLOCK cho đến khi task hoàn thành.
    """
    if not crud.get_brand(db, brand_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand.")
    
    print(f"API: Nhận yêu cầu recalculate-and-wait cho brand {brand_id}.")
    
    # Gửi task đến Worker và lấy về đối tượng AsyncResult
    task_result = recalculate_all_brand_data.delay(brand_id)
    
    try:
        # Dòng quan trọng: Chờ đợi kết quả của task, với timeout là 5 phút (300 giây)
        task_result.get(timeout=300) 
        print(f"API: Worker đã hoàn thành recalculate cho brand {brand_id}.")
        return {"message": "Tính toán lại hoàn tất!"}
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Quá trình tính toán mất quá nhiều thời gian.")

def generate_cache_key(brand_id: int, request_type: str, params: Dict[str, Any]) -> str:
    """Tạo ra một cache key nhất quán từ thông tin request."""
    param_string = ":".join(f"{k}={v}" for k, v in sorted(params.items()))
    return f"data_req:{brand_id}:{request_type}:{param_string}"

@app.post("/data-requests", status_code=status.HTTP_202_ACCEPTED)
def request_data_processing(
    request_body: schemas.DataRequest, # Sử dụng Pydantic model để xác thực payload
    db: Session = Depends(get_db)
):
    """
    Endpoint chính: Nhận yêu cầu, kiểm tra cache, hoặc giao việc cho worker.
    """
    brand_id = request_body.brand_id
    request_type = request_body.request_type
    params = request_body.params

    cache_key = generate_cache_key(brand_id, request_type, params)
    
    # Bước 1: Kiểm tra cache
    cached_result = redis_client.get(cache_key)
    if cached_result:
        print(f"API: Cache HIT cho key: {cache_key}")
        # Trả về ngay lập tức nếu tìm thấy
        return ORJSONResponse(
            content={"status": "SUCCESS", "data": json.loads(cached_result)},
            status_code=status.HTTP_200_OK
        )
    
    # Bước 2: Cache miss -> Giao việc cho worker
    print(f"API: Cache MISS cho key: {cache_key}. Giao việc cho worker.")
    task = process_data_request.delay(
        request_type=request_type,
        cache_key=cache_key,
        brand_id=brand_id,
        params=params
    )
    
    # Trả về task_id để frontend có thể "hỏi thăm"
    return {"task_id": task.id, "status": "PROCESSING", "cache_key": cache_key}

@app.get("/data-requests/status/{cache_key}")
def get_request_status(cache_key: str):
    """
    Endpoint để Frontend "hỏi thăm" xem dữ liệu đã được xử lý xong chưa.
    Nó chỉ cần kiểm tra sự tồn tại của cache key.
    """
    cached_result = redis_client.get(cache_key)
    
    if cached_result:
        print(f"API: Polling HIT cho key: {cache_key}")
        result = json.loads(cached_result)
        # Kiểm tra xem worker có báo lỗi không
        if isinstance(result, dict) and result.get("status") == "FAILED":
            return {"status": "FAILED", "error": result.get("error", "Lỗi không xác định từ worker.")}
        # Thành công
        return {"status": "SUCCESS", "data": result}
    else:
        # Vẫn đang xử lý
        return {"status": "PROCESSING"}

@app.post("/brands/{brand_id}/recalculate", status_code=status.HTTP_200_OK)
def recalculate_brand_data(brand_id: int, db: Session = Depends(get_db)):
    """Tính toán lại toàn bộ dữ liệu của một brand một cách đồng bộ."""
    if not crud.get_brand(db, brand_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand.")
    result = crud.recalculate_brand_data_sync(db, brand_id=brand_id)
    return result

# ==============================================================================
# === 3. ENDPOINTS LẤY DỮ LIỆU CHO DASHBOARD (DATA RETRIEVAL) ===
# ==============================================================================

@app.get("/brands/{brand_id}", response_model=schemas.BrandWithKpis)
def read_brand_kpis(
    brand_id: int, 
    start_date: date, 
    end_date: date, 
    db: Session = Depends(get_db)
):
    """Lấy thông tin tổng quan và các chỉ số KPI tổng hợp của một brand."""
    db_brand, cache_was_missing = crud.get_brand_details(db, brand_id, start_date, end_date)
    if not db_brand: 
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand.")
    if cache_was_missing:
        print(f"API: Phát hiện cache lỗi thời cho brand ID {brand_id}. Kích hoạt worker tự sửa chữa.")
        process_brand_data.delay(brand_id)
    return db_brand

@app.get("/brands/{brand_id}/daily-kpis", response_model=schemas.DailyKpiResponse)
def read_brand_daily_kpis(
    brand_id: int, 
    start_date: date, 
    end_date: date, 
    db: Session = Depends(get_db)
):
    """Lấy dữ liệu KPI hàng ngày cho việc vẽ biểu đồ."""
    if not crud.get_brand(db, brand_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand.")
    daily_data = crud.get_daily_kpis_for_range(db, brand_id, start_date, end_date)
    return {"data": daily_data}

@app.get("/brands/{brand_id}/top-products", response_model=List[schemas.TopProduct])
def read_top_products(
    brand_id: int,
    start_date: date,
    end_date: date,
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Lấy top N sản phẩm bán chạy nhất."""
    if not crud.get_brand(db, brand_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand.")
    try:
        top_products = crud.get_top_selling_products(db, brand_id, start_date, end_date, limit)
        return top_products
    except Exception as e:
        print(f"!!! LỖI ENDPOINT TOP PRODUCTS: {e}")
        raise HTTPException(status_code=500, detail="Lỗi server khi xử lý yêu cầu.")

@app.get("/brands/{brand_id}/customer-map-distribution", response_model=List[schemas.CustomerMapDistributionItem])
def read_customer_map_distribution(
    brand_id: int,
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db)
):
    """Lấy dữ liệu phân bổ khách hàng theo tỉnh/thành để vẽ bản đồ."""
    if not crud.get_brand(db, brand_id):
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand.")
    distribution_data = crud.get_customer_distribution_with_coords(db, brand_id, start_date, end_date)
    return distribution_data
