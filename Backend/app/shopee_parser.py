import pandas as pd
from sqlalchemy.orm import Session
import crud, io, traceback, math, models
from sqlalchemy.dialects.postgresql import insert

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
        print("\n--- BẮT ĐẦU XỬ LÝ FILE ĐƠN HÀNG ---")
        df = pd.read_excel(file_content, header=0, dtype=str).fillna('')
        
        df['Ngày đặt hàng'] = pd.to_datetime(df['Ngày đặt hàng'], errors='coerce')
        df['Số lượng'] = pd.to_numeric(df['Số lượng'], errors='coerce').fillna(0).astype(int)
        
        if df.empty:
            return {"status": "success", "message": "File rỗng, không có dữ liệu để xử lý."}

        # --- BƯỚC 1: LẤY DỮ LIỆU TỪ DB ---
        product_cost_map = {p.sku: p.cost_price for p in db.query(models.Product.sku, models.Product.cost_price).filter(models.Product.brand_id == brand_id).all()}
        
        order_codes_in_file = df['Mã đơn hàng'].dropna().unique().tolist()
        
        existing_order_codes_query = db.query(models.Order.order_code).filter(
            models.Order.brand_id == brand_id,
            models.Order.order_code.in_(order_codes_in_file)
        ).all()
        existing_order_codes_set = {code for code, in existing_order_codes_query}
        
        print(f"Tổng số đơn hàng duy nhất trong file: {len(order_codes_in_file)}")
        print(f"Số đơn hàng đã tồn tại trong DB: {len(existing_order_codes_set)}")

        # --- BƯỚC 2: XÁC ĐỊNH CÁC ĐƠN HÀNG MỚI (LOGIC MỚI, AN TOÀN HƠN) ---
        new_order_codes = set(order_codes_in_file) - existing_order_codes_set
        
        print(f"Số đơn hàng mới cần import: {len(new_order_codes)}")
        
        if not new_order_codes:
            return {"status": "success", "message": "Không có đơn hàng mới nào để import."}

        # Lọc DataFrame để chỉ giữ lại các dòng của đơn hàng mới
        df_new = df[df['Mã đơn hàng'].isin(new_order_codes)].copy()
        
        # --- BƯỚC 3: XỬ LÝ KHÁCH HÀNG (CHỈ CHO CÁC ĐƠN MỚI) ---
        # (Logic này đã tốt, giữ nguyên)
        unique_customers_df = df_new[['Người Mua', 'Tỉnh/Thành phố', 'TP / Quận / Huyện', 'Quận']].drop_duplicates(subset=['Người Mua'])
        unique_usernames_in_file = [u for u in unique_customers_df['Người Mua'].tolist() if u]
        if unique_usernames_in_file:
            existing_usernames = {u for u, in db.query(models.Customer.username).filter(models.Customer.brand_id == brand_id, models.Customer.username.in_(unique_usernames_in_file)).all()}
            new_customers_to_insert = [
                { "username": row['Người Mua'], "city": row.get('Tỉnh/Thành phố'), "district_1": row.get('TP / Quận / Huyện'), "district_2": row.get('Quận'), "brand_id": brand_id }
                for _, row in unique_customers_df.iterrows() if row['Người Mua'] and row['Người Mua'] not in existing_usernames
            ]
            if new_customers_to_insert:
                print(f"Chuẩn bị thêm {len(new_customers_to_insert)} khách hàng mới.")
                db.bulk_insert_mappings(models.Customer, new_customers_to_insert)

        # --- BƯỚC 4: CHUẨN BỊ DỮ LIỆU ĐƠN HÀNG MỚI ĐỂ GHI HÀNG LOẠT ---
        orders_to_insert = []
        # Nhóm dữ liệu trên DataFrame đã được lọc
        for order_code, group in df_new.groupby('Mã đơn hàng'):
            first_row = group.iloc[0]
            items_details = []
            order_cogs = 0

            for _, row in group.iterrows():
                sku = row.get('SKU phân loại hàng')
                quantity = row.get('Số lượng')
                order_cogs += product_cost_map.get(sku, 0) * quantity
                items_details.append({"sku": sku, "name": row.get('Tên phân loại hàng'), "quantity": quantity})

            details_dict = first_row.astype(str).to_dict()
            details_dict['items'] = items_details
            
            orders_to_insert.append({
                "order_code": order_code,
                "order_date": first_row.get('Ngày đặt hàng').date() if pd.notna(first_row.get('Ngày đặt hàng')) else None,
                "status": first_row.get('Trạng Thái Đơn Hàng'), "username": first_row.get('Người Mua'),
                "total_quantity": int(group['Số lượng'].sum()), "cogs": order_cogs, "details": details_dict,
                "brand_id": brand_id, "source": source
            })

        print(f"Đã chuẩn bị được {len(orders_to_insert)} đơn hàng để ghi vào DB.")

        # --- BƯỚC 5: GHI VÀ COMMIT ---
        if orders_to_insert:
            print(f"Thực hiện bulk insert cho {len(orders_to_insert)} đơn hàng...")
            db.bulk_insert_mappings(models.Order, orders_to_insert)
            
            print("Thực hiện commit giao dịch...")
            db.commit()
            print("COMMIT THÀNH CÔNG.")
        else:
            print("Không có đơn hàng nào được chuẩn bị, bỏ qua bước ghi.")
            
        return {"status": "success", "message": f"Đã import thành công {len(orders_to_insert)} đơn hàng mới."}
    except Exception as e:
        print("!!! ĐÃ XẢY RA LỖI, THỰC HIỆN ROLLBACK !!!")
        db.rollback()
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