# FILE: Backend/app/kpi_calculator.py
from datetime import date
import models  # Cần import models để có type hinting cho rõ ràng

# ==============================================================================
# HÀM 1: TÍNH TOÁN KPI CHO MỘT NGÀY DUY NHẤT
# ==============================================================================
def calculate_daily_kpis(
    orders_in_day: list[models.Order], 
    revenues_in_day: list[models.Revenue], 
    ads_in_day: list[models.Ad]
) -> dict:
    """
    Tính toán KPI cho MỘT ngày từ dữ liệu thô đã được cung cấp.
    Hàm này không tương tác với DB, chỉ làm nhiệm vụ tính toán.
    """
    try:
        # === KHỐI 1: TÍNH CÁC CHỈ SỐ TÀI CHÍNH & MARKETING CƠ BẢN ===
        gmv = sum(r.gmv for r in revenues_in_day)
        netRevenue = sum(r.net_revenue for r in revenues_in_day)
        cogs = sum(o.cogs for o in orders_in_day)
        executionCost = sum(r.total_fees for r in revenues_in_day)
        adSpend = sum(a.expense for a in ads_in_day)

        # === KHỐI 2: TÍNH CÁC CHỈ SỐ VẬN HÀNH CƠ BẢN ===
        all_order_codes = {o.order_code for o in orders_in_day}
        totalOrders = len(all_order_codes)
        
        cancelled_order_codes = {o.order_code for o in orders_in_day if o.status and ('hủy' in o.status.lower() or 'cancel' in o.status.lower())}
        refunded_order_codes = {r.order_code for r in revenues_in_day if r.refund > 0}
        
        cancelledOrders = len(cancelled_order_codes)
        refundedOrders = len(refunded_order_codes)
        completed_order_codes = all_order_codes - cancelled_order_codes - refunded_order_codes
        completedOrders = len(completed_order_codes)

        totalQuantitySoldInCompletedOrders = sum(o.total_quantity for o in orders_in_day if o.order_code in completed_order_codes)
        
        unique_skus_sold_set = set()
        for order in orders_in_day:
            if order.order_code in completed_order_codes and order.details and isinstance(order.details.get('items'), list):
                for item in order.details['items']:
                    if item.get('sku'):
                        unique_skus_sold_set.add(item['sku'])
        uniqueSkusSold = len(unique_skus_sold_set)

        # === KHỐI 3: TÍNH CÁC CHỈ SỐ KHÁCH HÀNG (Cần DB context ở tầng cao hơn) ===
        # Ở đây ta chỉ tính được Total Customers trong ngày
        usernames_today = {o.username for o in orders_in_day if o.username}
        totalCustomers = len(usernames_today)
        
        # === KHỐI 4: TỔNG HỢP VÀ TÍNH CÁC CHỈ SỐ PHÁI SINH ===
        totalCost = cogs + executionCost + adSpend
        profit = netRevenue - totalCost 
        
        aov = (gmv / completedOrders) if completedOrders > 0 else 0
        upt = (totalQuantitySoldInCompletedOrders / completedOrders) if completedOrders > 0 else 0
        roi = (profit / totalCost) if totalCost > 0 else 0
        profitMargin = (profit / netRevenue) if netRevenue != 0 else 0
        takeRate = (executionCost / gmv) if gmv > 0 else 0

        # Trả về dictionary kết quả (các chỉ số khách hàng phức tạp hơn sẽ được tính ở worker)
        return {
            "gmv": gmv, "netRevenue": netRevenue, "cogs": cogs, "executionCost": executionCost,
            "adSpend": adSpend, "totalCost": totalCost, "profit": profit,
            "roi": roi, "profitMargin": profitMargin, "takeRate": takeRate,
            "totalOrders": totalOrders, "completedOrders": completedOrders, "cancelledOrders": cancelledOrders,
            "refundedOrders": refundedOrders, "aov": aov, "upt": upt, "uniqueSkusSold": uniqueSkusSold,
            "totalQuantitySold": totalQuantitySoldInCompletedOrders,
            "totalCustomers": totalCustomers,
            # Các chỉ số như newCustomers, LTV... sẽ được tính ở worker vì cần thêm truy vấn DB
        }
    except Exception as e:
        print(f"CALCULATOR ERROR (daily): {e}")
        return {} # Trả về dict rỗng nếu có lỗi

