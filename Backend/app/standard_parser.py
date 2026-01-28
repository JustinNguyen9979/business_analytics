# FILE: Backend/app/standard_parser.py

import pandas as pd
from sqlalchemy.orm import Session
import traceback
import io
import models
import crud
import schemas
import re # Import Regex
import hashlib # Import hashlib for MD5
from datetime import date, datetime
from typing import Union, List
from dateutil import parser as date_parser 
from unidecode import unidecode
from vietnam_address_mapping import get_new_province_name 

def parse_date(date_str: str) -> Union[date, None]:
    """
    Hàm chuẩn hóa ngày tháng.
    Xử lý nghiêm ngặt:
    - Nếu dạng YYYY-MM-DD (có dấu gạch ngang): Hiểu là Năm-Tháng-Ngày.
    - Nếu dạng DD/MM/YYYY (có dấu gạch chéo): Hiểu là Ngày/Tháng/Năm.
    """
    if not date_str or pd.isna(date_str):
        return None
    
    s = str(date_str).strip()
    if not s: return None

    try:
        # Nếu là format ISO (chứa dấu gạch ngang -), parse chuẩn quốc tế (Year-Month-Day)
        if re.match(r'^\d{4}', s):
            dt_object = date_parser.parse(s, yearfirst=True, dayfirst=False)
        else:
            # Nếu là format VN (chứa dấu gạch chéo /), parse theo kiểu VN (Day/Month/Year)
            dt_object = date_parser.parse(s, dayfirst=True)
        
        # Sanity check
        if dt_object.year < 2000 or dt_object.year > 2030:
            print(f"CẢNH BÁO: Ngày '{s}' parse ra năm {dt_object.year} không hợp lệ.")
            return None
            
        return dt_object.date()
    except (ValueError, TypeError, OverflowError):
        print(f"CẢNH BÁO: Không thể đọc định dạng ngày: '{date_str}'.")
        return None

def parse_datetime(date_str: str, source_type: str = None) -> Union[datetime, None]:
    """
    Hàm chuẩn hóa ngày giờ.
    """
    if not date_str or pd.isna(date_str):
        return None
    
    s = str(date_str).strip()
    if not s: return None

    # try:
    #     if re.match(r'^\d{4}', s):
    #         dt_object = date_parser.parse(s, yearfirst=True, dayfirst=False)
    #     else:
    #         dt_object = date_parser.parse(s, dayfirst=True)

    #     return dt_object.replace(microsecond=0)
    try:
        if source_type == 'shopee':
            dt = date_parser.parse(s, yearfirst=True, dayfirst=False)
            return dt
        elif source_type == 'tiktok':
            dt = date_parser.parse(s, dayfirst=True)
            return dt 
        else:
            if re.match(r'^\d{4}', s):
                dt = date_parser.parse(s, yearfirst=True, dayfirst=False)
            else:
                dt = date_parser.parse(s, dayfirst=True)
            return dt.replace(microsecond=0)
    
    except (ValueError, TypeError, OverflowError):
        try:
            return pd.to_datetime(s).to_pydatetime()
        except:
            print(f"CẢNH BÁO: Không thể đọc định dạngày giờ: '{date_str}' cho nguồn '{source_type}'.")
            return None

