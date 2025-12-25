# FILE: Backend/app/kpi_calculator.py
from datetime import date, datetime
import models
from typing import List, Set, Dict
from collections import defaultdict
from unidecode import unidecode
from sqlalchemy.orm import Session
from sqlalchemy import func
from province_centroids import PROVINCE_CENTROIDS

CANCELLED_STATUSES = {'hủy', 'cancel', 'đã hủy', 'cancelled'}

ORDER_STATUS_KEYWORDS = {
    "bomb_status": ["fail", "return", "tra hang", "chuyen hoan", "that bai", "khong thanh cong", "khong nhan", "tu choi"],
    "cancel_status": ["huy", "cancel"],
    "success_status": ["hoan thanh", "complete", "deliver", "success", "da nhan", "thanh cong"]
}

# Danh sách keyword để phân loại lý do hủy (Đã chuẩn hóa về không dấu, chữ thường)
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
    "Lý do khác": [] # Mặc định nếu không khớp
}

BOMB_REASON_KEYWORDS = CANCEL_REASON_MAPPING.get("Giao thất bại (Bom hàng)", [])

# Mapping phương thức thanh toán (Chuẩn hóa unidecode)
PAYMENT_METHOD_MAPPING = {
    "COD (Thanh toán khi nhận hàng)": [
        "thanh toan khi nhan hang", "thanh toan khi giao hang", 
        "cod", "cash", "tien mat", "pay upon delivery"
    ],
    "Ví điện tử (ShopeePay/Momo/...)": [
        "momo", "zalopay", "vnpay", "shopeepay", "shopee pay", "wallet", 
        "vi dien tu", "airpay", "google pay", "apple pay", "so du tk shopee",
        "tiktok shop balance", "balance", "lien ket shopeepay"
    ],
    "Thẻ / Ngân hàng": [
        "the tin dung", "the ghi no", "credit", "debit", "atm", "napas", 
        "banking", "chuyen khoan", "bank transfer", "visa", "mastercard", "jcb",
        "tk ngan hang"
    ],
    "Mua trước trả sau (SPayLater)": [
        "spaylater", "paylater", "tra sau"
    ],
    "Miễn phí / Khác": [
        "thanh toan duoc mien", "free", "zero cost", "0d"
    ]
}

# --- HÀM HELPER KIỂM TRA TỪ KHÓA ---
def _matches_keywords(text: str, keywords: List[str]) -> bool:
    if not text: return False
    normalized_text = unidecode(str(text)).lower()
    return any(kw in normalized_text for kw in keywords)

def _classify_order_status(order: models.Order, total_refund: float) -> str:
    """
    Phân loại trạng thái đơn hàng dựa trên status text và tổng refund.
    Trả về: 'refunded', 'bomb', 'cancelled', 'completed', hoặc None
    """
    # Check Refund
    if total_refund < 0:
        return 'refunded'
    
    status = order.status or ""
    reason = ""
    if order.details and isinstance(order.details, dict):
        reason = order.details.get('cancel_reason', '')

    # Check Bom (Rule 2)
    # Bom = (Status Hủy/Fail) và (Reason chứa từ khóa bom hàng)
    is_cancel_group = _matches_keywords(status, ORDER_STATUS_KEYWORDS["cancel_status"])
    is_bomb_status_specific = _matches_keywords(status, ORDER_STATUS_KEYWORDS["bomb_status"])
    is_bomb_reason = _matches_keywords(reason, BOMB_REASON_KEYWORDS)

    if (is_cancel_group and is_bomb_reason) or is_bomb_status_specific:
        return 'bomb'
    
    # Check Hủy thường
    if is_cancel_group:
        return 'cancelled'
    
    # Check Thành công
    if _matches_keywords(status, ORDER_STATUS_KEYWORDS["success_status"]):
        return 'completed'
    
    return 'other'

