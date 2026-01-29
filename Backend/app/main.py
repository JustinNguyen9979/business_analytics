# FILE: Backend/app/main.py

import json, crud, models, schemas, standard_parser
from services.search_service import search_service
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Response, status, Query, Body, Request
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from database import SessionLocal, engine
from datetime import date
from cache import redis_client
from celery_worker import process_data_request, recalculate_all_brand_data, recalculate_brand_data_specific_dates
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
    new_brand = crud.create_brand(db=db, obj_in=brand)
    if not new_brand:
         raise HTTPException(status_code=400, detail="Brand này đã tồn tại.")
    return new_brand

@app.put("/brands/{brand_id}", response_model=schemas.BrandInfo)
def update_brand_api(brand_id: int, brand_update: schemas.BrandCreate, db: Session = Depends(get_db)):
    updated_brand = crud.update_brand_name(db, brand_id=brand_id, new_name=brand_update.name)
    if not updated_brand:
        raise HTTPException(status_code=400, detail="Không thể đổi tên. Tên Brand mới đã bị trùng.")
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
    file: UploadFile = File(...),
    force: bool = Query(False, description="Nếu True, sẽ xử lý lại file ngay cả khi đã tồn tại trong lịch sử import.")
):
    """Nhận file, xử lý và kích hoạt worker tính toán lại toàn bộ."""
    result = standard_parser.process_standard_file(
        db, 
        await file.read(), 
        brand.id, 
        platform, 
        file_name=file.filename,
        allow_override=force
    )
    if result.get("status") == "error":
        raise HTTPException(status_code=400, detail=result.get("message"))
    
    # [TỐI ƯU] Kích hoạt task tính toán lại thông minh
    affected_dates = result.get("affected_dates")
    task = None
    
    if affected_dates and isinstance(affected_dates, list) and len(affected_dates) > 0:
        print(f"API: Kích hoạt tính toán lại cho {len(affected_dates)} ngày cụ thể.")
        task = recalculate_brand_data_specific_dates.delay(brand.id, affected_dates)
    else:
        # Fallback: Nếu không xác định được ngày (file rỗng?), tính lại toàn bộ cho chắc
        print("API: Không xác định được ngày cụ thể, tính toán lại TOÀN BỘ.")
        task = recalculate_all_brand_data.delay(brand.id)
    
    # [UX IMPROVEMENT] Chờ worker hoàn thành (tối đa 60s) để Frontend hiển thị Loading đúng thực tế
    if task:
        try:
            # Chờ task hoàn thành. Vì đã tối ưu nên thường chỉ mất < 5s.
            task.get(timeout=60)
            print("API: Worker đã hoàn thành nhiệm vụ tính toán.")
        except Exception as e:
            print(f"API: Worker chưa kịp hoàn thành trong 60s hoặc có lỗi: {e}. Client sẽ tự refresh.")
            # Không raise error để tránh làm user hoang mang, worker vẫn sẽ chạy ngầm tiếp.
        
    return {"message": "Upload và xử lý dữ liệu thành công!"}

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
        
        # Kích hoạt tính toán lại dữ liệu trong nền (Chỉ tính các ngày bị ảnh hưởng)
        from datetime import timedelta
        
        delta = payload.end_date - payload.start_date
        affected_dates = []
        # Tạo danh sách các ngày trong khoảng thời gian xóa
        for i in range(delta.days + 1):
            day = payload.start_date + timedelta(days=i)
            affected_dates.append(day.isoformat())
            
        if affected_dates:
            recalculate_brand_data_specific_dates.delay(brand.id, affected_dates)
        else:
            # Fallback nếu không xác định được ngày
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
    status: List[str] = Query(['completed'], description="Trạng thái đơn hàng cần lấy (completed, cancelled, bomb, refunded). Mặc định chỉ lấy completed."),
    source: List[str] = Query(None, description="Danh sách nguồn dữ liệu (e.g. shopee, lazada)"),
    brand: models.Brand = Depends(get_brand_from_slug),
    db: Session = Depends(get_db)
):
    """Lấy dữ liệu phân bổ khách hàng theo tỉnh/thành để vẽ bản đồ."""
    try:
        distribution_data = crud.get_aggregated_location_distribution(
            db, brand.id, start_date, end_date, status_filter=status, source_list=source
        )
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
        print(f"API: Phát hiện cache lỗi thời cho brand ID {brand.id}. Dashboard có thể hiển thị dữ liệu cũ.")
    
    # [TỐI ƯU] Đã loại bỏ lệnh recalculate_all_brand_data vô điều kiện.
    # Chỉ tính lại khi có hành động cụ thể (Upload/Delete).
    return db_brand

@app.get("/brands/{brand_slug}/daily-kpis", response_model=schemas.DailyKpiResponse)
def read_brand_daily_kpis(
    start_date: date, 
    end_date: date, 
    source: List[str] = Query(None), # Thêm tham số source
    brand: models.Brand = Depends(get_brand_from_slug),
    db: Session = Depends(get_db)
):
    """Lấy dữ liệu KPI hàng ngày cho việc vẽ biểu đồ, có hỗ trợ lọc theo nguồn."""
    daily_data = crud.get_daily_kpis_for_range(db, brand.id, start_date, end_date, source_list=source)
    return {"data": daily_data}

