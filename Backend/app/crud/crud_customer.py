from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_
from datetime import date
from collections import defaultdict
from models import Order, Revenue, Product, Customer
from kpi_utils import _classify_order_status, is_success_category
from vietnam_address_mapping import get_new_province_name

class CRUDCustomer:
    """
    CRUDCustomer (Refactored): Tối ưu hóa logic tính toán, loại bỏ code lặp lại.
    Sử dụng Single Source of Truth cho việc phân loại và cộng dồn số liệu.
    """

    def upsert_customers_from_orders(self, db: Session, brand_id: int, usernames: list):
        """
        Đồng bộ dữ liệu khách hàng từ danh sách username bị ảnh hưởng.
        Tính toán lại toàn bộ chỉ số để đảm bảo tính chính xác (Single Source of Truth).
        """
        if not usernames:
            return

        # 1. Lấy tất cả đơn hàng của các username này để tính toán lại chỉ số
        all_orders = db.query(Order).filter(
            Order.brand_id == brand_id,
            Order.username.in_(usernames)
        ).order_by(Order.username, Order.order_date.desc()).all()

        # 2. Lấy dữ liệu tài chính (Revenue) để tính LTV chuẩn
        order_codes = [o.order_code for o in all_orders if o.order_code]
        revenue_map, _, _, refunded_codes, _ = self._get_revenue_map(db, brand_id, order_codes)

        # 3. Gom nhóm và tính toán
        cust_data = defaultdict(lambda: {
            "total_spent": 0.0,
            "total_profit": 0.0,
            "total_orders": 0,
            "success_orders": 0,
            "canceled_orders": 0,
            "bomb_orders": 0,
            "refunded_orders": 0,
            "latest_source": None,
            "phone": None,
            "email": None,
            "gender": None,
            "province": None,
            "address": None
        })

        for order in all_orders:
            username = order.username
            stats = cust_data[username]
            
            # Phân loại đơn hàng
            is_refunded = order.order_code in refunded_codes
            category = _classify_order_status(order, is_financial_refund=is_refunded)
            
            # Chỉ số số lượng
            stats["total_orders"] += 1
            
            # 1. Đếm số lượng đơn thành công (Mẫu số AOV) - Chỉ tính Completed
            if is_success_category(category):
                stats["success_orders"] += 1
            elif category == 'cancelled':
                stats["canceled_orders"] += 1
            elif category == 'bomb':
                stats["bomb_orders"] += 1 # Tách riêng bomb
            elif category == 'refunded':
                stats["refunded_orders"] += 1

            # 2. Tính toán Tài chính (Net Revenue & Profit)
            # - Completed: +Doanh thu, -COGS
            # - Refunded: +Doanh thu (Âm), KHÔNG trừ COGS (giả định hàng về kho)
            if is_success_category(category):
                net_rev = revenue_map.get(order.order_code, 0.0)
                stats["total_spent"] += net_rev
                stats["total_profit"] += (net_rev - (order.cogs or 0.0))
            elif category == 'refunded':
                net_rev = revenue_map.get(order.order_code, 0.0)
                stats["total_spent"] += net_rev
                stats["total_profit"] += net_rev # Chỉ cộng doanh thu âm (phí), không trừ COGS

            # Lấy thông tin từ đơn hàng MỚI NHẤT (do query đã order_by desc)
            if not stats["latest_source"]:
                stats["latest_source"] = order.source # Lấy nguồn từ đơn mới nhất
                
                # Trích xuất thông tin cá nhân từ details
                if order.details:
                    stats["phone"] = order.details.get("phone")
                    stats["email"] = order.details.get("email")
                    stats["gender"] = order.details.get("gender")
                    stats["province"] = order.details.get("province")
                    stats["address"] = order.details.get("address")

        # 4. Cập nhật vào bảng Customer
        for username, data in cust_data.items():
            # Tìm khách hàng cũ
            customer = db.query(Customer).filter(
                Customer.brand_id == brand_id,
                Customer.username == username
            ).first()

            if not customer:
                customer = Customer(
                    brand_id=brand_id,
                    username=username
                )
                db.add(customer)

            # Cập nhật thông tin định danh
            customer.source = data["latest_source"] # Cập nhật source
            
            customer.phone = data["phone"]
            customer.email = data["email"]
            customer.gender = data["gender"]
            customer.default_province = data["province"]
            customer.default_address = data["address"]
            
            # Cập nhật chỉ số
            customer.total_spent = data["total_spent"]
            customer.profit = data["total_profit"] # Cập nhật Profit
            customer.total_orders = data["total_orders"]
            customer.success_orders = data["success_orders"]
            customer.canceled_orders = data["canceled_orders"]
            customer.bomb_orders = data["bomb_orders"] # Cập nhật cột mới
            customer.refunded_orders = data["refunded_orders"]
            
            if data["success_orders"] > 0:
                customer.aov = data["total_spent"] / data["success_orders"]

            # Phân hạng (Rank) - Logic tính toán inline (Thay vì gọi helper thiếu)
            current_spent = customer.total_spent or 0.0
            rank = "MEMBER"
            if current_spent < 2000000: rank = "MEMBER"
            elif current_spent < 10000000: rank = "SILVER"
            elif current_spent < 20000000: rank = "GOLD"
            elif current_spent < 50000000: rank = "PLATINUM"
            else: rank = "DIAMOND"
            
            customer.rank = rank

        db.flush() # Đẩy thay đổi xuống nhưng chưa commit hoàn toàn

    def _extract_location_data(self, details: dict):
        """Helper: Trích xuất và chuẩn hóa Province/District từ JSON details."""
        if not details or not isinstance(details, dict):
            return None, None
            
        raw_prov = details.get('province')
        raw_dist = details.get('district')
        
        if raw_prov:
            mapped_prov = get_new_province_name(raw_prov)
            if mapped_prov:
                return mapped_prov, raw_dist
        
        return None, None


    def _get_revenue_map(self, db: Session, brand_id: int, order_codes: list):
        """
        Helper: Lấy Net Revenue, Total Fees, GMV và Refund Status từ bảng Revenue.
        Trả về:
            - revenue_map: Dict[order_code, net_revenue]
            - fees_map: Dict[order_code, total_fees]
            - gmv_map: Dict[order_code, gmv]
            - refunded_codes: Set[order_code] (Các đơn có refund thực tế)
        """
        revenue_map = defaultdict(float) # order_code -> total_net_revenue
        fees_map = defaultdict(float) # order_code -> total_fees
        gmv_map = defaultdict(float) # order_code -> gmv
        refunded_codes = set()
        
        if not order_codes:
            return revenue_map, fees_map, gmv_map, refunded_codes

        chunk_size = 1000
        for i in range(0, len(order_codes), chunk_size):
            chunk = order_codes[i:i + chunk_size]
            rev_records = db.query(
                Revenue.order_code, 
                Revenue.net_revenue,
                Revenue.total_fees,
                Revenue.gmv,
                Revenue.refund,
                Revenue.order_refund  
            ).filter(
                Revenue.brand_id == brand_id, 
                Revenue.order_code.in_(chunk)
            ).all()
            
            for code, net_rev, fees, gmv, refund, order_refund in rev_records:
                if net_rev:
                    revenue_map[code] += net_rev
                if fees:
                    fees_map[code] += fees
                if gmv:
                    gmv_map[code] += gmv
                if (refund or 0) < -0.1:
                    refunded_codes.add(code)
                
                # Lưu mã hoàn hàng vào map (nếu có)
                if order_refund:
                    # Tận dụng gmv_map hoặc tạo map mới?
                    # Để code gọn, ta thêm vào một thuộc tính động hoặc trả về map mới
                    # Ở đây tốt nhất là gán vào fees_map tạm thời hoặc tạo map riêng
                    # TẠO MAP MỚI là an toàn nhất
                    if 'refund_tracking_map' not in locals(): refund_tracking_map = {}
                    refund_tracking_map[code] = order_refund

        # Trả về thêm refund_tracking_map (cần sửa return signature)
        # TUY NHIÊN, để tránh sửa quá nhiều chỗ gọi hàm, ta có thể gán nó vào một biến tạm global
        # hoặc sửa hàm trả về. Sửa hàm trả về là chuẩn nhất.
        return revenue_map, fees_map, gmv_map, refunded_codes, locals().get('refund_tracking_map', {})

    def _accumulate_order_data(self, stats: dict, order: Order, net_revenue: float, is_refunded: bool):
        """
        Helper TRUNG TÂM: Thực hiện mọi logic tính toán cho một đơn hàng.
        - Phân loại đơn (Completed/Cancelled/Bomb/Refunded).
        - Cộng dồn số lượng.
        - Cộng tiền (kiểm tra trùng lặp).
        - Cập nhật thông tin khách (Ngày mua cuối, Địa chỉ).
        
        Return: category (str) - Trạng thái của đơn hàng này.
        """
        # 1. Phân loại đơn hàng
        category = _classify_order_status(order, is_financial_refund=is_refunded)
        
        # 2. Cộng số lượng
        stats["total_orders"] += 1
        
        if is_success_category(category):
            stats["completed_orders"] += 1
        elif category == 'cancelled':
            stats["cancelled_orders"] += 1
        elif category == 'bomb':
            stats["bomb_orders"] += 1
        elif category == 'refunded':
            stats["refunded_orders"] += 1

        # 3. Cộng tiền (Completed + Refunded)
        if order.order_code and order.order_code not in stats["seen_codes"]:
            if is_success_category(category):
                stats["total_spent"] += net_revenue
                # Chỉ trừ COGS khi đơn thành công
                # (Lưu ý: Logic này giả định tính profit tại chỗ, nhưng hàm này hiện tại chỉ cộng total_spent
                # Profit được tính ở loop chính bên ngoài hoặc hàm gọi, nhưng để an toàn ta ghi chú rõ)
                pass 
            elif category == 'refunded':
                stats["total_spent"] += net_revenue
                # Refunded: Cộng doanh thu âm, không đụng đến COGS (Hàng về)
                pass
            
            # Lưu ý: Hàm này hiện tại CHỈ tính total_spent cho customer_stats
            # Phần profit được tính riêng ở logic gọi hàm (upsert/detail) hoặc cần cập nhật tại đây nếu muốn
            # Tuy nhiên, cấu trúc hiện tại của `_accumulate_order_data` chỉ update `total_spent`.
            
            if is_success_category(category) or category == 'refunded':
                stats["seen_codes"].add(order.order_code)

        # 4. Cập nhật ngày mua gần nhất
        if order.order_date:
            # Chuẩn hóa về date object nếu cần
            o_date_val = order.order_date.date() if hasattr(order.order_date, 'date') else order.order_date
            
            current_last = stats.get("last_order_date")
            # Logic: Nếu chưa có ngày hoặc ngày mới > ngày cũ -> Cập nhật
            if not current_last or o_date_val >= current_last:
                stats["last_order_date"] = o_date_val

        # 5. Cập nhật địa chỉ (Lấy địa chỉ từ đơn mới nhất có thông tin)
        # Logic: Ưu tiên lấy địa chỉ nếu stats chưa có. 
        # (Có thể cải tiến: Lấy địa chỉ của đơn mới nhất, nhưng hiện tại logic cũ là gặp đâu lấy đó)
        if not stats["province"]:
            prov, dist = self._extract_location_data(order.details)
            if prov:
                stats["province"] = prov
                stats["district"] = dist
                
        return category

    def get_top_customers_in_period(
        self, 
        db: Session, 
        brand_id: int, 
        start_date: date, 
        end_date: date, 
        limit: int = 20000, 
        page: int = 1,
        page_size: int = 20,
        source_list: list[str] = None
    ):
        # 1. Query Orders
        filters = [
            Order.brand_id == brand_id,
            func.date(Order.order_date) >= start_date,
            func.date(Order.order_date) <= end_date,
            Order.username.isnot(None)
        ]
        if source_list and 'all' not in source_list:
            filters.append(Order.source.in_(source_list))

        orders = db.query(Order).filter(*filters).order_by(Order.order_date).all()
        
        # 2. Get Financial Data
        order_codes = [o.order_code for o in orders if o.order_code]
        revenue_map, fees_map, gmv_map, refunded_codes, _ = self._get_revenue_map(db, brand_id, order_codes)

        # 3. Process Data
        customer_stats = defaultdict(lambda: {
            "total_spent": 0.0,
            "total_orders": 0,
            "completed_orders": 0,
            "cancelled_orders": 0,
            "bomb_orders": 0,
            "refunded_orders": 0,
            "last_order_date": None,
            "province": None,
            "district": None,
            "seen_codes": set() # Quan trọng: Tránh cộng tiền trùng lặp
        })

        for order in orders:
            stats = customer_stats[order.username]
            net_revenue = revenue_map.get(order.order_code, 0.0)
            is_refunded = order.order_code in refunded_codes
            
            # Gọi Helper xử lý tất cả logic
            self._accumulate_order_data(stats, order, net_revenue, is_refunded)

        # 4. Format Result
        results = []
        for username, data in customer_stats.items():
            completed = data["completed_orders"]
            results.append({
                "username": username,
                "total_spent": data["total_spent"],
                "total_orders": data["total_orders"],
                "completed_orders": completed,
                "cancelled_orders": data["cancelled_orders"],
                "bomb_orders": data["bomb_orders"],
                "refunded_orders": data["refunded_orders"],
                "aov": (data["total_spent"] / completed) if completed > 0 else 0,
                "last_order_date": data["last_order_date"],
                "province": data["province"] or "---",
                "district": data["district"] or "---"
            })

        # 5. Sort & Pagination
        results.sort(key=lambda x: x["total_spent"], reverse=True)
        total_found = len(results)
        
        if total_found > limit:
            results = results[:limit]
            total_found = limit

        start_idx = (page - 1) * page_size
        return {
            "data": results[start_idx : start_idx + page_size],
            "total": total_found, "page": page, "limit": page_size
        }

    def update_customer_info(self, db: Session, brand_id: int, customer_identifier: str, update_data):
        """
        Cập nhật thông tin khách hàng (SĐT, Email, Address, Notes).
        identifier có thể là ID (int) hoặc username (str).
        """
        # Thử tìm theo username trước (vì frontend đang dùng username làm ID chính)
        customer = db.query(Customer).filter(
            Customer.brand_id == brand_id,
            Customer.username == customer_identifier
        ).first()

        # Nếu không tìm thấy theo username, thử tìm theo ID (đề phòng)
        if not customer and customer_identifier.isdigit():
             customer = db.query(Customer).filter(
                Customer.brand_id == brand_id,
                Customer.id == int(customer_identifier)
            ).first()

        if not customer:
            return None

        # Cập nhật các trường được phép
        if update_data.phone is not None:
            customer.phone = update_data.phone
        if update_data.email is not None:
            customer.email = update_data.email
        if update_data.gender is not None:
            customer.gender = update_data.gender
        if update_data.default_address is not None:
            customer.default_address = update_data.default_address
        if update_data.notes is not None:
            customer.notes = update_data.notes
        if update_data.tags is not None:
            customer.tags = update_data.tags
            
        db.commit()
        db.refresh(customer)
        
        return customer

customer = CRUDCustomer()
