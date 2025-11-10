import pandas as pd
from sqlalchemy.orm import Session
import traceback, json, models, crud

# --- HÀM HỖ TRỢ GIỮ NGUYÊN ---
def to_float_safe(value):
    try: return float(str(value).replace(',', ''))
    except (ValueError, TypeError): return 0.0
def to_int_safe(value):
    try: return int(str(value).replace(',', ''))
    except (ValueError, TypeError): return 0

# ==============================================================================
# HÀM XỬ LÝ FILE ĐƠN HÀNG (ORDER) CỦA TIKTOK
# ==============================================================================
def process_order_file(db: Session, file_content: bytes, brand_id: int, source: str):
    try:
        # <<< SỬA LỖI 1: ĐỌC FILE CHO ĐÚNG >>>
        # header=0: Dòng 1 là tiêu đề. skiprows=[1]: Bỏ qua dòng thứ 2.
        df = pd.read_excel(file_content, header=0, skiprows=[1], dtype=str).fillna('')
        
        # <<< SỬA LỖI 2: CHỈ ĐỊNH ĐÚNG ĐỊNH DẠNG NGÀY THÁNG >>>
        # format='%d/%m/%Y %H:%M:%S' khớp với '31/10/2025 23:42:29'
        df['Created Time'] = pd.to_datetime(df['Created Time'], format='%d/%m/%Y %H:%M:%S', errors='coerce')
        df['Quantity'] = pd.to_numeric(df['Quantity'], errors='coerce').fillna(0).astype(int)

        if df.empty:
            return {"status": "success", "message": "File đơn hàng TikTok không có dữ liệu."}
            
        # --- Logic "Chỉ thêm mới" --- (Giữ nguyên, logic này đã đúng)
        order_codes_in_file = df['Order ID'].dropna().unique().tolist()
        if not order_codes_in_file: return {"status": "success", "message": "Không tìm thấy mã đơn hàng."}
        existing_order_codes_set = {code for code, in db.query(models.Order.order_code).filter(models.Order.brand_id == brand_id, models.Order.order_code.in_(order_codes_in_file)).all()}
        new_order_codes = set(order_codes_in_file) - existing_order_codes_set
        if not new_order_codes: return {"status": "success", "message": "Không có đơn hàng TikTok mới."}
        df_new = df[df['Order ID'].isin(new_order_codes)].copy()

        # --- Lấy giá vốn và xử lý khách hàng --- (Giữ nguyên)
        product_cost_map = {p.sku: p.cost_price for p in db.query(models.Product.sku, models.Product.cost_price).filter(models.Product.brand_id == brand_id).all()}
        # (Logic xử lý khách hàng)
        
        # --- Chuẩn bị dữ liệu để ghi hàng loạt ---
        new_orders_count = 0
        for order_code, group in df_new.groupby('Order ID'):
            first_row = group.iloc[0]
            items_details = []
            order_cogs = 0.0
            for _, row in group.iterrows():
                sku = row.get('Seller SKU')
                quantity = int(row.get('Quantity'))
                order_cogs += float(product_cost_map.get(sku, 0)) * quantity
                items_details.append({"sku": sku, "name": row.get('Product Name'), "variation": row.get('Variation'), "quantity": quantity})

            details_dict = first_row.to_dict()
            # Chuyển đổi các giá trị không an toàn thành chuỗi
            for key, value in details_dict.items():
                details_dict[key] = str(value) if pd.notna(value) else None
            details_dict['items'] = items_details
            
            order_data = {
                "order_code": order_code,
                "order_date": first_row.get('Created Time').date() if pd.notna(first_row.get('Created Time')) else None,
                "status": first_row.get('Order Status'), "username": first_row.get('Buyer Username'),
                "total_quantity": int(group['Quantity'].sum()), "cogs": float(order_cogs),
                "details": details_dict, # <<< ĐƯA DICTIONARY THƯỜNG VÀO
            }
            # Gọi hàm crud để thêm vào session, SQLAlchemy sẽ tự xử lý JSON
            crud.create_order_entry(db, order_data=order_data, brand_id=brand_id, source=source)
            new_orders_count += 1

        # <<< COMMIT MỘT LẦN DUY NHẤT Ở CUỐI >>>
        if new_orders_count > 0:
            print(f"Đã chuẩn bị {new_orders_count} đơn hàng, thực hiện commit...")
            db.commit()
            print("COMMIT THÀNH CÔNG.")
            
        return {"status": "success", "message": f"Đã import thành công {new_orders_count} đơn hàng TikTok mới."}
    except Exception as e:
        print("!!! LỖI, THỰC HIỆN ROLLBACK !!!")
        db.rollback()
        traceback.print_exc()
        return {"status": "error", "message": f"Lỗi nghiêm trọng: {e}"}

