from typing import List, Dict, Any, Tuple, Optional, Set
from datetime import date, datetime, timedelta
from collections import defaultdict
from unidecode import unidecode
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

import models
from province_centroids import PROVINCE_CENTROIDS
from vietnam_address_mapping import get_new_province_name

# Constants cho chiến lược Query
STRATEGY_ALL = "ALL"          # Query bảng DailyStat
STRATEGY_FILTERED = "FILTERED" # Query bảng DailyAnalytics
STRATEGY_EMPTY = "EMPTY"      # Không query, trả về rỗng

# Constants cho phân loại đơn hàng (Dời từ kpi_calculator)
CANCELLED_STATUSES = {'hủy', 'cancel', 'đã hủy', 'cancelled'}

ORDER_STATUS_KEYWORDS = {
    "bomb_status": ["fail", "chuyen hoan", "that bai", "khong thanh cong", "khong nhan", "tu choi", "khong lien lac", "thue bao", "tu choi", "khong nghe may", "boom hang", "bom hang", "contact failed"],
    "cancel_status": ["huy", "cancel"],
    "success_status": ["hoan thanh", "complete", "deliver", "success", "da nhan", "thanh cong", "da giao", "giao thanh cong", "shipped", "finish", "done", "hoan tat", "nguoi mua xac nhan"],
    "processing_status": ["dang giao", "dang trung chuyen", "cho giao hang", "cho van chuyen", "dang cho", "chuan bi hang", "pickup", "transitting", "delivery"]
}

# Các trạng thái được tính là thành công (Góp phần vào số lượng đơn tính AOV)
SUCCESS_CATEGORIES = {'completed'}

def is_success_category(category: str) -> bool:
    """Check if the categorized status is considered a successful/active order."""
    return category in SUCCESS_CATEGORIES

def get_active_order_filters(model):
    """
    Trả về điều kiện lọc chung để loại bỏ các đơn hàng không hợp lệ (Hủy, Bom, Fail).
    Giúp đồng bộ logic lọc đơn 'Active' hoặc 'Successful' cơ bản trên toàn hệ thống.
    """
    return and_(
        ~model.status.ilike('%huy%'),
        ~model.status.ilike('%cancel%'),
        ~model.status.ilike('%fail%'),
        ~model.status.ilike('%bom%')
    )

CANCEL_REASON_MAPPING = {
    "Giao thất bại (Bom hàng)": [
        "that bai", "khong thanh cong", "khach khong nhan", "khong lien lac", "tu choi nhan",
        "thue bao", "tu choi", "delivery failed", "unreachable", "refused", 
        "khong nghe may", "boom hang", "bom hang", "contact failed"
    ],
    "Đổi ý / Không nhu cầu": [
        "khong con nhu cau", "doi y", "khong muon mua", "khong can", 
        "mua nham", "dat nham", "change of mind", "no need", 
        "trung lap", "duplicate", "huy don"
    ],
    "Thay đổi Đơn hàng (Voucher/Đ.Chỉ/SP)": [
        "change", "doi dia chi", "address", "sdt", "so dien thoai", "thay doi mau hoac kich co",
        "voucher", "ma giam gia", "coupon", "khuyen mai", "nhap quen", "forgot code",
        "san pham", "product", "mau sac", "kich thuoc", "size", "color", 
        "gop don", "tach don", "delivery address"
    ],
    "Giá / Tìm được rẻ hơn": [
        "gia tot hon", "re hon", "gia cao", "dat qua", 
        "price", "tim duoc cho khac", "cheaper", "phi ship", "shipping fee", 
        "cuoc van chuyen"
    ],
    "Vấn đề Thanh toán": [
        "thanh toan", "payment", "pay", "the tin dung", "khong kha dung"
        "banking", "chuyen khoan", "cod", "payment method", 
        "vi dien tu", "rac roi", "error", "loi thanh toan"
    ],
    "Vấn đề Vận chuyển (Chậm/Lâu)": [
        "giao cham", "ship cham", "lau qua", "thoi gian", "time", "phi giao hang cao", "phi ship cao",
        "nguoi ban gui", "seller", "delivery", "tre han", "delay", 
        "chuan bi hang"
    ],
    "Do nhà bán": [
        "khong tra loi", "het hang", "hang ve muon", "hang ve sau", "dung han", "khong gui hang"
    ],
    "Lý do khác": []
}

BOMB_REASON_KEYWORDS = CANCEL_REASON_MAPPING.get("Giao thất bại (Bom hàng)", [])

PAYMENT_METHOD_MAPPING = {
    "COD": [
        "thanh toan khi nhan hang", "thanh toan khi giao hang", "nhan hang thanh toan"
        "cod", "cash", "tien mat", "pay upon delivery"
    ],
    "Ví điện tử": [
        "momo", "zalopay", "vnpay", "shopeepay", "shopee pay", "wallet", "viettelpay",
        "vi dien tu", "airpay", "google pay", "apple pay", "so du tk shopee",
        "tiktok shop balance", "balance", "lien ket shopeepay"
    ],
    "Mua trước trả sau": [
        "spaylater", "paylater", "tra sau"
    ],
    "Thẻ / Ngân hàng": [
        "the tin dung", "the ghi no", "credit", "debit", "atm", "napas", 
        "banking", "chuyen khoan", "bank transfer", "visa", "mastercard", "jcb",
        "tk ngan hang"
    ],
    "Free": [
        "thanh toan duoc mien", "mien thanh toan", "mien phi", "free"
    ]
}

def normalize_source_strategy(source_input: Any) -> Tuple[str, List[str]]:
    """Phân tích input source từ API để quyết định chiến lược query."""
    clean_sources = []
    if source_input is None: return STRATEGY_ALL, []
    if isinstance(source_input, list):
        if len(source_input) == 0: return STRATEGY_EMPTY, []
        if any(str(s).lower() == 'all' for s in source_input): return STRATEGY_ALL, []
        clean_sources = [str(s).lower() for s in source_input if str(s).lower() != 'all']
    elif isinstance(source_input, str):
        if source_input.lower() == 'all': return STRATEGY_ALL, []
        clean_sources = [source_input.lower()]
    if not clean_sources: return STRATEGY_EMPTY, []
    return STRATEGY_FILTERED, clean_sources

