import pandas as pd
from sqlalchemy.orm import Session
import crud
import io
import traceback
import math
import models

# --- CÁC HÀM HỖ TRỢ CHUYỂN ĐỔI DỮ LIỆU ---
def to_int(value):
    try:
        return abs(int(str(value).replace(',', '')))
    except (ValueError, TypeError):
        return 0

def to_float_raw(value):
    try:
        # Bỏ qua hàm abs()
        return float(str(value).replace(',', ''))
    except (ValueError, TypeError):
        return 0.0

def to_float(value):
    try:
        return abs(float(str(value).replace(',', '')))
    except (ValueError, TypeError):
        return 0.0

def to_percent_float(value):
    try:
        return abs(float(str(value).replace('%', ''))) 
    except (ValueError, TypeError):
        return 0.0

def process_cost_file(db: Session, file_content: bytes, brand_id: int): 
    try:
        buffer = io.BytesIO(file_content)
        # SỬA ĐỔI 1: Đọc 3 cột thay vì 2, và đặt tên cho chúng
        df = pd.read_excel(buffer, usecols=[0, 1, 2], header=0, names=['sku', 'name', 'cost_price'])
        
        # Tiền xử lý dữ liệu
        df.dropna(subset=['sku'], inplace=True) # Vẫn yêu cầu SKU là bắt buộc
        df['sku'] = df['sku'].astype(str)
        df['name'] = df['name'].astype(str).fillna('') # Chuyển tên SP thành chuỗi, nếu trống thì là chuỗi rỗng
        df['cost_price'] = pd.to_numeric(df['cost_price'], errors='coerce').fillna(0).astype(int)

        count = 0
        for _, row in df.iterrows():
            # SỬA ĐỔI 2: Khi tạo/lấy sản phẩm, nếu nó đã tồn tại, ta sẽ cập nhật lại tên
            product = crud.get_or_create_product(db, sku=row['sku'], brand_id=brand_id)
            
            # SỬA ĐỔI 3: Gọi hàm cập nhật cả tên và giá vốn
            crud.update_product_details(
                db, 
                product_id=product.id, 
                name=row['name'], 
                cost_price=row['cost_price']
            )
            count += 1
            
        return {"status": "success", "message": f"Đã xử lý {count} sản phẩm."}
    except Exception as e:
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

# FILE: backend/app/shopee_parser.py

def process_order_file(db: Session, file_content: bytes, brand_id: int, source: str):
    try:
        buffer = io.BytesIO(file_content)
        # Đọc file, giữ nguyên dtype là string để kiểm soát
        df = pd.read_excel(buffer, header=0, dtype=str).fillna('')
        
        # Chuyển đổi kiểu dữ liệu một cách có kiểm soát
        df['Ngày đặt hàng'] = pd.to_datetime(df['Ngày đặt hàng'], errors='coerce')
        df['Số lượng'] = pd.to_numeric(df['Số lượng'], errors='coerce').fillna(0)
        
        products = db.query(models.Product).filter(models.Product.brand_id == brand_id).all()
        product_cost_map = {p.sku: p.cost_price for p in products}

        grouped = df.groupby('Mã đơn hàng')

        count = 0
        for order_code, group in grouped:
            if not order_code: continue

            first_row = group.iloc[0]

            order_cogs = 0
            items_details = []
            for _, row in group.iterrows():
                sku = row.get('SKU phân loại hàng')
                quantity = int(row.get('Số lượng')) # Chuyển sang int
                cost_price = product_cost_map.get(sku, 0)
                order_cogs += cost_price * quantity
                
                items_details.append({
                    "sku": sku,
                    "name": row.get('Tên phân loại hàng'),
                    "quantity": quantity
                })
            
            # === SỬA LỖI Ở ĐÂY: CHUYỂN TOÀN BỘ DỮ LIỆU GỐC THÀNH STRING ===
            # Cách này đảm bảo không có kiểu dữ liệu phức tạp nào lọt vào JSON
            details_dict = first_row.astype(str).to_dict()
            details_dict['items'] = items_details
            
            order_data = {
                "order_code": order_code,
                "order_date": first_row.get('Ngày đặt hàng').date() if pd.notna(first_row.get('Ngày đặt hàng')) else None,
                "status": first_row.get('Trạng Thái Đơn Hàng'),
                "username": first_row.get('Người Mua'),
                "total_quantity": int(group['Số lượng'].sum()), # Chuyển sang int
                "cogs": order_cogs,
                "details": details_dict
            }
            
            crud.create_order_entry(db, order_data=order_data, brand_id=brand_id, source=source)
            crud.get_or_create_customer(db, customer_data=first_row.to_dict(), brand_id=brand_id)
            count += 1
            
        return {"status": "success", "message": f"Đã xử lý {count} đơn hàng."}
    except Exception as e:
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

