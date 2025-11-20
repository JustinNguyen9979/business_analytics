# FILE: Backend/app/kpi_calculator.py
from datetime import date
import models, math  

CANCELLED_STATUSES = {'hủy', 'cancel', 'đã hủy', 'cancelled'}


def _calculate_core_kpis(
    orders: list[models.Order], 
    revenues: list[models.Revenue],
    ads: list[models.Ad],
    total_orders_for_rates: int # Tham số mới cho mẫu số đúng của tỷ lệ
) -> dict:
    
    # === KHỐI 1: PHÂN LOẠI MÃ ĐƠN HÀNG ===

    # 1.1. Phân loại từ bảng Revenues (cho TikTok và Shopee)
    revenue_refunded_codes = set()
    revenue_cancelled_codes = set()
    all_revenue_codes = {r.order_code for r in revenues}

    for r in revenues:
        # Trường hợp TikTok có refund và net_revenue
        if r.source == 'tiktok' and r.refund < 0:
            if r.net_revenue == 0:
                revenue_cancelled_codes.add(r.order_code)
            else: # net_revenue != 0
                revenue_refunded_codes.add(r.order_code)
        # Trường hợp Shopee có refund
        elif r.source == 'shopee' and r.refund != 0:
            revenue_refunded_codes.add(r.order_code)

    # 1.2. Phân loại từ bảng Orders (dựa trên status)
    status_cancelled_codes = {
        o.order_code for o in orders 
        if o.status and o.status.lower().strip() in CANCELLED_STATUSES
    }

    # 1.3. Tổng hợp danh sách cuối cùng
    final_cancelled_codes = status_cancelled_codes.union(revenue_cancelled_codes)
    final_refunded_codes = revenue_refunded_codes
    
    # Đơn chốt = Có doanh thu VÀ KHÔNG bị hủy VÀ KHÔNG bị hoàn
    final_completed_codes = all_revenue_codes - final_cancelled_codes - final_refunded_codes
    
    # === KHỐI 2: TÍNH TOÁN CÁC CHỈ SỐ ===
    
    # Lọc ra các dòng revenue hợp lệ (của các đơn chốt) để tính toán tài chính
    valid_revenues = [r for r in revenues if r.order_code in final_completed_codes]

    netRevenue = sum(r.net_revenue for r in valid_revenues)
    gmv = sum(r.gmv for r in valid_revenues)
    executionCost = abs(sum(r.total_fees for r in valid_revenues))

    cogs_map = {}
    for o in orders:
        cogs_map[o.order_code] = cogs_map.get(o.order_code, 0) + o.cogs

    cogs = sum(cogs_map.get(code, 0) for code in final_completed_codes)
    
    adSpend = sum(a.expense for a in ads)
    totalCost = cogs + executionCost + adSpend
    profit = gmv - totalCost
    roi = (profit / totalCost) if totalCost > 0 else 0
    profitMargin = (profit / netRevenue) if netRevenue != 0 else 0
    takeRate = (executionCost / gmv) if gmv > 0 else 0

    # Các số đếm vận hành
    completedOrders = len(final_completed_codes)
    totalCancelledOrders = len(final_cancelled_codes)
    refundedOrders = len(final_refunded_codes)

    # Các chỉ số trung bình (dựa trên đơn chốt)
    aov = (gmv / completedOrders) if completedOrders > 0 else 0
    
    orders_map = {o.order_code: o for o in orders}
    totalQuantitySoldInCompletedOrders = sum(orders_map.get(code, models.Order(total_quantity=0)).total_quantity for code in final_completed_codes)
    
    unique_skus_sold_set = set()
    for code in final_completed_codes:
        order = orders_map.get(code)
        if order and order.details and isinstance(order.details.get('items'), list):
            for item in order.details['items']:
                if item.get('sku'):
                    unique_skus_sold_set.add(item['sku'])
    uniqueSkusSold = len(unique_skus_sold_set)

    upt = (totalQuantitySoldInCompletedOrders / completedOrders) if completedOrders > 0 else 0

    # Dùng total_orders_for_rates làm mẫu số đúng cho các tỷ lệ vận hành
    totalOrders = total_orders_for_rates
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
    ads_in_day: list[models.Ad],
    total_orders_for_rates: int # Tham số mới
) -> dict:
    """
    Tính toán KPI cho MỘT ngày.
    Hàm này gọi hàm helper và thêm vào các chỉ số chỉ có ý nghĩa trong ngày.
    """
    try:
        # Gọi hàm tính toán cốt lõi và truyền tham số mới vào
        kpis = _calculate_core_kpis(orders_in_day, revenues_in_day, ads_in_day, total_orders_for_rates)
        
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
    Lưu ý: Đối với tính toán tổng hợp, total_orders_for_rates chính là tổng số đơn trong all_orders
    """
    # print("CALCULATOR: Bắt đầu tính toán các chỉ số tổng hợp...")
    try:
        # Đếm số đơn hàng duy nhất trong khoảng thời gian tổng hợp
        total_orders_in_range = len({o.order_code for o in all_orders})
        kpis = _calculate_core_kpis(all_orders, all_revenues, all_ads, total_orders_in_range)
        # print("CALCULATOR: Hoàn thành tính toán.")
        return kpis
    except Exception as e:
        print(f"CALCULATOR ERROR (aggregated): {e}")
        return {}