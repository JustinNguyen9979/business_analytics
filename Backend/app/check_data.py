import sys
import os
from datetime import date, datetime

# Thêm đường dẫn để import được các module trong Backend/app
sys.path.append(os.path.join(os.getcwd(), 'Backend/app'))

from database import SessionLocal
from models import Order, Revenue, DailyStat, DailyAnalytics
from kpi_calculator import _classify_order_status, _calculate_core_kpis, CANCEL_REASON_MAPPING
from sqlalchemy import func, create_engine

def print_separator():
    print("-" * 100)

def check_daily_logic(brand_id, target_date_str):
    db = SessionLocal()
    try:
        target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
        print_separator()
        print(f"🔍 BẮT ĐẦU KIỂM TRA DỮ LIỆU NGÀY: {target_date} (Brand ID: {brand_id})")
        print_separator()

        # 1. LẤY DỮ LIỆU THÔ
        # Lấy đơn hàng tạo trong ngày
        orders = db.query(Order).filter(
            Order.brand_id == brand_id,
            func.date(Order.order_date) == target_date
        ).all()
        
        # Lấy mã đơn
        order_codes = {o.order_code for o in orders}
        
        # Lấy Revenue liên quan
        revenues = db.query(Revenue).filter(
            Revenue.brand_id == brand_id,
            Revenue.order_code.in_(order_codes)
        ).all()

        print(f"📊 DỮ LIỆU ĐẦU VÀO:")
        print(f"   - Tổng số đơn hàng tìm thấy (theo Order Date): {len(orders)}")
        print(f"   - Tổng số dòng doanh thu tìm thấy (theo mã đơn): {len(revenues)}")
        print_separator()

        # Map revenue theo order code để tra cứu nhanh
        rev_map = {}
        for r in revenues:
            if r.order_code not in rev_map:
                rev_map[r.order_code] = {"net_revenue": 0, "refund": 0, "total_fees": 0}
            rev_map[r.order_code]["net_revenue"] += (r.net_revenue or 0)
            rev_map[r.order_code]["refund"] += (r.refund or 0)
            rev_map[r.order_code]["total_fees"] += (r.total_fees or 0) # Phí sàn/thực thi

        calc_stats = {
            "completed": 0, "cancelled": 0, "bomb": 0, "refunded": 0, 
            "revenue": 0, "gmv": 0, "execution_cost": 0
        }

        print(f"{'MÃ ĐƠN':<20} | {'STATUS GỐC':<15} | {'GMV':<10} | {'REVENUE':<10} | {'COST':<8} | {'REFUND':<8} | {'-> STATUS':<12} | {'GHI CHÚ'}")
        print("-" * 115)

        for order in orders:
            code = order.order_code
            status_goc = order.status or "None"
            
            # Lấy thông tin tài chính
            fin_info = rev_map.get(code, {"net_revenue": 0, "refund": 0, "total_fees": 0})
            rev_val = fin_info["net_revenue"]
            refund_val = fin_info["refund"]
            fees_val = abs(fin_info["total_fees"]) # Cost luôn dương để dễ nhìn
            
            # Lấy GMV từ Order
            gmv_val = order.gmv or 0

            # GIẢ LẬP LOGIC CỦA HỆ THỐNG
            # 1. Check refund để quyết định status
            has_refund = refund_val < 0
            final_status = _classify_order_status(order, -1 if has_refund else 0)
            
            # 2. Cộng dồn thống kê
            if final_status in calc_stats:
                calc_stats[final_status] += 1
            calc_stats["revenue"] += rev_val
            calc_stats["gmv"] += gmv_val
            calc_stats["execution_cost"] += fees_val

            # Tạo ghi chú lý do
            note = ""
            if final_status == "refunded":
                note = "Refund < 0"
            elif final_status == "bomb":
                reason = order.details.get('cancel_reason', '') if order.details else ''
                # Cắt ngắn lý do nếu dài quá
                short_reason = (reason[:15] + '..') if len(reason) > 15 else reason
                note = f"Bom Kw: {short_reason}"
            elif final_status == "completed" and rev_val == 0:
                note = "⚠️ Rev=0"

            print(f"{code:<20} | {status_goc[:15]:<15} | {gmv_val:,.0f}{'':<4} | {rev_val:,.0f}{'':<4} | {fees_val:,.0f}{'':<4} | {refund_val:,.0f}{'':<2} | -> {final_status.upper():<12} | {note}")

        print_separator()
        
        # 3. SO SÁNH VỚI DATABASE (Bảng DailyStat)
        print("⚖️  SO SÁNH KẾT QUẢ:")
        
        db_stat = db.query(DailyStat).filter(
            DailyStat.brand_id == brand_id,
            DailyStat.date == target_date
        ).first()

        def compare(label, calc_val, db_val):
            diff = calc_val - db_val
            status = "✅ Khớp" if diff == 0 else f"❌ LỆCH {diff:,.0f}"
            print(f"   - {label:<20}: Tính tay = {calc_val:<12,.0f} | DB lưu = {db_val:<12,.0f} -> {status}")

        if db_stat:
            compare("GMV", calc_stats["gmv"], db_stat.gmv or 0)
            compare("Doanh thu (Net)", calc_stats["revenue"], db_stat.net_revenue or 0)
            compare("Chi phí sàn (Cost)", calc_stats["execution_cost"], db_stat.execution_cost or 0)
            print("-" * 60)
            compare("Đơn Thành công", calc_stats["completed"], db_stat.completed_orders or 0)
            compare("Đơn Bom", calc_stats["bomb"], db_stat.bomb_orders or 0)
            compare("Đơn Hoàn", calc_stats["refunded"], db_stat.refunded_orders or 0)
            compare("Đơn Hủy", calc_stats["cancelled"], db_stat.cancelled_orders or 0)
        else:
            print("⚠️  Chưa có dữ liệu trong bảng DailyStat cho ngày này (Cần chạy lại Import/Recalculate).")

    except Exception as e:
        print(f"❌ CÓ LỖI XẢY RA: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    # Mặc định test Brand ID 1 và ngày hôm nay, hoặc anh có thể sửa ở đây
    # Ví dụ: python check_data.py 2024-12-20
    
    if len(sys.argv) > 1:
        date_input = sys.argv[1]
    else:
        print("⚠️ Vui lòng nhập ngày cần kiểm tra (YYYY-MM-DD):")
        date_input = input("> ").strip()
    
    # Giả định Brand ID là 1 (Anh có thể sửa nếu cần)
    BRAND_ID = 1 
    
    check_daily_logic(BRAND_ID, date_input)