def _calculate_cancel_reason_breakdown(orders: List[models.Order]) -> Dict[str, int]:
    """
    Phân tích lý do hủy đơn hàng dựa trên text 'cancel_reason' trong details.
    Sử dụng unidecode để chuẩn hóa về tiếng Việt không dấu trước khi so khớp.
    """
    reason_counts = defaultdict(int)
    
    for order in orders:
        # Chỉ xét đơn Hủy hoặc Hoàn
        is_cancelled = order.status and order.status.lower().strip() in CANCELLED_STATUSES
        
        # Logic check status đặc biệt nếu cần (ví dụ 'Giao thất bại')
        if not is_cancelled:
            pass 

        if order.details and isinstance(order.details, dict):
            raw_reason = order.details.get('cancel_reason', '')
            if raw_reason:
                # Chuẩn hóa: Unidecode -> Lowercase -> Strip
                # Ví dụ: "Muốn đổi Voucher" -> "muon doi voucher"
                reason_text = unidecode(str(raw_reason)).lower().strip()
                found_group = False
                
                # Quét qua danh sách mapping để gom nhóm
                for group_name, keywords in CANCEL_REASON_MAPPING.items():
                    for kw in keywords:
                        if kw in reason_text:
                            reason_counts[group_name] += 1
                            found_group = True
                            break
                    if found_group: break
                
                if not found_group:
                    # Có thể log lại reason_text lạ để update thêm keyword sau này
                    reason_counts["Lý do khác"] += 1
    
    return dict(reason_counts)

def _calculate_hourly_breakdown(orders: List[models.Order]) -> Dict[str, int]:
    """
    Tính phân bổ số lượng đơn hàng theo giờ (0-23).
    Yêu cầu: order.order_date phải là datetime.
    """
    hourly_counts = defaultdict(int)
    for order in orders:
        if order.order_date and isinstance(order.order_date, datetime):
            hour = str(order.order_date.hour)
            hourly_counts[hour] += 1
    
    # Điền đủ 24h để biểu đồ không bị gãy khúc
    result = {str(h): 0 for h in range(24)}
    result.update(hourly_counts)
    return result

def _calculate_top_products(orders: List[models.Order], limit=10) -> List[Dict]:
    """
    Tìm top sản phẩm bán chạy nhất trong ngày dựa trên order details.
    """
    product_stats = defaultdict(lambda: {"quantity": 0, "revenue": 0, "name": ""})
    
    for order in orders:
        if order.details and isinstance(order.details.get('items'), list):
            for item in order.details['items']:
                sku = item.get('sku')
                if sku:
                    qty = int(item.get('quantity', 0))
                    # Nếu có giá bán trong item thì tính doanh thu, tạm thời tính theo qty trước
                    product_stats[sku]["quantity"] += qty
                    product_stats[sku]["name"] = item.get('name', sku) # Lấy tên hoặc dùng SKU tạm
                    # product_stats[sku]["revenue"] += item.get('price', 0) * qty

    # Sắp xếp theo số lượng bán giảm dần
    sorted_products = sorted(product_stats.items(), key=lambda x: x[1]['quantity'], reverse=True)[:limit]
    
    return [
        {"sku": sku, "name": data["name"], "quantity": data["quantity"], "revenue": data["revenue"]}
        for sku, data in sorted_products
    ]

def _calculate_top_refunded_products(orders: List[models.Order], revenues: List[models.Revenue], limit=10) -> List[Dict]:
    """
    Tính Top sản phẩm bị Hoàn/Hủy/Bom trong ngày.
    Dựa trên:
    1. Status đơn hàng (Hủy, Bom).
    2. Giao dịch hoàn tiền trong bảng Revenue (refund < 0).
    """
    refunded_skus = defaultdict(int)
    product_names = {}

    # 1. Xác định các đơn hàng có vấn đề (Bad Orders)
    # Map order_code -> bool (is_bad)
    bad_orders_map = {}

    # Check từ Revenue (Ưu tiên vì chính xác về tiền bạc)
    for r in revenues:
        if r.refund < 0 and r.order_code:
            bad_orders_map[r.order_code] = True

    # Check từ Order Status
    for order in orders:
        if order.order_code in bad_orders_map:
            continue # Đã xác định là xấu từ revenue rồi
        
        status_lower = unidecode(str(order.status or "")).lower()
        # Dùng lại keywords đã định nghĩa ở trên
        is_bad_status = any(kw in status_lower for kw in ORDER_STATUS_KEYWORDS["bomb_status"] + ORDER_STATUS_KEYWORDS["cancel_status"])
        
        if is_bad_status:
            bad_orders_map[order.order_code] = True

    # 2. Duyệt qua các đơn hàng xấu để đếm SKU
    for order in orders:
        if bad_orders_map.get(order.order_code):
            if order.details and isinstance(order.details.get('items'), list):
                for item in order.details['items']:
                    sku = item.get('sku')
                    if sku:
                        qty = int(item.get('quantity', 0))
                        refunded_skus[sku] += qty
                        # Lưu tên sản phẩm
                        if sku not in product_names:
                            product_names[sku] = item.get('name', sku)

    # 3. Sắp xếp và format
    sorted_refunds = sorted(refunded_skus.items(), key=lambda x: x[1], reverse=True)[:limit]

    return [
        {
            "sku": sku,
            "name": product_names.get(sku, sku),
            "value": qty # Thống nhất key là 'value' cho frontend dễ dùng
        }
        for sku, qty in sorted_refunds
    ]

