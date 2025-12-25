from typing import List, Dict, Any, Tuple

# Constants cho chiến lược Query
STRATEGY_ALL = "ALL"          # Query bảng DailyStat
STRATEGY_FILTERED = "FILTERED" # Query bảng DailyAnalytics
STRATEGY_EMPTY = "EMPTY"      # Không query, trả về rỗng

def normalize_source_strategy(source_input: Any) -> Tuple[str, List[str]]:
    """
    Phân tích input source từ API để quyết định chiến lược query.
    
    Returns:
        (strategy_code, cleaned_source_list)
    """
    clean_sources = []
    
    if source_input is None:
        return STRATEGY_ALL, []
    
    if isinstance(source_input, list):
        if len(source_input) == 0:
            return STRATEGY_EMPTY, []
        
        # Kiểm tra xem có từ khóa 'all' không
        if any(str(s).lower() == 'all' for s in source_input):
            return STRATEGY_ALL, []
        
        # Lọc các source hợp lệ
        clean_sources = [str(s).lower() for s in source_input if str(s).lower() != 'all']
        
    elif isinstance(source_input, str):
        if source_input.lower() == 'all':
            return STRATEGY_ALL, []
        clean_sources = [source_input.lower()]
    
    if not clean_sources:
        # Nếu filter xong mà rỗng (ví dụ input=['all'] nhưng filter bỏ all) -> fallback về ALL nếu logic ban đầu là ALL
        # Nhưng ở bước trên đã return ALL rồi.
        return STRATEGY_EMPTY, []

    return STRATEGY_FILTERED, clean_sources