def process_ad_file(db: Session, file_content: bytes, brand_id: int, source: str):
    try:
        buffer = io.BytesIO(file_content)
        df = pd.read_csv(buffer, skiprows=7, thousands=',')
        df['Ngày bắt đầu'] = pd.to_datetime(df['Ngày bắt đầu'], format='%d/%m/%Y %H:%M:%S', errors='coerce')
        
        count = 0
        for _, row in df.iterrows():
            # Gom tất cả dữ liệu gốc vào một dictionary
            details_dict = row.astype(str).to_dict()

            ad_data = {
                # Trích xuất các chỉ số cốt lõi
                "campaign_name": row.get('Tên Dịch vụ Hiển thị'),
                "ad_date": row.get('Ngày bắt đầu').date() if pd.notna(row.get('Ngày bắt đầu')) else None,
                "impressions": to_int(row.get('Số lượt xem')),
                "clicks": to_int(row.get('Số lượt click')),
                "expense": to_float_raw(row.get('Chi phí')),
                "orders": to_int(row.get('Lượt chuyển đổi')),
                "gmv": to_float_raw(row.get('GMV')),
                # Lưu toàn bộ dòng gốc vào details
                "details": details_dict
            }
            crud.create_ad_entry(db, ad_data=ad_data, brand_id=brand_id, source=source)
            count += 1
        return {"status": "success", "message": f"Đã xử lý {count} dòng quảng cáo."}
    except Exception as e:
        traceback.print_exc()
        return {"status": "error", "message": str(e)}

def process_revenue_file(db: Session, file_content: bytes, brand_id: int, source: str):
    try:
        buffer = io.BytesIO(file_content)
        df = pd.read_excel(buffer, header=2)
        df_orders = df[df['Đơn hàng / Sản phẩm'] == 'Order'].copy()
        df_orders['Ngày hoàn thành thanh toán'] = pd.to_datetime(df_orders['Ngày hoàn thành thanh toán'], errors='coerce')

        count = 0
        for _, row in df_orders.iterrows():
            # Gom tất cả dữ liệu gốc vào một dictionary
            details_dict = row.astype(str).to_dict()

            revenue_data = {
                # Trích xuất các chỉ số cốt lõi
                "order_code": row.get('Mã đơn hàng'),
                "transaction_date": row.get('Ngày hoàn thành thanh toán').date() if pd.notna(row.get('Ngày hoàn thành thanh toán')) else None,
                "gmv": to_float_raw(row.get('Giá sản phẩm')),
                "net_revenue": to_float_raw(row.get('Tổng tiền đã thanh toán')),
                # Lưu toàn bộ dòng gốc vào details
                "details": details_dict
            }
            crud.create_revenue_entry(db, revenue_data=revenue_data, brand_id=brand_id, source=source)
            count += 1
        return {"status": "success", "message": f"Đã xử lý {count} dòng doanh thu."}
    except Exception as e:
        traceback.print_exc()
        return {"status": "error", "message": str(e)}