def to_float(value) -> float:
    """
    Chuyển đổi thông minh mọi định dạng số (US/VN) thành float chuẩn.
    Xử lý các case:
    - "19,000.00" -> 19000.0
    - "19.000,00" -> 19000.0
    - "19824,353" -> 19824.353
    - "19000" -> 19000.0
    """
    if pd.isna(value) or value == '':
        return 0.0
    try:
        s = str(value).strip()
        # Chỉ giữ lại số, dấu chấm, dấu phẩy, dấu trừ
        s = re.sub(r'[^\d\.,-]', '', s)
        
        if not s: return 0.0

        # Logic đoán định dạng:
        if '.' in s and ',' in s:
            # Nếu có cả 2: Dấu nào nằm cuối cùng là dấu thập phân
            if s.rfind('.') > s.rfind(','): 
                # Dạng US: 1,000.00 -> Xóa phẩy
                s = s.replace(',', '')
            else:
                # Dạng VN: 1.000,00 -> Xóa chấm, thay phẩy bằng chấm
                s = s.replace('.', '').replace(',', '.')
        
        elif ',' in s:
            # Nếu chỉ có dấu phẩy (Ca khó: 19,000 vs 19,5)
            # Với dữ liệu sàn, giả định dấu phẩy là thập phân nếu nó xuất hiện (để hỗ trợ 19824,353)
            # Tuy nhiên, nếu nó xuất hiện nhiều lần (1,000,000) thì là dấu ngăn cách
            if s.count(',') > 1:
                s = s.replace(',', '') # 1,000,000 -> 1000000
            else:
                s = s.replace(',', '.') # 19824,353 -> 19824.353
        
        return float(s)
    except (ValueError, TypeError):
        return 0.0

def to_int(value) -> int:
    """
    Chuyển đổi thành số nguyên.
    """
    return int(to_float(value))

# === HÀM TIỆN ÍCH: TÌM KIẾM LINH HOẠT ===
def find_sheet_name(items: List[str], keywords: List[str]) -> str | None:
    """
    Tìm phần tử đầu tiên trong danh sách `items` có chứa (hoặc khớp) bất kỳ từ khóa nào trong `keywords`.
    Dùng cho cả tên Sheet và tên Cột.
    """
    for item in items:
        normalized_item = str(item).lower().strip()
        for keyword in keywords:
            if keyword in normalized_item:
                return item # Trả về tên gốc
    return None

def normalize_phone(phone) -> str | None:
    """Chuẩn hóa số điện thoại VN."""
    if not phone or pd.isna(phone): return None
    s = str(phone).strip()
    s = re.sub(r'\D', '', s) # Giữ lại số
    if not s: return None
    
    # Xử lý đầu 84
    if s.startswith('84'):
        s = '0' + s[2:]
    elif not s.startswith('0'):
        s = '0' + s
        
    if len(s) < 9 or len(s) > 12: # Check độ dài hợp lý
        return None
    return s

def normalize_email(email) -> str | None:
    """Chuẩn hóa email cơ bản."""
    if not email or pd.isna(email): return None
    s = str(email).strip().lower()
    if '@' not in s or '.' not in s: return None
    return s

def normalize_gender(value) -> str | None:
    """
    Chuẩn hóa giới tính: female, male, other.
    Input: Nữ, Chị, Cô, Nu, Female, F... -> female
    Input: Nam, Anh, Chú, Ong, Male, M... -> male
    """
    if not value or pd.isna(value): return None
    
    # Bỏ dấu và chuyển về chữ thường (Ví dụ: "Nữ" -> "nu")
    s = unidecode(str(value)).lower().strip()
    
    # 1. Nhóm Nữ (Female)
    female_keywords = [
        'nu', 'chi', 'female', 'ba', 'co', 'me', 'f', 'woman', 'lady', 'girl', 
        'madam', 'ms', 'mrs', 'miss'
    ]
    # Kiểm tra khớp chính xác hoặc chứa từ khóa (ưu tiên khớp từ đầu)
    if any(k == s for k in female_keywords) or any(s.startswith(k) for k in female_keywords):
        return 'female'

    # 2. Nhóm Nam (Male)
    male_keywords = [
        'nam', 'anh', 'male', 'ong', 'chu', 'bo', 'm', 'man', 'boy', 
        'mr', 'sir'
    ]
    if any(k == s for k in male_keywords) or any(s.startswith(k) for k in male_keywords):
        return 'male'

    return 'other'

