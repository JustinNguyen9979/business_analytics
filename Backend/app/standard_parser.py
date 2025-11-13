# FILE: Backend/app/standard_parser.py

import pandas as pd
from sqlalchemy.orm import Session
import traceback
import io
import models
import crud
from datetime import date
from typing import Union, List

# --- Các hàm tiện ích (Giữ nguyên) ---
def parse_date(date_str) -> Union[date, None]:
    if not date_str or pd.isna(date_str): return None
    try: return pd.to_datetime(date_str, dayfirst=True).date()
    except (ValueError, TypeError): return None

def to_float(value) -> float:
    try: return float(str(value).replace(',', ''))
    except (ValueError, TypeError): return 0.0

def to_int(value) -> int:
    try: return int(float(str(value).replace(',', '')))
    except (ValueError, TypeError): return 0

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
                for order_code, group in df_new_orders.groupby('order_id'):
                    first_row = group.iloc[0]
                    username = first_row.get('username')
                    if username:
                         customer_data = {'username': username, 'province': first_row.get('province'), 'district': first_row.get('district')}
                         crud.get_or_create_customer(db, customer_data=customer_data, brand_id=brand_id)

                    order_cogs, total_quantity = 0, 0
                    for _, row in group.iterrows():
                        quantity = to_int(row.get('quantity'))
                        cost_price = product_cost_map.get(str(row.get('sku')), 0)
                        order_cogs += quantity * cost_price
                        total_quantity += quantity

                    orders_to_insert.append({ "order_code": order_code, "order_date": parse_date(first_row.get('order_date')), "status": first_row.get('order_status'), "username": username, "total_quantity": total_quantity, "cogs": order_cogs, "details": {"items": group.to_dict('records')}, "brand_id": brand_id, "source": source })
                
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
                revenues_to_insert = []
                for _, row in df_revenue.iterrows():
                    revenues_to_insert.append({ "order_code": row.get('order_id'), "transaction_date": parse_date(row.get('transaction_date')), "net_revenue": to_float(row.get('net_revenue')), "gmv": to_float(row.get('gmv')), "total_fees": to_float(row.get('total_fees')), "refund": to_float(row.get('refund')), "brand_id": brand_id, "source": source })
                
                if revenues_to_insert:
                    db.bulk_insert_mappings(models.Revenue, revenues_to_insert)
                results['revenue_sheet'] = f"Đã chuẩn bị import {len(revenues_to_insert)} dòng doanh thu."
                print(results['revenue_sheet'])

        else:
            print("Không tìm thấy sheet Doanh thu.")

        # --- BƯỚC 4: COMMIT GIAO DỊCH ---
        print("Đang thực hiện commit dữ liệu vào DB...")
        db.commit()
        print("COMMIT THÀNH CÔNG!")
        
        return {"status": "success", "message": "Xử lý file và nạp dữ liệu thành công!", "details": results}

    except Exception as e:
        db.rollback()
        print(f"!!! ĐÃ XẢY RA LỖI, THỰC HIỆN ROLLBACK: {e}")
        traceback.print_exc()
        return {"status": "error", "message": f"Đã xảy ra lỗi nghiêm trọng khi xử lý file: {e}"}