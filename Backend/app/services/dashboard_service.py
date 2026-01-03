from datetime import date, timedelta
from typing import List, Dict, Any, Optional
import json
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session
import pandas as pd

import models
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
    Service lấy dữ liệu KPI theo ngày để vẽ biểu đồ (Chart).
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
            # Map model object -> dict
            date_map[stat.date] = {
                "date": stat.date.isoformat(),
                "net_revenue": stat.net_revenue, "gmv": stat.gmv, "profit": stat.profit,
                "total_cost": stat.total_cost, "ad_spend": stat.ad_spend, "cogs": stat.cogs,
                "execution_cost": stat.execution_cost,
                "completed_orders": stat.completed_orders, "cancelled_orders": stat.cancelled_orders,
                "refunded_orders": stat.refunded_orders, "bomb_orders": stat.bomb_orders, "total_orders": stat.total_orders,
                "total_quantity_sold": stat.total_quantity_sold, "unique_skus_sold": stat.unique_skus_sold,
                "total_customers": stat.total_customers,
                "impressions": stat.impressions, "clicks": stat.clicks, "conversions": stat.conversions,
                # Copy nguyên các chỉ số tỷ lệ đã tính sẵn trong DB
                "roi": stat.roi, "aov": stat.aov, "upt": stat.upt, "ctr": stat.ctr, "cpc": stat.cpc,
                "completion_rate": stat.completion_rate, "cancellation_rate": stat.cancellation_rate,
                "avg_processing_time": stat.avg_processing_time, "avg_shipping_time": stat.avg_shipping_time,
                # JSON fields (cho chi tiết nếu cần)
                "hourly_breakdown": stat.hourly_breakdown, "top_products": stat.top_products,
                "location_distribution": stat.location_distribution,
                "cancel_reason_breakdown": stat.cancel_reason_breakdown,
                "top_refunded_products": stat.top_refunded_products,
                "payment_method_breakdown": stat.payment_method_breakdown,
            }

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
            data_by_date[d].append({
                "net_revenue": record.net_revenue, "gmv": record.gmv, "profit": record.profit,
                "total_cost": record.total_cost, "ad_spend": record.ad_spend, "cogs": record.cogs,
                "execution_cost": record.execution_cost,
                "completed_orders": record.completed_orders, "total_orders": record.total_orders,
                "cancelled_orders": record.cancelled_orders, "refunded_orders": record.refunded_orders,
                "bomb_orders": record.bomb_orders,
                "total_quantity_sold": record.total_quantity_sold, "unique_skus_sold": record.unique_skus_sold,
                "total_customers": record.new_customers + record.returning_customers,
                "impressions": record.impressions, "clicks": record.clicks, "conversions": record.conversions,
                "avg_processing_time": record.avg_processing_time, "avg_shipping_time": record.avg_shipping_time,
                # JSON fields
                "hourly_breakdown": getattr(record, 'hourly_breakdown', {}),
                "top_products": getattr(record, 'top_products', []),
                "cancel_reason_breakdown": getattr(record, 'cancel_reason_breakdown', {}),
                "top_refunded_products": getattr(record, 'top_refunded_products', []),
                "payment_method_breakdown": getattr(record, 'payment_method_breakdown', {}),
            })
            
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
    # Logic tương tự hàm trên nhưng gom tất cả các ngày lại thành 1 cục
    kpis_list = get_daily_kpis_for_range(db, brand_id, start_date, end_date, source_list)
    
    # KPI list đã là list các dict đã aggregated theo ngày. Giờ ta aggregate tiếp theo range.
    # Tuy nhiên, hàm get_daily_kpis_for_range trả về cả những ngày trống (0).
    # Ta lọc bỏ ngày trống để tính avg chính xác hơn (nếu cần), hoặc cứ để kpi_utils xử lý.
    
    aggregated_range = kpi_utils.aggregate_data_points(kpis_list)
    
    # Tính lại derived metrics (VD: ROI của cả tháng, chứ không phải avg ROI của từng ngày)
    aggregated_range['_day_count'] = (end_date - start_date).days + 1
    final_kpis = kpi_utils.calculate_derived_metrics(aggregated_range)
    
    # Thêm dữ liệu so sánh platform
    final_kpis['platform_comparison'] = get_kpis_by_platform(db, brand_id, start_date, end_date, source_list)

    return final_kpis

def get_top_selling_products(
    db: Session, 
    brand_id: int, 
    start_date: date, 
    end_date: date, 
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Lấy top sản phẩm bán chạy. 
    Logic cũ dùng Pandas parse JSON details trực tiếp từ Order -> Khá chậm nếu data lớn.
    Nhưng hiện tại để an toàn ta giữ nguyên logic query Order, chỉ tối ưu code structure.
    """
    # ... (Giữ logic cũ nhưng viết gọn lại)
    orders = db.query(models.Order).filter(
        models.Order.brand_id == brand_id,
        func.date(models.Order.order_date).between(start_date, end_date)
    ).all()
    
    if not orders: return []

    all_items = []
    for order in orders:
        if order.details and isinstance(order.details.get('items'), list):
            for item in order.details['items']:
                if isinstance(item, dict) and item.get('sku') and item.get('quantity'):
                    try:
                        all_items.append({
                            'sku': str(item['sku']), 
                            'quantity': int(item['quantity'])
                        })
                    except (ValueError, TypeError): continue
    
    if not all_items: return []
    
    # Dùng Pandas aggregate
    df = pd.DataFrame(all_items)
    top_df = df.groupby('sku')['quantity'].sum().nlargest(limit).reset_index()
    
    # Map tên sản phẩm
    skus = top_df['sku'].tolist()
    products = db.query(models.Product.sku, models.Product.name).filter(
        models.Product.brand_id == brand_id,
        models.Product.sku.in_(skus)
    ).all()
    name_map = {p.sku: p.name for p in products}
    
    results = []
    for _, row in top_df.iterrows():
        sku = row['sku']
        results.append({
            "sku": sku,
            "total_quantity": int(row['quantity']),
            "name": name_map.get(sku, sku)
        })
        
    return results

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
    """Helper tạo data rỗng mặc định."""
    return {
        "date": date_obj.isoformat(),
        "net_revenue": 0, "gmv": 0, "profit": 0, "total_cost": 0, "ad_spend": 0,
        "cogs": 0, "execution_cost": 0, "roi": 0,
        "completed_orders": 0, "cancelled_orders": 0, "refunded_orders": 0, "bomb_orders": 0, "total_orders": 0,
        "aov": 0, "upt": 0, "unique_skus_sold": 0, "total_quantity_sold": 0,
        "completion_rate": 0, "cancellation_rate": 0, "refund_rate": 0, "bomb_rate": 0, "total_customers": 0,
        "impressions": 0, "clicks": 0, "conversions": 0, "cpc": 0,
        "cpa": 0, "cpm": 0, "ctr": 0, "reach": 0, "frequency": 0,
        "avg_processing_time": 0, "avg_shipping_time": 0,
        "hourly_breakdown": {}, "top_products": [], "location_distribution": [],
        "payment_method_breakdown": {}, "cancel_reason_breakdown": {},
        "top_refunded_products": [], "financial_events": []
    }