# --- HÀM XỬ LÝ CHÍNH - "SIÊU PARSER" ĐÃ NÂNG CẤP ---
def process_standard_file(db: Session, file_content: bytes, brand_id: int, source: str, file_name: str = "unknown.xlsx", allow_override: bool = False):
    results = {}
    print(f"\n--- BẮT ĐẦU XỬ LÝ FILE CHUẨN CHO BRAND {brand_id}, NGUỒN {source.upper()} ---")
    
    # [TỐI ƯU] Tập hợp các ngày cần tính toán lại
    affected_dates = set()

    # --- BƯỚC 0: KIỂM TRA TRÙNG FILE (WHOLE FILE DEDUP) ---
    file_hash = hashlib.md5(file_content).hexdigest()
    print(f"MD5 Hash của file: {file_hash}")
    
    # Chỉ kiểm tra nếu KHÔNG có cờ ghi đè
    if not allow_override:
        existing_log = db.query(models.ImportLog).filter(
            models.ImportLog.file_hash == file_hash,
            models.ImportLog.brand_id == brand_id, # Kiểm tra đúng Brand
            models.ImportLog.source == source,     # Kiểm tra đúng Source
            models.ImportLog.status == 'SUCCESS'
        ).first()

        if existing_log:
            msg = f"File '{file_name}' đã được import thành công vào nguồn '{source}' lúc {existing_log.created_at}. Sử dụng tùy chọn 'Ghi đè' nếu bạn muốn xử lý lại."
            print(f"BỎ QUA: {msg}")
            return {"status": "error", "message": msg}

    # Tạo log mới với trạng thái PROCESSING
    current_log = models.ImportLog(
        brand_id=brand_id,
        source=source,
        file_name=file_name,
        file_hash=file_hash,
        status='PROCESSING',
        log="Bắt đầu xử lý..."
    )
    db.add(current_log)
    db.commit()
    db.refresh(current_log)

    try:
        xls = pd.ExcelFile(io.BytesIO(file_content))
        sheet_names = xls.sheet_names
        print(f"Các sheet tìm thấy trong file: {sheet_names}")

        # === SỬA LỖI: SỬ DỤNG HÀM TÌM KIẾM LINH HOẠT ===
        cost_sheet = find_sheet_name(sheet_names, ['giá vốn', 'cost'])
        order_sheet = find_sheet_name(sheet_names, ['đơn hàng', 'order'])
        revenue_sheet = find_sheet_name(sheet_names, ['doanh thu', 'revenue'])
        marketing_sheet = find_sheet_name(sheet_names, ['marketing'])
        
        # --- BƯỚC 1: XỬ LÝ SHEET GIÁ VỐN ---
        if cost_sheet:
            print(f"Đang xử lý sheet '{cost_sheet}'...")
            df_cost = pd.read_excel(xls, sheet_name=cost_sheet, header=1)
            if not df_cost.empty:
                count = 0
                for _, row in df_cost.dropna(subset=['sku']).iterrows():
                    crud.upsert_product(
                        db=db,
                        brand_id=brand_id,
                        sku=str(row['sku']),
                        name=str(row.get('name', '')),
                        cost_price=to_int(row.get('cost_price'))
                    )
                    count += 1
                results['cost_sheet'] = f"Đã xử lý {count} dòng giá vốn."
                print(results['cost_sheet'])
        else:
            print("Không tìm thấy sheet Giá vốn.")

        db.flush()
        print("Flush thành công.")


        product_cost_map = {p.sku: p.cost_price for p in db.query(models.Product.sku, models.Product.cost_price).filter(models.Product.brand_id == brand_id).all()}
        print(f"Đã tải {len(product_cost_map)} sản phẩm có giá vốn từ DB sau khi flush.")

        # --- BƯỚC 2: XỬ LÝ SHEET ĐƠN HÀNG ---
        affected_usernames = set() # Tập hợp các username cần đồng bộ
        if order_sheet:
            print(f"Đang xử lý sheet '{order_sheet}'...")
            df_order = pd.read_excel(xls, sheet_name=order_sheet, header=1, dtype=str).fillna('')
            if not df_order.empty and 'order_id' in df_order.columns:
                # Thu thập tất cả username trong file
                if 'username' in df_order.columns:
                    affected_usernames.update(df_order['username'].dropna().unique().tolist())
                
                order_codes_in_file = df_order['order_id'].dropna().unique().tolist()
                existing_codes = {c for c, in db.query(models.Order.order_code).filter(models.Order.brand_id == brand_id, models.Order.order_code.in_(order_codes_in_file)).all()}
                
                # Tách ra 2 luồng: Thêm mới và Cập nhật
                df_new_orders = df_order[~df_order['order_id'].isin(existing_codes)]
                df_existing_orders = df_order[df_order['order_id'].isin(existing_codes)]
                
                print(f"Phân loại: {len(df_new_orders['order_id'].unique())} đơn mới | {len(df_existing_orders['order_id'].unique())} đơn cần cập nhật.")
                
                cols = df_order.columns.tolist()
                # Tự động tìm tên cột linh hoạt hơn
                col_phone = find_sheet_name(cols, ['phone', 'sdt', 'điện thoại', 'tel', 'mobile']) or ('phone' if 'phone' in cols else None)
                col_email = find_sheet_name(cols, ['email', 'mail', 'thư']) or ('email' if 'email' in cols else None)
                col_address = find_sheet_name(cols, ['address', 'địa chỉ', 'dia chi']) or ('address' if 'address' in cols else None)
                col_gender = find_sheet_name(cols, ['gender', 'sex', 'giới tính', 'gioi tinh', 'phái', 'phai', 'xưng hô', 'xung ho'])

                orders_to_insert = []
                orders_to_update = []
                
                # --- HÀM HELPER ĐỂ XỬ LÝ DỮ LIỆU ĐƠN HÀNG ---
                def process_order_group(group, is_update=False):
                    first_row = group.iloc[0]
                    order_code = str(first_row.get('order_id'))
                    
                    # Parse ngày tháng
                    o_date_val = parse_datetime(first_row.get('order_date'))
                    delivered_date_val = parse_datetime(first_row.get('delivered_date'))
                    shipped_time_val = parse_datetime(first_row.get('shipped_time'), source_type=source)
                    
                    # --- SANITY CHECK (Kiểm tra tính hợp lý) ---
                    # 1. Kiểm tra ngày giao hàng so với ngày đặt
                    if o_date_val and delivered_date_val:
                        if delivered_date_val < o_date_val:
                            # Nếu chỉ chênh lệch vài giờ do múi giờ thì bỏ qua, nhưng nếu chênh ngày thì là lỗi
                            if (o_date_val - delivered_date_val).total_seconds() > 86400: 
                                print(f"CẢNH BÁO LOGIC: Đơn {order_code} có ngày giao ({delivered_date_val}) nhỏ hơn ngày đặt ({o_date_val}). Bỏ qua ngày giao.")
                                delivered_date_val = None

                    # 2. Kiểm tra dữ liệu bắt buộc
                    if not is_update and (not order_code or not o_date_val):
                        print(f"Bỏ qua đơn lỗi thiếu thông tin: Code='{order_code}'")
                        return None

                    # Ghi nhận ngày cần tính toán lại
                    if o_date_val: affected_dates.add(o_date_val.date())
                    if delivered_date_val: affected_dates.add(delivered_date_val.date())

                    # Xử lý items và tính toán cộng dồn
                    order_cogs = 0.0
                    total_quantity = 0
                    order_original_price = 0.0
                    order_sku_price = 0.0
                    order_subsidy_amount = 0.0
                    items_list = []

                    for _, row in group.iterrows():
                        quantity = to_int(row.get('quantity'))
                        sku = str(row.get('sku'))
                        
                        cost_price = product_cost_map.get(sku, 0)
                        order_cogs += quantity * cost_price
                        total_quantity += quantity
                        
                        item_original_price = to_float(row.get('original_price'))
                        item_sku_price = to_float(row.get('sku_price'))
                        item_subsidy_amount = to_float(row.get('subsidy_amount'))

                        order_original_price += item_original_price
                        order_sku_price += item_sku_price
                        order_subsidy_amount += item_subsidy_amount

                        item_dict = row.to_dict()
                        item_dict['sku'] = sku
                        item_dict['quantity'] = quantity
                        item_dict['original_price'] = item_original_price
                        item_dict['sku_price'] = item_sku_price
                        item_dict['subsidy_amount'] = item_subsidy_amount
                        
                        redundant_keys = [
                            'order_date', 'delivered_date', 'payment_method', 
                            'cancel_reason', 'order_status', 'province', 
                            'district', 'order_id', 'username', 
                            'shipping_provider_name'
                        ]
                        # Remove also dynamic cols if exist
                        if col_phone: redundant_keys.append(col_phone)
                        if col_email: redundant_keys.append(col_email)
                        if col_address: redundant_keys.append(col_address)
                        if col_gender: redundant_keys.append(col_gender)

                        for key in redundant_keys:
                            item_dict.pop(key, None)
                        items_list.append(item_dict)

                    # Thông tin chung
                    username = first_row.get('username')
                    tracking_id_val = str(first_row.get('tracking_id')) if not pd.isna(first_row.get('tracking_id')) else None
                    payment_method_val = str(first_row.get('payment_method', ''))
                    cancel_reason_val = str(first_row.get('cancel_reason', ''))
                    province_val = get_new_province_name(str(first_row.get('province', '')))
                    district_val = str(first_row.get('district', ''))
                    
                    # Xử lý thông tin KH mới (Phone, Email, Gender)
                    phone_val = normalize_phone(first_row.get(col_phone)) if col_phone else None
                    email_val = normalize_email(first_row.get(col_email)) if col_email else None
                    address_val = str(first_row.get(col_address)).strip() if col_address and not pd.isna(first_row.get(col_address)) else None
                    gender_val = normalize_gender(first_row.get(col_gender)) if col_gender else None

                    # Tạo dict chi tiết (Quan trọng để lưu cancel_reason)
                    extra_details = {
                        "items": items_list, 
                        "payment_method": payment_method_val,
                        "cancel_reason": cancel_reason_val, 
                        "shipping_provider_name": str(first_row.get('shipping_provider_name', '')),
                        "order_status": str(first_row.get('order_status', '')),
                        "province": province_val,
                        "district": district_val,
                        "delivered_date": delivered_date_val.isoformat() if delivered_date_val else None,
                        "phone": phone_val,
                        "email": email_val,
                        "address": address_val,
                        "gender": gender_val
                    }

                    return {
                        "order_code": order_code,
                        "tracking_id": tracking_id_val,
                        "original_price": order_original_price,
                        "sku_price": order_sku_price,
                        "subsidy_amount": order_subsidy_amount,
                        "order_date": o_date_val,
                        "shipped_time": shipped_time_val, 
                        "delivered_date": delivered_date_val,
                        "status": first_row.get('order_status'), 
                        "username": username, 
                        "total_quantity": total_quantity, 
                        "cogs": order_cogs, 
                        "details": extra_details, 
                        "brand_id": brand_id, 
                        "source": source 
                    }

                # --- 2.1 XỬ LÝ ĐƠN HÀNG MỚI (INSERT) ---
                if not df_new_orders.empty:
                    for order_code, group in df_new_orders.groupby('order_id'):
                        data = process_order_group(group, is_update=False)
                        if data:
                            orders_to_insert.append(data)
                    
                    if orders_to_insert:
                        db.bulk_insert_mappings(models.Order, orders_to_insert)
                        results['order_insert'] = f"Đã thêm mới {len(orders_to_insert)} đơn hàng."
                        print(results['order_insert'])

                # --- 2.2 XỬ LÝ ĐƠN HÀNG CŨ (UPDATE) ---
                if not df_existing_orders.empty:
                    # Lấy ID của các đơn hàng cần update để mapping
                    existing_orders_map = {
                        o.order_code: o.id 
                        for o in db.query(models.Order.id, models.Order.order_code)
                        .filter(models.Order.brand_id == brand_id, models.Order.order_code.in_(df_existing_orders['order_id'].unique()))
                        .all()
                    }

                    for order_code, group in df_existing_orders.groupby('order_id'):
                        if order_code not in existing_orders_map: continue
                        
                        data = process_order_group(group, is_update=True)
                        if data:
                            # Với update, ta chỉ cập nhật các trường có thể thay đổi
                            update_data = {
                                "id": existing_orders_map[order_code], # Bắt buộc phải có PK cho bulk_update
                                "status": data['status'],
                                "delivered_date": data['delivered_date'],
                                "shipped_time": data['shipped_time'],
                                "tracking_id": data['tracking_id'],
                                "details": data['details'], # Cập nhật cancel_reason nằm trong này
                                "updated_at": datetime.now() # Đánh dấu thời điểm cập nhật
                            }
                            # Update thêm các chỉ số tài chính nếu cần (đề phòng file trước bị sai)
                            # Nhưng cẩn thận ghi đè dữ liệu đã sửa tay. Hiện tại ưu tiên trạng thái vận đơn.
                            orders_to_update.append(update_data)

                    if orders_to_update:
                        db.bulk_update_mappings(models.Order, orders_to_update)
                        results['order_update'] = f"Đã cập nhật trạng thái cho {len(orders_to_update)} đơn hàng cũ."
                        print(results['order_update'])
                
                results['order_sheet'] = f"Tổng xử lý: {len(orders_to_insert)} thêm mới, {len(orders_to_update)} cập nhật."

        else:
            print("Không tìm thấy sheet Đơn hàng.")

        # --- BƯỚC 3: XỬ LÝ SHEET DOANH THU ---
        if revenue_sheet:
            print(f"Đang xử lý sheet '{revenue_sheet}'...")
            df_revenue = pd.read_excel(xls, sheet_name=revenue_sheet, header=1, dtype=str).fillna('')
            if not df_revenue.empty and 'order_id' in df_revenue.columns:
                # Lấy các order_code trong file để giới hạn query
                order_codes_in_file = df_revenue['order_id'].dropna().unique().tolist()
                
                # Lấy các bản ghi revenue đã tồn tại trong DB
                existing_revenues = db.query(models.Revenue).filter(
                    models.Revenue.brand_id == brand_id,
                    models.Revenue.order_code.in_(order_codes_in_file)
                ).all()

                # Tạo một set "chữ ký" của các bản ghi đã có để check trùng lặp O(1)
                existing_signatures = {
                    (
                        rev.order_code,
                        rev.transaction_date,
                        rev.net_revenue,
                        rev.gmv,
                        rev.total_fees,
                        rev.refund,
                        rev.order_refund,
                        rev.source
                    ) for rev in existing_revenues
                }
                print(f"Tìm thấy {len(existing_signatures)} dòng doanh thu đã tồn tại trong DB cho các order_id liên quan.")

                revenues_to_insert = []
                for _, row in df_revenue.iterrows():
                    # Chuẩn hóa dữ liệu từ file excel
                    order_code = row.get('order_id')
                    transaction_date = parse_date(row.get('transaction_date'))
                    order_date = parse_date(row.get('order_date'))

                    # [TỐI ƯU] Ghi nhận ngày order gốc để tính lại
                    if order_date:
                        affected_dates.add(order_date)

                    net_revenue = to_float(row.get('net_revenue'))
                    gmv = to_float(row.get('gmv'))
                    total_fees = to_float(row.get('total_fees'))
                    refund = to_float(row.get('refund'))
                    order_refund = to_float(row.get('order_refund'))

                    # Tạo chữ ký cho dòng mới
                    new_signature = (
                        order_code,
                        transaction_date,
                        net_revenue,
                        gmv,
                        total_fees,
                        refund,
                        order_refund,
                        source # `source` là của cả file import
                    )

                    # Nếu chữ ký chưa tồn tại, đây là dòng mới
                    if new_signature not in existing_signatures:
                        revenues_to_insert.append({
                            "order_code": order_code,
                            "transaction_date": transaction_date,
                            "order_date": order_date,
                            "net_revenue": net_revenue,
                            "gmv": gmv,
                            "total_fees": total_fees,
                            "refund": refund,
                            "order_refund": order_refund,
                            "brand_id": brand_id,
                            "source": source
                        })
                        # Thêm chữ ký mới vào set để chống trùng lặp trong chính file upload
                        existing_signatures.add(new_signature)
                
                if revenues_to_insert:
                    db.bulk_insert_mappings(models.Revenue, revenues_to_insert)
                results['revenue_sheet'] = f"Đã chuẩn bị import {len(revenues_to_insert)} dòng doanh thu mới."
                print(results['revenue_sheet'])

        else:
            print("Không tìm thấy sheet Doanh thu.")

        # --- BƯỚC 4: XỬ LÝ SHEET MARKETING ---
        if marketing_sheet:
            print(f"Đang xử lý sheet '{marketing_sheet}'...")
            df_marketing = pd.read_excel(xls, sheet_name=marketing_sheet, header=0).fillna(0)
            if not df_marketing.empty:
                count = 0
                for _, row in df_marketing.iterrows():
                    parsed_date = parse_date(row.get('ads_date'))
                    if not parsed_date:
                        continue # Bỏ qua dòng nếu không có ngày hợp lệ

                    # [TỐI ƯU] Ghi nhận ngày marketing
                    affected_dates.add(parsed_date)

                    spend_data = schemas.MarketingSpendCreate(
                        date=parsed_date,
                        ad_spend=to_float(row.get('adSpend')),
                        cpm=to_float(row.get('cpm')),
                        ctr=to_float(row.get('ctr')),
                        cpa=to_float(row.get('cpa')),
                        cpc=to_float(row.get('cpc')),
                        conversions=to_int(row.get('conversion')),
                        impressions=to_int(row.get('impressions')),
                        reach=to_int(row.get('reach')),
                        clicks=to_int(row.get('click'))
                    )
                    crud.upsert_marketing_spend(
                        db=db,
                        brand_id=brand_id,
                        source=source,
                        spend_data=spend_data
                    )
                    count += 1
                results['marketing_sheet'] = f"Đã xử lý {count} dòng chi phí marketing."
                print(results['marketing_sheet'])
        else:
            print("Không tìm thấy sheet Marketing.")

        # --- BƯỚC 5: ĐỒNG BỘ BẢNG CUSTOMER ---
        if affected_usernames:
            print(f"Đang đồng bộ dữ liệu cho {len(affected_usernames)} khách hàng...")
            crud.customer.upsert_customers_from_orders(db, brand_id, list(affected_usernames))

        # --- BƯỚC 6: COMMIT GIAO DỊCH ---
        print("Đang thực hiện commit dữ liệu vào DB...")
        db.commit()
        print("COMMIT THÀNH CÔNG!")
        
        # Convert set to sorted list of strings for JSON response
        sorted_affected_dates = sorted([d.isoformat() for d in affected_dates])
        print(f"-> Tổng cộng tìm thấy {len(affected_dates)} ngày cần tính toán lại.")

        # Update log thành công
        current_log.status = 'SUCCESS'
        current_log.log = str(results)
        db.commit()

        return {
            "status": "success", 
            "message": "Xử lý file và nạp dữ liệu thành công!", 
            "details": results,
            "affected_dates": sorted_affected_dates
        }

    except Exception as e:
        db.rollback()
        print(f"!!! ĐÃ XẢY RA LỖI, THỰC HIỆN ROLLBACK: {e}")
        traceback.print_exc()

        # Update log thất bại
        current_log.status = 'FAILED'
        current_log.log = str(e)
        db.commit()

        return {"status": "error", "message": f"Đã xảy ra lỗi nghiêm trọng khi xử lý file: {e}"}