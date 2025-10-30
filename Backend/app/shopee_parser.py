import pandas as pd
from sqlalchemy.orm import Session
import crud
import io
import traceback
import math

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

def process_order_file(db: Session, file_content: bytes, brand_id: int, source: str):
    try:
        buffer = io.BytesIO(file_content)
        # Đọc toàn bộ file vào df_orig để bảo toàn dữ liệu gốc
        df_orig = pd.read_excel(buffer, header=0, dtype=str).fillna('')

        # --- VÒNG LẶP XỬ LÝ TRÊN DỮ LIỆU GỐC (df_orig) ---
        processed_count = 0
        skipped_count = 0
        
        for index, row in df_orig.iterrows():
            try:
                order_code = row.get('Mã đơn hàng')
                sku = row.get('SKU phân loại hàng')
                
                if not order_code or not sku:
                    skipped_count += 1
                    continue

                # Chuyển đổi và kiểm tra ngày tháng cho từng dòng
                order_datetime = pd.to_datetime(row.get('Ngày đặt hàng'), errors='coerce')
                if pd.isna(order_datetime):
                    print(f"Dòng {index + 2}: Ngày đặt hàng '{row.get('Ngày đặt hàng')}' không hợp lệ, bỏ qua.")
                    skipped_count += 1
                    continue

                order_data = row.to_dict()
                order_data['Ngày đặt hàng'] = order_datetime.date()
                order_data['Số lượng'] = to_int(row.get('Số lượng'))
                
                crud.get_or_create_customer(db, customer_data=order_data, brand_id=brand_id)
                crud.create_order_entry(db, order_data=order_data, brand_id=brand_id, source=source)
                
                processed_count += 1

            except Exception as e:
                print(f"Lỗi xử lý dòng {index + 2}: {e}. Dữ liệu dòng: {row.to_dict()}")
                skipped_count += 1
                continue

        message = f"Hoàn tất! Đã xử lý {processed_count}/{len(df_orig)} dòng sản phẩm."
        if skipped_count > 0:
            message += f" Đã bỏ qua {skipped_count} dòng bị lỗi hoặc thiếu dữ liệu."
            
        return {"status": "success", "message": message}
        
    except Exception as e: 
        print("--- LỖI NGHIÊM TRỌNG TRONG process_order_file ---")
        traceback.print_exc()
        return {"status": "error", "message": f"Lỗi hệ thống nghiêm trọng: {e}"}

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