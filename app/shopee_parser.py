import pandas as pd
from sqlalchemy.orm import Session
from . import crud
import io

# --- CÁC HÀM HỖ TRỢ CHUYỂN ĐỔI DỮ LIỆU ---
def to_int(value):
    try:
        # Xóa dấu phẩy ngăn cách hàng nghìn và chuyển thành số nguyên
        return int(str(value).replace(',', ''))
    except (ValueError, TypeError):
        return 0

def to_float(value):
    try:
        # Xóa dấu phẩy ngăn cách hàng nghìn và chuyển thành số thực
        return float(str(value).replace(',', ''))
    except (ValueError, TypeError):
        return 0.0

def to_percent_float(value):
    try:
        # Xóa ký tự '%' và chuyển thành số thực (ví dụ: '5.25%' -> 5.25)
        return float(str(value).replace('%', ''))
    except (ValueError, TypeError):
        return 0.0

def process_cost_file(db: Session, file_content: bytes, brand_id: int): # Giữ nguyên logic overwrite
    try:
        buffer = io.BytesIO(file_content); df = pd.read_excel(buffer, usecols=[0, 1], header=0, names=['sku', 'cost_price'])
        df.dropna(subset=['sku'], inplace=True); df['sku'] = df['sku'].astype(str)
        df['cost_price'] = pd.to_numeric(df['cost_price'], errors='coerce').fillna(0).astype(int)
        for _, row in df.iterrows():
            product = crud.get_or_create_product(db, sku=row['sku'], brand_id=brand_id)
            crud.update_product_cost_price(db, product_id=product.id, cost_price=row['cost_price'])
        return {"status": "success", "message": f"Đã xử lý {len(df)} sản phẩm."}
    except Exception as e: return {"status": "error", "message": str(e)}

def process_order_file(db: Session, file_content: bytes, brand_id: int):
    try:
        buffer = io.BytesIO(file_content); df = pd.read_excel(buffer, header=0, parse_dates=["Ngày đặt hàng"])
        if not df.empty:
            start_date = df["Ngày đặt hàng"].min(); end_date = df["Ngày đặt hàng"].max()
            crud.delete_orders_in_date_range(db, brand_id, start_date, end_date)
        
        count = 0
        for _, row in df.iterrows():
            if pd.notna(row.get('SKU phân loại hàng')):
                crud.get_or_create_customer(db, customer_data=row.to_dict(), brand_id=brand_id)
                crud.create_order_entry(db, order_data=row.to_dict(), brand_id=brand_id)
                count += 1
        return {"status": "success", "message": f"Đã xử lý {count} đơn hàng."}
    except Exception as e: return {"status": "error", "message": str(e)}

def process_ad_file(db: Session, file_content: bytes, brand_id: int):
    try:
        buffer = io.BytesIO(file_content); df = pd.read_csv(buffer, skiprows=7, thousands=',', parse_dates=['Ngày bắt đầu'], dayfirst=True)
        if not df.empty:
            start_date = df["Ngày bắt đầu"].min(); end_date = df["Ngày bắt đầu"].max()
            crud.delete_ads_in_date_range(db, brand_id, start_date, end_date)
        
        count = 0
        for _, row in df.iterrows():
            ad_data = { "campaign_name": row['Tên Dịch vụ Hiển thị'], "start_date": row['Ngày bắt đầu'], "impressions": int(row['Số lượt xem']), "clicks": int(row['Số lượt click']),
                "ctr": float(str(row['Tỷ Lệ Click']).strip('%'))/100, "conversions": int(row['Lượt chuyển đổi']), "items_sold": int(row['Sản phẩm đã bán']),
                "gmv": float(row['GMV']), "expense": float(row['Chi phí']), "roas": float(row['ROAS']) }
            crud.create_ad_entry(db, ad_data=ad_data, brand_id=brand_id)
            count += 1
        return {"status": "success", "message": f"Đã xử lý {count} dòng quảng cáo."}
    except Exception as e: return {"status": "error", "message": str(e)}

def process_revenue_file(db: Session, file_content: bytes, brand_id: int):
    try:
        buffer = io.BytesIO(file_content)
        # Thêm 'Ngày đặt hàng' vào danh sách parse_dates
        df = pd.read_excel(buffer, header=2, parse_dates=['Ngày hoàn thành thanh toán', 'Ngày đặt hàng'])
        
        # Chỉ lấy những dòng có "Order"
        df_orders = df[df['Đơn hàng / Sản phẩm'] == 'Order'].copy()
        
        # Logic xóa dữ liệu cũ trong khoảng thời gian của file mới
        if not df_orders.empty:
            start_date = df_orders["Ngày hoàn thành thanh toán"].min()
            end_date = df_orders["Ngày hoàn thành thanh toán"].max()
            if pd.notna(start_date) and pd.notna(end_date):
                 crud.delete_revenues_in_date_range(db, brand_id, start_date, end_date)
        
        count = 0
        for _, row in df_orders.iterrows():
            # Ánh xạ toàn bộ cột từ file Excel vào dictionary
            revenue_data = {
                "order_code": row.get('Mã đơn hàng'),
                "refund_request_code": row.get('Mã yêu cầu hoàn tiền'),
                "order_date": row.get('Ngày đặt hàng'),
                "payment_completed_date": row.get('Ngày hoàn thành thanh toán'),
                "total_payment": to_float(row.get('Tổng tiền đã thanh toán')),
                "product_price": to_float(row.get('Giá sản phẩm')),
                "refund_amount": to_float(row.get('Số tiền hoàn lại')),
                "shipping_fee": to_float(row.get('Phí vận chuyển')),
                "buyer_paid_shipping_fee": to_float(row.get('Người mua trả')),
                "actual_shipping_fee": to_float(row.get('Phí vận chuyển thực tế')),
                "shopee_subsidized_shipping_fee": to_float(row.get('Phí vận chuyển được trợ giá từ Shopee')),
                "seller_voucher_code": row.get('Mã ưu đãi do Người Bán chịu'),
                "fixed_fee": to_float(row.get('Phí cố định')),
                "service_fee": to_float(row.get('Phí Dịch Vụ')),
                "payment_fee": to_float(row.get('Phí thanh toán')),
                "commission_fee": to_float(row.get('Phí hoa hồng')),
                "affiliate_marketing_fee": to_float(row.get('Tiếp thị liên kết')),
                "buyer_username": row.get('Người Mua')
            }
            # Dùng .get() để tránh lỗi nếu một cột nào đó không tồn tại
            
            crud.create_revenue_entry(db, revenue_data=revenue_data, brand_id=brand_id)
            count += 1
        return {"status": "success", "message": f"Đã xử lý {count} dòng doanh thu."}
    except Exception as e:
        return {"status": "error", "message": str(e)}