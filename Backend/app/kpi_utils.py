from typing import List, Dict, Any, Tuple, Optional, Set
from datetime import date, datetime
from collections import defaultdict
from unidecode import unidecode
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
from province_centroids import PROVINCE_CENTROIDS

# Constants cho chiến lược Query
STRATEGY_ALL = "ALL"          # Query bảng DailyStat
STRATEGY_FILTERED = "FILTERED" # Query bảng DailyAnalytics
STRATEGY_EMPTY = "EMPTY"      # Không query, trả về rỗng

# Constants cho phân loại đơn hàng (Dời từ kpi_calculator)
CANCELLED_STATUSES = {'hủy', 'cancel', 'đã hủy', 'cancelled'}

ORDER_STATUS_KEYWORDS = {
    "bomb_status": ["fail", "chuyen hoan", "that bai", "khong thanh cong", "khong nhan", "tu choi", "khong lien lac", "thue bao", "tu choi", "khong nghe may", "boom hang", "bom hang", "contact failed"],
    "cancel_status": ["huy", "cancel"],
    "success_status": ["hoan thanh", "complete", "deliver", "success", "da nhan", "thanh cong", "da giao", "giao thanh cong", "shipped", "finish", "done", "hoan tat"]
}

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
    city_map = {}
    
    for loc_list in lists_of_locations:
        if not loc_list or not isinstance(loc_list, list): continue
        for item in loc_list:
            city = item.get('city')
            if not city: continue
            
            if city not in city_map:
                city_map[city] = {
                    'city': city,
                    'latitude': item.get('latitude'),
                    'longitude': item.get('longitude'),
                    'metrics': defaultdict(lambda: {"orders": 0, "revenue": 0}),
                    # Legacy fields aggregation
                    'orders': 0, 'revenue': 0 
                }
            
            # 1. Merge Metrics (Format Mới)
            item_metrics = item.get('metrics')
            if item_metrics and isinstance(item_metrics, dict):
                for status, val in item_metrics.items():
                    city_map[city]['metrics'][status]['orders'] += val.get('orders', 0)
                    city_map[city]['metrics'][status]['revenue'] += val.get('revenue', 0)
            
            # 2. Merge Legacy Fields (Cho dữ liệu cũ chưa có metrics)
            city_map[city]['orders'] += (item.get('orders') or 0)
            city_map[city]['revenue'] += (item.get('revenue') or 0)
            
            if city_map[city]['latitude'] is None and item.get('latitude'):
                 city_map[city]['latitude'] = item.get('latitude')
                 city_map[city]['longitude'] = item.get('longitude')

    results = []
    for city, data in city_map.items():
        # Clean up defaultdict
        metrics_clean = {k: dict(v) for k, v in data["metrics"].items()}
        data["metrics"] = metrics_clean
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
        "impressions": 0, "clicks": 0, "conversions": 0, "reach": 0,
        "hourly_breakdown": [], "cancel_reason_breakdown": [], "top_refunded_products": [],
        "payment_method_breakdown": [], "location_distribution": [],
        "_sum_processing_time": 0, "_sum_shipping_time": 0, "_count_processing": 0, "_count_shipping": 0
    }
    
    hourly_jsons = []
    cancel_jsons = []
    refund_product_lists = []
    payment_jsons = []
    location_lists = []

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

        if item.get('hourly_breakdown'): hourly_jsons.append(item['hourly_breakdown'])
        if item.get('cancel_reason_breakdown'): cancel_jsons.append(item['cancel_reason_breakdown'])
        if item.get('top_refunded_products'): refund_product_lists.append(item['top_refunded_products'])
        if item.get('payment_method_breakdown'): payment_jsons.append(item['payment_method_breakdown'])
        if item.get('location_distribution'): location_lists.append(item['location_distribution'])

    aggregated['hourly_breakdown'] = merge_json_counters(hourly_jsons)
    aggregated['cancel_reason_breakdown'] = merge_json_counters(cancel_jsons)
    # Sử dụng hàm merge cấu trúc mới (Dict lồng nhau) thay vì hàm merge list cũ
    aggregated['top_refunded_products'] = merge_product_breakdown_structure(refund_product_lists)
    aggregated['payment_method_breakdown'] = merge_json_counters(payment_jsons)
    aggregated['location_distribution'] = merge_location_lists(location_lists)

    return aggregated