def _calculate_location_distribution(orders: List[models.Order], db_session: Session = None) -> List[Dict]:
    """
    Tính phân bổ đơn hàng theo tỉnh/thành phố.
    Cần query bảng Customer thông qua username để lấy city.
    """
    if not db_session or not orders:
        return []

    city_stats = defaultdict(lambda: {"orders": 0, "revenue": 0})
    
    # 1. Lấy danh sách username từ orders
    usernames = {o.username for o in orders if o.username}
    if not usernames:
        return []

    # 2. Query bulk thông tin Customer để lấy City
    # SELECT username, city FROM customers WHERE username IN (...)
    try:
        customers = db_session.query(models.Customer.username, models.Customer.city).filter(
            models.Customer.username.in_(usernames)
        ).all()
        
        # Map username -> city
        user_city_map = {c.username: c.city for c in customers if c.city}
        
        # 3. Duyệt lại orders để tính toán
        for order in orders:
            if order.username in user_city_map:
                city = user_city_map[order.username]
                # Chuẩn hóa tên thành phố nếu cần (ví dụ dùng unidecode hoặc mapping)
                # Tạm thời dùng tên gốc từ DB
                
                city_stats[city]["orders"] += 1
                # Giả định doanh thu lấy từ details hoặc tính sau (ở đây tạm tính số đơn trước)
                # Nếu muốn chính xác doanh thu, cần join với Revenue hoặc lấy từ order details
                
        # Chuyển đổi sang list format
        results = []
        for city, data in city_stats.items():
            coords = PROVINCE_CENTROIDS.get(city)
            if coords:
                results.append({
                    "city": city,
                    "orders": data["orders"],
                    "revenue": data["revenue"],
                    "longitude": coords[0],
                    "latitude": coords[1]
                })
        
        # Sắp xếp theo số đơn giảm dần
        return sorted(results, key=lambda x: x["orders"], reverse=True)

    except Exception as e:
        print(f"Warning: Could not calculate location distribution: {e}")
        return []
    
def _calculate_customer_retention(orders: List[models.Order], current_date: date, db_session: Session) -> Dict:
    """
    Phân loại khách hàng Mới vs Cũ và tính doanh thu tương ứng.
    - Khách cũ: Đã từng có đơn hàng thành công/phát sinh trước ngày hiện tại.
    - Khách mới: Lần đầu tiên phát sinh đơn hàng vào ngày hiện tại.
    """

    stats = {
        "new_customers": 0,
        "returning_customers": 0,
        "new_customer_revenue": 0.0,
        "returning_customer_revenue": 0.0
    }

    if not orders or not db_session:
        return stats
    
    # Lấy danh sách username mua hàng trong ngày
    usernames_today = {o.username for o in orders if o.username}
    if not usernames_today:
        return stats
    
    # Tìm những username đã từng mua hàng TRƯỚC ngày hôm nay (Returning Customer)
    try:
        existing_customers_query = db_session.query(models.Order.username).filter(
            models.Order.username.in_(usernames_today),
            models.Order.order_date < datetime.combine(current_date, datetime.min.time())
        ).distinct()

        existing_usernames = {row[0] for row in existing_customers_query.all()}

        # Phân loại và tính toán
        counted_new_users = set()
        counted_returning_users = set()

        for order in orders:
            if not order.username:
                continue

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

    except Exception as e:
        print(f"Error calculating customer retention: {e}")

    return stats

