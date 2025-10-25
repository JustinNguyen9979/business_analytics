import pandas as pd
from sqlalchemy.orm import Session
from . import crud
import io

def process_cost_file(db: Session, file_content: bytes, brand_id: int):
    """
    PHIÊN BẢN SỬA LỖI LOGIC GIÁ NHẬP:
    1. Đọc cột giá nhập trực tiếp dưới dạng số.
    2. Xử lý các ô trống (không có giá) thành số 0.
    3. Chuyển đổi an toàn sang số nguyên, không còn lỗi thêm số 0.
    """
    try:
        buffer = io.BytesIO(file_content)
        df = pd.read_excel(buffer, usecols=[0, 1], header=0, names=['sku', 'cost_price'])

        # --- LOGIC XỬ LÝ GIÁ VỐN MỚI, CHÍNH XÁC HƠN ---
        # 1. Xóa các dòng mà SKU bị trống
        df.dropna(subset=['sku'], inplace=True)
        df['sku'] = df['sku'].astype(str)
        
        # 2. Chuyển cột giá vốn thành dạng số, nếu gặp lỗi (chữ, ký tự) thì biến thành NaN (trống)
        df['cost_price'] = pd.to_numeric(df['cost_price'], errors='coerce')

        # 3. Thay thế tất cả các ô trống (NaN) bằng số 0
        df['cost_price'] = df['cost_price'].fillna(0)

        # 4. Chuyển toàn bộ cột thành số nguyên
        df['cost_price'] = df['cost_price'].astype(int)

        for index, row in df.iterrows():
            product = crud.get_or_create_product(db, sku=row['sku'], brand_id=brand_id)
            # Truyền giá trị cost_price đã được xử lý chính xác
            crud.update_product_cost_price(db, product_id=product.id, cost_price=row['cost_price'])
            
        return {"status": "success", "message": f"Đã xử lý {len(df)} sản phẩm từ file giá vốn."}
    except Exception as e: 
        return {"status": "error", "message": str(e)}

def process_order_file(db: Session, file_content: bytes, brand_id: int):
    """(Hàm này không thay đổi)"""
    try:
        buffer = io.BytesIO(file_content)
        df = pd.read_excel(buffer, header=0)
        
        processed_count = 0
        for index, row in df.iterrows():
            if pd.isna(row.get('SKU phân loại hàng')):
                continue

            crud.get_or_create_customer(db, customer_data=row.to_dict(), brand_id=brand_id)
            crud.create_order_entry(db, order_data=row.to_dict(), brand_id=brand_id)
            
            processed_count += 1
            
        return {"status": "success", "message": f"Đã xử lý {processed_count} dòng đơn hàng."}
    except KeyError as e:
        return {"status": "error", "message": f"Không tìm thấy cột cần thiết trong file: {e}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}