# ==============================================================================
# PHẦN 2: LOGIC XỬ LÝ DỮ LIỆU THÔ
# ==============================================================================

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
        
    # Ưu tiên 5: CÒN LẠI (An toàn)
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
                    product_stats[sku]["quantity"] += int(item.get('quantity', 0))
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
    revenue_map: Dict[str, float] = None, # Key: order_code, Value: net_revenue
    refund_status_map: Dict[str, bool] = None, # Key: order_code, Value: has_refund
    db_session: Session = None
) -> List[Dict]:
    if not db_session or not orders: return []
    
    # Structure: City -> { lat, lon, metrics: { status: { orders, revenue } } }
    city_stats = defaultdict(lambda: {
        "latitude": None, "longitude": None,
        "metrics": defaultdict(lambda: {"orders": 0, "revenue": 0})
    })

    usernames = {o.username for o in orders if o.username}
    if not usernames: return []

    try:
        customers = db_session.query(models.Customer.username, models.Customer.city).filter(models.Customer.username.in_(usernames)).all()
        user_city_map = {c.username: c.city for c in customers if c.city}
        
        for order in orders:
            if order.username in user_city_map:
                city = user_city_map[order.username]
                
                # Xác định Status
                is_refunded = refund_status_map.get(order.order_code, False) if refund_status_map else False
                status = _classify_order_status(order, is_refunded)
                
                # Xác định Revenue
                rev = revenue_map.get(order.order_code, 0) if revenue_map else 0
                
                # Cộng dồn
                city_stats[city]["metrics"][status]["orders"] += 1
                city_stats[city]["metrics"][status]["revenue"] += rev
                
                # Lấy tọa độ (chỉ cần lấy 1 lần)
                if city_stats[city]["latitude"] is None:
                    coords = PROVINCE_CENTROIDS.get(city)
                    if coords:
                        city_stats[city]["latitude"] = coords[1]
                        city_stats[city]["longitude"] = coords[0]

        results = []
        for city, data in city_stats.items():
            if data["latitude"] is None: continue # Skip if no coords
            
            # Tính tổng metrics để sort (mặc định sort theo Completed Orders)
            total_orders = sum(m["orders"] for m in data["metrics"].values())
            
            # Convert metrics dict to standard dict for JSON serialization
            metrics_clean = {k: dict(v) for k, v in data["metrics"].items()}
            
            results.append({
                "city": city,
                "metrics": metrics_clean,
                "longitude": data["longitude"],
                "latitude": data["latitude"],
                # Giữ lại các trường legacy để tương thích ngược tạm thời (hoặc hiển thị nhanh)
                "orders": total_orders, 
                "revenue": sum(m["revenue"] for m in data["metrics"].values())
            })
            
        return sorted(results, key=lambda x: x["orders"], reverse=True)
    except Exception as e: 
        print(f"Warning: Could not calculate location distribution: {e}")
        return []

def _calculate_customer_retention(orders: List[models.Order], current_date: date, db_session: Session) -> Dict:
    stats = {"new_customers": 0, "returning_customers": 0, "new_customer_revenue": 0.0, "returning_customer_revenue": 0.0}
    if not orders or not db_session: return stats
    usernames_today = {o.username for o in orders if o.username}
    if not usernames_today: return stats
    try:
        existing_customers_query = db_session.query(models.Order.username).filter(
            models.Order.username.in_(usernames_today),
            models.Order.order_date < datetime.combine(current_date, datetime.min.time())
        ).distinct()
        existing_usernames = {row[0] for row in existing_customers_query.all()}
        counted_new_users = set(); counted_returning_users = set()
        for order in orders:
            if not order.username: continue
            gmv = order.gmv or 0
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

# ==============================================================================
# HÀM CHÍNH CHO WORKER (Hợp nhất Bước 3 luôn)
# ==============================================================================

