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
    "bomb_status": ["fail", "return", "tra hang", "chuyen hoan", "that bai", "khong thanh cong", "khong nhan", "tu choi"],
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
        "thay doi", "change", "dia chi", "address", "sdt", "so dien thoai",
        "voucher", "ma giam gia", "coupon", "khuyen mai", "nhap quen", "forgot code",
        "san pham", "product", "mau sac", "kich thuoc", "size", "color", 
        "gop don", "tach don"
    ],
    "Giá / Tìm được rẻ hơn": [
        "gia tot hon", "re hon", "gia cao", "dat qua", 
        "price", "tim duoc cho khac", "cheaper", "phi ship", "shipping fee", 
        "cuoc van chuyen"
    ],
    "Vấn đề Thanh toán": [
        "thanh toan", "payment", "pay", "the tin dung", 
        "banking", "chuyen khoan", "cod", "payment method", 
        "vi dien tu", "rac roi", "error", "loi thanh toan"
    ],
    "Vấn đề Vận chuyển (Chậm/Lâu)": [
        "giao cham", "ship cham", "lau qua", "thoi gian", "time", 
        "nguoi ban gui", "seller", "delivery", "tre han", "delay", 
        "chuan bi hang"
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
                    'orders': 0, 
                    'revenue': 0,
                    'latitude': item.get('latitude'),
                    'longitude': item.get('longitude')
                }
            
            city_map[city]['orders'] += (item.get('orders') or 0)
            city_map[city]['revenue'] += (item.get('revenue') or 0)
            
            if city_map[city]['latitude'] is None and item.get('latitude'):
                 city_map[city]['latitude'] = item.get('latitude')
                 city_map[city]['longitude'] = item.get('longitude')
                 
    results = list(city_map.values())
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
    aggregated['top_refunded_products'] = merge_top_products_list(refund_product_lists)
    aggregated['payment_method_breakdown'] = merge_json_counters(payment_jsons)
    aggregated['location_distribution'] = merge_location_lists(location_lists)

    return aggregated

# ==============================================================================
# PHẦN 2: LOGIC XỬ LÝ DỮ LIỆU THÔ (Dời từ kpi_calculator sang)
# ==============================================================================

def _matches_keywords(text: str, keywords: List[str]) -> bool:
    if not text: return False
    normalized_text = unidecode(str(text)).lower()
    return any(kw in normalized_text for kw in keywords)

def _classify_order_status(order: models.Order, total_refund: float) -> str:
    if total_refund < 0: return 'refunded'
    status = order.status or ""
    reason = order.details.get('cancel_reason', '') if order.details and isinstance(order.details, dict) else ""
    if (_matches_keywords(status, ORDER_STATUS_KEYWORDS["cancel_status"]) and _matches_keywords(reason, BOMB_REASON_KEYWORDS)) or \
       _matches_keywords(status, ORDER_STATUS_KEYWORDS["bomb_status"]):
        return 'bomb'
    if _matches_keywords(status, ORDER_STATUS_KEYWORDS["cancel_status"]): return 'cancelled'
    if _matches_keywords(status, ORDER_STATUS_KEYWORDS["success_status"]): return 'completed'
    return 'other'

def _calculate_cancel_reason_breakdown(orders: List[models.Order]) -> Dict[str, int]:
    reason_counts = defaultdict(int)
    for order in orders:
        is_cancelled = order.status and order.status.lower().strip() in CANCELLED_STATUSES
        if not is_cancelled: continue
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

def _calculate_top_refunded_products(orders: List[models.Order], revenues: List[models.Revenue], limit=10) -> List[Dict]:
    refunded_skus = defaultdict(int); product_names = {}; bad_orders_map = {}
    for r in revenues:
        if r.refund < 0 and r.order_code: bad_orders_map[r.order_code] = True
    for order in orders:
        if order.order_code in bad_orders_map: continue
        status_lower = unidecode(str(order.status or "")).lower()
        if any(kw in status_lower for kw in ORDER_STATUS_KEYWORDS["bomb_status"] + ORDER_STATUS_KEYWORDS["cancel_status"]):
            bad_orders_map[order.order_code] = True
    for order in orders:
        if bad_orders_map.get(order.order_code):
            if order.details and isinstance(order.details.get('items'), list):
                for item in order.details['items']:
                    sku = item.get('sku')
                    if sku:
                        refunded_skus[sku] += int(item.get('quantity', 0))
                        if sku not in product_names: product_names[sku] = item.get('name', sku)
    sorted_refunds = sorted(refunded_skus.items(), key=lambda x: x[1], reverse=True)[:limit]
    return [{"sku": sku, "name": product_names.get(sku, sku), "value": qty} for sku, qty in sorted_refunds]

def _calculate_location_distribution(orders: List[models.Order], db_session: Session = None) -> List[Dict]:
    if not db_session or not orders: return []
    city_stats = defaultdict(lambda: {"orders": 0, "revenue": 0})
    usernames = {o.username for o in orders if o.username}
    if not usernames: return []
    try:
        customers = db_session.query(models.Customer.username, models.Customer.city).filter(models.Customer.username.in_(usernames)).all()
        user_city_map = {c.username: c.city for c in customers if c.city}
        for order in orders:
            if order.username in user_city_map:
                city = user_city_map[order.username]
                city_stats[city]["orders"] += 1
        results = []
        for city, data in city_stats.items():
            coords = PROVINCE_CENTROIDS.get(city)
            if coords: results.append({"city": city, "orders": data["orders"], "revenue": data["revenue"], "longitude": coords[0], "latitude": coords[1]})
        return sorted(results, key=lambda x: x["orders"], reverse=True)
    except Exception as e: print(f"Warning: Could not calculate location distribution: {e}")
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
        order_has_refund = {r.order_code: True for r in valid_revenues if r.refund < 0}
        counters = {"completed": 0, "cancelled": 0, "bomb": 0, "refunded": 0}
        for order in target_orders:
            cat = _classify_order_status(order, -1 if order_has_refund.get(order.order_code) else 0)
            if cat in counters: counters[cat] += 1
        
        data.update({
            "completed_orders": counters["completed"],
            "cancelled_orders": counters["cancelled"],
            "refunded_orders": counters["refunded"],
            "bomb_orders": counters["bomb"]
        })

        # 4. Tính Giá vốn (COGS) - Chỉ tính cho đơn không bị Hủy/Hoàn
        bad_codes = {o.order_code for o in target_orders if _classify_order_status(o, -1 if order_has_refund.get(o.order_code) else 0) in ['cancelled', 'bomb', 'refunded']}
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
        success_orders = [o for o in target_orders if _classify_order_status(o, -1 if order_has_refund.get(o.order_code) else 0) == 'completed']
        
        data["hourly_breakdown"] = _calculate_hourly_breakdown(target_orders)
        data["top_products"] = _calculate_top_products(target_orders)
        data["top_refunded_products"] = _calculate_top_refunded_products(orders_in_day, revenues_in_day)
        data["payment_method_breakdown"] = _calculate_payment_method_breakdown(success_orders)
        data["cancel_reason_breakdown"] = _calculate_cancel_reason_breakdown(target_orders)
        data["location_distribution"] = _calculate_location_distribution(target_orders, db_session)
        
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