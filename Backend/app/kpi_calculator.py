# FILE: Backend/app/kpi_calculator.py
from datetime import date
import models
from typing import List, Set

CANCELLED_STATUSES = {'hủy', 'cancel', 'đã hủy', 'cancelled'}


def _calculate_core_kpis(
    orders: List[models.Order],
    revenues: List[models.Revenue],
    ads: List[models.Ad],
    creation_date_order_codes: Set[str]
) -> dict:
    
    # === KHỐI 1: PHÂN LOẠI TRẠNG THÁI ĐƠN HÀNG (LOGIC CHUNG) ===
    # Phân loại tất cả các đơn có hoạt động trong ngày để xác định trạng thái cuối cùng.
    
    revenue_refunded_codes = set()
    revenue_cancelled_codes = set()
    all_revenue_codes = {r.order_code for r in revenues} # Đơn có hoạt động tài chính hôm nay

    for r in revenues:
        if r.source == 'tiktok' and r.refund < 0:
            if r.net_revenue == 0:
                revenue_cancelled_codes.add(r.order_code)
            # else: # Tạm thời bỏ qua đơn hoàn tiền theo chỉ đạo
            #     revenue_refunded_codes.add(r.order_code)
        elif r.source == 'shopee' and r.refund != 0:
            # Tạm thời bỏ qua đơn hoàn tiền
            # revenue_refunded_codes.add(r.order_code)
            pass

    status_cancelled_codes = {
        o.order_code for o in orders
        if o.status and o.status.lower().strip() in CANCELLED_STATUSES
    }

    globally_cancelled_codes = status_cancelled_codes.union(revenue_cancelled_codes)
    # globally_refunded_codes = revenue_refunded_codes # Tạm bỏ qua
    
    # === KHỐI 2: TÍNH TOÁN CÁC CHỈ SỐ TÀI CHÍNH (DỰA TRÊN TRANSACTION_DATE) ===
    # *** Logic này được giữ nguyên như ban đầu để đảm bảo tính đúng đắn của các chỉ số tài chính ***
    
    # Tập hợp đơn hàng hoàn chỉnh cho mục đích tài chính
    financial_completed_codes = all_revenue_codes - globally_cancelled_codes
    
    valid_revenues = [r for r in revenues if r.order_code in financial_completed_codes]

    netRevenue = sum(r.net_revenue for r in valid_revenues)
    gmv = sum(r.gmv for r in valid_revenues)
    executionCost = abs(sum(r.total_fees for r in valid_revenues))

    cogs_map = {o.order_code: o.cogs for o in orders if o.cogs is not None}
    # COGS cho các chỉ số tài chính phải được tính trên các đơn hoàn chỉnh về mặt tài chính
    cogs_for_finance = sum(cogs_map.get(code, 0) for code in financial_completed_codes)
    
    adSpend = sum(a.expense for a in ads)
    totalCost = cogs_for_finance + executionCost + adSpend
    profit = gmv - totalCost
    roi = (profit / totalCost) if totalCost > 0 else 0
    profitMargin = (profit / netRevenue) if netRevenue != 0 else 0
    takeRate = (executionCost / gmv) if gmv > 0 else 0
    
    # AOV và các chỉ số tài chính khác được tính dựa trên tập hợp đơn hàng tài chính
    financial_completed_count = len(financial_completed_codes)
    aov = (gmv / financial_completed_count) if financial_completed_count > 0 else 0
    
    orders_map = {o.order_code: o for o in orders}
    totalQuantitySold_finance = sum(orders_map.get(code, models.Order(total_quantity=0)).total_quantity for code in financial_completed_codes)
    
    unique_skus_sold_set_finance = set()
    for code in financial_completed_codes:
        order = orders_map.get(code)
        if order and order.details and isinstance(order.details.get('items'), list):
            for item in order.details['items']:
                if item.get('sku'):
                    unique_skus_sold_set_finance.add(item['sku'])
    uniqueSkusSold = len(unique_skus_sold_set_finance)

    upt = (totalQuantitySold_finance / financial_completed_count) if financial_completed_count > 0 else 0

    # === KHỐI 3: TÍNH TOÁN CÁC CHỈ SỐ VẬN HÀNH (DỰA TRÊN ORDER_DATE) ===
    # *** Logic này được sửa lại theo đúng yêu cầu của anh ***

    totalOrders_op = len(creation_date_order_codes)
    cancelled_today_codes = creation_date_order_codes.intersection(globally_cancelled_codes)
    cancelledOrders_op = len(cancelled_today_codes)
    
    # Tạm thời chưa tính đơn hoàn
    refundedOrders_op = 0
    
    # Công thức tính Đơn chốt theo đúng yêu cầu
    completedOrders_op = totalOrders_op - cancelledOrders_op - refundedOrders_op
    
    completionRate = (completedOrders_op / totalOrders_op) if totalOrders_op > 0 else 0
    cancellationRate = (cancelledOrders_op / totalOrders_op) if totalOrders_op > 0 else 0
    refundRate = (refundedOrders_op / totalOrders_op) if totalOrders_op > 0 else 0

    # === KHỐI 4: TỔNG HỢP KẾT QUẢ ===
    # Trả về các chỉ số tài chính từ Khối 2 và các chỉ số vận hành từ Khối 3
    return {
        "gmv": gmv, "netRevenue": netRevenue, "cogs": cogs_for_finance, "executionCost": executionCost,
        "adSpend": adSpend, "totalCost": totalCost, "profit": profit, "roi": roi, 
        "profitMargin": profitMargin, "takeRate": takeRate, "aov": aov, "upt": upt, 
        "uniqueSkusSold": uniqueSkusSold, "totalQuantitySold": totalQuantitySold_finance,

        "totalOrders": totalOrders_op, 
        "completedOrders": completedOrders_op, 
        "cancelledOrders": cancelledOrders_op,
        "refundedOrders": refundedOrders_op, 
        
        "completionRate": completionRate, "cancellationRate": cancellationRate, "refundRate": refundRate
    }

# ==============================================================================
# HÀM 1: TÍNH TOÁN KPI CHO MỘT NGÀY DUY NHẤT
# ==============================================================================
def calculate_daily_kpis(
    orders_in_day: List[models.Order], 
    revenues_in_day: List[models.Revenue], 
    ads_in_day: List[models.Ad],
    creation_date_order_codes: Set[str]
) -> dict:
    """
    Tính toán KPI cho MỘT ngày.
    Hàm này gọi hàm helper và thêm vào các chỉ số chỉ có ý nghĩa trong ngày.
    """
    try:
        kpis = _calculate_core_kpis(orders_in_day, revenues_in_day, ads_in_day, creation_date_order_codes)
        
        # Chỉ số này không bị ảnh hưởng, vẫn có thể giữ nguyên
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
    all_orders: List[models.Order],
    all_revenues: List[models.Revenue],
    all_ads: List[models.Ad]
) -> dict:
    """
    Tính toán KPI tổng hợp cho một khoảng thời gian.
    """
    try:
        creation_date_order_codes = {o.order_code for o in all_orders}
        kpis = _calculate_core_kpis(all_orders, all_revenues, all_ads, creation_date_order_codes)
        return kpis
    except Exception as e:
        print(f"CALCULATOR ERROR (aggregated): {e}")
        return {}