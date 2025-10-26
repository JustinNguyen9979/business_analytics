import pandas as pd
from sqlalchemy.orm import Session
import crud
import io
import traceback

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
        buffer = io.BytesIO(file_content)
        # Đọc toàn bộ file vào df_orig để bảo toàn dữ liệu gốc
        df_orig = pd.read_excel(buffer, header=0, dtype=str).fillna('')

        # --- LOGIC XÓA DỮ LIỆU CŨ (AN TOÀN) ---
        # Chỉ thực hiện xóa nếu DataFrame có dữ liệu và có cột "Ngày đặt hàng"
        if not df_orig.empty and "Ngày đặt hàng" in df_orig.columns:
            try:
                # Tạo một bản sao chỉ để xác định khoảng thời gian, không làm thay đổi df_orig
                df_dates = df_orig[["Ngày đặt hàng"]].copy()
                df_dates["Ngày đặt hàng"] = pd.to_datetime(df_dates["Ngày đặt hàng"], errors='coerce')
                df_dates.dropna(subset=["Ngày đặt hàng"], inplace=True)
                
                if not df_dates.empty:
                    start_date = df_dates["Ngày đặt hàng"].min()
                    end_date = df_dates["Ngày đặt hàng"].max()
                    print(f"Sẽ xóa dữ liệu đơn hàng từ {start_date} đến {end_date}")
                    crud.delete_orders_in_date_range(db, brand_id, start_date, end_date)
            except Exception as e:
                print(f"CẢNH BÁO: Không thể xóa dữ liệu cũ. Lỗi: {e}. Quá trình import sẽ tiếp tục.")

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
                crud.create_order_entry(db, order_data=order_data, brand_id=brand_id)
                
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

def process_ad_file(db: Session, file_content: bytes, brand_id: int):
    try:
        buffer = io.BytesIO(file_content)
        df = pd.read_csv(buffer, skiprows=7, thousands=',')
        df.replace('-', 0, inplace=True)

        if not df.empty and 'Ngày bắt đầu' in df.columns:
            df['Ngày bắt đầu'] = pd.to_datetime(df['Ngày bắt đầu'], format='%d/%m/%Y %H:%M:%S', errors='coerce')
            df['Ngày kết thúc'] = pd.to_datetime(df['Ngày kết thúc'], format='%d/%m/%Y %H:%M:%S', errors='coerce')
            start_date = df['Ngày bắt đầu'].min()
            end_date = df['Ngày bắt đầu'].max()
            if pd.notna(start_date) and pd.notna(end_date):
                crud.delete_ads_in_date_range(db, brand_id, start_date, end_date)
        
        count = 0
        for _, row in df.iterrows():
            start_date_val = row.get('Ngày bắt đầu').date() if pd.notna(row.get('Ngày bắt đầu')) else None
            end_date_val = row.get('Ngày kết thúc').date() if pd.notna(row.get('Ngày kết thúc')) else None

            ad_data = {
                "campaign_name": row.get('Tên Dịch vụ Hiển thị'),
                "status": row.get('Trạng thái'),
                "ad_type": row.get('Loại Dịch vụ Hiển thị'),
                "product_id": str(row.get('Mã sản phẩm')),
                "target_audience_settings": row.get('Cài đặt Đối tượng'),
                "ad_content": row.get('Nội dung Dịch vụ Hiển thị'),
                "bidding_method": row.get('Phương thức đấu thầu'),
                "location": row.get('Vị trí'),
                "start_date": start_date_val,
                "end_date": end_date_val,
                "impressions": to_int(row.get('Số lượt xem')),
                "clicks": to_int(row.get('Số lượt click')),
                "ctr": to_percent_float(row.get('Tỷ Lệ Click')), 
                "conversions": to_int(row.get('Lượt chuyển đổi')),
                "direct_conversions": to_int(row.get('Lượt chuyển đổi trực tiếp')),
                "conversion_rate": to_percent_float(row.get('Tỷ lệ chuyển đổi')), 
                "direct_conversion_rate": to_percent_float(row.get('Tỷ lệ chuyển đổi trực tiếp')), 
                "cost_per_conversion": to_float(row.get('Chi phí cho mỗi lượt chuyển đổi')),
                "cost_per_direct_conversion": to_float(row.get('Chi phí cho mỗi lượt chuyển đổi trực tiếp')),
                "items_sold": to_int(row.get('Sản phẩm đã bán')),
                "direct_items_sold": to_int(row.get('Sản phẩm đã bán trực tiếp')),
                "gmv": to_float(row.get('GMV')),
                "direct_gmv": to_float(row.get('GMV trực tiếp')),
                "expense": to_float(row.get('Chi phí')),
                "roas": to_float(row.get('ROAS')),
                "direct_roas": to_float(row.get('ROAS trực tiếp')),
                "acos": to_percent_float(row.get('ACOS')), 
                "direct_acos": to_percent_float(row.get('ACOS trực tiếp')), 
                "product_impressions": to_int(row.get('Lượt xem Sản phẩm')),
                "product_clicks": to_int(row.get('Lượt clicks Sản phẩm')),
                "product_ctr": to_percent_float(row.get('Tỷ lệ Click Sản phẩm')) 
            }
            crud.create_ad_entry(db, ad_data=ad_data, brand_id=brand_id)
            count += 1
        return {"status": "success", "message": f"Đã xử lý {count} dòng quảng cáo."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def process_revenue_file(db: Session, file_content: bytes, brand_id: int):
    try:
        buffer = io.BytesIO(file_content)
        df = pd.read_excel(buffer, header=2, parse_dates=['Ngày hoàn thành thanh toán', 'Ngày đặt hàng'])
        df_orders = df[df['Đơn hàng / Sản phẩm'] == 'Order'].copy()
        
        if not df_orders.empty:
            start_date = df_orders["Ngày hoàn thành thanh toán"].min()
            end_date = df_orders["Ngày hoàn thành thanh toán"].max()
            if pd.notna(start_date) and pd.notna(end_date):
                 crud.delete_revenues_in_date_range(db, brand_id, start_date, end_date)
        
        count = 0
        for _, row in df_orders.iterrows():
            order_date_val = row.get('Ngày đặt hàng').date() if pd.notna(row.get('Ngày đặt hàng')) else None
            payment_date_val = row.get('Ngày hoàn thành thanh toán').date() if pd.notna(row.get('Ngày hoàn thành thanh toán')) else None

            revenue_data = {
                "order_code": row.get('Mã đơn hàng'),
                "refund_request_code": row.get('Mã yêu cầu hoàn tiền'),
                "order_date": order_date_val,
                "payment_completed_date": payment_date_val,
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
                "buyer_username": row.get('Người mua')
            }
            crud.create_revenue_entry(db, revenue_data=revenue_data, brand_id=brand_id)
            count += 1
        return {"status": "success", "message": f"Đã xử lý {count} dòng doanh thu."}
    except Exception as e:
        return {"status": "error", "message": str(e)}