def calculate_daily_kpis(
    orders_in_day: List[models.Order], 
    revenues_in_day: List[models.Revenue],
    marketing_spends: List[models.MarketingSpend],
    creation_date_order_codes: Set[str],
    date_to_calculate: date,
    db_session: Session = None
) -> dict:
    """
    Tính toán KPI cho MỘT ngày. 
    Hợp nhất: Sử dụng hàm calculate_derived_metrics để tính tỷ lệ.
    """
    try:
        # 1. Sàng lọc dữ liệu mục tiêu
        target_orders = [o for o in orders_in_day if o.order_code in creation_date_order_codes]
        valid_revenues = [r for r in revenues_in_day if r.order_code in creation_date_order_codes]
        
        # 2. Tính toán số liệu thô (Sum)
        data = {
            "provisional_revenue": sum((o.selling_price or 0) for o in target_orders),
            "subsidy_amount": sum((o.subsidy_amount or 0) for o in target_orders),
            "gmv": sum((r.gmv or 0) for r in valid_revenues),
            "net_revenue": sum(r.net_revenue for r in valid_revenues),
            "execution_cost": abs(sum(r.total_fees for r in valid_revenues)),
            "ad_spend": sum(m.ad_spend for m in marketing_spends),
            "total_orders": len(target_orders),
            "total_quantity_sold": sum((o.total_quantity or 0) for o in target_orders),
            "impressions": sum(m.impressions for m in marketing_spends),
            "clicks": sum(m.clicks for m in marketing_spends),
            "conversions": sum(m.conversions for m in marketing_spends),
            "reach": sum(m.reach for m in marketing_spends),
            "unique_skus_sold": len(set(item['sku'] for o in target_orders if o.details and o.details.get('items') for item in o.details['items'] if item.get('sku')))
        }

        # 3. Xử lý trạng thái vận hành
        # Tính tổng Net Revenue và Refund theo từng Order Code để xác định chính xác Đơn Hoàn
        rev_summary = defaultdict(lambda: {"net": 0.0, "refund": 0.0})
        for r in valid_revenues:
            rev_summary[r.order_code]["net"] += (r.net_revenue or 0)
            rev_summary[r.order_code]["refund"] += (r.refund or 0)

        # Chỉ những đơn có Refund âm VÀ Net Revenue âm mới được coi là Đơn Hoàn (Refunded)
        # Những đơn Refund âm nhưng Net = 0 thường là đơn Hủy (đã được lọc ở bước Status Hủy)
        order_has_refund = {
            code: True 
            for code, val in rev_summary.items() 
            if val["refund"] < -0.1 and val["net"] < -0.1 # Dùng -0.1 để tránh lỗi float rounding
        }

        counters = {"completed": 0, "cancelled": 0, "bomb": 0, "refunded": 0}
        for order in target_orders:
            cat = _classify_order_status(order, order_has_refund.get(order.order_code, False))
            if cat in counters: counters[cat] += 1
        
        data.update({
            "completed_orders": counters["completed"],
            "cancelled_orders": counters["cancelled"],
            "refunded_orders": counters["refunded"],
            "bomb_orders": counters["bomb"]
        })

        # 4. Tính Giá vốn (COGS) - Chỉ tính cho đơn không bị Hủy/Hoàn
        bad_codes = {o.order_code for o in target_orders if _classify_order_status(o, order_has_refund.get(o.order_code, False)) in ['cancelled', 'bomb', 'refunded']}
        data["cogs"] = sum((o.cogs or 0) for o in target_orders if o.order_code not in bad_codes)
        
        # --- BỔ SUNG TÍNH TỔNG CHI PHÍ ---
        # Total Cost = COGS + Ad Spend + Execution Cost
        data["total_cost"] = data["cogs"] + data["ad_spend"] + data["execution_cost"]
        
        data["profit"] = data["net_revenue"] - data["cogs"] - data["ad_spend"]

        # 5. Xử lý thời gian vận hành
        t_proc = 0; c_proc = 0; t_ship = 0; c_ship = 0
        for o in target_orders:
            if o.shipped_time and o.order_date:
                diff = (o.shipped_time - o.order_date).total_seconds() / 3600
                if diff > 0: t_proc += diff; c_proc += 1
            if o.delivered_date and o.shipped_time:
                diff = (o.delivered_date - o.shipped_time).total_seconds() / 86400
                if diff > 0: t_ship += diff; c_ship += 1
        
        data["_sum_processing_time"] = t_proc; data["_count_processing"] = c_proc
        data["_sum_shipping_time"] = t_ship; data["_count_shipping"] = c_ship

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
        rev_map = {r.order_code: r.net_revenue for r in valid_revenues}
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
            data.update(_calculate_customer_retention(target_orders, date_to_calculate, db_session))
            data["total_customers"] = len({o.username for o in target_orders if o.username})

        return data
    except Exception as e:
        print(f"CORE CALCULATOR ERROR: {e}")
        return {}