def calculate_derived_metrics(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    TẬP TRUNG CÔNG THỨC: Tính toán các chỉ số tỷ lệ, trung bình.
    Sử dụng chung cho cả luồng Ghi (Calculator) và luồng Đọc (Aggregator).
    """
    # Lấy các giá trị thô
    net_revenue = data.get("net_revenue", 0) or 0
    total_cost = data.get("total_cost", 0) or 0
    profit = data.get("profit", 0) or 0
    gmv = data.get("gmv", 0) or 0
    ad_spend = data.get("ad_spend", 0) or 0
    
    completed_orders = data.get("completed_orders", 0) or 0
    total_orders = data.get("total_orders", 0) or 0
    total_quantity_sold = data.get("total_quantity_sold", 0) or 0
    
    impressions = data.get("impressions", 0) or 0
    clicks = data.get("clicks", 0) or 0
    conversions = data.get("conversions", 0) or 0

    # 1. Tài chính
    data["roi"] = (profit / total_cost) if total_cost > 0 else 0
    data["profit_margin"] = (profit / net_revenue) if net_revenue > 0 else 0
    data["aov"] = (gmv / completed_orders) if completed_orders > 0 else 0
    data["upt"] = (total_quantity_sold / completed_orders) if completed_orders > 0 else 0
    data["take_rate"] = (data.get("execution_cost", 0) / gmv) if gmv > 0 else 0

    # 2. Vận hành (Rates)
    data["completion_rate"] = (completed_orders / total_orders) if total_orders > 0 else 0
    
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
    data["roas"] = (gmv / ad_spend) if ad_spend > 0 else 0

    # 4. Average Time (Nếu chưa tính sẵn)
    data["avg_processing_time"] = 0 # Default
    if "_count_processing" in data and data["_count_processing"] > 0:
        data["avg_processing_time"] = data["_sum_processing_time"] / data["_count_processing"]
        
    data["avg_shipping_time"] = 0 # Default
    if "_count_shipping" in data and data["_count_shipping"] > 0:
        data["avg_shipping_time"] = data["_sum_shipping_time"] / data["_count_shipping"]

    # 5. Khác
    day_count = data.get("_day_count", 1)
    data["avg_daily_orders"] = total_orders / day_count if day_count > 0 else 0

    # 6. Customer Metrics (Aggregate)
    # Lưu ý: total_customers ở đây là tổng các phiên khách hàng (sessions) nếu aggregate nhiều ngày
    total_cust = data.get("total_customers", 0) or 0
    new_cust = data.get("new_customers", 0) or 0
    returning_cust = data.get("returning_customers", 0) or 0
    
    data["arpu"] = int(round(net_revenue / total_cust)) if total_cust > 0 else 0
    data["ltv"] = int(round(profit / total_cust)) if total_cust > 0 else 0 # Simple LTV based on period profit
    data["retention_rate"] = (returning_cust / total_cust * 100) if total_cust > 0 else 0

    return data

def merge_json_counters(dict_list: List[Dict[str, int]]) -> Dict[str, int]:
    result = {}
    for d in dict_list:
        if not d or not isinstance(d, dict): continue
        for k, v in d.items():
            result[k] = result.get(k, 0) + (v if isinstance(v, (int, float)) else 0)
    return result

def merge_top_products_list(lists_of_products: List[List[Dict]]) -> List[Dict]:
    sku_map = {}
    for prod_list in lists_of_products:
        if not prod_list or not isinstance(prod_list, list): continue
        for item in prod_list:
            sku = item.get('sku')
            if not sku: continue
            qty = item.get('total_quantity') or item.get('value') or 0
            name = item.get('name', 'Unknown')
            if sku not in sku_map:
                sku_map[sku] = {'sku': sku, 'name': name, 'value': 0}
            sku_map[sku]['value'] += int(qty)
            if sku_map[sku]['name'] == 'Unknown' and name != 'Unknown':
                sku_map[sku]['name'] = name
    results = list(sku_map.values())
    results.sort(key=lambda x: x['value'], reverse=True)
    return results[:10]

def merge_location_lists(lists_of_locations: List[List[Dict]]) -> List[Dict]:
    province_map = {}
    
    for loc_list in lists_of_locations:
        if not loc_list or not isinstance(loc_list, list): continue
        for item in loc_list:
            province = item.get('province')
            if not province: continue
            
            if province not in province_map:
                province_map[province] = {
                    'province': province,
                    'latitude': item.get('latitude'),
                    'longitude': item.get('longitude'),
                    'metrics': defaultdict(lambda: {"orders": 0, "revenue": 0}),
                    'districts': defaultdict(lambda: {"orders": 0, "revenue": 0}),
                    # Legacy fields aggregation
                    'orders': 0, 'revenue': 0 
                }
            
            # 1. Merge Metrics (Format Mới)
            item_metrics = item.get('metrics')
            if item_metrics and isinstance(item_metrics, dict):
                for status, val in item_metrics.items():
                    province_map[province]['metrics'][status]['orders'] += val.get('orders', 0)
                    province_map[province]['metrics'][status]['revenue'] += val.get('revenue', 0)

            # 2. Merge Districts (Format Mới cho Drill-down)
            item_districts = item.get('districts')
            if item_districts and isinstance(item_districts, dict):
                for district, val in item_districts.items():
                    province_map[province]['districts'][district]['orders'] += val.get('orders', 0)
                    province_map[province]['districts'][district]['revenue'] += val.get('revenue', 0)
            
            # 3. Merge Legacy Fields (Cho dữ liệu cũ chưa có metrics)
            province_map[province]['orders'] += (item.get('orders') or 0)
            province_map[province]['revenue'] += (item.get('revenue') or 0)
            
            if province_map[province]['latitude'] is None and item.get('latitude'):
                 province_map[province]['latitude'] = item.get('latitude')
                 province_map[province]['longitude'] = item.get('longitude')

    results = []
    for province, data in province_map.items():
        # Clean up defaultdict
        metrics_clean = {k: dict(v) for k, v in data["metrics"].items()}
        districts_clean = {k: dict(v) for k, v in data["districts"].items()}
        data["metrics"] = metrics_clean
        data["districts"] = districts_clean
        results.append(data)

    results.sort(key=lambda x: x['orders'], reverse=True)
    return results

def aggregate_data_points(data_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Cộng dồn danh sách các dictionary số liệu thành 1 dictionary tổng.
    """
    aggregated = {
        "net_revenue": 0, "gmv": 0, "profit": 0, "total_cost": 0, "ad_spend": 0,
        "cogs": 0, "execution_cost": 0, "subsidy_amount": 0,
        "completed_orders": 0, "cancelled_orders": 0, "refunded_orders": 0, 
        "bomb_orders": 0, "total_orders": 0,
        "unique_skus_sold": 0, "total_quantity_sold": 0, "total_customers": 0,
        "new_customers": 0, "returning_customers": 0,
        "new_customer_revenue": 0, "returning_customer_revenue": 0,
        "impressions": 0, "clicks": 0, "conversions": 0, "reach": 0,
        "hourly_breakdown": [], "cancel_reason_breakdown": [], "top_refunded_products": [],
        "payment_method_breakdown": [], "location_distribution": [],
        "frequency_distribution": [], # List để gom các dict con lại
        "_sum_processing_time": 0, "_sum_shipping_time": 0, "_count_processing": 0, "_count_shipping": 0,
        "_sum_repurchase_cycle": 0, "_count_returning_transactions": 0, # Biến tạm tính Weighted Avg Cycle
        "_sum_churn_weighted": 0, "_sum_cust_for_churn": 0 # Biến tạm tính Weighted Churn Rate
    }
    
    hourly_jsons = []
    cancel_jsons = []
    refund_product_lists = []
    payment_jsons = []
    location_lists = []
    freq_jsons = [] # List chứa các frequency map từ daily stats

    for item in data_list:
        for key in aggregated:
            if key in item and isinstance(aggregated[key], (int, float)) and not key.startswith('_'):
                aggregated[key] += (item[key] or 0)
        
        # Weighted Average logic
        n_orders = item.get('total_orders', 0) or 0
        if n_orders > 0:
            aggregated['_sum_processing_time'] += ((item.get('avg_processing_time', 0) or 0) * n_orders)
            aggregated['_count_processing'] += n_orders
            aggregated['_sum_shipping_time'] += ((item.get('avg_shipping_time', 0) or 0) * n_orders)
            aggregated['_count_shipping'] += n_orders
            
        # Weighted Average logic cho Repurchase Cycle (Trọng số là số khách quay lại)
        n_returning = item.get('returning_customers', 0) or 0
        cycle = item.get('avg_repurchase_cycle', 0) or 0
        
        # [MODIFIED] Logic kép: Vừa tính Weighted, vừa tính Simple để fallback
        if n_returning > 0:
            aggregated['_sum_repurchase_cycle'] += (cycle * n_returning)
            aggregated['_count_returning_transactions'] += n_returning
        
        if cycle > 0:
            aggregated['_sum_repurchase_simple'] = aggregated.get('_sum_repurchase_simple', 0) + cycle
            aggregated['_count_repurchase_simple'] = aggregated.get('_count_repurchase_simple', 0) + 1

        # Weighted Average logic cho Churn Rate (Trọng số là Total Customers)
        n_cust = item.get('total_customers', 0) or 0
        churn = item.get('churn_rate', 0) or 0
        
        # [MODIFIED] Logic kép: Vừa tính Weighted, vừa tính Simple để fallback
        if n_cust > 0:
            aggregated['_sum_churn_weighted'] += (churn * n_cust)
            aggregated['_sum_cust_for_churn'] += n_cust
            
        if churn > 0:
            aggregated['_sum_churn_simple'] = aggregated.get('_sum_churn_simple', 0) + churn
            aggregated['_count_churn_simple'] = aggregated.get('_count_churn_simple', 0) + 1

        if item.get('hourly_breakdown'): hourly_jsons.append(item['hourly_breakdown'])
        if item.get('cancel_reason_breakdown'): cancel_jsons.append(item['cancel_reason_breakdown'])
        if item.get('top_refunded_products'): refund_product_lists.append(item['top_refunded_products'])
        if item.get('payment_method_breakdown'): payment_jsons.append(item['payment_method_breakdown'])
        if item.get('location_distribution'): location_lists.append(item['location_distribution'])
        if item.get('frequency_distribution'): freq_jsons.append(item['frequency_distribution'])
    
    # Tính Weighted Averages
    aggregated['avg_repurchase_cycle'] = 0
    if aggregated['_count_returning_transactions'] > 0:
        aggregated['avg_repurchase_cycle'] = aggregated['_sum_repurchase_cycle'] / aggregated['_count_returning_transactions']
    # [FALLBACK] Nếu không có khách quay lại trong ngày (weight=0), dùng simple avg
    elif aggregated.get('_count_repurchase_simple', 0) > 0:
        aggregated['avg_repurchase_cycle'] = aggregated['_sum_repurchase_simple'] / aggregated['_count_repurchase_simple']

    # Tính Churn Rate trung bình
    aggregated['churn_rate'] = 0
    if aggregated['_sum_cust_for_churn'] > 0:
        aggregated['churn_rate'] = aggregated['_sum_churn_weighted'] / aggregated['_sum_cust_for_churn']
    # [FALLBACK] Nếu không có khách mua hàng trong ngày (weight=0), dùng simple avg
    elif aggregated.get('_count_churn_simple', 0) > 0:
        aggregated['churn_rate'] = aggregated['_sum_churn_simple'] / aggregated['_count_churn_simple']

    aggregated['hourly_breakdown'] = merge_json_counters(hourly_jsons)
    aggregated['cancel_reason_breakdown'] = merge_json_counters(cancel_jsons)
    # Sử dụng hàm merge cấu trúc mới (Dict lồng nhau) thay vì hàm merge list cũ
    aggregated['top_refunded_products'] = merge_product_breakdown_structure(refund_product_lists)
    aggregated['payment_method_breakdown'] = merge_json_counters(payment_jsons)
    aggregated['location_distribution'] = merge_location_lists(location_lists)
    aggregated['frequency_distribution'] = merge_json_counters(freq_jsons) # Sử dụng lại hàm merge counter đơn giản
    
    # Merge Customer Segment Distribution
    # Logic: Gom nhóm theo Key (vip, potential, mass) và cộng Value
    seg_map = defaultdict(int)
    seg_labels = {} # Lưu label cuối cùng (hoặc logic lấy max/avg threshold)
    
    for item in data_list:
        seg_dist = item.get('customer_segment_distribution')
        if not seg_dist or not isinstance(seg_dist, list): continue
        
        for segment in seg_dist:
            key = segment.get('key')
            val = segment.get('value', 0)
            if key:
                seg_map[key] += val
                # Lấy label của ngày gần nhất (hoặc bất kỳ) để hiển thị
                if segment.get('name'):
                    seg_labels[key] = segment.get('name')

    # Reconstruct list
    aggregated['customer_segment_distribution'] = []
    # Định nghĩa thứ tự hiển thị chuẩn
    order_keys = ['vip', 'potential', 'mass']
    for k in order_keys:
        if k in seg_map:
            aggregated['customer_segment_distribution'].append({
                "key": k,
                "name": seg_labels.get(k, k.upper()), # Fallback name
                "value": seg_map[k]
            })

    return aggregated

# ==============================================================================
# PHẦN 2: LOGIC XỬ LÝ DỮ LIỆU THÔ
# ==============================================================================

def _calculate_customer_segment_distribution(
    orders: List[models.Order], 
    date_to_calculate: date, 
    db_session: Session
) -> List[Dict]:
    """
    Phân loại khách hàng mua trong ngày (VIP, Tiềm năng, Phổ thông)
    dựa trên TỔNG CHI TIÊU TÍCH LŨY (LTV) của họ tính đến thời điểm đó.
    Sử dụng phương pháp Percentile (20/30/50) trên nhóm khách hàng này.
    """
    if not orders or not db_session: return []
    
    # 1. Lấy danh sách khách hàng mua trong ngày
    target_usernames = list({o.username for o in orders if o.username})
    if not target_usernames: return []

    try:
        # 2. Tính LTV (Tổng chi tiêu tích lũy) của những khách này
        ltv_query = db_session.query(
            models.Order.username,
            func.sum(models.Order.sku_price)
        ).filter(
            models.Order.username.in_(target_usernames),
            models.Order.order_date <= datetime.combine(date_to_calculate, datetime.max.time()),
            # Chỉ tính đơn thành công? 
            # Thường segmentation tính trên đơn thành công.
            # Tuy nhiên, nếu lọc ở đây sẽ phức tạp vì text search.
            # Tạm thời tính ALL đơn hoặc reuse logic status keywords.
            # Để đơn giản và nhanh cho worker, ta lọc đơn status thành công cơ bản.
             get_active_order_filters(models.Order)
        ).group_by(models.Order.username).all()
        
        user_ltv = {row[0]: float(row[1] or 0) for row in ltv_query}
        
        # Những user không tìm thấy (có thể do order hiện tại chưa commit?), gán bằng đơn hiện tại
        # (Lưu ý: orders input chưa chắc đã commit vào DB nếu đang trong transaction của worker)
        # Nhưng thường worker query orders từ DB nên OK.
        
        # Tạo danh sách giá trị để tính percentile
        values = sorted([v for v in user_ltv.values() if v > 0], reverse=True)
        count = len(values)
        
        if count == 0: return []
        
        # 3. Xác định ngưỡng (Thresholds)
        # Top 20% -> VIP
        # Next 30% -> Tiềm năng
        # Rest 50% -> Phổ thông
        
        idx_vip = int(count * 0.2) # Top 20%
        idx_potential = int(count * 0.5) # Top 50% (20+30)
        
        # Giá trị chặn (Min value to be in segment)
        # values đã sort desc: [100tr, 50tr, ... 100k]
        threshold_vip = values[idx_vip] if idx_vip < count else values[-1]
        threshold_potential = values[idx_potential] if idx_potential < count else values[-1]
        
        # Handle edge case: ít user quá
        if count < 5:
            # Nếu ít khách, dùng ngưỡng cứng tạm thời hoặc chỉ 1 nhóm
            threshold_vip = 5000000
            threshold_potential = 1000000

        # 4. Gom nhóm & Đếm
        def fmt(v):
            if v >= 1_000_000:
                return f"{v/1_000_000:g}tr"
            return f"{int(v/1000)}k"

        groups = {
            "vip": {"count": 0, "label": f"VIP (>{fmt(threshold_vip)})"},
            "potential": {"count": 0, "label": f"Tiềm năng ({fmt(threshold_potential)}-{fmt(threshold_vip)})"},
            "mass": {"count": 0, "label": f"Phổ thông (<{fmt(threshold_potential)})"}
        }
        
        # Duyệt lại từng user trong batch hiện tại để phân loại
        # Lưu ý: user_ltv chứa LTV toàn thời gian.
        for user in target_usernames:
            ltv = user_ltv.get(user, 0)
            
            # Fallback: Nếu không có trong DB (VD đơn chưa commit), tính tạm từ đơn hiện tại
            if ltv == 0:
                current_orders_val = sum(o.sku_price or 0 for o in orders if o.username == user)
                ltv = current_orders_val
            
            if ltv >= threshold_vip:
                groups["vip"]["count"] += 1
            elif ltv >= threshold_potential:
                groups["potential"]["count"] += 1
            else:
                groups["mass"]["count"] += 1
                
        # 5. Format Output
        result = []
        result.append({"key": "vip", "name": groups["vip"]["label"], "value": groups["vip"]["count"]})
        result.append({"key": "potential", "name": groups["potential"]["label"], "value": groups["potential"]["count"]})
        result.append({"key": "mass", "name": groups["mass"]["label"], "value": groups["mass"]["count"]})
        
        return result

    except Exception as e:
        print(f"Error calculating customer segment: {e}")
        return []

def _matches_keywords(text: str, keywords: List[str]) -> bool:
    if not text: return False
    normalized_text = unidecode(str(text)).lower()
    return any(kw in normalized_text for kw in keywords)

def _is_bomb_order(status: str, reason: str) -> bool:
    """Kiểm tra xem đơn có phải là BOM không."""
    # 1. Trạng thái BOM rõ ràng (Ví dụ: Chuyển hoàn, Thất bại...)
    if _matches_keywords(status, ORDER_STATUS_KEYWORDS["bomb_status"]):
        return True
    
    # 2. Trạng thái HỦY nhưng lý do là BOM (Ví dụ: Hủy do không nghe máy...)
    if _matches_keywords(status, ORDER_STATUS_KEYWORDS["cancel_status"]) and \
       _matches_keywords(reason, BOMB_REASON_KEYWORDS):
        return True
        
    return False

def _is_cancelled_order(status: str) -> bool:
    """Kiểm tra xem đơn có phải là HỦY không (Chỉ check status)."""
    return _matches_keywords(status, ORDER_STATUS_KEYWORDS["cancel_status"])

def _is_completed_order(status: str) -> bool:
    """Kiểm tra xem đơn có phải là THÀNH CÔNG không."""
    return _matches_keywords(status, ORDER_STATUS_KEYWORDS["success_status"])

def _classify_order_status(order: models.Order, is_financial_refund: bool) -> str:
    """
    Phân loại trạng thái đơn hàng theo thứ tự ưu tiên mới (User Defined):
    1. Hủy (Cancel Status) -> Soi Reason để tách Bom.
    2. Bom (Bomb Status) -> Bom đặc thù (không có chữ Hủy).
    3. Hoàn tiền (Financial Refund).
    4. Thành công (Success Status).
    5. Khác (Other/Pending).
    """
    status = order.status or ""
    reason = order.details.get('cancel_reason', '') if order.details and isinstance(order.details, dict) else ""
    
    # --- BƯỚC 1: PHÂN LOẠI CẤP 1 (Dựa trên Status) ---
    is_cancel_group = _is_cancelled_order(status)
    is_success_group = _is_completed_order(status)

    # --- BƯỚC 2: XỬ LÝ CHUYÊN SÂU ---

    # Ưu tiên 1: Xử lý nhóm HỦY (Bóc tách Cancel vs Bomb)
    if is_cancel_group:
        if _is_bomb_order(status, reason):
            return 'bomb'
        return 'cancelled'

    # Ưu tiên 2: Xử lý nhóm BOM ĐẶC THÙ (Không có chữ Hủy nhưng là thất bại)
    # Ví dụ: "Giao hàng thất bại", "Chuyển hoàn"
    if _matches_keywords(status, ORDER_STATUS_KEYWORDS["bomb_status"]):
        return 'bomb'

    # Ưu tiên 3: Xử lý Đơn HOÀN TIỀN
    # Logic tài chính (refund âm)
    if is_financial_refund:
        return 'refunded'

    # Ưu tiên 4: Xử lý Nhóm THÀNH CÔNG
    # Chỉ khi thoát được 3 cửa ải trên mới được tính là Thành công
    if is_success_group:
        return 'completed'

    # Ưu tiên 5: Xử lý Nhóm ĐANG XỬ LÝ (Processing)
    if _matches_keywords(status, ORDER_STATUS_KEYWORDS["processing_status"]):
        return 'processing'
        
    # Ưu tiên 6: CÒN LẠI (An toàn)
    # Đơn đang giao, chờ xác nhận... -> Không tính toán
    return 'other'

def _calculate_cancel_reason_breakdown(orders: List[models.Order]) -> Dict[str, int]:
    try:
        reason_counts = defaultdict(int)
        for order in orders:
            # Lọc tất cả đơn có trạng thái Hủy (Bao gồm cả Bom dạng hủy và Hủy thường)
            # Sử dụng chung bộ từ khóa chuẩn để đồng bộ logic
            if not _matches_keywords(order.status, ORDER_STATUS_KEYWORDS["cancel_status"]):
                continue
                
            if order.details and isinstance(order.details, dict):
                raw_reason = order.details.get('cancel_reason', '')
                if raw_reason:
                    reason_text = unidecode(str(raw_reason)).lower().strip()
                    found_group = False
                    for group_name, keywords in CANCEL_REASON_MAPPING.items() if 'CAN_REASON_MAPPING' in locals() else CANCEL_REASON_MAPPING.items():
                        for kw in keywords:
                            if kw in reason_text:
                                reason_counts[group_name] += 1
                                found_group = True
                                break
                        if found_group: break
                    if not found_group: reason_counts["Lý do khác"] += 1
        return dict(reason_counts)
    except Exception as e:
        print(f"ERROR in _calculate_cancel_reason_breakdown: {e}")
        return {}

def _calculate_hourly_breakdown(orders: List[models.Order]) -> Dict[str, int]:
    hourly_counts = defaultdict(int)
    for order in orders:
        if order.order_date and isinstance(order.order_date, datetime):
            hourly_counts[str(order.order_date.hour)] += 1
    result = {str(h): 0 for h in range(24)}
    result.update(hourly_counts)
    return result

def _calculate_top_products(orders: List[models.Order], limit=10) -> List[Dict]:
    product_stats = defaultdict(lambda: {"quantity": 0, "revenue": 0, "name": ""})
    for order in orders:
        if order.details and isinstance(order.details.get('items'), list):
            for item in order.details['items']:
                sku = item.get('sku')
                if sku:
                    try:
                        qty = int(float(item.get('quantity', 0) or 0))
                    except (ValueError, TypeError):
                        qty = 0
                    
                    price = float(item.get('price', 0) or 0)
                    
                    product_stats[sku]["quantity"] += qty
                    product_stats[sku]["revenue"] += qty * price
                    product_stats[sku]["name"] = item.get('name', sku)
    
    sorted_products = sorted(product_stats.items(), key=lambda x: x[1]['quantity'], reverse=True)[:limit]
    return [{"sku": sku, "name": data["name"], "quantity": data["quantity"], "revenue": data["revenue"]} for sku, data in sorted_products]

def merge_product_breakdown_structure(list_of_breakdowns: List[Dict]) -> Dict[str, List[Dict]]:
    """
    Gộp danh sách các breakdown (mỗi breakdown chứa 3 key: cancelled, bomb, refunded)
    thành 1 breakdown tổng hợp.
    """
    try:
        grouped = {
            "cancelled": [],
            "bomb": [],
            "refunded": []
        }
        
        for bd in list_of_breakdowns:
            if not bd: continue
            # Tương thích ngược: Nếu dữ liệu cũ là List (từ logic cũ), ta bỏ qua hoặc cố gắng convert
            if isinstance(bd, list): 
                continue 
            
            if isinstance(bd, dict):
                if "cancelled" in bd: grouped["cancelled"].append(bd["cancelled"])
                if "bomb" in bd: grouped["bomb"].append(bd["bomb"])
                if "refunded" in bd: grouped["refunded"].append(bd["refunded"])

        # Sử dụng lại hàm merge list cũ cho từng nhóm
        return {
            "cancelled": merge_top_products_list(grouped["cancelled"]),
            "bomb": merge_top_products_list(grouped["bomb"]),
            "refunded": merge_top_products_list(grouped["refunded"])
        }
    except Exception as e:
        print(f"ERROR in merge_product_breakdown_structure: {e}")
        return {"cancelled": [], "bomb": [], "refunded": []}

def _calculate_bad_product_breakdown(
    orders: List[models.Order], 
    order_has_refund_map: Dict[str, bool],
    limit=10
) -> Dict[str, List[Dict]]:
    """
    Tính Top sản phẩm cho 3 nhóm riêng biệt: Hủy, Bom, Hoàn tiền.
    Sử dụng logic phân loại chuẩn _classify_order_status.
    """
    try:
        # 3 giỏ chứa data thô: Key=SKU, Value={qty, name}
        baskets = {
            "cancelled": defaultdict(lambda: {"qty": 0, "name": "Unknown"}),
            "bomb": defaultdict(lambda: {"qty": 0, "name": "Unknown"}),
            "refunded": defaultdict(lambda: {"qty": 0, "name": "Unknown"})
        }

        for order in orders:
            # 1. Phân loại đơn chuẩn xác
            cat = _classify_order_status(order, order_has_refund_map.get(order.order_code, False))
            
            # 2. Chỉ quan tâm 3 loại xấu này
            if cat not in baskets: continue
            
            # 3. Lấy sản phẩm và cộng dồn vào giỏ tương ứng
            if order.details and isinstance(order.details.get('items'), list):
                for item in order.details['items']:
                    sku = item.get('sku')
                    if sku:
                        try:
                            qty = int(float(item.get('quantity', 0) or 0)) # Safe convert string/float/None -> int
                        except:
                            qty = 0
                            
                        name = item.get('name', sku)
                        
                        baskets[cat][sku]["qty"] += qty
                        # Cập nhật tên nếu chưa có
                        if baskets[cat][sku]["name"] == "Unknown" and name:
                            baskets[cat][sku]["name"] = name

        # 4. Convert sang list và sort
        final_result = {}
        for cat, data in baskets.items():
            sorted_items = sorted(data.items(), key=lambda x: x[1]['qty'], reverse=True)[:limit]
            final_result[cat] = [
                {"sku": sku, "name": val["name"], "value": val["qty"]} 
                for sku, val in sorted_items
            ]
            
        return final_result
    except Exception as e:
        print(f"ERROR in _calculate_bad_product_breakdown: {e}")
        return {"cancelled": [], "bomb": [], "refunded": []}

def _calculate_location_distribution(
    orders: List[models.Order], 
    revenue_map: Dict[str, float] = None,
    refund_status_map: Dict[str, bool] = None,
    db_session: Session = None
) -> List[Dict]:
    """
    [REFACTORED] Tính phân bổ địa lý.
    Lấy dữ liệu địa chỉ từ Order.details, chuẩn hóa và tổng hợp số liệu.
    """
    if not orders:
        return []

    province_stats = {}
    revenue_map = revenue_map or {}
    refund_status_map = refund_status_map or {}

    for order in orders:
        # 1. Lấy province từ details
        details = order.details or {}
        raw_province = details.get('province')
        if not raw_province:
            continue

        # 2. Chuẩn hóa tên tỉnh thành theo mapping 34 tỉnh
        normalized_province = get_new_province_name(raw_province)
        if not normalized_province:
            continue

        # 3. Phân loại trạng thái đơn hàng (completed, cancelled, bomb, refunded...)
        status_cat = _classify_order_status(order, refund_status_map.get(order.order_code, False))
        
        # 4. Xác định doanh thu thực tế (Ưu tiên net_revenue từ map, fallback gmv)
        revenue = revenue_map.get(order.order_code, 0)

        # 5. Khởi tạo dữ liệu cho tỉnh nếu chưa có
        if normalized_province not in province_stats:
            coords = PROVINCE_CENTROIDS.get(normalized_province, [None, None])
            province_stats[normalized_province] = {
                "province": normalized_province,
                "latitude": coords[1], # Vị trí 1 trong centroids là Latitude
                "longitude": coords[0], # Vị trí 0 trong centroids là Longitude
                "orders": 0,
                "revenue": 0,
                "metrics": defaultdict(lambda: {"orders": 0, "revenue": 0}),
                "districts": defaultdict(lambda: {"orders": 0, "revenue": 0})
            }

        # 6. Cộng dồn số liệu tổng quát và chi tiết theo status và district
        stats = province_stats[normalized_province]
        stats["orders"] += 1
        stats["revenue"] += revenue
        stats["metrics"][status_cat]["orders"] += 1
        stats["metrics"][status_cat]["revenue"] += revenue

        # Thêm thông tin district (nếu có)
        raw_district = details.get('district')
        if raw_district:
            # Có thể thêm chuẩn hóa district ở đây nếu cần, hiện tại giữ nguyên bản
            stats["districts"][raw_district]["orders"] += 1
            stats["districts"][raw_district]["revenue"] += revenue

    # 7. Chuyển đổi sang danh sách và định dạng lại kết quả
    results = []
    for prov, data in province_stats.items():
        # Làm sạch defaultdict sang dict thường để lưu JSONB
        data["metrics"] = {k: dict(v) for k, v in data["metrics"].items()}
        data["districts"] = {k: dict(v) for k, v in data["districts"].items()}
        results.append(data)

    # Sắp xếp theo thứ tự tỉnh có nhiều đơn nhất
    results.sort(key=lambda x: x['orders'], reverse=True)
    return results

def _calculate_customer_retention(orders: List[models.Order], current_date: date, db_session: Session, gmv_map: Dict[str, float] = None) -> Dict:
    stats = {"new_customers": 0, "returning_customers": 0, "new_customer_revenue": 0.0, "returning_customer_revenue": 0.0}
    if not orders or not db_session: return stats
    usernames_today = {o.username for o in orders if o.username}
    if not usernames_today: return stats
    
    # Use provided map or empty dict
    gmv_lookup = gmv_map or {}

    try:
        existing_customers_query = db_session.query(models.Order.username).filter(
            models.Order.username.in_(usernames_today),
            models.Order.order_date < datetime.combine(current_date, datetime.min.time())
        ).distinct()
        existing_usernames = {row[0] for row in existing_customers_query.all()}
        counted_new_users = set(); counted_returning_users = set()
        for order in orders:
            if not order.username: continue
            
            # Use GMV from map, fallback to 0 (order.gmv is deprecated)
            gmv = gmv_lookup.get(order.order_code, 0)
            
            if order.username in existing_usernames:
                stats["returning_customer_revenue"] += gmv
                if order.username not in counted_returning_users:
                    stats["returning_customers"] += 1
                    counted_returning_users.add(order.username)
            else:
                stats["new_customer_revenue"] += gmv
                if order.username not in counted_new_users:
                    stats["new_customers"] += 1
                    counted_new_users.add(order.username)
    except Exception as e: print(f"Error calculating customer retention: {e}")
    return stats

def _calculate_payment_method_breakdown(orders: List[models.Order]) -> Dict[str, int]:
    method_counts = defaultdict(int)
    for order in orders:
        if order.details and isinstance(order.details, dict):
            raw_method = order.details.get('payment_method')
            if raw_method:
                method_text = unidecode(str(raw_method)).lower().strip()
                found_group = False
                for group_name, keywords in PAYMENT_METHOD_MAPPING.items():
                    for kw in keywords:
                        if kw in method_text:
                            method_counts[group_name] += 1
                            found_group = True
                            break
                    if found_group: break
                if not found_group: method_counts["Khác"] += 1
    return dict(method_counts)

def _calculate_repurchase_cycle(
    orders: List[models.Order], 
    date_to_calculate: date, 
    db_session: Session
) -> float:
    """
    Tính chu kỳ mua lại trung bình (Average Repurchase Cycle) trong ngày.
    Chỉ tính trên các đơn hàng THÀNH CÔNG của KHÁCH QUAY LẠI.
    """
    if not orders or not db_session: return 0.0

    # 1. Lọc ra các đơn thành công trong ngày
    # Reuse logic lọc cơ bản để tránh phụ thuộc phức tạp
    success_orders = [
        o for o in orders 
        if o.username 
        and not _matches_keywords(o.status, ORDER_STATUS_KEYWORDS["cancel_status"])
        and not _matches_keywords(o.status, ORDER_STATUS_KEYWORDS["bomb_status"])
    ]
    
    if not success_orders: return 0.0
    
    target_usernames = list({o.username for o in success_orders})
    if not target_usernames: return 0.0
    
    # 2. Tìm ngày mua gần nhất trước đó của các user này
    # Query: SELECT username, MAX(order_date) FROM orders WHERE username IN (...) AND date < current_date GROUP BY username
    try:
        prev_orders_query = db_session.query(
            models.Order.username,
            func.max(models.Order.order_date)
        ).filter(
            models.Order.username.in_(target_usernames),
            models.Order.order_date < datetime.combine(date_to_calculate, datetime.min.time()),
            # Filter đơn thành công quá khứ
            get_active_order_filters(models.Order)
        ).group_by(models.Order.username).all()
        
        prev_date_map = {row[0]: row[1] for row in prev_orders_query}
        
        cycles = []
        for order in success_orders:
            prev_date = prev_date_map.get(order.username)
            if prev_date and order.order_date:
                diff = (order.order_date - prev_date).days
                # Chỉ tính nếu diff hợp lệ (>= 0). 0 ngày có thể do mua 2 đơn cùng ngày -> Vẫn tính là 0 để phản ánh tần suất cao
                if diff >= 0:
                    cycles.append(diff)
                    
        if not cycles: return 0.0
        
        return sum(cycles) / len(cycles)
    except Exception as e:
        print(f"Error calculating repurchase cycle: {e}")
        return 0.0

# ==============================================================================
# HÀM CHÍNH CHO WORKER (Hợp nhất Bước 3 luôn)
# ==============================================================================

def _calculate_churn_rate(
    date_to_calculate: date, 
    db_session: Session,
    brand_id: int,
    source: str = None,
    churn_days: int = 90
) -> float:
    """
    Tính tỷ lệ rời bỏ (Churn Rate).
    Churn Rate = (Số khách hàng rời bỏ / Tổng số khách hàng từng hoạt động) * 100
    Khách hàng rời bỏ: Là khách từng mua thành công trước đây, nhưng không có đơn nào trong 'churn_days' vừa qua.
    
    Cập nhật: Hỗ trợ lọc theo brand_id và source.
    """
    if not db_session or not brand_id: return 0.0
    
    try:
        churn_threshold_date = datetime.combine(date_to_calculate - timedelta(days=churn_days), datetime.min.time())
        end_date_time = datetime.combine(date_to_calculate, datetime.max.time())
        
        # Helper build query
        def build_cust_query(date_filter_condition):
            q = db_session.query(
                func.count(func.distinct(models.Order.username))
            ).filter(
                models.Order.brand_id == brand_id,
                date_filter_condition,
                get_active_order_filters(models.Order)
            )
            if source:
                q = q.filter(models.Order.source == source)
            return q

        # 1. Tổng số khách hàng từng mua thành công tính đến thời điểm xem xét
        total_active_customers = build_cust_query(
            models.Order.order_date < end_date_time
        ).scalar() or 0
        
        if total_active_customers == 0: return 0.0
        
        # 2. Số khách hàng CÓ phát sinh đơn trong churn_days vừa qua
        customers_with_recent_orders = build_cust_query(
            (models.Order.order_date >= churn_threshold_date) & 
            (models.Order.order_date < end_date_time)
        ).scalar() or 0
        
        # 3. Số khách rời bỏ = Tổng khách - Khách có đơn gần đây
        churned_customers = total_active_customers - customers_with_recent_orders
        
        if churned_customers < 0: churned_customers = 0
        
        return (churned_customers / total_active_customers) * 100
    except Exception as e:
        print(f"Error calculating churn rate: {e}")
        return 0.0

def calculate_daily_kpis(
    orders_in_day: List[models.Order], 
    revenues_in_day: List[models.Revenue],
    marketing_spends: List[models.MarketingSpend],
    creation_date_order_codes: Set[str],
    date_to_calculate: date,
    db_session: Session = None,
    brand_id: int = None,
    source: str = None
) -> dict:
    """
    Tính toán KPI cho MỘT ngày. 
    Hợp nhất: Sử dụng hàm calculate_derived_metrics để tính tỷ lệ.
    """
    try:
        # Nếu không truyền brand_id, cố gắng lấy từ orders (Fallback)
        if not brand_id and orders_in_day:
            brand_id = orders_in_day[0].brand_id

        # 1. Sàng lọc dữ liệu mục tiêu
        target_orders = [o for o in orders_in_day if o.order_code in creation_date_order_codes]
        valid_revenues = [r for r in revenues_in_day if r.order_code in creation_date_order_codes]
        
        # --- BƯỚC 2: SINGLE PASS CALCULATION (GOM NHÓM TÍNH TOÁN) ---
        # Khởi tạo biến cộng dồn
        sums = {
            "subsidy_amount": 0, "total_quantity_sold": 0,
            "cogs": 0, "proc_time": 0, "proc_count": 0, "ship_time": 0, "ship_count": 0
        }
        counters = {"completed": 0, "cancelled": 0, "bomb": 0, "refunded": 0}
        unique_skus = set()

        # Chuẩn bị Map cho Refund (Do phụ thuộc bảng Revenues, không phải Orders)
        rev_summary = defaultdict(lambda: {"net": 0.0, "refund": 0.0})
        for r in valid_revenues:
            rev_summary[r.order_code]["net"] += (r.net_revenue or 0)
            rev_summary[r.order_code]["refund"] += (r.refund or 0)

        # Logic xác định đơn hoàn tiền (Refunded)
        order_has_refund = {
            code: True 
            for code, val in rev_summary.items() 
            if val["refund"] < -0.1 and val["net"] < -0.1 
        }

        # VÒNG LẶP CHÍNH (Duyệt Orders 1 lần duy nhất)
        for o in target_orders:
            # 2.1. Cộng dồn doanh thu/số lượng cơ bản
            sums["subsidy_amount"] += (o.subsidy_amount or 0)
            sums["total_quantity_sold"] += (o.total_quantity or 0)
            
            # 2.2. Lấy Unique SKUs
            if o.details and isinstance(o.details.get('items'), list):
                for item in o.details['items']:
                    if item.get('sku'): unique_skus.add(item['sku'])

            # 2.3. Phân loại trạng thái (Status Classification)
            cat = _classify_order_status(o, order_has_refund.get(o.order_code, False))
            if cat in counters: 
                counters[cat] += 1
            
            # 2.4. Tính Giá vốn (COGS) - Chỉ tính cho đơn không bị Hủy/Bom/Hoàn
            if cat not in ['cancelled', 'bomb', 'refunded']:
                sums["cogs"] += (o.cogs or 0)

            # 2.5. Tính thời gian vận hành (Processing Time)
            if o.shipped_time and o.order_date:
                diff = (o.shipped_time - o.order_date).total_seconds() / 3600
                if diff > 0: 
                    sums["proc_time"] += diff
                    sums["proc_count"] += 1
            
            # 2.6. Tính thời gian giao hàng (Shipping Time)
            if o.delivered_date and o.shipped_time:
                diff = (o.delivered_date - o.shipped_time).total_seconds() / 86400
                if diff > 0: 
                    sums["ship_time"] += diff
                    sums["ship_count"] += 1

        # --- BƯỚC 3: TỔNG HỢP KẾT QUẢ ---
        data = {
            # Từ vòng lặp Orders
            "subsidy_amount": sums["subsidy_amount"],
            "total_quantity_sold": sums["total_quantity_sold"],
            "unique_skus_sold": len(unique_skus),
            "completed_orders": counters["completed"],
            "cancelled_orders": counters["cancelled"],
            "refunded_orders": counters["refunded"],
            "bomb_orders": counters["bomb"],
            "cogs": sums["cogs"],
            "_sum_processing_time": sums["proc_time"],
            "_count_processing": sums["proc_count"],
            "_sum_shipping_time": sums["ship_time"],
            "_count_shipping": sums["ship_count"],

            # Từ bảng Revenues (Aggregated)
            "gmv": sum((r.gmv or 0) for r in valid_revenues),
            "net_revenue": sum(r.net_revenue for r in valid_revenues),
            "execution_cost": abs(sum(r.total_fees for r in valid_revenues)),
            
            # Từ bảng Marketing Spends
            "ad_spend": sum(m.ad_spend for m in marketing_spends),
            "impressions": sum(m.impressions for m in marketing_spends),
            "clicks": sum(m.clicks for m in marketing_spends),
            "conversions": sum(m.conversions for m in marketing_spends),
            "reach": sum(m.reach for m in marketing_spends),
            
            "total_orders": len(target_orders),
        }

        # Tính Total Cost & Profit
        data["total_cost"] = data["cogs"] + data["ad_spend"] + data["execution_cost"]
        data["profit"] = data["net_revenue"] - data["cogs"] - data["ad_spend"]

        # 6. GỌI HÀM CÔNG THỨC CHUNG (Hợp nhất logic)
        data = calculate_derived_metrics(data)

        # 7. Tính các trường JSONB
        # Lọc danh sách đơn thành công để tính phương thức thanh toán (Loại bỏ Hủy/Bom/Hoàn)
        success_orders = [o for o in target_orders if _classify_order_status(o, order_has_refund.get(o.order_code, False)) == 'completed']
        
        data["hourly_breakdown"] = _calculate_hourly_breakdown(target_orders)
        data["top_products"] = _calculate_top_products(target_orders)
        # Sử dụng hàm mới tách biệt 3 loại sản phẩm xấu
        data["top_refunded_products"] = _calculate_bad_product_breakdown(target_orders, order_has_refund)
        data["payment_method_breakdown"] = _calculate_payment_method_breakdown(success_orders)
        data["cancel_reason_breakdown"] = _calculate_cancel_reason_breakdown(target_orders)
        
        # Prepare maps for location calculation
        rev_map = defaultdict(float)
        gmv_map = defaultdict(float)
        
        for r in valid_revenues:
            if r.order_code:
                rev_map[r.order_code] += r.net_revenue
                gmv_map[r.order_code] += (r.gmv or 0)
        
        data["location_distribution"] = _calculate_location_distribution(
            target_orders, 
            revenue_map=rev_map,
            refund_status_map=order_has_refund,
            db_session=db_session
        )
        
        # 8. Nhật ký tài chính
        financial_events = []
        for r in valid_revenues:
            evt_type = "income"
            if r.refund < 0: evt_type = "refund"
            elif r.net_revenue < 0: evt_type = "deduction"
            elif r.total_fees > 0: evt_type = "fee"
            if r.net_revenue != 0 or evt_type == "refund":
                financial_events.append({"date": str(r.transaction_date), "type": evt_type, "amount": r.net_revenue, "order_code": r.order_code, "note": f"Source: {r.source}"})
        data["financial_events"] = financial_events

        # 9. Khách hàng mới/cũ
        if db_session:
            data.update(_calculate_customer_retention(target_orders, date_to_calculate, db_session, gmv_map=gmv_map))
            data["total_customers"] = len({o.username for o in target_orders if o.username})
            
            # --- TÍNH TOÁN CHU KỲ MUA LẠI TRUNG BÌNH ---
            data["avg_repurchase_cycle"] = _calculate_repurchase_cycle(target_orders, date_to_calculate, db_session)
            
            # --- TÍNH TOÁN TỶ LỆ RỜI BỎ (CHURN RATE) ---
            # Truyền brand_id và source để tính chính xác ngữ cảnh
            data["churn_rate"] = _calculate_churn_rate(date_to_calculate, db_session, brand_id, source)
            
            # --- TÍNH TOÁN PHÂN BỔ TẦN SUẤT (Frequency Distribution) ---
            try:
                # 1. Lọc đơn thành công trong ngày (dựa vào map order_has_refund đã tính ở trên)
                success_orders_today = [
                    o for o in target_orders 
                    if _classify_order_status(o, order_has_refund.get(o.order_code, False)) == 'completed' 
                    and o.username
                ]
                
                if success_orders_today:
                    # Sắp xếp theo thời gian để xác định thứ tự trong ngày
                    success_orders_today.sort(key=lambda x: x.order_date or getattr(x, 'id', 0))
                    
                    target_usernames = {o.username for o in success_orders_today}
                    
                    # 2. Query số lượng đơn thành công trong QUÁ KHỨ (Trước ngày tính toán)
                    # Sử dụng text search đơn giản cho status để tối ưu
                    past_counts_query = db_session.query(
                        models.Order.username, 
                        func.count(models.Order.id)
                    ).filter(
                        models.Order.username.in_(target_usernames),
                        models.Order.order_date < datetime.combine(date_to_calculate, datetime.min.time()),
                        # Filter đơn thành công (Không phải Hủy/Bom/Hoàn/Fail)
                        get_active_order_filters(models.Order),
                        ~models.Order.status.ilike('%hoan%')
                    ).group_by(models.Order.username)
                    
                    past_counts_map = {r[0]: r[1] for r in past_counts_query.all()}
                    
                    freq_dist = defaultdict(int)
                    current_day_counts = defaultdict(int) 
                    
                    for order in success_orders_today:
                        user = order.username
                        past_count = past_counts_map.get(user, 0)
                        
                        # Thứ tự mua hàng = Đã mua quá khứ + Đã mua trước đó trong ngày + 1 (đơn hiện tại)
                        nth_purchase = past_count + current_day_counts[user] + 1
                        
                        freq_dist[str(nth_purchase)] += 1
                        current_day_counts[user] += 1
                        
                    data["frequency_distribution"] = dict(freq_dist)
                else:
                    data["frequency_distribution"] = {}
            except Exception as e:
                print(f"Error calculating frequency_distribution: {e}")
                data["frequency_distribution"] = {}

            # --- TÍNH PHÂN KHÚC KHÁCH HÀNG (Mới) ---
            data["customer_segment_distribution"] = _calculate_customer_segment_distribution(
                target_orders, date_to_calculate, db_session
            )

        return data
    except Exception as e:
        print(f"CORE CALCULATOR ERROR: {e}")
        return {}