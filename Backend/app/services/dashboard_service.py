from datetime import date, timedelta, datetime
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

def get_aggregated_kpis_chart(
    db: Session, 
    brand_id: int, 
    start_date: date, 
    end_date: date, 
    source_list: Optional[List[str]] = None,
    interval: str = 'day'
) -> List[schemas.KpiSet]:
    """
    Lấy dữ liệu KPI biểu đồ, hỗ trợ gom nhóm theo Tuần/Tháng ngay tại Backend.
    Giúp giảm tải cho Frontend khi xem khoảng thời gian dài.
    """
    # 1. Lấy dữ liệu thô theo ngày
    daily_data_objs = get_daily_kpis_for_range(db, brand_id, start_date, end_date, source_list)
    
    if not daily_data_objs or interval == 'day':
        return daily_data_objs

    # 2. Gom nhóm (Grouping)
    grouped_map = defaultdict(list)
    
    for item in daily_data_objs:
        try:
            current_date = item.date
            if not current_date: continue
            
            key_date = None
            if interval == 'month':
                # Gom về ngày đầu tháng
                key_date = current_date.replace(day=1)
            elif interval == 'week':
                # Gom về ngày đầu tuần (Thứ 2)
                key_date = current_date - timedelta(days=current_date.weekday())
            else:
                key_date = current_date

            grouped_map[key_date].append(item.model_dump())
        except Exception as e:
            print(f"Error grouping date {item.date}: {e}")
            continue

    # 3. Tổng hợp (Aggregation) từng nhóm
    results = []
    for date_key, records in grouped_map.items():
        # Dùng lại logic chuẩn của kpi_utils để cộng dồn
        agg = kpi_utils.aggregate_data_points(records)
        
        # Tính lại các chỉ số % (ROI, AOV...)
        final_metrics = kpi_utils.calculate_derived_metrics(agg)
        
        # Gán lại ngày đại diện
        final_metrics['date'] = date_key
        results.append(schemas.KpiSet(**final_metrics))
    
    # Sắp xếp lại theo thời gian
    results.sort(key=lambda x: x.date)
    
    return results

def get_daily_kpis_for_range(
    db: Session, 
    brand_id: int, 
    start_date: date, 
    end_date: date, 
    source_list: Optional[List[str]] = None
) -> List[schemas.KpiSet]:
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
            # Parse lại thành list các đối tượng KpiSet
            raw_list = json.loads(cached_data)
            return [schemas.KpiSet(**item) for item in raw_list]
    except Exception as e:
        print(f"WARNING: Redis Error: {e}")

    strategy, clean_sources = kpi_utils.normalize_source_strategy(source_list)
    
    # Chuẩn bị khung dữ liệu cho toàn bộ dải ngày (để tránh ngày bị thiếu)
    date_map = {} # Dict[date, schemas.KpiSet]
    curr = start_date
    while curr <= end_date:
        date_map[curr] = schemas.KpiSet(date=curr)
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
            # Map model object -> Pydantic KpiSet
            kpi_obj = schemas.KpiSet.model_validate(stat)
            date_map[stat.date] = kpi_obj

    elif strategy == kpi_utils.STRATEGY_FILTERED:
        # Query DailyAnalytics và cộng gộp theo ngày
        analytics = db.query(models.DailyAnalytics).filter(
            models.DailyAnalytics.brand_id == brand_id,
            models.DailyAnalytics.date.between(start_date, end_date),
            models.DailyAnalytics.source.in_(clean_sources)
        ).all()
        
        # Group by Date in memory
        data_by_date = {} 
        for record in analytics:
            d = record.date
            if d not in data_by_date: data_by_date[d] = []
            data_by_date[d].append(schemas.KpiSet.model_validate(record).model_dump())
            
        # Aggregate từng ngày
        for d, records in data_by_date.items():
            aggregated = kpi_utils.aggregate_data_points(records)
            final_metrics = kpi_utils.calculate_derived_metrics(aggregated)
            final_metrics['date'] = d
            date_map[d] = schemas.KpiSet(**final_metrics)

    result_data = [date_map[d] for d in sorted(date_map.keys())]

    # 3. SAVE CACHE (Lưu dạng dict để json.dumps được)
    try:
        redis_client.setex(
            cache_key,
            3600, # 1 giờ
            json.dumps([item.model_dump(mode='json') for item in result_data])
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
) -> schemas.KpiSet:
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
        return schemas.KpiSet()

    # 2. Aggregate (Chuyển list KpiSet thành list dict để dùng hàm aggregate cũ)
    records = [item.model_dump() for item in daily_kpis]
    aggregated = kpi_utils.aggregate_data_points(records)
    
    # 3. Tính toán metrics
    aggregated['_day_count'] = (end_date - start_date).days + 1
    final_metrics = kpi_utils.calculate_derived_metrics(aggregated)
    
    return schemas.KpiSet(**final_metrics)

