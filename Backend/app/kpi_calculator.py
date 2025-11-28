# FILE: Backend/app/kpi_calculator.py
from datetime import date, datetime
import models
from typing import List, Set, Dict
from collections import defaultdict
from unidecode import unidecode
from sqlalchemy.orm import Session
from sqlalchemy import func

CANCELLED_STATUSES = {'hủy', 'cancel', 'đã hủy', 'cancelled'}

# ==============================================================================
# CÁC HÀM HELPER TÍNH TOÁN CHI TIẾT (JSONB)
# ==============================================================================

# Danh sách keyword để phân loại lý do hủy (Đã chuẩn hóa về không dấu, chữ thường)
CANCEL_REASON_MAPPING = {
    "Giao thất bại (Bom hàng)": [
        "giao that bai", "khong thanh cong", "khach khong nhan", "khong lien lac", 
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
        results = [
            {"city": city, "orders": data["orders"], "revenue": data["revenue"]}
            for city, data in city_stats.items()
        ]
        
        # Sắp xếp theo số đơn giảm dần
        return sorted(results, key=lambda x: x["orders"], reverse=True)

    except Exception as e:
        print(f"Warning: Could not calculate location distribution: {e}")
        return []

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


# ==============================================================================
# HÀM LOGIC CỐT LÕI (CORE)
# ==============================================================================

def _calculate_core_kpis(
    orders: List[models.Order],
    revenues: List[models.Revenue],
    marketing_spends: List[models.MarketingSpend],
    creation_date_order_codes: Set[str]
) -> dict:
    
    # === KHỐI 1: PHÂN LOẠI TRẠNG THÁI ĐƠN HÀNG ===
    
    revenue_refunded_codes = set()
    revenue_cancelled_codes = set()
    all_revenue_codes = {r.order_code for r in revenues} # Đơn có hoạt động tài chính hôm nay

    for r in revenues:
        if r.source == 'tiktok' and r.refund < 0 and r.net_revenue == 0:
            revenue_cancelled_codes.add(r.order_code)
        elif r.refund < 0 and r.net_revenue != 0:
            revenue_refunded_codes.add(r.order_code)
        else:
            pass
    
    status_cancelled_codes = {
        o.order_code for o in orders
        if o.status and o.status.lower().strip() in CANCELLED_STATUSES
    }

    globally_cancelled_codes = status_cancelled_codes.union(revenue_cancelled_codes)
    
    # === KHỐI 2: TÍNH TOÁN CÁC CHỈ SỐ TÀI CHÍNH ===
    
    financial_completed_codes = all_revenue_codes - globally_cancelled_codes
    valid_revenues = [r for r in revenues if r.order_code in financial_completed_codes]

    netRevenue = sum(r.net_revenue for r in valid_revenues)
    gmv = sum(r.gmv for r in valid_revenues)
    executionCost = abs(sum(r.total_fees for r in valid_revenues))

    cogs_map = {o.order_code: o.cogs for o in orders if o.cogs is not None}
    cogs_for_finance = sum(cogs_map.get(code, 0) for code in financial_completed_codes)
    
    adSpend = sum(m.ad_spend for m in marketing_spends)
    totalCost = cogs_for_finance + executionCost + adSpend
    profit = gmv - totalCost

    roi = (profit / totalCost) if totalCost > 0 else 0
    profitMargin = (profit / netRevenue) if netRevenue != 0 else 0
    takeRate = (executionCost / gmv) if gmv > 0 else 0
    
    financial_completed_count = len(financial_completed_codes)
    aov = (gmv / financial_completed_count) if financial_completed_count > 0 else 0
    
    orders_map = {o.order_code: o for o in orders}

    # === KHỐI 3: TÍNH TOÁN CÁC CHỈ SỐ VẬN HÀNH ===

    totalOrders_op = len(creation_date_order_codes)
    cancelled_today_codes = creation_date_order_codes.intersection(globally_cancelled_codes)
    cancelledOrders_op = len(cancelled_today_codes)
    
    refunded_transactions_count = len(revenue_refunded_codes)
    completedOrders_op = totalOrders_op - cancelledOrders_op
    completed_today_codes = creation_date_order_codes - cancelled_today_codes

    totalQuantitySold_op = 0
    unique_skus_sold_set = set()
    
    # Biến tính thời gian giao hàng
    total_fulfillment_time_hours = 0
    fulfillment_count = 0

    for code in completed_today_codes:
        order = orders_map.get(code)
        if order:
            totalQuantitySold_op += (order.total_quantity or 0)
            if order.details and isinstance(order.details, dict):
                # Đếm SKU
                items = order.details.get('items')
                if isinstance(items, list):
                    for item in items:
                        if item.get('sku'):
                            unique_skus_sold_set.add(item['sku'])
                
                # Tính thời gian giao hàng (nếu có delivered_date)
                delivered_str = order.details.get('delivered_date')
                if delivered_str and order.order_date:
                    try:
                        # delivered_date trong DB là chuỗi ISO (do ta lưu .isoformat())
                        delivered_at = datetime.fromisoformat(delivered_str)
                        # order_date là datetime object (do ta đã query bằng SQLAlchemy models)
                        created_at = order.order_date
                        
                        # Tính khoảng cách (giờ)
                        diff = delivered_at - created_at
                        hours = diff.total_seconds() / 3600
                        if hours > 0:
                            total_fulfillment_time_hours += hours
                            fulfillment_count += 1
                    except (ValueError, TypeError):
                        pass

    uniqueSkusSold_op = len(unique_skus_sold_set)
    avg_fulfillment_time = (total_fulfillment_time_hours / fulfillment_count) if fulfillment_count > 0 else 0

    total_financial_transaction_orders = len(financial_completed_codes) + refunded_transactions_count
    
    completionRate_op = (completedOrders_op / totalOrders_op) if totalOrders_op > 0 else 0
    cancellationRate_op = (cancelledOrders_op / totalOrders_op) if totalOrders_op > 0 else 0
    refundRate_op = (refunded_transactions_count / total_financial_transaction_orders) if total_financial_transaction_orders > 0 else 0
    upt = (totalQuantitySold_op / completedOrders_op) if completedOrders_op > 0 else 0

    # === KHỐI 4: KHỐI MARKETING ===
    impressions = sum(m.impressions for m in marketing_spends)
    clicks = sum(m.clicks for m in marketing_spends)
    conversions = sum(m.conversions for m in marketing_spends)
    reach = sum(m.reach for m in marketing_spends)

    cpm = (adSpend / impressions) * 1000 if impressions > 0 else 0
    cpc = (adSpend / clicks) if clicks > 0 else 0
    ctr = (clicks / impressions) * 100 if impressions > 0 else 0
    cpa = (adSpend / conversions) if conversions > 0 else 0
    frequency = (impressions / reach) if reach > 0 else 0
    
    conversion_rate = (conversions / clicks) if clicks > 0 else 0

    # === KHỐI 5: TỔNG HỢP KẾT QUẢ (Snake case cho Model) ===
    return {
        # Finance
        "gmv": gmv, 
        "net_revenue": netRevenue, 
        "profit": profit,
        "cogs": cogs_for_finance, 
        "execution_cost": executionCost,
        "ad_spend": adSpend, 
        "total_cost": totalCost, 
        
        # Ratios
        "roi": roi, 
        "profit_margin": profitMargin, 
        "take_rate": takeRate, 
        "aov": aov, 
        "upt": upt, 

        # Ops & Product
        "unique_skus_sold": uniqueSkusSold_op,
        "total_quantity_sold": totalQuantitySold_op,
        "total_orders": totalOrders_op, 
        "completed_orders": completedOrders_op, 
        "cancelled_orders": cancelledOrders_op,
        "refunded_orders": refunded_transactions_count, 
        
        # Rates
        "completion_rate": completionRate_op, 
        "cancellation_rate": cancellationRate_op, 
        "refund_rate": refundRate_op,
        "avg_fulfillment_time": avg_fulfillment_time,

        # Marketing
        "cpm": cpm, 
        "cpa": cpa, 
        "cpc": cpc, 
        "ctr": ctr, 
        "impressions": impressions, 
        "clicks": clicks,
        "conversions": conversions,
        "reach": reach, 
        "frequency": frequency,
        "conversion_rate": conversion_rate
    }

# ==============================================================================
# HÀM 1: TÍNH TOÁN KPI CHO MỘT NGÀY DUY NHẤT (Full DailyAnalytics)
# ==============================================================================
def calculate_daily_kpis(
    orders_in_day: List[models.Order], 
    revenues_in_day: List[models.Revenue], 
    marketing_spends: List[models.MarketingSpend],
    creation_date_order_codes: Set[str],
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
        kpis["total_customers"] = len(usernames_today)
        
        # Lọc ra các order thực sự được TẠO trong ngày để phân tích hành vi
        # (orders_in_day bao gồm cả order cũ nhưng có phát sinh doanh thu hôm nay)
        created_orders = [o for o in orders_in_day if o.order_code in creation_date_order_codes]
        
        # 3. Tính các trường JSONB
        kpis["hourly_breakdown"] = _calculate_hourly_breakdown(created_orders)
        kpis["top_products"] = _calculate_top_products(created_orders)
        kpis["payment_method_breakdown"] = _calculate_payment_method_breakdown(created_orders)
        kpis["cancel_reason_breakdown"] = _calculate_cancel_reason_breakdown(created_orders)
        
        # Tính phân bổ địa lý (truyền db_session vào)
        kpis["location_distribution"] = _calculate_location_distribution(created_orders, db_session)
        
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