# ==============================================================================
# HÀM 2: TÍNH TOÁN KPI TỔNG HỢP CHO MỘT KHOẢNG THỜI GIAN
# ==============================================================================
def calculate_aggregated_kpis(
    all_orders: list[models.Order],
    all_revenues: list[models.Revenue],
    all_ads: list[models.Ad]
) -> dict:
    """
    Tính toán KPI tổng hợp cho một khoảng thời gian từ dữ liệu thô.
    Hàm này không tương tác với DB.
    """
    print("CALCULATOR: Bắt đầu tính toán các chỉ số tổng hợp...")
    try:
        # --- Tính các chỉ số cơ bản ---
        gmv = sum(r.gmv for r in all_revenues)
        netRevenue = sum(r.net_revenue for r in all_revenues)
        executionCost = sum(r.total_fees for r in all_revenues)
        cogs = sum(o.cogs for o in all_orders)
        adSpend = sum(a.expense for a in all_ads)

        # --- Tính các chỉ số vận hành ---
        all_order_codes = {o.order_code for o in all_orders}
        totalOrders = len(all_order_codes)
        
        cancelled_order_codes = {o.order_code for o in all_orders if o.status and ('hủy' in o.status.lower() or 'cancel' in o.status.lower())}
        refunded_order_codes = {r.order_code for r in all_revenues if r.refund > 0}
        
        cancelledOrders = len(cancelled_order_codes)
        refundedOrders = len(refunded_order_codes)
        completed_order_codes = all_order_codes - cancelled_order_codes - refunded_order_codes
        completedOrders = len(completed_order_codes)
        
        totalQuantitySold = sum(o.total_quantity for o in all_orders if o.order_code in completed_order_codes)
        
        unique_skus_sold_set = set()
        for order in all_orders:
            if order.order_code in completed_order_codes and order.details and isinstance(order.details.get('items'), list):
                for item in order.details['items']:
                    if item.get('sku'):
                        unique_skus_sold_set.add(item['sku'])
        uniqueSkusSold = len(unique_skus_sold_set)

        # --- Gộp lại và tính chỉ số phái sinh ---
        kpis = {
            "gmv": gmv, "netRevenue": netRevenue, "executionCost": executionCost, "cogs": cogs,
            "adSpend": adSpend, "totalOrders": totalOrders, "cancelledOrders": cancelledOrders,
            "refundedOrders": refundedOrders, "completedOrders": completedOrders,
            "totalQuantitySold": totalQuantitySold, "uniqueSkusSold": uniqueSkusSold,
        }
        
        kpis['totalCost'] = kpis['cogs'] + kpis['executionCost'] + kpis['adSpend']
        kpis['profit'] = kpis['netRevenue'] - kpis['totalCost']
        
        kpis['roi'] = (kpis['profit'] / kpis['totalCost']) if kpis['totalCost'] > 0 else 0
        kpis['profitMargin'] = (kpis['profit'] / kpis['netRevenue']) if kpis['netRevenue'] != 0 else 0
        kpis['takeRate'] = (kpis['executionCost'] / kpis['gmv']) if kpis['gmv'] > 0 else 0
        kpis['aov'] = (kpis['gmv'] / kpis['completedOrders']) if kpis['completedOrders'] > 0 else 0
        kpis['upt'] = (kpis['totalQuantitySold'] / kpis['completedOrders']) if kpis['completedOrders'] > 0 else 0

        print("CALCULATOR: Hoàn thành tính toán.")
        return kpis
    except Exception as e:
        print(f"CALCULATOR ERROR (aggregated): {e}")
        return {}