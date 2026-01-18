from datetime import date, timedelta
from typing import List, Dict, Any, Optional
import json
from decimal import Decimal
from collections import defaultdict

from sqlalchemy import func
from sqlalchemy.orm import Session
import pandas as pd

import models
import schemas
import kpi_utils
from cache import redis_client
from province_centroids import PROVINCE_CENTROIDS

# Helper xử lý JSON serialize cho Date và Decimal
def json_serial(obj):
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")

def get_daily_kpis_for_range(
    db: Session, 
    brand_id: int, 
    start_date: date, 
    end_date: date, 
    source_list: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Sử dụng chiến lược Hybrid:
    - ALL sources -> Query bảng DailyStat.
    - Filtered sources -> Query DailyAnalytics & Aggregate.
    """
    
    # 1. CHECK CACHE REDIS
    source_key = "all"
    if source_list:
        source_key = "-".join(sorted(source_list))
    
    cache_key = f"kpi_daily:{brand_id}:{start_date}:{end_date}:{source_key}"
    
    try:
        cached_data = redis_client.get(cache_key)
        if cached_data:
            # print(f"DEBUG: HIT CACHE for {cache_key}")
            return json.loads(cached_data)
    except Exception as e:
        print(f"WARNING: Redis Error: {e}")

    strategy, clean_sources = kpi_utils.normalize_source_strategy(source_list)
    
    # Chuẩn bị khung dữ liệu cho toàn bộ dải ngày (để tránh ngày bị thiếu)
    date_map = {}
    curr = start_date
    while curr <= end_date:
        date_map[curr] = _create_empty_daily_stat(curr)
        curr += timedelta(days=1)

    # --- EXECUTE QUERY ---
    if strategy == kpi_utils.STRATEGY_EMPTY:
        pass

    elif strategy == kpi_utils.STRATEGY_ALL:
        # Query DailyStat (Nhanh, đã tính sẵn)
        stats = db.query(models.DailyStat).filter(
            models.DailyStat.brand_id == brand_id,
            models.DailyStat.date.between(start_date, end_date)
        ).all()
        
        for stat in stats:
            # Map model object -> dict (Optimized with Pydantic)
            # Use KpiSet schema to validate and dump all matching fields automatically
            kpi_data = schemas.KpiSet.model_validate(stat).model_dump()
            kpi_data['date'] = stat.date.isoformat()
            
            date_map[stat.date] = kpi_data

    elif strategy == kpi_utils.STRATEGY_FILTERED:
        # Query DailyAnalytics và cộng gộp theo ngày
        analytics = db.query(models.DailyAnalytics).filter(
            models.DailyAnalytics.brand_id == brand_id,
            models.DailyAnalytics.date.between(start_date, end_date),
            models.DailyAnalytics.source.in_(clean_sources)
        ).all()
        
        # Group by Date in memory (vì logic aggregate phức tạp, python xử lý linh hoạt hơn SQL thuần lúc này)
        data_by_date = {} # Key: date, Value: list of analytics records
        for record in analytics:
            d = record.date
            if d not in data_by_date: data_by_date[d] = []
            
            # Convert record to dict
            data_by_date[d].append(schemas.KpiSet.model_validate(record).model_dump())
            
        # Aggregate từng ngày
        for d, records in data_by_date.items():
            aggregated = kpi_utils.aggregate_data_points(records)
            final_metrics = kpi_utils.calculate_derived_metrics(aggregated)
            final_metrics['date'] = d.isoformat()
            date_map[d] = final_metrics

    result_data = [date_map[d] for d in sorted(date_map.keys())]

    # 3. SAVE CACHE
    try:
        redis_client.setex(
            cache_key,
            3600, # 1 giờ
            json.dumps(result_data, default=json_serial)
        )
    except Exception as e:
        print(f"WARNING: Redis Set Error: {e}")

    return result_data

def _fetch_and_aggregate_kpis(
    db: Session, 
    brand_id: int, 
    start_date: date, 
    end_date: date, 
    source_list: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Helper function: 
    1. Lấy dữ liệu KPI theo ngày (get_daily_kpis_for_range).
    2. Cộng dồn lại thành 1 cục tổng (aggregate_data_points).
    3. Tính toán các chỉ số phái sinh (calculate_derived_metrics).
    """
    # 1. Lấy dữ liệu Daily
    daily_kpis = get_daily_kpis_for_range(db, brand_id, start_date, end_date, source_list)
    
    if not daily_kpis:
        # Trả về object rỗng nếu không có dữ liệu
        return kpi_utils.calculate_derived_metrics({})

    # 2. Aggregate
    aggregated = kpi_utils.aggregate_data_points(daily_kpis)
    
    # 3. Tính toán metrics
    aggregated['_day_count'] = (end_date - start_date).days + 1
    final_kpis = kpi_utils.calculate_derived_metrics(aggregated)
    
    return final_kpis

def get_aggregated_operation_kpis(
    db: Session, 
    brand_id: int, 
    start_date: date, 
    end_date: date, 
    source_list: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Service lấy KPI vận hành tổng hợp (1 cục duy nhất) cho toàn bộ khoảng thời gian.
    Dùng cho các Card chỉ số tổng quan ở đầu Dashboard.
    """
    # Sử dụng helper function đã refactor
    final_kpis = _fetch_and_aggregate_kpis(db, brand_id, start_date, end_date, source_list)
    
    # Thêm dữ liệu so sánh platform
    final_kpis['platform_comparison'] = get_kpis_by_platform(db, brand_id, start_date, end_date, source_list)

    return final_kpis

def get_top_selling_products(
    db: Session, 
    brand_id: int, 
    start_date: date, 
    end_date: date, 
    limit: int = 10,
    source_list: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    Lấy top sản phẩm bán chạy từ dữ liệu đã aggregate sẵn (DailyStat/DailyAnalytics).
    Nhanh hơn nhiều so với query trực tiếp bảng Order.
    """
    # 1. Xác định chiến lược lọc source
    strategy, clean_sources = kpi_utils.normalize_source_strategy(source_list)

    # 2. Query dữ liệu aggregate
    records = []
    if strategy == kpi_utils.STRATEGY_FILTERED:
        # Query DailyAnalytics nếu lọc theo source
        records = db.query(models.DailyAnalytics.top_products).filter(
            models.DailyAnalytics.brand_id == brand_id,
            models.DailyAnalytics.date.between(start_date, end_date),
            models.DailyAnalytics.source.in_(clean_sources)
        ).all()
    else:
        # Query DailyStat nếu lấy tất cả (Mặc định)
        records = db.query(models.DailyStat.top_products).filter(
            models.DailyStat.brand_id == brand_id,
            models.DailyStat.date.between(start_date, end_date)
        ).all()
    
    if not records:
        return []

    # 3. Aggregate dữ liệu JSON (Cộng dồn quantity theo SKU)
    product_map = {} # SKU -> {name, total_quantity, revenue}

    for record in records:
        # record là một tuple (top_products,), lấy phần tử đầu tiên
        daily_top = record[0]
        if not daily_top or not isinstance(daily_top, list):
            continue
            
        for item in daily_top:
            if not isinstance(item, dict): continue
            
            sku = item.get('sku')
            if not sku: continue
            
            quantity = item.get('quantity', 0)
            # Fallback nếu key là total_quantity (đề phòng data cũ/mới lẫn lộn)
            if quantity == 0:
                quantity = item.get('total_quantity', 0)
                
            if quantity <= 0: continue

            revenue = item.get('revenue', 0)

            if sku not in product_map:
                product_map[sku] = {
                    'sku': sku,
                    'name': item.get('name', 'Unknown'),
                    'total_quantity': 0,
                    'revenue': 0.0
                }
            
            product_map[sku]['total_quantity'] += quantity
            product_map[sku]['revenue'] += revenue

    # 4. Convert về list và Sort
    result = list(product_map.values())
    result.sort(key=lambda x: x['total_quantity'], reverse=True)
    
    return result[:limit]

def get_brand_details(db: Session, brand_id: int, start_date: date, end_date: date):
    """
    Lấy thông tin chi tiết của Brand kèm theo KPI tổng hợp trong khoảng thời gian.
    Dùng cho Dashboard Header & Summary Cards.
    """
    # 1. Lấy thông tin Brand cơ bản
    brand = db.query(models.Brand).filter(models.Brand.id == brand_id).first()
    if not brand:
        return None, False

    # 2. Lấy dữ liệu KPI tổng hợp (Sử dụng Helper mới)
    # Mặc định lấy ALL source cho Dashboard tổng
    final_kpis = _fetch_and_aggregate_kpis(db, brand_id, start_date, end_date, source_list=None)
    
    # 3. Gán KPI vào object Brand (để Pydantic serialize)
    setattr(brand, 'kpis', final_kpis)
    
    # Cache status (Tạm thời luôn trả về False hoặc check Redis nếu cần optimization sâu hơn)
    return brand, False

def get_kpis_by_platform(
    db: Session, 
    brand_id: int, 
    start_date: date, 
    end_date: date,
    source_list: Optional[List[str]] = None
) -> List[Dict[str, Any]]:
    """
    So sánh hiệu quả giữa các sàn (Shopee, TikTok...)
    Query trực tiếp từ DailyAnalytics và Group By Source.
    Có tính toán Weighted Average cho thời gian xử lý/giao hàng.
    """
    # Query SQL: Tính tổng và tích (để tính avg weighted)
    query = db.query(
        models.DailyAnalytics.source,
        func.sum(models.DailyAnalytics.net_revenue).label('netRevenue'),
        func.sum(models.DailyAnalytics.gmv).label('gmv'),
        func.sum(models.DailyAnalytics.profit).label('profit'),
        func.sum(models.DailyAnalytics.total_cost).label('totalCost'),
        func.sum(models.DailyAnalytics.ad_spend).label('adSpend'),
        func.sum(models.DailyAnalytics.cogs).label('cogs'),
        func.sum(models.DailyAnalytics.execution_cost).label('executionCost'),
        func.sum(models.DailyAnalytics.completed_orders).label('completedOrders'),
        func.sum(models.DailyAnalytics.total_orders).label('totalOrders'),
        func.sum(models.DailyAnalytics.cancelled_orders).label('cancelledOrders'),
        func.sum(models.DailyAnalytics.refunded_orders).label('refundedOrders'),
        func.sum(models.DailyAnalytics.bomb_orders).label('bombOrders'),
        # Tính trọng số cho thời gian (Time * Orders)
        func.sum(models.DailyAnalytics.avg_processing_time * models.DailyAnalytics.total_orders).label('weighted_proc_time'),
        func.sum(models.DailyAnalytics.avg_shipping_time * models.DailyAnalytics.total_orders).label('weighted_ship_time'),
    ).filter(
        models.DailyAnalytics.brand_id == brand_id,
        models.DailyAnalytics.date.between(start_date, end_date)
    )

    # Lọc theo source nếu có yêu cầu (để user có thể so sánh subset các sàn)
    strategy, clean_sources = kpi_utils.normalize_source_strategy(source_list)
    if strategy == kpi_utils.STRATEGY_FILTERED:
        query = query.filter(models.DailyAnalytics.source.in_(clean_sources))

    results = query.group_by(models.DailyAnalytics.source).all()
    
    final_data = []
    total_summary = {
        'platform': 'Tổng cộng',
        'net_revenue': 0, 'gmv': 0, 'profit': 0, 'ad_spend': 0, 'total_cost': 0,
        'cogs': 0, 'execution_cost': 0,
        'completed_orders': 0, 'total_orders': 0, 'cancelled_orders': 0,
        'refunded_orders': 0, 'bomb_orders': 0,
        'roi': 0, 'profit_margin': 0,
        'avg_processing_time': 0, 'avg_shipping_time': 0 # Thêm field tổng
    }
    
    # Biến tạm để tính avg tổng
    total_weighted_proc = 0
    total_weighted_ship = 0
    
    for row in results:
        source = row.source or "Unknown"
        n_orders = row.totalOrders or 0
        
        # Tính Average Time (Weighted)
        avg_proc = (row.weighted_proc_time / n_orders) if n_orders > 0 else 0
        avg_ship = (row.weighted_ship_time / n_orders) if n_orders > 0 else 0
        
        item = {
            'platform': source.capitalize(),
            'net_revenue': row.netRevenue or 0,
            'gmv': row.gmv or 0,
            'profit': row.profit or 0,
            'total_cost': row.totalCost or 0,
            'ad_spend': row.adSpend or 0,
            'cogs': row.cogs or 0,
            'execution_cost': row.executionCost or 0,
            'completed_orders': row.completedOrders or 0,
            'total_orders': row.totalOrders or 0,
            'cancelled_orders': row.cancelledOrders or 0,
            'refunded_orders': row.refundedOrders or 0,
            'bomb_orders': row.bombOrders or 0,
            'avg_processing_time': avg_proc,
            'avg_shipping_time': avg_ship
        }
        # Tính tỷ lệ
        item['roi'] = (item['profit'] / item['total_cost']) if item['total_cost'] > 0 else 0
        item['profit_margin'] = (item['profit'] / item['net_revenue']) if item['net_revenue'] != 0 else 0
        item['take_rate'] = (item['execution_cost'] / item['gmv']) if item['gmv'] > 0 else 0
        
        final_data.append(item)
        
        # Cộng dồn vào tổng
        for k in total_summary:
            if k in item and isinstance(item[k], (int, float)) and 'avg' not in k:
                total_summary[k] += item[k]
        
        # Cộng dồn trọng số thời gian cho tổng
        total_weighted_proc += (row.weighted_proc_time or 0)
        total_weighted_ship += (row.weighted_ship_time or 0)
                
    # Tính lại tỷ lệ tổng
    total_summary['roi'] = (total_summary['profit'] / total_summary['total_cost']) if total_summary['total_cost'] > 0 else 0
    total_summary['profit_margin'] = (total_summary['profit'] / total_summary['net_revenue']) if total_summary['net_revenue'] != 0 else 0
    total_summary['take_rate'] = (total_summary['execution_cost'] / total_summary['gmv']) if total_summary['gmv'] > 0 else 0
    
    # Tính Avg Time Tổng
    total_orders_all = total_summary['total_orders']
    total_summary['avg_processing_time'] = (total_weighted_proc / total_orders_all) if total_orders_all > 0 else 0
    total_summary['avg_shipping_time'] = (total_weighted_ship / total_orders_all) if total_orders_all > 0 else 0
    
    if final_data:
        final_data.insert(0, total_summary)
        
    return final_data

def _process_frequency_data(freq_map_raw: Dict[str, int]) -> List[Dict[str, Any]]:
    """Helper xử lý Frequency Distribution thành buckets hiển thị (1-6, 7+)."""
    # Convert key từ string (do JSON lưu key là string) sang int
    freq_map = {}
    if freq_map_raw:
        for k, v in freq_map_raw.items():
            try:
                freq_map[int(k)] = v
            except (ValueError, TypeError):
                continue

    frequency_data = []
    if freq_map:
        max_freq = max(freq_map.keys())
        
        # LOGIC DYNAMIC 7 CỘT
        if max_freq <= 7:
            for i in range(1, max_freq + 1):
                val = freq_map.get(i, 0)
                frequency_data.append({"range": f"{i} đơn", "value": val})
        else:
            for i in range(1, 7):
                val = freq_map.get(i, 0)
                frequency_data.append({"range": f"{i} đơn", "value": val})
            
            # Cột thứ 7: Tổng hợp tất cả >= 7
            count_7_plus = sum(v for k, v in freq_map.items() if k >= 7)
            frequency_data.append({"range": "≥ 7 đơn", "value": count_7_plus})
            
    return frequency_data

def get_aggregated_customer_kpis(
    db: Session, 
    brand_id: int, 
    start_date: date, 
    end_date: date, 
    source_list: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Service lấy KPI Khách hàng tổng hợp và dữ liệu cho các biểu đồ CustomerPage.
    """
    # 1. Lấy dữ liệu Aggregate hiện tại (KPI Card & Segment Data)
    aggregated = _fetch_and_aggregate_kpis(db, brand_id, start_date, end_date, source_list)
    
    # Lấy thêm dữ liệu Daily để vẽ biểu đồ Trend
    # (Lưu ý: _fetch_and_aggregate_kpis không trả về daily_list, nên ta gọi lại hàm lấy list nếu cần trend)
    # Tuy nhiên, để tối ưu ta có thể sửa _fetch_and_aggregate_kpis để trả về cả 2, 
    # NHƯNG để an toàn và giữ code đơn giản như cam kết, ta gọi lại get_daily_kpis_for_range 
    # (Do có Redis cache nên lần gọi thứ 2 sẽ rất nhanh, không đáng lo ngại)
    daily_kpis = get_daily_kpis_for_range(db, brand_id, start_date, end_date, source_list)

    # --- 2.1 Tính toán dữ liệu kỳ trước (Comparison) ---
    duration = end_date - start_date
    prev_end_date = start_date - timedelta(days=1)
    prev_start_date = prev_end_date - duration
    
    # Sử dụng helper mới cho kỳ trước
    prev_aggregated = _fetch_and_aggregate_kpis(db, brand_id, prev_start_date, prev_end_date, source_list)

    # --- 2.2 Xử lý Frequency Data (Sử dụng Helper mới) ---
    frequency_data = _process_frequency_data(aggregated.get('frequency_distribution', {}))

    # 3. Chuẩn bị dữ liệu trả về
    response = {
        "total_customers": aggregated.get("total_customers", 0),
        "new_customers": aggregated.get("new_customers", 0),
        "returning_customers": aggregated.get("returning_customers", 0),
        "retention_rate": aggregated.get("retention_rate", 0),
        "arpu": aggregated.get("arpu", 0),
        "ltv": aggregated.get("ltv", 0),
        
        "previous_period": prev_aggregated,
        "trend_data": daily_kpis,
        
        # Dữ liệu phân khúc thật từ DB
        "segment_data": aggregated.get("customer_segment_distribution", []) or [],
        
        # Dữ liệu thật đã tính toán
        "frequency_data": frequency_data
    }
    
    return response

def get_aggregated_location_distribution(
    db: Session, 
    brand_id: int, 
    start_date: date, 
    end_date: date,
    status_filter: List[str] = ['completed'], # Mặc định chỉ lấy đơn thành công cho Dashboard
    source_list: Optional[List[str]] = None
):
    """
    Tổng hợp dữ liệu phân bố địa lý từ DailyStat hoặc DailyAnalytics.
    Hỗ trợ cả Data Mới (có metrics chi tiết) và Data Cũ (chỉ có total).
    """
    try:
        strategy, clean_sources = kpi_utils.normalize_source_strategy(source_list)
        
        daily_records = []
        if strategy == kpi_utils.STRATEGY_FILTERED:
             # Query DailyAnalytics
            daily_records = db.query(models.DailyAnalytics.location_distribution).filter(
                models.DailyAnalytics.brand_id == brand_id,
                models.DailyAnalytics.date.between(start_date, end_date),
                models.DailyAnalytics.source.in_(clean_sources)
            ).all()
        else:
            # Query DailyStat (Default / All)
            daily_records = db.query(models.DailyStat.location_distribution).filter(
                models.DailyStat.brand_id == brand_id,
                models.DailyStat.date.between(start_date, end_date),
            ).all()

        if not daily_records:
            return []
        
        city_stats = {}

        for record in daily_records:
            loc_dist = record[0]
            if loc_dist and isinstance(loc_dist, list):
                for item in loc_dist:
                    if not isinstance(item, dict): continue

                    city = item.get('city')
                    if not city: continue
                    
                    # --- LOGIC TÍNH TOÁN HYBRID ---
                    orders_to_add = 0
                    revenue_to_add = 0
                    
                    # CASE 1: Data Mới (Có metrics chi tiết)
                    if 'metrics' in item and isinstance(item['metrics'], dict):
                        for status in status_filter:
                            if status in item['metrics']:
                                orders_to_add += item['metrics'][status].get('orders', 0)
                                revenue_to_add += item['metrics'][status].get('revenue', 0)
                                
                    # CASE 2: Data Cũ (Legacy - Chỉ có tổng)
                    # Nếu không tìm thấy metrics, ta đành lấy số tổng (chấp nhận không filter được)
                    else:
                        orders_to_add = item.get('orders', 0)
                        revenue_to_add = item.get('revenue', 0)

                    # --- CỘNG DỒN ---
                    if city not in city_stats:
                        city_stats[city] = {
                            'city': city,
                            'orders': 0,
                            'revenue': 0,
                            # Thêm breakdown chi tiết
                            'completed': 0,
                            'cancelled': 0,
                            'bomb': 0,
                            'refunded': 0,
                            'latitude': item.get('latitude'),
                            'longitude': item.get('longitude'),
                        }
                    
                    # 1. Tính tổng dựa trên Filter (Logic cũ - để sort và hiển thị tổng)
                    city_stats[city]["orders"] += orders_to_add
                    city_stats[city]["revenue"] += revenue_to_add

                    # 2. Tính chi tiết breakdown (Logic mới - cho Multi-Series Map)
                    # Chỉ tính nếu data có metrics chi tiết
                    if 'metrics' in item and isinstance(item['metrics'], dict):
                        city_stats[city]['completed'] += item['metrics'].get('completed', {}).get('orders', 0)
                        city_stats[city]['cancelled'] += item['metrics'].get('cancelled', {}).get('orders', 0)
                        city_stats[city]['bomb'] += item['metrics'].get('bomb', {}).get('orders', 0)
                        city_stats[city]['refunded'] += item['metrics'].get('refunded', {}).get('orders', 0)
                    else:
                        # Fallback cho data cũ (cố gắng map nếu có thể, hoặc chấp nhận thiếu breakdown)
                        # Ở đây tạm thời không làm gì vì data cũ không phân loại sâu được
                        pass
                    
                    # Lấy tọa độ chuẩn từ file config (Fix lỗi dữ liệu cũ bị ngược)
                    coords = PROVINCE_CENTROIDS.get(city)
                    if coords:
                        # PROVINCE_CENTROIDS lưu [Longitude, Latitude]
                        city_stats[city]["latitude"] = coords[1]
                        city_stats[city]["longitude"] = coords[0]
                    # Fallback: Nếu không tìm thấy trong config thì mới lấy từ DB
                    elif (city_stats[city]["latitude"] is None) and (item.get('latitude') is not None):
                        city_stats[city]["latitude"] = item.get('latitude')
                        city_stats[city]["longitude"] = item.get('longitude')
                            
        results = list(city_stats.values())
        return sorted(results, key=lambda item: item['orders'], reverse=True)
    except Exception as e:
        print(f"ERROR aggregation location: {e}")
        return []

def _create_empty_daily_stat(date_obj):
    """Helper tạo data rỗng mặc định dùng Schema chuẩn."""
    # Tạo object rỗng từ Schema, tự động có đủ các trường với giá trị default (0)
    empty_data = schemas.KpiSet().model_dump()
    empty_data['date'] = date_obj.isoformat()
    return empty_data
