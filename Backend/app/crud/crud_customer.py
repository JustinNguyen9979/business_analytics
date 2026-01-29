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
                stats["canceled_orders"] += 1
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
            customer.refunded_orders = data["refunded_orders"]
            
            if data["success_orders"] > 0:
                customer.aov = data["total_spent"] / data["success_orders"]

            # Phân hạng (Rank)
            if customer.total_spent >= 50000000: customer.rank = "DIAMOND"
            elif customer.total_spent >= 20000000: customer.rank = "PLATINUM"
            elif customer.total_spent >= 10000000: customer.rank = "GOLD"
            elif customer.total_spent >= 2000000: customer.rank = "SILVER"
            else: customer.rank = "MEMBER"

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

    def _get_product_map(self, db: Session, brand_id: int):
        """Helper: Lấy Map SKU -> Product Name chuẩn từ bảng Products"""
        products = db.query(Product.sku, Product.name).filter(
            Product.brand_id == brand_id,
            Product.name.isnot(None)
        ).all()
        return {p.sku: p.name for p in products}

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
                Revenue.order_refund  # Lấy thêm cột mã hoàn
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

    def _format_unified_order(
        self, 
        order: Order, 
        net_revenue: float, 
        gmv: float, 
        total_fees: float, 
        category: str, 
        refund_tracking_code: str = None,
        product_map: dict = None
    ):
        """
        Helper chuẩn hóa dữ liệu đơn hàng về format thống nhất cho cả Search và Detail View.
        Format này tương thích trực tiếp với OrderHistoryTable ở Frontend.
        """
        # Lấy details và deep copy để tránh sửa đổi object gốc nếu cần (hoặc dùng dict mới)
        full_details = order.details if order.details and isinstance(order.details, dict) else {}
        
        # Cập nhật tên sản phẩm chuẩn từ SKU (nếu có map)
        if product_map and 'items' in full_details and isinstance(full_details['items'], list):
            for item in full_details['items']:
                sku = item.get('sku')
                if sku and sku in product_map:
                    item['product_name'] = product_map[sku]

        return {
            # --- CÁC TRƯỜNG BẮT BUỘC CỦA SCHEMA (Database Model) ---
            "id": order.id,
            "brand_id": order.brand_id,
            "username": order.username,
            "total_quantity": order.total_quantity or 0,
            "cogs": order.cogs or 0.0,
            "original_price": order.original_price or 0.0,
            "sku_price": order.sku_price or 0.0,
            
            # --- CÁC TRƯỜNG HIỂN THỊ UI & LOGIC ---
            "order_code": order.order_code,
            "tracking_id": order.tracking_id,
            "return_tracking_code": refund_tracking_code,
            "order_date": order.order_date.isoformat() if order.order_date else None,
            "status": order.status,
            "category": category,
            "net_revenue": net_revenue,
            "gmv": gmv,
            "total_fees": total_fees,
            "source": order.source or "---",
            "details": full_details
        }

    def _build_customer_response(self, customer: Customer, orders: list, revenue_map: dict, fees_map: dict, gmv_map: dict, refunded_codes: set, refund_tracking_map: dict, product_map: dict):
        """
        Helper duy nhất để tạo ra object Customer Response chuẩn (Single Source of Truth).
        Kết hợp dữ liệu từ DB (cho các chỉ số tổng) và tính toán realtime (cho list orders).
        """
        # 1. Xử lý danh sách đơn hàng & Tính chỉ số phụ (Cycle, Real Revenue...)
        formatted_orders = []
        completed_dates = []
        real_net_revenue = 0.0
        real_total_fees = 0.0
        
        # Bomb orders chưa có trong bảng Customer, cần tính từ danh sách đơn hàng hoặc giả định
        bomb_count_from_loop = 0
        
        for order in orders:
            net_rev = revenue_map.get(order.order_code, 0.0)
            fees = fees_map.get(order.order_code, 0.0)
            gmv = gmv_map.get(order.order_code, 0.0)
            refund_code = refund_tracking_map.get(order.order_code)
            
            # Phân loại trạng thái chuẩn xác
            # Sử dụng refunded_codes (được xác định từ dữ liệu tài chính) để biết đơn có hoàn tiền hay không
            is_financial_refund = order.order_code in refunded_codes
            category = _classify_order_status(order, is_financial_refund=is_financial_refund)
            
            formatted_order = self._format_unified_order(
                order, net_rev, gmv, fees, category, refund_code, product_map
            )
            formatted_orders.append(formatted_order)
            
            # Collect stats
            if category == 'completed':
                real_net_revenue += net_rev
                completed_dates.append(order.order_date)
            elif category == 'refunded':
                real_net_revenue += net_rev # Cộng số âm
            elif category == 'bomb':
                bomb_count_from_loop += 1
            
            real_total_fees += fees

        # 2. Tính Avg Repurchase Cycle
        avg_cycle = 0.0
        if len(completed_dates) > 1:
            unique_dates = sorted(list(set([d.date() if hasattr(d, 'date') else d for d in completed_dates])))
            if len(unique_dates) > 1:
                total_days = (unique_dates[-1] - unique_dates[0]).days
                avg_cycle = total_days / (len(unique_dates) - 1)

        # 3. Tính Rank Progress
        current_spent = customer.total_spent or 0
        next_rank_target = 0
        next_rank_name = "MAX"
        
        if current_spent < 2000000:
            next_rank_target = 2000000; next_rank_name = "SILVER"
        elif current_spent < 10000000:
            next_rank_target = 10000000; next_rank_name = "GOLD"
        elif current_spent < 20000000:
            next_rank_target = 20000000; next_rank_name = "PLATINUM"
        elif current_spent < 50000000:
            next_rank_target = 50000000; next_rank_name = "DIAMOND"
        
        rank_progress = 100
        if next_rank_target > 0:
            rank_progress = min(round((current_spent / next_rank_target) * 100, 1), 100)

        # 4. Construct Final Object
        # Lấy ngày đặt hàng gần nhất từ danh sách đơn hàng (đã sort desc)
        latest_order_date = None
        if orders and len(orders) > 0:
            # orders[0] là object Order, có thuộc tính order_date (datetime)
            latest_order_date = orders[0].order_date

        return {
            "type": "customer",
            "id": customer.username or str(customer.id),
            "source": customer.source or "---",
            "name": customer.username or customer.phone or "Khách vãng lai",
            "phone": customer.phone or "---",
            "email": customer.email or "---",
            "gender": customer.gender or "---",
            "defaultAddress": customer.default_address or "---",
            "province": customer.default_province or "---",
            "district": "---", # Cần bổ sung nếu DB có cột district
            "lastLogin": "Gần đây",
            "tags": customer.tags or [],
            "notes": customer.notes or "---",
            "lastOrderDate": latest_order_date,
            
            # --- Metrics ---
            "rank": customer.rank,
            "nextRank": next_rank_name,
            "rankProgress": rank_progress,
            
            "ltv": customer.total_spent,
            "totalProfit": customer.profit or 0.0,
            "totalFees": real_total_fees, # Tính từ list orders hiển thị
            "aov": customer.aov or 0.0,
            
            "orderCount": customer.total_orders,
            "successCount": customer.success_orders,
            "refundedOrders": customer.refunded_orders,
            "cancelCount": customer.canceled_orders,
            "bombOrders": bomb_count_from_loop, # Tạm dùng số tính từ loop
            "avgRepurchaseCycle": avg_cycle,
            
            # --- List ---
            "recentOrders": formatted_orders
        }

    def _fetch_customer_profile_data(self, db: Session, brand_id: int, customer: Customer):
        """
        Helper: Logic cốt lõi để lấy dữ liệu chi tiết khách hàng + orders + finance.
        Được tách ra từ SearchPage để dùng chung, tránh trùng lặp logic.
        """
        # 1. Lấy toàn bộ lịch sử đơn hàng
        all_orders = db.query(Order).filter(
            Order.brand_id == brand_id,
            Order.username == customer.username
        ).order_by(Order.order_date.desc()).all()

        # 2. Lấy dữ liệu tài chính
        order_codes = [o.order_code for o in all_orders if o.order_code]
        revenue_map, fees_map, gmv_map, refunded_codes, refund_tracking_map = self._get_revenue_map(db, brand_id, order_codes)
        product_map = self._get_product_map(db, brand_id)

        # 3. Build Response using Shared Helper
        return self._build_customer_response(
            customer, all_orders, revenue_map, fees_map, gmv_map, refunded_codes, refund_tracking_map, product_map
        )

    def search_entities(self, db: Session, brand_id: int, query: str):
        """
        Tìm kiếm thông minh: 
        - Hỗ trợ tìm chính xác hoặc gần đúng (case-insensitive)
        - Order: order_code, tracking_id, return_tracking_code (via Revenue)
        - Customer: username, phone, email
        """
        query = query.strip()
        if not query:
            return None

        # 1. TÌM KIẾM ĐƠN HÀNG (Order Code hoặc Tracking ID)
        # Sử dụng ilike để tìm kiếm không phân biệt hoa thường
        order = db.query(Order).filter(
            Order.brand_id == brand_id,
            or_(
                Order.order_code.ilike(query), 
                Order.tracking_id.ilike(query)
            )
        ).first()

        # Nếu không tìm thấy trong Order, thử tìm trong Revenue (Mã vận đơn hoàn - Return Tracking Code)
        if not order:
            from models import Revenue
            from sqlalchemy import cast, String
            rev_match = db.query(Revenue).filter(
                Revenue.brand_id == brand_id,
                cast(Revenue.order_refund, String).ilike(query) # Cast sang String để dùng ilike
            ).first()
            
            if rev_match:
                order = db.query(Order).filter(
                    Order.brand_id == brand_id,
                    Order.order_code == rev_match.order_code
                ).first()

        if order:
            from models import Revenue
            rev = db.query(Revenue).filter(Revenue.brand_id == brand_id, Revenue.order_code == order.order_code).first()
            is_refunded = (rev.refund or 0) < -0.1 if rev else False
            category = _classify_order_status(order, is_financial_refund=is_refunded)
            
            return {
                "type": "order",
                "id": order.order_code,
                "status": category,
                "createdDate": order.order_date.strftime("%d/%m/%Y %H:%M") if order.order_date else "---",
                "paymentMethod": order.details.get("payment_method") if order.details else "---",
                "source": order.source,
                "trackingCode": order.tracking_id or "---",
                "return_tracking_code": rev.order_refund if rev and rev.order_refund else "---",
                "carrier": order.details.get("shipping_provider_name") if order.details else "---",
                "customer": {
                    "name": order.details.get("customer_name") or order.username if order.details else order.username,
                    "phone": order.details.get("phone") if order.details else "---",
                    "email": "---",
                    "rank": "MEMBER", 
                    "fullAddress": f"{order.details.get('address', '')}, {order.details.get('province', '')}" if order.details else "---"
                },
                "items": order.details.get("items", []) if order.details else [],
                "subtotal": order.original_price or 0.0,
                "discountVoucher": order.subsidy_amount or 0.0,
                "totalCollected": rev.net_revenue if rev else 0.0,
                "cogs": order.cogs or 0.0,
                "netProfit": (rev.net_revenue - order.cogs) if rev else 0.0,
                "netMargin": round(((rev.net_revenue - order.cogs) / rev.net_revenue * 100), 1) if rev and rev.net_revenue > 0 else 0
            }

        # 2. TÌM KIẾM KHÁCH HÀNG (Username, Phone, Email)
        customer = db.query(Customer).filter(
            Customer.brand_id == brand_id,
            or_(
                Customer.username.ilike(query),
                Customer.phone.ilike(query),
                Customer.email.ilike(query)
            )
        ).first()

        if customer:
            return self._fetch_customer_profile_data(db, brand_id, customer)

        return None

    def suggest_entities(self, db: Session, brand_id: int, query: str, limit: int = 10):
        """
        Gợi ý kết quả khi người dùng đang gõ (Autocomplete).
        Tìm kiếm gần đúng trong Customers (username, phone, email) và Orders (order_code).
        """
        if not query or len(query) < 2:
            return []

        suggestions = []
        
        # 1. Gợi ý khách hàng (Ưu tiên username, phone, email)
        customers = db.query(Customer).filter(
            Customer.brand_id == brand_id,
            or_(
                Customer.username.ilike(f"%{query}%"),
                Customer.phone.ilike(f"%{query}%"),
                Customer.email.ilike(f"%{query}%")
            )
        ).limit(limit).all()

        for c in customers:
            label = c.username
            if c.phone: label += f" ({c.phone})"
            
            suggestions.append({
                "type": "customer",
                "value": c.username,
                "label": label,
                "sub_label": c.email or "Khách hàng"
            })

        # 2. Gợi ý đơn hàng (Nếu còn chỗ)
        if len(suggestions) < limit:
            remaining = limit - len(suggestions)
            orders = db.query(Order).filter(
                Order.brand_id == brand_id,
                or_(
                    Order.order_code.ilike(f"%{query}%"),
                    Order.tracking_id.ilike(f"%{query}%")
                )
            ).limit(remaining).all()

            for o in orders:
                suggestions.append({
                    "type": "order",
                    "value": o.order_code,
                    "label": f"Đơn hàng: {o.order_code}",
                    "sub_label": o.tracking_id or o.source
                })

        return suggestions

customer = CRUDCustomer()