@app.get("/brands/{brand_slug}/top-products", response_model=List[schemas.TopProduct])
def read_top_products(
    start_date: date,
    end_date: date,
    source: List[str] = Query(None, description="Lọc theo nguồn (shopee, lazada...)"),
    brand: models.Brand = Depends(get_brand_from_slug),
    limit: int = 10,
    db: Session = Depends(get_db)
):
    """Lấy top N sản phẩm bán chạy nhất."""
    try:
        top_products = crud.get_top_selling_products(db, brand.id, start_date, end_date, limit, source_list=source)
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
    source: List[str] = Query(None, description="Danh sách nguồn dữ liệu (e.g. shopee, lazada)"),
    db: Session = Depends(get_db),
): 
    """
    Lấy các chỉ số KPI vận hành tổng hợp cho OperationPage.
    Trả về giá trị trung bình trong khoảng thời gian được chọn.
    """
    db_brand = crud.get_brand_by_slug(db, slug=brand_slug)
    if not db_brand:
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand.")
    
    # Lấy dữ liệu KPI theo ngày trong range
    # Nếu không có source truyền vào, mặc định là ['all'] bên trong logic
    
    print(f"DEBUG_API: get_operation_kpis called with range: {start_date} -> {end_date}, sources: {source}")
    
    # Sử dụng hàm aggregation mới từ crud (đã dùng kpi_utils để gộp JSON)
    operation_kpis = crud.get_aggregated_operation_kpis(
        db, 
        db_brand.id, 
        start_date, 
        end_date, 
        source_list=source
    )

    # Convert kết quả dict thành Pydantic model response
    return operation_kpis

@app.get("/brands/{brand_slug}/kpis/customer", response_model=schemas.CustomerKpisResponse)
@limiter.limit("30/minute")
def get_customer_kpis (
    request: Request,
    brand_slug: str,
    start_date: date = Query(..., description="Ngày bắt đầu (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Ngày kết thúc (YYYY-MM-DD)"),
    source: List[str] = Query(None, description="Danh sách nguồn dữ liệu"),
    db: Session = Depends(get_db),
):
    """
    Lấy các chỉ số KPI khách hàng cho CustomerPage.
    """
    db_brand = crud.get_brand_by_slug(db, slug=brand_slug)
    if not db_brand:
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand.")
        
    customer_kpis = crud.get_aggregated_customer_kpis(
        db,
        db_brand.id,
        start_date,
        end_date,
        source_list=source
    )
    return customer_kpis

@app.get("/brands/{brand_slug}/customers", response_model=List[schemas.CustomerAnalyticsItem])
@limiter.limit("30/minute")
def get_top_customers(
    request: Request,
    brand_slug: str,
    limit: int = 50,
    sort_by: str = Query("total_spent", description="Trường cần sắp xếp: total_spent, total_orders, bomb_orders..."),
    order: str = Query("desc", description="Thứ tự: asc hoặc desc"),
    db: Session = Depends(get_db),
):
    """
    Lấy danh sách Top Khách hàng (Đã chuyển sang tính toán động).
    Mặc định lấy toàn bộ lịch sử (2020 -> 2030) nếu không có bộ lọc ngày.
    """
    db_brand = crud.get_brand_by_slug(db, slug=brand_slug)
    if not db_brand:
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand.")
    
    # Giả lập khoảng thời gian "Toàn thời gian"
    start_date = date(2020, 1, 1)
    end_date = date(2030, 12, 31)
    
    # Gọi hàm tính toán động
    # Lưu ý: Hàm này trả về dict {data, total, ...}, ta chỉ cần data
    result = crud.customer.get_top_customers_in_period(
        db, 
        brand_id=db_brand.id, 
        start_date=start_date, 
        end_date=end_date, 
        limit=limit
    )
    
    # Kết quả trả về là List[Dict], Pydantic sẽ tự validate sang List[CustomerAnalyticsItem]
    return result['data']

@app.get("/brands/{brand_slug}/search")
def search_anything(
    brand_slug: str,
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db)
):
    """
    Tìm kiếm thông minh: Đơn hàng, Mã vận đơn, SĐT hoặc Tên khách hàng.
    """
    db_brand = crud.get_brand_by_slug(db, slug=brand_slug)
    if not db_brand:
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand.")
    
    result = search_service.search_entities(db, db_brand.id, q)
    if not result:
        # Trả về 200 kèm status not_found để frontend xử lý êm ái hơn là báo lỗi 404
        return {"status": "not_found", "message": "Không tìm thấy kết quả phù hợp."}
    
    return result

@app.get("/brands/{brand_slug}/search-suggestions")
def get_search_suggestions(
    brand_slug: str,
    q: str = Query(..., min_length=2),
    db: Session = Depends(get_db)
):
    """
    Gợi ý nhanh khi người dùng nhập vào ô tìm kiếm.
    """
    db_brand = crud.get_brand_by_slug(db, slug=brand_slug)
    if not db_brand:
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand.")
    
    return search_service.suggest_entities(db, db_brand.id, q)

@app.put("/brands/{brand_slug}/customers/{customer_identifier}")
def update_customer_api(
    brand_slug: str,
    customer_identifier: str,
    update_data: schemas.CustomerUpdate,
    db: Session = Depends(get_db)
):
    """
    Cập nhật thông tin khách hàng (SĐT, Email, Address, Notes).
    """
    db_brand = crud.get_brand_by_slug(db, slug=brand_slug)
    if not db_brand:
        raise HTTPException(status_code=404, detail="Không tìm thấy Brand.")
        
    updated_customer = crud.customer.update_customer_info(db, db_brand.id, customer_identifier, update_data)
    
    if not updated_customer:
        raise HTTPException(status_code=404, detail="Không tìm thấy Khách hàng.")
        
    return search_service.get_customer_profile(db, db_brand.id, updated_customer)