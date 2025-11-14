# FILE: Backend/app/kpi_calculator.py
from datetime import date
import models, math  

CANCELLED_STATUSES = {'hủy', 'cancel', 'đã hủy', 'cancelled'}

def _calculate_core_kpis(
    orders: list[models.Order], 
    revenues: list[models.Revenue], 
    ads: list[models.Ad]
) -> dict:
    # === KHỐI 1: TÍNH CÁC CHỈ SỐ TÀI CHÍNH & MARKETING CƠ BẢN ===

    # GMV (Gross Merchandise Value): Tổng giá trị hàng hóa bán ra trước khi trừ chi phí, giảm giá.
    gmv = sum(r.gmv for r in revenues)

    # Net Revenue: Doanh thu thuần, là số tiền thực nhận sau khi trừ phí sàn.
    netRevenue = sum(r.net_revenue for r in revenues)

    # COGS (Cost of Goods Sold): Giá vốn hàng bán, là chi phí trực tiếp để sản xuất ra hàng hóa đã bán.
    cogs = sum(o.cogs for o in orders)

    # Execution Cost: Chi phí vận hành/thực thi, bao gồm các loại phí sàn, phí giao dịch, phí vận chuyển...
    executionCost = abs(sum(r.total_fees for r in revenues))

    # Ad Spend: Tổng chi phí đã chi cho quảng cáo.
    adSpend = sum(a.expense for a in ads)

    # === KHỐI 2: TÍNH CÁC CHỈ SỐ VẬN HÀNH CƠ BẢN ===

    # Lấy tất cả mã đơn hàng duy nhất để có con số tổng chính xác.
    all_order_codes = {o.order_code for o in orders}
    totalOrders = len(all_order_codes)
    
    # Lọc ra các đơn hàng bị hủy dựa trên trạng thái.
    cancelled_order_codes = {o.order_code for o in orders if o.status and o.status.lower() in CANCELLED_STATUSES}
    
    # Khởi tạo tập hợp rỗng cho các đơn hoàn tiền.
    refunded_order_codes = set()

    # 3. Duyệt qua dữ liệu DOANH THU để áp dụng logic hoàn/hủy đặc thù cho từng sàn.
    for r in revenues:
        if r.refund == 0:
            continue

        # Logic cho Shopee: Chỉ cần có refund là tính đơn hoàn.
        if r.source == 'shopee':
            refunded_order_codes.add(r.order_code)
        
        # Logic cho TikTok:
        elif r.source == 'tiktok':
            # Trường hợp 1: Có refund, VÀ cả doanh thu & tổng phí đều KHÁC 0 -> Đây là ĐƠN HOÀN.
            if r.net_revenue != 0 or r.total_fees != 0:
                refunded_order_codes.add(r.order_code)
            # Trường hợp 2: Có refund, nhưng net_revenue hoặc total_fees bằng 0 -> Đây là ĐƠN HỦY.
            else: 
                cancelled_order_codes.add(r.order_code)

    # Tính toán số lượng cuối cùng sau khi đã áp dụng tất cả logic.
    cancelledOrders = len(cancelled_order_codes)
    refundedOrders = len(refunded_order_codes)
    
    # Đơn hàng thành công = Tổng đơn - Đơn hủy - Đơn hoàn tiền. Đây là cơ sở để tính các chỉ số hiệu suất.
    completed_order_codes = all_order_codes - cancelled_order_codes - refunded_order_codes
    completedOrders = len(completed_order_codes)

    # Tổng số lượng sản phẩm đã bán CHỈ TÍNH trên các đơn hàng thành công.
    totalQuantitySoldInCompletedOrders = sum(o.total_quantity for o in orders if o.order_code in completed_order_codes)
    
    # Đếm số lượng SKU (mã sản phẩm) duy nhất đã được bán trong các đơn thành công.
    unique_skus_sold_set = set()
    for order in orders:
        if order.order_code in completed_order_codes and order.details and isinstance(order.details.get('items'), list):
            for item in order.details['items']:
                if item.get('sku'):
                    unique_skus_sold_set.add(item['sku'])
    uniqueSkusSold = len(unique_skus_sold_set)

    # Tỷ lệ chốt đơn (Completion Rate): Tỷ lệ đơn hàng thành công trên tổng số đơn đã tạo.
    completionRate = (completedOrders / totalOrders) if totalOrders > 0 else 0

    # Tỷ lệ hủy đơn (Cancellation Rate): Tỷ lệ đơn hàng bị hủy trên tổng số đơn đã tạo.
    cancellationRate = (cancelledOrders / totalOrders) if totalOrders > 0 else 0

    # Tỷ lệ hoàn tiền (Refund Rate): Tỷ lệ đơn hàng có hoàn tiền trên tổng số đơn đã tạo.
    refundRate = (refundedOrders / totalOrders) if totalOrders > 0 else 0

    # === KHỐI 3: TỔNG HỢP VÀ TÍNH CÁC CHỈ SỐ PHÁI SINH ===

    # Total Cost: Tổng tất cả các loại chi phí (giá vốn + vận hành + quảng cáo).
    totalCost = cogs + executionCost + adSpend

    # Profit: Lợi nhuận, tính bằng GMV trừ Tổng chi phí.
    profit = gmv - totalCost
    
    # AOV (Average Order Value): Giá trị trung bình của một đơn hàng thành công.
    aov = (gmv / completedOrders) if completedOrders > 0 else 0

    # UPT (Units Per Transaction): Số lượng sản phẩm trung bình trên một đơn hàng thành công.
    upt = (totalQuantitySoldInCompletedOrders / completedOrders) if completedOrders > 0 else 0

    # ROI (Return on Investment): Tỷ suất lợi nhuận trên tổng chi phí đầu tư. Mỗi đồng chi phí tạo ra bao nhiêu đồng lợi nhuận.
    roi = (profit / totalCost) if totalCost > 0 else 0

    # Profit Margin: Biên lợi nhuận, cho biết tỷ lệ phần trăm lợi nhuận trên doanh thu thuần.
    profitMargin = (profit / netRevenue) if netRevenue != 0 else 0

    # Take Rate: Tỷ lệ phí mà nền tảng/sàn thu trên tổng giá trị giao dịch (GMV).
    takeRate = (executionCost / gmv) if gmv > 0 else 0

    return {
        # Tài chính
        "gmv": gmv, 
        "netRevenue": netRevenue, 
        "cogs": cogs, 
        "executionCost": executionCost,
        "adSpend": adSpend, 
        "totalCost": totalCost, 
        "profit": profit,
        "roi": roi, 
        "profitMargin": profitMargin, 
        "takeRate": takeRate,

        # Vận hành
        "totalOrders": totalOrders, 
        "completedOrders": completedOrders, 
        "cancelledOrders": cancelledOrders,
        "refundedOrders": refundedOrders, 
        "aov": aov, 
        "upt": upt, 
        "uniqueSkusSold": uniqueSkusSold,
        "totalQuantitySold": totalQuantitySoldInCompletedOrders,
        "completionRate": completionRate,
        "cancellationRate": cancellationRate,
        "refundRate": refundRate
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
        
        # Các chỉ số như newCustomers, LTV... sẽ được tính ở worker vì cần thêm truy vấn DB
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