def get_aggregated_operation_kpis(
    db: Session, 
    brand_id: int, 
    start_date: date, 
    end_date: date, 
    source_list: Optional[List[str]] = None
) -> schemas.OperationKpisResponse:
    """
    Service lấy KPI vận hành tổng hợp (1 cục duy nhất) cho toàn bộ khoảng thời gian.
    Dùng cho các Card chỉ số tổng quan ở đầu Dashboard.
    """
    # Sử dụng helper function đã refactor
    final_kpis_obj = _fetch_and_aggregate_kpis(db, brand_id, start_date, end_date, source_list)
    
    # Dump ra dict để bổ sung thêm trường platform_comparison trước khi validate vào response schema
    response_data = final_kpis_obj.model_dump()
    response_data['platform_comparison'] = get_kpis_by_platform(db, brand_id, start_date, end_date, source_list)

    return schemas.OperationKpisResponse(**response_data)

def get_top_selling_products(
    db: Session, 
    brand_id: int, 
    start_date: date, 
    end_date: date, 
    limit: int = 10,
    source_list: Optional[List[str]] = None
) -> List[schemas.TopProduct]:
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

    # 4. Convert về list, Validate qua Schema và Sort
    result = [schemas.TopProduct(**item) for item in product_map.values()]
    result.sort(key=lambda x: x.total_quantity, reverse=True)
    
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
) -> List[schemas.PlatformComparisonItem]:
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
    total_summary_dict = {
        'platform': 'Tổng cộng',
        'net_revenue': 0, 'gmv': 0, 'profit': 0, 'ad_spend': 0, 'total_cost': 0,
        'cogs': 0, 'execution_cost': 0,
        'completed_orders': 0, 'total_orders': 0, 'cancelled_orders': 0,
        'refunded_orders': 0, 'bomb_orders': 0,
        'roi': 0, 'profit_margin': 0,
        'avg_processing_time': 0, 'avg_shipping_time': 0 
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
        
        item_dict = {
            'platform': source.capitalize(),
            'net_revenue': float(row.netRevenue or 0),
            'gmv': float(row.gmv or 0),
            'profit': float(row.profit or 0),
            'total_cost': float(row.totalCost or 0),
            'ad_spend': float(row.adSpend or 0),
            'cogs': float(row.cogs or 0),
            'execution_cost': float(row.executionCost or 0),
            'completed_orders': int(row.completedOrders or 0),
            'total_orders': int(row.totalOrders or 0),
            'cancelled_orders': int(row.cancelledOrders or 0),
            'refunded_orders': int(row.refundedOrders or 0),
            'bomb_orders': int(row.bombOrders or 0),
            'avg_processing_time': float(avg_proc),
            'avg_shipping_time': float(avg_ship)
        }
        # Tính tỷ lệ
        item_dict['roi'] = (item_dict['profit'] / item_dict['total_cost']) if item_dict['total_cost'] > 0 else 0
        item_dict['profit_margin'] = (item_dict['profit'] / item_dict['net_revenue']) if item_dict['net_revenue'] != 0 else 0
        item_dict['take_rate'] = (item_dict['execution_cost'] / item_dict['gmv']) if item_dict['gmv'] > 0 else 0
        
        final_data.append(schemas.PlatformComparisonItem(**item_dict))
        
        # Cộng dồn vào tổng
        for k in total_summary_dict:
            if k in item_dict and isinstance(item_dict[k], (int, float)) and 'avg' not in k:
                total_summary_dict[k] += item_dict[k]
        
        # Cộng dồn trọng số thời gian cho tổng
        total_weighted_proc += (row.weighted_proc_time or 0)
        total_weighted_ship += (row.weighted_ship_time or 0)
                
    # Tính lại tỷ lệ tổng
    total_summary_dict['roi'] = (total_summary_dict['profit'] / total_summary_dict['total_cost']) if total_summary_dict['total_cost'] > 0 else 0
    total_summary_dict['profit_margin'] = (total_summary_dict['profit'] / total_summary_dict['net_revenue']) if total_summary_dict['net_revenue'] != 0 else 0
    total_summary_dict['take_rate'] = (total_summary_dict['execution_cost'] / total_summary_dict['gmv']) if total_summary_dict['gmv'] > 0 else 0
    
    # Tính Avg Time Tổng
    total_orders_all = total_summary_dict['total_orders']
    total_summary_dict['avg_processing_time'] = (total_weighted_proc / total_orders_all) if total_orders_all > 0 else 0
    total_summary_dict['avg_shipping_time'] = (total_weighted_ship / total_orders_all) if total_orders_all > 0 else 0
    
    if final_data:
        final_data.insert(0, schemas.PlatformComparisonItem(**total_summary_dict))
        
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
) -> schemas.CustomerKpisResponse:
    """
    Service lấy KPI Khách hàng tổng hợp và dữ liệu cho các biểu đồ CustomerPage.
    """
    # 1. Lấy dữ liệu Aggregate hiện tại (KPI Card & Segment Data)
    aggregated_obj = _fetch_and_aggregate_kpis(db, brand_id, start_date, end_date, source_list)
    aggregated_dict = aggregated_obj.model_dump()
    
    # Lấy thêm dữ liệu Daily để vẽ biểu đồ Trend
    daily_kpis = get_daily_kpis_for_range(db, brand_id, start_date, end_date, source_list)

    # --- 2.1 Tính toán dữ liệu kỳ trước (Comparison) ---
    duration = end_date - start_date
    prev_end_date = start_date - timedelta(days=1)
    prev_start_date = prev_end_date - duration
    
    # Sử dụng helper mới cho kỳ trước
    prev_aggregated_obj = _fetch_and_aggregate_kpis(db, brand_id, prev_start_date, prev_end_date, source_list)

    # --- 2.2 Xử lý Frequency Data (Sử dụng Helper mới) ---
    frequency_data = _process_frequency_data(aggregated_dict.get('frequency_distribution', {}))

    # 3. Chuẩn bị dữ liệu trả về theo Schema
    response = schemas.CustomerKpisResponse(
        total_customers=aggregated_dict.get("total_customers", 0),
        new_customers=aggregated_dict.get("new_customers", 0),
        returning_customers=aggregated_dict.get("returning_customers", 0),
        retention_rate=aggregated_dict.get("retention_rate", 0),
        arpu=aggregated_dict.get("arpu", 0),
        ltv=aggregated_dict.get("ltv", 0),
        
        previous_period=prev_aggregated_obj.model_dump(),
        trend_data=daily_kpis,
        
        # Dữ liệu phân khúc thật từ DB
        segment_data=aggregated_dict.get("customer_segment_distribution", []) or [],
        
        # Dữ liệu thật đã tính toán
        frequency_data=frequency_data
    )
    
    return response

