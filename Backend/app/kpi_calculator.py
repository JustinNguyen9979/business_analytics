# FILE: Backend/app/kpi_calculator.py
from datetime import date
import models, math  

CANCELLED_STATUSES = {'hủy', 'cancel', 'đã hủy', 'cancelled'}

def _calculate_core_kpis(
    orders: list[models.Order], 
    revenues: list[models.Revenue],
    ads: list[models.Ad]
) -> dict:
    # === DEBUGGING: In ra thông tin đầu vào ===
    print(f"[DEBUG] Received {len(orders)} orders and {len(revenues)} revenues records.")

    # === KHỐI 1: PHÂN LOẠI ĐƠN HÀNG DỰA TRÊN LOGIC CHUẨN TỪ REVENUES ===
    
    refunded_order_codes = set()
    cancelled_order_codes = set()

    for r in revenues:
        if r.refund == 0:
            continue
        if r.source == 'shopee':
            refunded_order_codes.add(r.order_code)
        elif r.source == 'tiktok':
            if r.net_revenue != 0:
                refunded_order_codes.add(r.order_code)
            else: 
                cancelled_order_codes.add(r.order_code)

    valid_revenues = [r for r in revenues if r.order_code not in cancelled_order_codes]
    valid_revenue_order_codes = {r.order_code for r in valid_revenues}
    completed_order_codes = valid_revenue_order_codes - refunded_order_codes

    # === DEBUGGING: In ra các mã đơn hàng đã phân loại ===
    print(f"[DEBUG] Found {len(completed_order_codes)} completed order codes: {list(completed_order_codes)[:10]}...") # In 10 mã đầu

    # === KHỐI 2: TÍNH TOÁN CÁC CHỈ SỐ TÀI CHÍNH THEO LOGIC ĐÚNG ===

    netRevenue = sum(r.net_revenue for r in valid_revenues)
    gmv = sum(r.gmv for r in valid_revenues)
    executionCost = abs(sum(r.total_fees for r in valid_revenues))

    cogs_map = {}
    for o in orders:
        cogs_map[o.order_code] = cogs_map.get(o.order_code, 0) + o.cogs
    # === DEBUGGING: In ra một phần của cogs_map ===
    print(f"[DEBUG] COGS map (first 5 items): {dict(list(cogs_map.items())[:5])}")

    cogs = sum(cogs_map.get(code, 0) for code in completed_order_codes)
    
    # === DEBUGGING: In ra giá trị COGS cuối cùng ===
    print(f"[DEBUG] Final calculated COGS: {cogs}")

    adSpend = sum(a.expense for a in ads)

    # === KHỐI 3: TÍNH TOÁN LỢI NHUẬN VÀ CÁC CHỈ SỐ PHÁI SINH ===

    totalCost = cogs + executionCost + adSpend
    profit = gmv - totalCost

    # ... (phần còn lại của hàm giữ nguyên) ...
    roi = (profit / totalCost) if totalCost > 0 else 0
    profitMargin = (profit / netRevenue) if netRevenue != 0 else 0
    takeRate = (executionCost / gmv) if gmv > 0 else 0

    all_order_codes_from_orders_table = {o.order_code for o in orders}
    totalOrders = len(all_order_codes_from_orders_table)
    
    cancelled_from_orders = all_order_codes_from_orders_table - {r.order_code for r in revenues}
    totalCancelledOrders = len(cancelled_from_orders.union(cancelled_order_codes))

    refundedOrders = len(refunded_order_codes)
    completedOrders = len(completed_order_codes)

    aov = (gmv / completedOrders) if completedOrders > 0 else 0

    orders_map = {o.order_code: o for o in orders}
    totalQuantitySoldInCompletedOrders = sum(orders_map.get(code, models.Order(total_quantity=0)).total_quantity for code in completed_order_codes)
    
    unique_skus_sold_set = set()
    for code in completed_order_codes:
        order = orders_map.get(code)
        if order and order.details and isinstance(order.details.get('items'), list):
            for item in order.details['items']:
                if item.get('sku'):
                    unique_skus_sold_set.add(item['sku'])
    uniqueSkusSold = len(unique_skus_sold_set)

    upt = (totalQuantitySoldInCompletedOrders / completedOrders) if completedOrders > 0 else 0

    completionRate = (completedOrders / totalOrders) if totalOrders > 0 else 0
    cancellationRate = (totalCancelledOrders / totalOrders) if totalOrders > 0 else 0
    refundRate = (refundedOrders / totalOrders) if totalOrders > 0 else 0

    return {
        "gmv": gmv, "netRevenue": netRevenue, "cogs": cogs, "executionCost": executionCost,
        "adSpend": adSpend, "totalCost": totalCost, "profit": profit, "roi": roi, 
        "profitMargin": profitMargin, "takeRate": takeRate, "totalOrders": totalOrders, 
        "completedOrders": completedOrders, "cancelledOrders": totalCancelledOrders,
        "refundedOrders": refundedOrders, "aov": aov, "upt": upt, 
        "uniqueSkusSold": uniqueSkusSold, "totalQuantitySold": totalQuantitySoldInCompletedOrders,
        "completionRate": completionRate, "cancellationRate": cancellationRate, "refundRate": refundRate
    }

# ==============================================================================
# HÀM 1: TÍNH TOÁN KPI CHO MỘT NGÀY DUY NHẤT
# ==============================================================================
def calculate_daily_kpis(
    orders_in_day: list[models.Order], 
    revenues_in_day: list[models.Revenue], 
    ads_in_day: list[models.Ad]
) -> dict:
    """
    Tính toán KPI cho MỘT ngày.
    Hàm này gọi hàm helper và thêm vào các chỉ số chỉ có ý nghĩa trong ngày.
    """
    try:
        # Gọi hàm tính toán cốt lõi
        kpis = _calculate_core_kpis(orders_in_day, revenues_in_day, ads_in_day)
        
        # Tính thêm các chỉ số đặc thù của ngày
        usernames_today = {o.username for o in orders_in_day if o.username}
        kpis["totalCustomers"] = len(usernames_today)
        
        return kpis
    except Exception as e:
        print(f"CALCULATOR ERROR (daily): {e}")
        return {}

# ==============================================================================
# HÀM 2: TÍNH TOÁN KPI TỔNG HỢP
# ==============================================================================
def calculate_aggregated_kpis(
    all_orders: list[models.Order],
    all_revenues: list[models.Revenue],
    all_ads: list[models.Ad]
) -> dict:
    """
    Tính toán KPI tổng hợp cho một khoảng thời gian.
    Hàm này giờ chỉ là một wrapper gọi đến hàm tính toán cốt lõi.
    """
    print("CALCULATOR: Bắt đầu tính toán các chỉ số tổng hợp...")
    try:
        kpis = _calculate_core_kpis(all_orders, all_revenues, all_ads)
        print("CALCULATOR: Hoàn thành tính toán.")
        return kpis
    except Exception as e:
        print(f"CALCULATOR ERROR (aggregated): {e}")
        return {}