def _calculate_payment_method_breakdown(orders: List[models.Order]) -> Dict[str, int]:
    """
    Phân tích phương thức thanh toán dựa trên từ khóa (Mapping).
    """
    method_counts = defaultdict(int)
    
    for order in orders:
        if order.details and isinstance(order.details, dict):
            # Lấy raw string từ sàn
            raw_method = order.details.get('payment_method')
            
            if raw_method:
                # Chuẩn hóa: Unidecode -> Lowercase -> Strip
                # VD: "Thẻ Tín dụng/Ghi nợ" -> "the tin dung/ghi no"
                method_text = unidecode(str(raw_method)).lower().strip()
                
                found_group = False
                
                # Quét từ khóa
                for group_name, keywords in PAYMENT_METHOD_MAPPING.items():
                    for kw in keywords:
                        if kw in method_text:
                            method_counts[group_name] += 1
                            found_group = True
                            break
                    if found_group: break
                
                # Nếu không khớp nhóm nào, gom vào 'Khác'
                if not found_group:
                    method_counts["Khác"] += 1
    
    return dict(method_counts)


def _calculate_core_kpis(
    orders: List[models.Order],
    revenues: List[models.Revenue],
    marketing_spends: List[models.MarketingSpend],
    creation_date_order_codes: Set[str]
) -> dict:
    
    # --- 1. SÀNG LỌC ORDER MỤC TIÊU (Theo ngày tạo) ---
    target_orders = [o for o in orders if o.order_code in creation_date_order_codes]
    orders_map = {o.order_code: o for o in orders}

    # --- 2. TÍNH TOÁN METRICS TỪ ORDER (Real-time / Tạm tính) ---
    # GMV & Doanh thu tạm tính lấy trực tiếp từ Order vừa đặt
    # gmv = sum((o.gmv or 0) for o in target_orders) -> Đã chuyển xuống tính từ Revenue
    provisional_revenue = sum((o.selling_price or 0) for o in target_orders)
    subsidy_amount = sum((o.subsidy_amount or 0) for o in target_orders)
    
    # --- 3. XỬ LÝ TRẠNG THÁI VẬN HÀNH ---
    counters = {
        "completed": 0, "cancelled": 0, "bomb": 0, "refunded": 0, "other": 0
    }
    
    # Xác định đơn nào có hoàn tiền từ Revenue để phân loại trạng thái chính xác
    order_has_refund = defaultdict(bool)
    for r in revenues:
        if r.refund < 0:
            order_has_refund[r.order_code] = True

    for order in target_orders:
        has_refund_tx = order_has_refund[order.order_code]
        category = _classify_order_status(order, total_refund=-1 if has_refund_tx else 0)
        counters[category] += 1

    total_orders = len(target_orders)
    completed_orders = counters['completed']
    cancelled_orders = counters['cancelled']
    refunded_orders = counters['refunded']
    bomb_orders = counters['bomb']

    # --- 4. TÍNH TOÁN TÀI CHÍNH THỰC TẾ (Từ Revenue) ---
    # Chỉ tính tiền của những đơn hàng nằm trong target_orders
    # (Tức là Revenue ngày 24/12 vẫn được cộng vào KPI ngày 17/12 nếu đơn đó tạo ngày 17)
    
    valid_revenues = [r for r in revenues if r.order_code in creation_date_order_codes]
    
    # CẬP NHẬT: GMV lấy từ bảng REVENUE (số liệu đã đối soát/chốt) thay vì Order
    gmv = sum((r.gmv or 0) for r in valid_revenues)
    
    net_revenue = sum(r.net_revenue for r in valid_revenues)
    execution_cost = abs(sum(r.total_fees for r in valid_revenues)) # Phí sàn thực tế
    
    # Tạo Financial Logs (Nhật ký giao dịch)
    financial_events = []
    for r in valid_revenues:
        # Logic phân loại Log: Dựa vào cột refund
        evt_type = "income"
        if r.refund < 0: # Hoàn tiền
            evt_type = "refund"
        elif r.net_revenue < 0: # Các khoản trừ khác không phải hoàn tiền trực tiếp
            evt_type = "deduction"
        elif r.total_fees > 0: # Các loại phí
             evt_type = "fee"
        
        # Nếu net_revenue khác 0 hoặc là refund thì mới ghi log (để tránh rác)
        if r.net_revenue != 0 or evt_type == "refund": # Keep refunds even if net_revenue is 0
            financial_events.append({
                "date": str(r.transaction_date),
                "type": evt_type,
                "amount": r.net_revenue, # Use net_revenue as the value for the event
                "order_code": r.order_code,
                "note": f"Source: {r.source}"
            })

    # --- 5. TÍNH CHI PHÍ & LỢI NHUẬN ---
    # Giá vốn: Chỉ tính cho các đơn đã hoàn thành (hoặc tùy logic shop, ở đây tính theo đơn completed)
    # Tuy nhiên để xem lãi lỗ tạm tính, ta có thể tính COGS của toàn bộ đơn đã đặt.
    # Logic hiện tại: Tính COGS của đơn completed (thận trọng)
    
    invalid_order_codes = {o.order_code for o in target_orders if _classify_order_status(o, order_has_refund[o.order_code]) in ['cancelled', 'bomb', 'refunded']}
    cogs = sum((o.cogs or 0) for o in target_orders if o.order_code not in invalid_order_codes)

    ad_spend = sum(m.ad_spend for m in marketing_spends)
    
    # Tổng chi phí = Giá vốn + Phí sàn + Ads
    total_cost = cogs + execution_cost + ad_spend
    
    # Lợi nhuận = Doanh thu thực - Tổng chi phí
    # (Nếu chưa có net_revenue thì profit sẽ âm ad_spend, phản ánh đúng thực tế dòng tiền)
    profit = net_revenue - cogs - ad_spend

    # --- 6. TÍNH CÁC CHỈ SỐ VẬN HÀNH KHÁC ---
    total_quantity_sold = sum((o.total_quantity or 0) for o in target_orders)
    unique_skus_sold = len(set(item['sku'] for o in target_orders if o.details and o.details.get('items') for item in o.details['items'] if item.get('sku'))) # Tính unique SKUs

    # Thời gian xử lý & Giao hàng
    total_processing_hours = 0; processing_count = 0
    total_shipping_days = 0; shipping_count = 0
    total_fulfillment_days = 0; fulfillment_count = 0

    for order in target_orders:
        # 1. Processing Time (Order -> Shipped)
        if order.shipped_time and order.order_date:
            diff = (order.shipped_time - order.order_date).total_seconds() / 3600
            if diff > 0:
                total_processing_hours += diff
                processing_count += 1
        
        # 2. Shipping Time (Shipped -> Delivered)
        if order.delivered_date and order.shipped_time:
            diff = (order.delivered_date - order.shipped_time).total_seconds() / 86400
            if diff > 0:
                total_shipping_days += diff
                shipping_count += 1
        
        # 3. Fulfillment Time (Order -> Delivered)
        if order.delivered_date and order.order_date:
            diff = (order.delivered_date - order.order_date).total_seconds() / 86400
            if diff > 0:
                total_fulfillment_days += diff
                fulfillment_count += 1
                
    avg_processing_time = (total_processing_hours / processing_count) if processing_count > 0 else 0
    avg_shipping_time = (total_shipping_days / shipping_count) if shipping_count > 0 else 0
    avg_fulfillment_time = (total_fulfillment_days / fulfillment_count) if fulfillment_count > 0 else 0

    # --- 7. TÍNH TỶ LỆ (RATIOS) ---
    roi = (profit / total_cost) if total_cost > 0 else 0
    profit_margin = (profit / net_revenue) if net_revenue != 0 else 0
    take_rate = (execution_cost / gmv) if gmv > 0 else 0
    
    aov = (gmv / completed_orders) if completed_orders > 0 else 0
    upt = (total_quantity_sold / completed_orders) if completed_orders > 0 else 0
    
    completion_rate = (completed_orders / total_orders) if total_orders > 0 else 0
    cancellation_rate = (cancelled_orders / total_orders) if total_orders > 0 else 0
    refund_rate = (refunded_orders / total_orders) if total_orders > 0 else 0
    bomb_rate = (bomb_orders / total_orders) if total_orders > 0 else 0

    # --- 8. MARKETING METRICS ---
    impressions = sum(m.impressions for m in marketing_spends)
    clicks = sum(m.clicks for m in marketing_spends)
    conversions = sum(m.conversions for m in marketing_spends)
    reach = sum(m.reach for m in marketing_spends)
    frequency = (impressions / reach) if reach > 0 else 0
    conversion_rate = (conversions / clicks) if clicks > 0 else 0

    # --- TRẢ VỀ KẾT QUẢ (SNAKE CASE) ---
    return {
        # Finance
        "net_revenue": net_revenue,
        "provisional_revenue": provisional_revenue,
        "gmv": gmv,
        "total_cost": total_cost,
        "cogs": cogs,
        "execution_cost": execution_cost,
        "subsidy_amount": subsidy_amount,
        "profit": profit,
        "roi": roi,
        "profit_margin": profit_margin,
        "take_rate": take_rate,

        # Marketing
        "ad_spend": ad_spend,
        "roas": (gmv / ad_spend) if ad_spend > 0 else 0, 
        "cpo": (ad_spend / total_orders) if total_orders > 0 else 0,
        "cpm": (ad_spend / impressions) * 1000 if impressions > 0 else 0, 
        "cpc": (ad_spend / clicks) if clicks > 0 else 0, 
        "ctr": (clicks / impressions) * 100 if impressions > 0 else 0, 
        "cpa": (ad_spend / conversions) if conversions > 0 else 0,

        "impressions": impressions, "clicks": clicks, 
        "conversions": conversions, "reach": reach,
        "frequency": frequency, "conversion_rate": conversion_rate,

        # Ops
        "total_orders": total_orders,
        "completed_orders": completed_orders,
        "cancelled_orders": cancelled_orders,
        "refunded_orders": refunded_orders,
        "bomb_orders": bomb_orders,
        
        "aov": aov, "upt": upt,
        "unique_skus_sold": unique_skus_sold, 
        "total_quantity_sold": total_quantity_sold,
        
        "completion_rate": completion_rate,
        "cancellation_rate": cancellation_rate,
        "refund_rate": refund_rate,
        "bomb_rate": bomb_rate,
        
        "avg_processing_time": avg_processing_time,
        "avg_shipping_time": avg_shipping_time,
        "avg_fulfillment_time": avg_fulfillment_time,
        
        # Logs
        "financial_events": financial_events
    }