def get_aggregated_location_distribution(
    db: Session, 
    brand_id: int, 
    start_date: date, 
    end_date: date,
    status_filter: List[str] = ['completed'], # Mặc định chỉ lấy đơn thành công cho Dashboard
    source_list: Optional[List[str]] = None
) -> List[schemas.CustomerMapDistributionItem]:
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
        
        province_stats = {}

        for record in daily_records:
            loc_dist = record[0]
            if loc_dist and isinstance(loc_dist, list):
                for item in loc_dist:
                    if not isinstance(item, dict): continue

                    # Hỗ trợ cả key cũ 'city' và key mới 'province'
                    province = item.get('province') or item.get('city')
                    if not province: continue
                    
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
                    if province not in province_stats:
                        province_stats[province] = {
                            'province': province,
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
                    province_stats[province]["orders"] += orders_to_add
                    province_stats[province]["revenue"] += revenue_to_add

                    # 2. Tính chi tiết breakdown (Logic mới - cho Multi-Series Map)
                    # Chỉ tính nếu data có metrics chi tiết
                    if 'metrics' in item and isinstance(item['metrics'], dict):
                        province_stats[province]['completed'] += item['metrics'].get('completed', {}).get('orders', 0)
                        province_stats[province]['cancelled'] += item['metrics'].get('cancelled', {}).get('orders', 0)
                        province_stats[province]['bomb'] += item['metrics'].get('bomb', {}).get('orders', 0)
                        province_stats[province]['refunded'] += item['metrics'].get('refunded', {}).get('orders', 0)
                    
                    # Lấy tọa độ chuẩn từ file config (Fix lỗi dữ liệu cũ bị ngược)
                    coords = PROVINCE_CENTROIDS.get(province)
                    if coords:
                        # PROVINCE_CENTROIDS lưu [Longitude, Latitude]
                        province_stats[province]["latitude"] = coords[1]
                        province_stats[province]["longitude"] = coords[0]
                    # Fallback: Nếu không tìm thấy trong config thì mới lấy từ DB
                    elif (province_stats[province]["latitude"] is None) and (item.get('latitude') is not None):
                        province_stats[province]["latitude"] = item.get('latitude')
                        province_stats[province]["longitude"] = item.get('longitude')
                            
        # Validate từng item qua Schema
        results = [schemas.CustomerMapDistributionItem(**stats) for stats in province_stats.values()]
        return sorted(results, key=lambda item: item.orders, reverse=True)
    except Exception as e:
        print(f"ERROR aggregation location: {e}")
        return []
    except Exception as e:
        print(f"ERROR aggregation location: {e}")
        return []

def _create_empty_daily_stat(date_obj):
    """Helper tạo data rỗng mặc định dùng Schema chuẩn."""
    # Tạo object rỗng từ Schema, tự động có đủ các trường với giá trị default (0)
    empty_data = schemas.KpiSet().model_dump()
    empty_data['date'] = date_obj.isoformat()
    return empty_data
