# FILE: Backend/app/standard_parser.py

import pandas as pd
from sqlalchemy.orm import Session
import traceback
import io
import models
import crud
import schemas
import re # Import Regex
from datetime import date, datetime
from typing import Union, List
from dateutil import parser as date_parser 
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

# === HÀM TIỆN ÍCH MỚI: TÌM TÊN SHEET LINH HOẠT ===
def find_sheet_name(sheet_names: List[str], keywords: List[str]) -> str | None:
    """
    Tìm tên sheet đầu tiên trong danh sách `sheet_names` có chứa bất kỳ từ khóa nào trong `keywords`.
    Không phân biệt chữ hoa/thường và khoảng trắng.
    """
    for name in sheet_names:
        normalized_name = name.lower().strip()
        for keyword in keywords:
            if keyword in normalized_name:
                return name # Trả về tên gốc để Pandas có thể tìm thấy
    return None

# --- HÀM XỬ LÝ CHÍNH - "SIÊU PARSER" ĐÃ NÂNG CẤP ---
def process_standard_file(db: Session, file_content: bytes, brand_id: int, source: str):
    results = {}
    print(f"\n--- BẮT ĐẦU XỬ LÝ FILE CHUẨN CHO BRAND {brand_id}, NGUỒN {source.upper()} ---")
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
        if order_sheet:
            print(f"Đang xử lý sheet '{order_sheet}'...")
            df_order = pd.read_excel(xls, sheet_name=order_sheet, header=1, dtype=str).fillna('')
            if not df_order.empty and 'order_id' in df_order.columns:
                order_codes_in_file = df_order['order_id'].dropna().unique().tolist()
                existing_codes = {c for c, in db.query(models.Order.order_code).filter(models.Order.brand_id == brand_id, models.Order.order_code.in_(order_codes_in_file)).all()}
                df_new_orders = df_order[~df_order['order_id'].isin(existing_codes)]
                
                print(f"Tìm thấy {len(df_new_orders['order_id'].unique())} đơn hàng mới cần import.")
                
                orders_to_insert = []
                
                # --- BƯỚC 2.2: XỬ LÝ ĐƠN HÀNG ---
                for order_code, group in df_new_orders.groupby('order_id'):
                    first_row = group.iloc[0]
                    username = first_row.get('username')

                    order_cogs, total_quantity = 0, 0
                    items_list = [] # Danh sách item đã chuẩn hóa

                    for _, row in group.iterrows():
                        quantity = to_int(row.get('quantity'))
                        sku = str(row.get('sku'))
                        
                        # Lấy giá vốn từ map
                        cost_price = product_cost_map.get(sku, 0)
                        order_cogs += quantity * cost_price
                        total_quantity += quantity
                        
                        # Lấy giá bán (SKU Price) từ file import
                        raw_price = row.get('sku_price')
                        price = to_float(raw_price)

                        # Tạo item dict chuẩn hóa
                        item_dict = row.to_dict()
                        item_dict['price'] = price # Lưu giá bán chuẩn hóa (float)
                        item_dict['sku'] = sku
                        item_dict['quantity'] = quantity
                        
                        # Dọn dẹp các trường dữ liệu cấp Order bị dư thừa trong Item
                        # Để tránh rác dữ liệu và định dạng ngày tháng lộn xộn
                        redundant_keys = [
                            'order_date', 'delivered_date', 'payment_method', 
                            'cancel_reason', 'order_status', 'province', 
                            'district', 'order_id', 'username', 
                            'sku_price', 'shipping_provider_name'
                        ]
                        for key in redundant_keys:
                            item_dict.pop(key, None)
                            
                        items_list.append(item_dict)

                    shipped_time_val = parse_datetime(first_row.get('shipped_time'), source_type=source)
                    tracking_id_val = str(first_row.get('tracking_id')) if not pd.isna(first_row.get('tracking_id')) else None
                    delivered_date_val = parse_datetime(first_row.get('delivered_date'))
                    payment_method_val = str(first_row.get('payment_method', ''))
                    cancel_reason_val = str(first_row.get('cancel_reason', '')) # Đọc lý do hủy
                    
                    # [UPDATED] Lưu thông tin địa chỉ vào details
                    province_val = str(first_row.get('province', ''))
                    district_val = str(first_row.get('district', ''))

                    # Tạo dict chi tiết bổ sung (Giữ lại các thông tin chung ở đây)
                    extra_details = {
                        "items": items_list, 
                        "payment_method": payment_method_val,
                        "cancel_reason": cancel_reason_val, 
                        "shipping_provider_name": str(first_row.get('shipping_provider_name', '')),
                        "order_status": str(first_row.get('order_status', '')),
                        "province": province_val, # Added province
                        "district": district_val, # Added district
                        # delivered_date cấp root JSON vẫn giữ cho đồng bộ nếu cần, nhưng đã có cột riêng
                        "delivered_date": delivered_date_val.isoformat() if delivered_date_val else None
                    }

                    orders_to_insert.append({ 
                        "order_code": order_code, 
                        "tracking_id": tracking_id_val,
                        "gmv": to_float(first_row.get('gmv')),
                        "selling_price": to_float(first_row.get('selling_price')),
                        "subsidy_amount": to_float(first_row.get('subsidy_amount')),
                        "order_date": parse_datetime(first_row.get('order_date')),
                        "shipped_time": shipped_time_val, 
                        "delivered_date": delivered_date_val,
                        "status": first_row.get('order_status'), 
                        "username": username, 
                        "total_quantity": total_quantity, 
                        "cogs": order_cogs, 
                        "details": extra_details, 
                        "brand_id": brand_id, 
                        "source": source 
                    })
                
                if orders_to_insert:
                    db.bulk_insert_mappings(models.Order, orders_to_insert)
                results['order_sheet'] = f"Đã chuẩn bị import {len(orders_to_insert)} đơn hàng mới."
                print(results['order_sheet'])

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
                    net_revenue = to_float(row.get('net_revenue'))
                    gmv = to_float(row.get('gmv'))
                    total_fees = to_float(row.get('total_fees'))
                    refund = to_float(row.get('refund'))

                    # Tạo chữ ký cho dòng mới
                    new_signature = (
                        order_code,
                        transaction_date,
                        net_revenue,
                        gmv,
                        total_fees,
                        refund,
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

        # --- BƯỚC 5: COMMIT GIAO DỊCH ---
        print("Đang thực hiện commit dữ liệu vào DB...")
        db.commit()
        print("COMMIT THÀNH CÔNG!")
        
        return {"status": "success", "message": "Xử lý file và nạp dữ liệu thành công!", "details": results}

    except Exception as e:
        db.rollback()
        print(f"!!! ĐÃ XẢY RA LỖI, THỰC HIỆN ROLLBACK: {e}")
        traceback.print_exc()
        return {"status": "error", "message": f"Đã xảy ra lỗi nghiêm trọng khi xử lý file: {e}"}