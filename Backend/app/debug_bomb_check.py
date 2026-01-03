import sys
import os
from datetime import date, datetime, timedelta
from sqlalchemy import func, text

# Setup môi trường (Không cần thiết nếu chạy ngay tại root /app nhưng giữ lại để an toàn)
sys.path.append(os.getcwd())

# Import trực tiếp vì script nằm cùng cấp với modules trong /app
try:
    from database import SessionLocal
    import models
    import kpi_utils
except ImportError:
    # Fallback nếu chạy từ bên ngoài (như IDE)
    from app.database import SessionLocal
    from app import models, kpi_utils

from unidecode import unidecode

# --- CẤU HÌNH ---
BRAND_SLUG = "honeyland"  # <--- Anh thay slug brand của anh vào đây nếu khác
START_DATE = "2025-12-01"     # Ngày bắt đầu check
END_DATE = "2025-12-31"       # Ngày kết thúc check

def debug_bomb_orders():
    db = SessionLocal()
    try:
        # 1. Lấy Brand ID
        brand = db.query(models.Brand).filter(models.Brand.slug == BRAND_SLUG).first()
        if not brand:
            print(f"❌ Không tìm thấy brand: {BRAND_SLUG}")
            return

        print(f"\n=== DEBUG BOM HÀNG: {BRAND_SLUG} ({START_DATE} -> {END_DATE}) ===")
        print(f"Logic: Check status hoặc lý do hủy chứa keywords: {kpi_utils.BOMB_REASON_KEYWORDS[:5]}...")

        # 2. LẤY DỮ LIỆU GỐC (ORDERS) & TỰ TÍNH TOÁN
        orders = db.query(models.Order).filter(
            models.Order.brand_id == brand.id,
            func.date(models.Order.order_date).between(START_DATE, END_DATE)
        ).all()

        calculated_bombs = 0
        calculated_bombs_details = []
        
        # Danh sách này để đối chiếu với logic cũ/mới
        bomb_reasons_found = {} 

        for order in orders:
            # Tái hiện logic phân loại của hệ thống (MỚI)
            status = order.status or ""
            reason = ""
            if order.details and isinstance(order.details, dict):
                reason = order.details.get('cancel_reason', '')
            
            # --- LOGIC CHECK BOM MỚI ---
            is_bomb = False
            match_source = ""
            
            # Bước 1: Check nhóm Hủy
            is_cancel_group = kpi_utils._matches_keywords(status, kpi_utils.ORDER_STATUS_KEYWORDS["cancel_status"])
            
            if is_cancel_group:
                # Nếu là Hủy, soi Reason
                if kpi_utils._is_bomb_order(status, reason):
                    is_bomb = True
                    match_source = f"Cancel Group -> Reason: {reason}"
            
            # Bước 2: Check nhóm Bom đặc thù (nếu chưa phải là bomb)
            elif kpi_utils._matches_keywords(status, kpi_utils.ORDER_STATUS_KEYWORDS["bomb_status"]):
                is_bomb = True
                match_source = f"Bomb Status: {status}"

            if is_bomb:
                calculated_bombs += 1
                calculated_bombs_details.append(f"[{order.source}] {order.order_code} | {match_source}")
                
                # Thống kê nhanh lý do
                key = match_source.split(": ")[-1] if ": " in match_source else match_source
                bomb_reasons_found[key] = bomb_reasons_found.get(key, 0) + 1

        # 3. LẤY DỮ LIỆU ĐÃ LƯU TRONG DB (DAILY ANALYTICS - Nguồn Chart)
        analytics = db.query(
            func.sum(models.DailyAnalytics.bomb_orders)
        ).filter(
            models.DailyAnalytics.brand_id == brand.id,
            models.DailyAnalytics.date.between(START_DATE, END_DATE)
        ).scalar() or 0

        # 4. SO SÁNH
        print(f"\n--- KẾT QUẢ SO SÁNH ---")
        print(f"✅ (A) Thực tế quét từ đơn hàng (Live): {calculated_bombs} đơn")
        print(f"📊 (B) Dữ liệu đang hiển thị trên Chart: {int(analytics)} đơn")
        
        diff = calculated_bombs - int(analytics)
        
        if diff == 0:
            print(f"🎉 KHỚP SỐ LIỆU! Hệ thống hoạt động đúng.")
        else:
            print(f"⚠️  LỆCH SỐ LIỆU: {diff} đơn")
            if diff > 0:
                print("=> Có đơn Bom mới chưa được cập nhật vào Chart (Cần chạy lại Recalculate).")
            else:
                print("=> Chart đang đếm dư (Có thể do đơn đã xóa hoặc đổi trạng thái nhưng Chart chưa cập nhật).")

        print(f"\n--- CHI TIẾT CÁC ĐƠN BOM TÌM THẤY (Live) ---")
        print(f"Tổng hợp lý do bắt được:")
        for r, c in bomb_reasons_found.items():
            print(f"  - {r}: {c} đơn")

        if calculated_bombs_details:
             print(f"\nDanh sách 10 đơn Bom đầu tiên:")
             for d in calculated_bombs_details[:10]:
                 print(f"  - {d}")

    except Exception as e:
        print(f"Lỗi: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    debug_bomb_orders()