def calculate_derived_metrics(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Tính toán các chỉ số dẫn xuất (Tỷ lệ, Trung bình) từ các chỉ số thô.
    Đảm bảo công thức duy nhất trên toàn hệ thống.
    """
    # Lấy các giá trị thô, mặc định là 0 nếu không có
    net_revenue = data.get("net_revenue", 0) or 0
    total_cost = data.get("total_cost", 0) or 0
    profit = data.get("profit", 0) or 0
    gmv = data.get("gmv", 0) or 0
    
    completed_orders = data.get("completed_orders", 0) or 0
    total_orders = data.get("total_orders", 0) or 0
    total_quantity_sold = data.get("total_quantity_sold", 0) or 0
    
    impressions = data.get("impressions", 0) or 0
    clicks = data.get("clicks", 0) or 0
    conversions = data.get("conversions", 0) or 0
    ad_spend = data.get("ad_spend", 0) or 0

    # --- TÍNH TOÁN ---
    
    # 1. Tài chính
    data["roi"] = (profit / total_cost) if total_cost > 0 else 0
    data["profit_margin"] = (profit / net_revenue) if net_revenue > 0 else 0
    data["aov"] = (gmv / completed_orders) if completed_orders > 0 else 0
    data["upt"] = (total_quantity_sold / completed_orders) if completed_orders > 0 else 0

    # 2. Vận hành (Rates)
    data["completion_rate"] = (completed_orders / total_orders) if total_orders > 0 else 0
    
    # Lưu ý: Các trường cancelled_orders, refunded_orders phải có sẵn trong data input
    cancelled = data.get("cancelled_orders", 0) or 0
    refunded = data.get("refunded_orders", 0) or 0
    bomb = data.get("bomb_orders", 0) or 0
    
    data["cancellation_rate"] = (cancelled / total_orders) if total_orders > 0 else 0
    data["refund_rate"] = (refunded / total_orders) if total_orders > 0 else 0
    data["bomb_rate"] = (bomb / total_orders) if total_orders > 0 else 0

    # 3. Marketing
    data["ctr"] = (clicks / impressions) if impressions > 0 else 0
    data["cpc"] = (ad_spend / clicks) if clicks > 0 else 0
    data["cpm"] = (ad_spend / impressions * 1000) if impressions > 0 else 0
    data["cpa"] = (ad_spend / conversions) if conversions > 0 else 0
    
    # 4. KPI Bổ sung
    day_count = data.get("_day_count", 1) # Mặc định là 1 để tránh chia 0
    data["avg_daily_orders"] = total_orders / day_count if day_count > 0 else 0

    return data

def merge_json_counters(dict_list: List[Dict[str, int]]) -> Dict[str, int]:
    """
    Gộp danh sách các dict đếm số. 
    Ví dụ: [{'Hết hàng': 1}, {'Hết hàng': 2, 'Đổi ý': 1}] -> {'Hết hàng': 3, 'Đổi ý': 1}
    """
    result = {}
    for d in dict_list:
        if not d or not isinstance(d, dict): continue
        for k, v in d.items():
            current_val = result.get(k, 0)
            # Đảm bảo v là số
            val_to_add = v if isinstance(v, (int, float)) else 0
            result[k] = current_val + val_to_add
    return result

def merge_top_products_list(lists_of_products: List[List[Dict]]) -> List[Dict]:
    """
    Gộp danh sách top products.
    Input: [ [{'sku': 'A', 'value': 10}], [{'sku': 'A', 'value': 5}, {'sku': 'B', 'value': 2}] ]
    Output: [{'sku': 'A', 'value': 15}, {'sku': 'B', 'value': 2}] (Sort desc)
    """
    sku_map = {} # Key: SKU, Value: {data...}
    
    for prod_list in lists_of_products:
        if not prod_list or not isinstance(prod_list, list): continue
        for item in prod_list:
            sku = item.get('sku')
            if not sku: continue
            
            qty = item.get('total_quantity') or item.get('value') or 0 # Support nhiều tên key
            name = item.get('name', 'Unknown')
            
            if sku not in sku_map:
                sku_map[sku] = {
                    'sku': sku,
                    'name': name,
                    'value': 0 # Dùng key 'value' cho thống nhất Chart
                }
            
            sku_map[sku]['value'] += int(qty)
            # Update name nếu trước đó chưa có hoặc là Unknown
            if sku_map[sku]['name'] == 'Unknown' and name != 'Unknown':
                sku_map[sku]['name'] = name

    # Chuyển về list và sort
    results = list(sku_map.values())
    results.sort(key=lambda x: x['value'], reverse=True)
    return results[:10] # Chỉ lấy Top 10 sau khi merge

def aggregate_data_points(data_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Cộng dồn danh sách các dictionary số liệu thành 1 dictionary tổng.
    Tự động gộp các trường JSON đặc thù.
    """
    # Khung dữ liệu tổng
    aggregated = {
        "net_revenue": 0, "gmv": 0, "profit": 0, "total_cost": 0, "ad_spend": 0,
        "cogs": 0, "execution_cost": 0, 
        "completed_orders": 0, "cancelled_orders": 0, "refunded_orders": 0, 
        "bomb_orders": 0, "total_orders": 0,
        "unique_skus_sold": 0, "total_quantity_sold": 0, "total_customers": 0,
        "impressions": 0, "clicks": 0, "conversions": 0, "reach": 0,
        
        # Các trường JSON cần gộp
        "hourly_breakdown": [], 
        "cancel_reason_breakdown": [],
        "top_refunded_products": [],
        
        # Các trường tính trung bình (Weighted Average sẽ tốt hơn, nhưng ở đây dùng Sum trước rồi chia sau hoặc cộng dồn tử/mẫu)
        # Tạm thời ta cộng dồn tổng thời gian xử lý * số đơn -> để sau tính lại avg
        "_sum_processing_time": 0,
        "_sum_shipping_time": 0,
        "_count_processing": 0, # Số đơn có processing time
        "_count_shipping": 0    # Số đơn có shipping time
    }
    
    hourly_jsons = []
    cancel_jsons = []
    refund_product_lists = []

    for item in data_list:
        # Cộng dồn số học
        for key in aggregated:
            if key in item and isinstance(aggregated[key], (int, float)) and not key.startswith('_'):
                aggregated[key] += (item[key] or 0)
        
        # Xử lý Average Time (Cần nhân ngược lại với số đơn để ra tổng giây, sau đó chia lại)
        # Nhưng DailyAnalytics đã lưu avg, ta xấp xỉ bằng avg * total_orders
        n_orders = item.get('total_orders', 0) or 0
        proc_time = item.get('avg_processing_time', 0) or 0
        ship_time = item.get('avg_shipping_time', 0) or 0
        
        if n_orders > 0:
            aggregated['_sum_processing_time'] += (proc_time * n_orders)
            aggregated['_count_processing'] += n_orders
            
            aggregated['_sum_shipping_time'] += (ship_time * n_orders)
            aggregated['_count_shipping'] += n_orders

        # Thu thập JSON để merge sau
        if item.get('hourly_breakdown'): hourly_jsons.append(item['hourly_breakdown'])
        if item.get('cancel_reason_breakdown'): cancel_jsons.append(item['cancel_reason_breakdown'])
        if item.get('top_refunded_products'): refund_product_lists.append(item['top_refunded_products'])

    # Gộp JSON
    aggregated['hourly_breakdown'] = merge_json_counters(hourly_jsons)
    aggregated['cancel_reason_breakdown'] = merge_json_counters(cancel_jsons)
    aggregated['top_refunded_products'] = merge_top_products_list(refund_product_lists)

    # Tính lại Average Time
    if aggregated['_count_processing'] > 0:
        aggregated['avg_processing_time'] = aggregated['_sum_processing_time'] / aggregated['_count_processing']
    else:
        aggregated['avg_processing_time'] = 0
        
    if aggregated['_count_shipping'] > 0:
        aggregated['avg_shipping_time'] = aggregated['_sum_shipping_time'] / aggregated['_count_shipping']
    else:
        aggregated['avg_shipping_time'] = 0

    return aggregated