# ==============================================================================
# HÀM XỬ LÝ FILE DOANH THU (REVENUE) CỦA TIKTOK
# ==============================================================================
def process_revenue_file(db: Session, file_content: bytes, brand_id: int, source: str):
    try:
        # header=0 vì dữ liệu bắt đầu ngay từ hàng 2
        df = pd.read_excel(file_content, header=0, dtype=str).fillna('')

        # <<< SỬA LỖI 3: CHỈ ĐỊNH ĐÚNG ĐỊNH DẠNG NGÀY THÁNG >>>
        # format='%Y/%m/%d' khớp với '2025/10/27'
        df['Order settled time'] = pd.to_datetime(df['Order settled time'], format='%Y/%m/%d', errors='coerce')
        
        df_orders = df[df['Type'].str.lower() == 'order'].copy()
        
        if df_orders.empty:
            return {"status": "success", "message": "File doanh thu TikTok không có dòng 'Order' nào."}

        # --- Logic "Chỉ thêm mới" --- (Giữ nguyên)
        transaction_ids_in_file = df_orders['Order/adjustment ID'].dropna().unique().tolist()
        if not transaction_ids_in_file: return {"status": "success", "message": "Không tìm thấy mã giao dịch."}
        existing_transaction_ids_query = db.query(models.Revenue.details['Order/adjustment ID'].astext).filter(
            models.Revenue.brand_id == brand_id, models.Revenue.source == source,
            models.Revenue.details['Order/adjustment ID'].astext.in_(transaction_ids_in_file)
        ).all()
        existing_transaction_ids_set = {id_ for id_, in existing_transaction_ids_query}
        new_transaction_ids = set(transaction_ids_in_file) - existing_transaction_ids_set
        if not new_transaction_ids: return {"status": "success", "message": "Không có giao dịch TikTok mới."}
        df_new = df_orders[df_orders['Order/adjustment ID'].isin(new_transaction_ids)].copy()

        # --- Chuẩn bị dữ liệu --- (Giữ nguyên)
        new_revenues_count = 0
        for _, row in df_new.iterrows():
            details_dict = row.to_dict()
            for key, value in details_dict.items():
                details_dict[key] = str(value) if pd.notna(value) else None

            revenue_data = {
                "order_code": row.get('Related order ID'),
                "transaction_date": row.get('Order settled time').date() if pd.notna(row.get('Order settled time')) else None,
                "gmv": to_float_safe(row.get('Total Revenue')),
                "net_revenue": to_float_safe(row.get('Total settlement amount')),
                "details": details_dict,
            }
            crud.create_revenue_entry(db, revenue_data=revenue_data, brand_id=brand_id, source=source)
            new_revenues_count += 1
        
        if new_revenues_count > 0:
            db.commit()

        return {"status": "success", "message": f"Đã import thành công {new_revenues_count} giao dịch TikTok mới."}
    except Exception as e:
        db.rollback()
        traceback.print_exc()
        return {"status": "error", "message": f"Lỗi xử lý file doanh thu TikTok: {e}"}

# ==============================================================================
# HÀM XỬ LÝ FILE QUẢNG CÁO (TẠM THỜI ĐỂ TRỐNG)
# ==============================================================================
def process_ad_file(db: Session, file_content: bytes, brand_id: int, source: str):
    # ...
    return {"status": "info", "message": "Chức năng xử lý file quảng cáo TikTok đang được phát triển."}