# ==============================================================================
# HÀM 1: TÍNH TOÁN KPI CHO MỘT NGÀY DUY NHẤT (Full DailyAnalytics)
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
    Tính toán KPI cho MỘT ngày -> Trả về full data cho bảng DailyAnalytics.
    """
    try:
        # 1. Tính KPI cốt lõi
        kpis = _calculate_core_kpis(orders_in_day, revenues_in_day, marketing_spends, creation_date_order_codes)
        
        # 2. Tính các chỉ số bổ sung cho ngày (JSONB, Customer)
        usernames_today = {o.username for o in orders_in_day if o.username}
        kpis["total_customers"] = len(usernames_today) # snake_case
        
        # Lọc ra các order thực sự được TẠO trong ngày để phân tích hành vi
        created_orders = [o for o in orders_in_day if o.order_code in creation_date_order_codes]
        
        # 3. Tính các trường JSONB (Đổi key sang snake_case)
        kpis["hourly_breakdown"] = _calculate_hourly_breakdown(created_orders)
        kpis["top_products"] = _calculate_top_products(created_orders)
        
        # Mới: Tính Top SP Hoàn
        kpis["top_refunded_products"] = _calculate_top_refunded_products(orders_in_day, revenues_in_day)

        kpis["payment_method_breakdown"] = _calculate_payment_method_breakdown(created_orders)
        kpis["cancel_reason_breakdown"] = _calculate_cancel_reason_breakdown(created_orders)
        
        # Tính phân bổ địa lý
        kpis["location_distribution"] = _calculate_location_distribution(created_orders, db_session)
        
        if db_session:
            customer_retention = _calculate_customer_retention(created_orders, date_to_calculate, db_session)
            kpis.update(customer_retention)

        return kpis
    except Exception as e:
        print(f"CALCULATOR ERROR (daily): {e}")
        return {}
# ==============================================================================
# HÀM 2: TÍNH TOÁN KPI TỔNG HỢP (Cho API Range, Chart...)
# ==============================================================================
def calculate_aggregated_kpis(
    all_orders: List[models.Order],
    all_revenues: List[models.Revenue],
    all_marketing_spends: List[models.MarketingSpend],
) -> dict:
    """
    Tính toán KPI tổng hợp cho một khoảng thời gian.
    Chủ yếu dùng cho Chart tổng quan, không cần JSONB chi tiết.
    """
    try:
        creation_date_order_codes = {o.order_code for o in all_orders}
        kpis = _calculate_core_kpis(all_orders, all_revenues, all_marketing_spends, creation_date_order_codes)
        return kpis
    except Exception as e:
        print(f"CALCULATOR ERROR (aggregated): {e}")
        return {}