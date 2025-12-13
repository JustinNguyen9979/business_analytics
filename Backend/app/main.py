# FILE: Backend/app/main.py

import json, crud, models, schemas, standard_parser
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Response, status, Query, Body, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from database import SessionLocal, engine
from datetime import date
from cache import redis_client
from celery_worker import process_data_request, recalculate_all_brand_data
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from limiter import limiter

app = FastAPI(
    # title="CEO Dashboard API by Julice",
    default_response_class=ORJSONResponse 
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# models.Base.metadata.create_all(bind=engine)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# --- Dependencies ---
def get_db(): 
    db = SessionLocal()
    try: 
        yield db 
    finally: 
        db.close()

def get_brand_from_slug(brand_slug: str, db: Session = Depends(get_db)):
    db_brand = crud.get_brand_by_slug(db, slug=brand_slug)
    if db_brand is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand.")
    return db_brand

# ==============================================================================
# === 1. ENDPOINTS QUẢN LÝ THƯƠNG HIỆU (BRAND MANAGEMENT) ===
# ==============================================================================

@app.get("/")
def read_root(): 
    return {"message": "Chào mừng đến với CEO Dashboard API!"}

@app.get("/brands/", response_model=List[schemas.BrandInfo])
def read_brands(db: Session = Depends(get_db)): 
    return crud.get_all_brands(db)

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

@app.post("/brands/{brand_slug}/trigger-recalculation", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
def trigger_recalculation_api(request: Request, brand: models.Brand = Depends(get_brand_from_slug)):
    """
    Kích hoạt task chạy nền để tính toán lại toàn bộ dữ liệu cho brand.
    Trả về ngay lập tức.
    """
    recalculate_all_brand_data.delay(brand.id)
    return {"message": "Yêu cầu tính toán lại đã được gửi đi. Dữ liệu sẽ được cập nhật trong nền."}


# ==============================================================================
# === 2. ENDPOINTS XỬ LÝ DỮ LIỆU (DATA PROCESSING) ===
# ==============================================================================

@app.post("/brands/{brand_slug}/upload-standard-file", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
async def upload_standard_file(
    request: Request,
    platform: str, 
    brand: models.Brand = Depends(get_brand_from_slug),
    db: Session = Depends(get_db), 
    file: UploadFile = File(...)
):
    """Nhận file, xử lý và kích hoạt worker tính toán lại toàn bộ."""
    result = standard_parser.process_standard_file(db, await file.read(), brand.id, platform)
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))
    
    # Kích hoạt task tính toán lại toàn bộ
    recalculate_all_brand_data.delay(brand.id)
    return {"message": "Upload thành công! Dữ liệu đang được tính toán lại trong nền."}

@app.post("/brands/{brand_slug}/recalculate-and-wait", status_code=status.HTTP_200_OK)
@limiter.limit("3/minute")
def recalculate_and_wait(request: Request, brand: models.Brand = Depends(get_brand_from_slug)):
    """
    Kích hoạt Worker để tính toán lại và BLOCK cho đến khi task hoàn thành.
    """
    print(f"API: Nhận yêu cầu recalculate-and-wait cho brand {brand.id}.")
    
    # Gửi task đến Worker và lấy về đối tượng AsyncResult
    task_result = recalculate_all_brand_data.delay(brand.id)
    
    try:
        # Dòng quan trọng: Chờ đợi kết quả của task, với timeout là 5 phút (300 giây)
        task_result.get(timeout=300) 
        print(f"API: Worker đã hoàn thành recalculate cho brand {brand.id}.")
        return {"message": "Tính toán lại hoàn tất!"}
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Quá trình tính toán mất quá nhiều thời gian.")

class DateRangePayload(BaseModel):
    start_date: date
    end_date: date

@app.get("/brands/{brand_slug}/sources", response_model=List[str])
def get_brand_sources(brand: models.Brand = Depends(get_brand_from_slug), db: Session = Depends(get_db)):
    """Lấy danh sách tất cả các 'source' duy nhất cho một brand."""
    return crud.get_sources_for_brand(db, brand.id)

@app.post("/brands/{brand_slug}/delete-data-in-range", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
def delete_data_in_range(
    request: Request,
    payload: DateRangePayload,
    brand: models.Brand = Depends(get_brand_from_slug),
    db: Session = Depends(get_db),
    source: str = Query(None, description="Optional: Filter by source (e.g., 'shopee', 'tiktok'). If not provided, deletes from all sources.")
):
    """
    Deletes transactional data for a brand within a specified date range.
    Returns a list of sources that have been completely wiped out.
    """
    try:
        # Hàm crud giờ sẽ trả về danh sách các source đã bị xóa hoàn toàn
        fully_deleted_sources = crud.delete_brand_data_in_range(
            db, brand.id, payload.start_date, payload.end_date, source
        )
        
        # Kích hoạt tính toán lại dữ liệu trong nền
        recalculate_all_brand_data.delay(brand.id)
        
        return {
            "message": "Yêu cầu xóa dữ liệu đã được thực hiện. Dữ liệu đang được tính toán lại.",
            "fully_deleted_sources": fully_deleted_sources
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi server khi xóa dữ liệu: {str(e)}")

def generate_cache_key(brand_id: int, request_type: str, params: Dict[str, Any]) -> str:
    """Tạo ra một cache key nhất quán từ thông tin request."""
    param_string = ":".join(f"{k}={v}" for k, v in sorted(params.items()))
    return f"data_req:{brand_id}:{request_type}:{param_string}"

@app.post("/data-requests", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("60/minute")
def request_data_processing(
    request: Request,
    request_body: schemas.DataRequest, # Sử dụng Pydantic model để xác thực payload
    db: Session = Depends(get_db)
):
    """
    Endpoint chính: Nhận yêu cầu (dùng SLUG), kiểm tra cache, hoặc giao việc cho worker.
    """
    # 1. Lấy brand_id từ slug để đảm bảo bảo mật
    db_brand = crud.get_brand_by_slug(db, slug=request_body.brand_slug)
    if not db_brand:
        raise HTTPException(status_code=404, detail=f"Brand slug '{request_body.brand_slug}' không tồn tại.")
    
    brand_id = db_brand.id
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

@app.post("/brands/{brand_slug}/recalculate", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
def recalculate_brand_data(request: Request, brand: models.Brand = Depends(get_brand_from_slug), db: Session = Depends(get_db)):
    """Tính toán lại toàn bộ dữ liệu của một brand một cách đồng bộ."""
    result = crud.recalculate_brand_data_sync(db, brand_id=brand.id)
    return result

# ==============================================================================
# === 3. ENDPOINTS LẤY DỮ LIỆU CHO DASHBOARD (DATA RETRIEVAL) ===
# ==============================================================================

@app.get("/brands/{brand_slug}/customer-map-distribution", response_model=List[schemas.CustomerMapDistributionItem])
def read_customer_map_distribution(
    start_date: date,
    end_date: date,
    brand: models.Brand = Depends(get_brand_from_slug),
    db: Session = Depends(get_db)
):
    """Lấy dữ liệu phân bổ khách hàng theo tỉnh/thành để vẽ bản đồ."""
    try:
        distribution_data = crud.get_aggregated_location_distribution(db, brand.id, start_date, end_date)
        return distribution_data
    except Exception as e:
        print(f"!!! LỖI ENDPOINT CUSTOMER MAP: {e}")
        # Trả về list rỗng thay vì lỗi 500 để tránh crash UI
        return []

@app.get("/brands/{brand_slug}", response_model=schemas.BrandWithKpis)
def read_brand_kpis(
    start_date: date, 
    end_date: date, 
    brand: models.Brand = Depends(get_brand_from_slug),
    db: Session = Depends(get_db)
):
    """Lấy thông tin tổng quan và các chỉ số KPI tổng hợp của một brand."""
    db_brand, cache_was_missing = crud.get_brand_details(db, brand.id, start_date, end_date)
    if not db_brand: 
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand.")
    if cache_was_missing:
        print(f"API: Phát hiện cache lỗi thời cho brand ID {brand.id}. Kích hoạt worker tự sửa chữa.")
        process_brand_data.delay(brand.id)
    return db_brand

@app.get("/brands/{brand_slug}/daily-kpis", response_model=schemas.DailyKpiResponse)
def read_brand_daily_kpis(
    start_date: date, 
    end_date: date, 
    brand: models.Brand = Depends(get_brand_from_slug),
    db: Session = Depends(get_db)
):
    """Lấy dữ liệu KPI hàng ngày cho việc vẽ biểu đồ."""
    daily_data = crud.get_daily_kpis_for_range(db, brand.id, start_date, end_date)
    return {"data": daily_data}

@app.get("/brands/{brand_slug}/top-products", response_model=List[schemas.TopProduct])
def read_top_products(
    start_date: date,
    end_date: date,
    brand: models.Brand = Depends(get_brand_from_slug),
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Lấy top N sản phẩm bán chạy nhất."""
    try:
        top_products = crud.get_top_selling_products(db, brand.id, start_date, end_date, limit)
        return top_products
    except Exception as e:
        print(f"!!! LỖI ENDPOINT TOP PRODUCTS: {e}")
        raise HTTPException(status_code=500, detail="Lỗi server khi xử lý yêu cầu.")


@app.get("/brands/{brand_slug}/kpis/operation", response_model=schemas.OperationKpisResponse)
@limiter.limit("30/minute")
def get_operation_kpis (
    request: Request,
    brand_slug: str,
    start_date: date = Query(..., description="Ngày bắt đầu (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Ngày kết thúc (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
): 
    """
    Lấy các chỉ số KPI vận hành tổng hợp cho OperationPage.
    Trả về giá trị trung bình trong khoảng thời gian được chọn.
    """
    db_brand = crud.get_brand_by_slug(db, slug=brand_slug)
    if not db_brand:
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand.")
    
    # Lấy dữ liệu KPI theo ngày trong range (từ DailyStat, tổng hợp cho cả brand)
    # Hàm này trả về list các dictionary, mỗi dict là KPI của 1 ngày
    print(f"DEBUG_API: get_operation_kpis called with range: {start_date} -> {end_date}")
    daily_kpis_list = crud.get_daily_kpis_for_range(db, db_brand.id, start_date, end_date, source_list=['all'])
    
    print(f"DEBUG_API: Found {len(daily_kpis_list)} records from DB.")
    if daily_kpis_list:
        print(f"DEBUG_API: Sample Record [0]: {daily_kpis_list[0]}") # In ra để soi key

    # Nếu không có dữ liệu, trả về default 0
    if not daily_kpis_list:
        return schemas.OperationKpisResponse(
            avg_processing_time=0, avg_shipping_time=0,
            completion_rate=0, cancellation_rate=0,
            avg_daily_orders=0,
        )
    
    # Tính giá trị trung bình cho các chỉ số trong khoảng thời gian
    total_processing_time = 0
    total_shipping_time = 0
    total_completion_rate = 0
    total_cancellation_rate = 0
    total_orders = 0

    count_days = len(daily_kpis_list)

    for daily_kpi in daily_kpis_list:
        total_processing_time += daily_kpi.get('avgProcessingTime', 0)
        total_shipping_time += daily_kpi.get('avgShippingTime', 0)
        total_completion_rate += daily_kpi.get('completionRate', 0)
        total_cancellation_rate += daily_kpi.get('cancellationRate', 0)
        total_orders += daily_kpi.get('totalOrders', 0) # Lấy tổng số đơn hàng

    avg_processing_time = (total_processing_time / count_days) if count_days > 0 else 0
    avg_shipping_time = (total_shipping_time / count_days) if count_days > 0 else 0
    avg_completion_rate = (total_completion_rate / count_days) if count_days > 0 else 0
    avg_cancellation_rate = (total_cancellation_rate / count_days) if count_days > 0 else 0
    avg_daily_orders = (total_orders / count_days) if count_days > 0 else 0

    return schemas.OperationKpisResponse(
        avg_processing_time=avg_processing_time,
        avg_shipping_time=avg_shipping_time,
        completion_rate=avg_completion_rate,
        cancellation_rate=avg_cancellation_rate,
        avg_daily_orders=avg_daily_orders,
    )