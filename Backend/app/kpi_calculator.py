# FILE: Backend/app/kpi_calculator.py
from datetime import date
import models
from typing import List, Set

CANCELLED_STATUSES = {'hủy', 'cancel', 'đã hủy', 'cancelled'}


def _calculate_core_kpis(
    orders: List[models.Order],
    revenues: List[models.Revenue],
    marketing_spends: List[models.MarketingSpend],
    creation_date_order_codes: Set[str]
) -> dict:
    
    # === KHỐI 1: PHÂN LOẠI TRẠNG THÁI ĐƠN HÀNG (LOGIC CHUNG) ===
    # Phân loại tất cả các đơn có hoạt động trong ngày để xác định trạng thái cuối cùng.
    
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
    
    # Tạo một tập hợp chứa mã của các đơn hàng có trạng thái là "hủy" dựa trên danh sách `orders`.
    status_cancelled_codes = {
        o.order_code for o in orders
        if o.status and o.status.lower().strip() in CANCELLED_STATUSES
    }

    globally_cancelled_codes = status_cancelled_codes.union(revenue_cancelled_codes)
    
    # === KHỐI 2: TÍNH TOÁN CÁC CHỈ SỐ TÀI CHÍNH (DỰA TRÊN TRANSACTION_DATE) ===
    # *** Logic này được giữ nguyên như ban đầu để đảm bảo tính đúng đắn của các chỉ số tài chính ***
    
    # Tập hợp đơn hàng hoàn chỉnh cho mục đích tài chính
    financial_completed_codes = all_revenue_codes - globally_cancelled_codes
    
    valid_revenues = [r for r in revenues if r.order_code in financial_completed_codes]

    netRevenue = sum(r.net_revenue for r in valid_revenues)
    gmv = sum(r.gmv for r in valid_revenues)
    executionCost = abs(sum(r.total_fees for r in valid_revenues))

    # Tạo một dictionary (`cogs_map`) để dễ dàng tra cứu Giá vốn hàng bán (COGS) theo mã đơn hàng.
    cogs_map = {o.order_code: o.cogs for o in orders if o.cogs is not None}

    # COGS cho các chỉ số tài chính phải được tính trên các đơn hoàn chỉnh về mặt tài chính
    cogs_for_finance = sum(cogs_map.get(code, 0) for code in financial_completed_codes)
    
    # `adSpend`: Tổng chi phí quảng cáo.
    adSpend = sum(m.ad_spend for m in marketing_spends)

    # `totalCost`: Tổng chi phí = COGS + Chi phí thực hiện + Chi phí quảng cáo.
    totalCost = cogs_for_finance + executionCost + adSpend

    # `profit`: Lợi nhuận = GMV - Tổng chi phí.
    profit = gmv - totalCost

    # `roi`: Tỷ suất lợi nhuận trên đầu tư (Return on Investment).
    roi = (profit / totalCost) if totalCost > 0 else 0

    # `profitMargin`: Tỷ suất lợi nhuận gộp.
    profitMargin = (profit / netRevenue) if netRevenue != 0 else 0

    # `takeRate`: Tỷ lệ phí (thường là phí sàn).
    takeRate = (executionCost / gmv) if gmv > 0 else 0
    
    # Đếm số lượng đơn hàng hoàn chỉnh về mặt tài chính.
    financial_completed_count = len(financial_completed_codes)

    # `aov`: Giá trị đơn hàng trung bình (Average Order Value).
    aov = (gmv / financial_completed_count) if financial_completed_count > 0 else 0
    
    # Tạo một dictionary (`orders_map`) để tra cứu thông tin chi tiết của đơn hàng theo mã.
    orders_map = {o.order_code: o for o in orders}

    # === KHỐI 3: TÍNH TOÁN CÁC CHỈ SỐ VẬN HÀNH (DỰA TRÊN ORDER_DATE) ===

    # `totalOrders_op`: Tổng số đơn hàng vận hành, được tính dựa trên số lượng mã đơn hàng được tạo trong ngày.
    totalOrders_op = len(creation_date_order_codes)

    # Tìm các đơn hàng vừa được tạo trong ngày, vừa bị hủy.
    cancelled_today_codes = creation_date_order_codes.intersection(globally_cancelled_codes)

    # Đếm số lượng đơn hàng bị hủy trong ngày.
    cancelledOrders_op = len(cancelled_today_codes)
    
    # Đếm đơn hoàn
    refunded_transactions_count = len(revenue_refunded_codes)
    
    # Công thức tính Đơn chốt
    completedOrders_op = totalOrders_op - cancelledOrders_op

    completed_today_codes = creation_date_order_codes - cancelled_today_codes

    totalQuantitySold_op = 0
    unique_skus_sold_set = set()

    for code in completed_today_codes:
        order = orders_map.get(code)
        if order:
            # Cộng dồn số lượng
            totalQuantitySold_op += (order.total_quantity or 0)
            
            # Đếm SKU
            if order.details and isinstance(order.details.get('items'), list):
                for item in order.details['items']:
                    if item.get('sku'):
                        unique_skus_sold_set.add(item['sku'])

    uniqueSkusSold_op = len(unique_skus_sold_set)

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

    # === KHỐI 5: TỔNG HỢP KẾT QUẢ ===
    return {
        "gmv": gmv, 
        "netRevenue": netRevenue, 
        "cogs": cogs_for_finance, 
        "executionCost": executionCost,
        "adSpend": adSpend, 
        "totalCost": totalCost, 
        "profit": profit, 
        "roi": roi, 
        "profitMargin": profitMargin, 
        "takeRate": takeRate, 
        "aov": aov, 
        "upt": upt, 

        "uniqueSkusSold": uniqueSkusSold_op,
        "totalQuantitySold": totalQuantitySold_op,
        "totalOrders": totalOrders_op, 
        "completedOrders": completedOrders_op, 
        "cancelledOrders": cancelledOrders_op,
        "refundedOrders": refunded_transactions_count, 
        "completionRate": completionRate_op, 
        "cancellationRate": cancellationRate_op, 
        "refundRate": refundRate_op,

        "cpm": cpm, # Chi phí cho 1000 lần hiển thị
        "cpa": cpa, # Chi phí mỗi lượt chuyển đổi
        "cpc": cpc, # Chi phí mỗi lượt nhấp
        "ctr": ctr, # Tỷ lệ nhấp
        "impressions": impressions, # Lượt hiển thị
        "clicks": clicks,
        "conversions": conversions,
        "reach": reach, # Lượt tiếp cận
        "frequency": frequency, # Tần suất
    }

# ==============================================================================
# HÀM 1: TÍNH TOÁN KPI CHO MỘT NGÀY DUY NHẤT
# ==============================================================================
def calculate_daily_kpis(
    orders_in_day: List[models.Order], 
    revenues_in_day: List[models.Revenue], 
    marketing_spends: List[models.MarketingSpend],
    creation_date_order_codes: Set[str]
) -> dict:
    """
    Tính toán KPI cho MỘT ngày.
    Hàm này gọi hàm helper và thêm vào các chỉ số chỉ có ý nghĩa trong ngày.
    """
    try:
        kpis = _calculate_core_kpis(orders_in_day, revenues_in_day, marketing_spends, creation_date_order_codes)
        
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
    all_marketing_spends: List[models.MarketingSpend],
) -> dict:
    """
    Tính toán KPI tổng hợp cho một khoảng thời gian.
    """
    try:
        creation_date_order_codes = {o.order_code for o in all_orders}
        kpis = _calculate_core_kpis(all_orders, all_revenues, all_marketing_spends, creation_date_order_codes)
        return kpis
    except Exception as e:
        print(f"CALCULATOR ERROR (aggregated): {e}")
        return {}