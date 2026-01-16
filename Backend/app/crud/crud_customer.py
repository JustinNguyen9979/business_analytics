from sqlalchemy.orm import Session
from .base import CRUDBase
from models import Customer
from schemas import CustomerBase, CustomerCreate
from typing import Optional

class CRUDCustomer(CRUDBase[Customer, CustomerCreate, CustomerBase]):
    def get_by_username(self, db: Session, *, brand_id: int, username: str) -> Optional[Customer]:
        """
        Tìm kiếm khách hàng theo username và brand_id.
        """
        return db.query(self.model).filter(
            self.model.brand_id == brand_id, 
            self.model.username == username
        ).first()

    def get_or_create(self, db: Session, *, brand_id: int, customer_data: dict) -> Customer:
        """
        Tìm customer theo username + brand_id.
        - Nếu có: Cập nhật thông tin (city, district) nếu thiếu hoặc thay đổi.
        - Nếu không: Tạo mới.
        """
        username = customer_data.get("username")
        if not username:
            return None # Should probably raise an error or handle this case

        db_customer = self.get_by_username(db, brand_id=brand_id, username=username)
        
        city = customer_data.get("city")
        district = customer_data.get("district")
        source = customer_data.get("source")

        if db_customer:
            # Update info if provided and different (basic logic, can be improved)
            if city and db_customer.city != city:
                db_customer.city = city
            if district and db_customer.district != district:
                db_customer.district = district
            if source and not db_customer.source: # Chỉ update source nếu chưa có (first touch)
                db_customer.source = source
        else:
            # Create new
            db_customer = self.model(
                brand_id=brand_id,
                username=username,
                city=city,
                district=district,
                source=source
            )
            db.add(db_customer)
            # Tương tự như product, ta chưa commit ở đây để caller quản lý transaction lớn.
        
        return db_customer

    def update_aggregated_data(self, db: Session, *, brand_id: int, usernames: list[str]):
        """
        Tính toán lại toàn bộ chỉ số tích lũy (Total Spent, Total Orders, Risk...) 
        cho danh sách users được chỉ định dựa trên lịch sử đơn hàng.
        Logic: Re-calculate từ đầu -> Ghi đè (Idempotent).
        Sử dụng hàm phân loại chuẩn từ kpi_utils để đồng bộ với Dashboard.
        """
        from models import Order, Revenue
        from kpi_utils import _classify_order_status
        from collections import defaultdict

        if not usernames:
            return

        # 1. Lấy toàn bộ đơn hàng của các khách hàng này
        # Cần load cả details để check lý do hủy/bom
        orders = db.query(Order).filter(
            Order.brand_id == brand_id,
            Order.username.in_(usernames)
        ).all()
        
        if not orders:
            return
            
        # --- BƯỚC BỔ SUNG: Kiểm tra dữ liệu Hoàn Tiền từ bảng Revenue ---
        order_codes = [o.order_code for o in orders if o.order_code]
        refunded_codes = set()
        
        if order_codes:
            refund_records = db.query(Revenue.order_code).filter(
                Revenue.brand_id == brand_id,
                Revenue.order_code.in_(order_codes),
                Revenue.refund < -0.1 # Logic check refund âm
            ).all()
            refunded_codes = {r.order_code for r in refund_records}

        # 2. Gom nhóm & Tính toán trong RAM (Python Dictionary)
        # Key: username, Value: Dict các chỉ số
        customer_stats = defaultdict(lambda: {
            "spent": 0.0, 
            "total_count": 0, 
            "cancel": 0, 
            "bomb": 0, 
            "refund": 0,
            "success_count": 0, # Đếm số đơn thành công để đối chiếu
            "last_date": None
        })

        for order in orders:
            if not order.username:
                continue
            
            stats = customer_stats[order.username]
            
            # Kiểm tra xem đơn này có bị hoàn tiền tài chính không
            is_refunded_financial = order.order_code in refunded_codes
            
            # --- LOGIC PHÂN LOẠI CHUẨN ---
            # Lưu ý: is_financial_refund=False vì ta đang tính sơ bộ từ Order.
            # Nếu muốn chính xác Refund tài chính, cần join bảng Revenue, nhưng ở cấp Customer view 
            # thì Refund trạng thái (đơn hoàn) quan trọng hơn.
            category = _classify_order_status(order, is_financial_refund=is_refunded_financial)
            
            # Cập nhật ngày mua gần nhất
            if order.order_date:
                if not stats["last_date"] or order.order_date > stats["last_date"]:
                    stats["last_date"] = order.order_date

            # Cộng dồn chỉ số (Aggregation)
            stats["total_count"] += 1 # Tổng đơn phát sinh (All status)

            if category == 'completed':
                stats["spent"] += (order.selling_price or 0.0)
                stats["success_count"] += 1
            elif category == 'cancelled':
                stats["cancel"] += 1
            elif category == 'bomb':
                stats["bomb"] += 1
            elif category == 'refunded':
                stats["refund"] += 1
            # Category 'other' (đang giao, chờ xác nhận...) -> Chỉ tính vào total_count, không cộng tiền/bom/hủy

        # 3. Cập nhật vào Database (Ghi đè - Idempotent Update)
        for username, data in customer_stats.items():
            db_customer = self.get_by_username(db, brand_id=brand_id, username=username)
            if db_customer:
                db_customer.total_spent = data["spent"]
                db_customer.total_orders = data["total_count"]
                db_customer.cancelled_orders = data["cancel"]
                db_customer.bomb_orders = data["bomb"]
                db_customer.refunded_orders = data["refund"]
                db_customer.completed_orders = data["success_count"] # Cập nhật cột mới
                db_customer.last_order_date = data["last_date"]
        
        # Flush để đẩy dữ liệu vào transaction hiện tại
        db.flush()

    def _is_status_match(self, column, keywords):
        # Hàm cũ không dùng nữa, nhưng giữ lại nếu cần tham khảo hoặc xóa sau
        from sqlalchemy import or_
        return or_(*[column.ilike(f"%{k}%") for k in keywords])

customer = CRUDCustomer(Customer)
