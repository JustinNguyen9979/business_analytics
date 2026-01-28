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

    def get_customer_detail_with_orders(self, db: Session, *, brand_id: int, username: str):
        # 1. Query Orders
        orders = db.query(Order).filter(
            Order.brand_id == brand_id, 
            Order.username == username
        ).order_by(desc(Order.order_date)).all()
        
        if not orders:
            return None

        # 2. Get Financial Data
        order_codes = [o.order_code for o in orders if o.order_code]
        revenue_map, fees_map, gmv_map, refunded_codes, refund_tracking_map = self._get_revenue_map(db, brand_id, order_codes)
        
        # 3. Get Product Map (SKU -> Name)
        product_map = self._get_product_map(db, brand_id)

        # 4. Aggregation (Sử dụng chung Helper với hàm trên)
        stats = {
            "total_spent": 0.0,
            "total_orders": 0, "completed_orders": 0,
            "cancelled_orders": 0, "bomb_orders": 0, "refunded_orders": 0,
            "last_order_date": None, "province": None, "district": None,
            "seen_codes": set(),
            "avg_repurchase_cycle": 0.0 # New metric
        }

        completed_dates = []

        for order in orders:
            net_revenue = revenue_map.get(order.order_code, 0.0)
            total_fees = fees_map.get(order.order_code, 0.0)
            revenue_gmv = gmv_map.get(order.order_code, 0.0)
            is_refunded = order.order_code in refunded_codes
            
            # --- LOGIC MỚI: Cập nhật tên sản phẩm chuẩn từ SKU ---
            if order.details and isinstance(order.details, dict):
                items = order.details.get('items', [])
                for item in items:
                    sku = item.get('sku')
                    # Nếu tìm thấy SKU trong bảng products, ghi đè tên chuẩn vào
                    if sku and sku in product_map:
                        item['product_name'] = product_map[sku]
            # -----------------------------------------------------
            
            # Gọi Helper để tính toán tổng quan
            category = self._accumulate_order_data(stats, order, net_revenue, is_refunded)
            
            # Collect dates for repurchase cycle calculation (Successful orders only)
            if is_success_category(category) and order.order_date:
                completed_dates.append(order.order_date)
            
            # Gán thuộc tính bổ sung vào object order để API trả về hiển thị
            setattr(order, "category", category)
            setattr(order, "net_revenue", net_revenue)
            setattr(order, "total_fees", total_fees)
            
            # Gán mã hoàn hàng (nếu có)
            if refund_tracking_map.get(order.order_code):
                setattr(order, "return_tracking_code", refund_tracking_map[order.order_code])
            
            # Ưu tiên lấy GMV từ bảng Revenue (nếu có)
            if revenue_gmv > 0:
                setattr(order, "gmv", revenue_gmv) 

        # Calculate Average Repurchase Cycle (Logic Updated: Deduplicate same-day orders)
        # Chỉ tính chu kỳ dựa trên "Ngày mua hàng" (Unique Dates), bỏ qua việc mua nhiều đơn trong cùng 1 ngày.
        if len(completed_dates) > 1:
            # 1. Chuyển đổi sang date object (bỏ time) và lọc trùng
            unique_dates = sorted(list(set([d.date() if hasattr(d, 'date') else d for d in completed_dates])))
            
            if len(unique_dates) > 1:
                total_days_diff = 0
                count_intervals = 0
                
                for i in range(1, len(unique_dates)):
                    # Calculate diff in days
                    diff = (unique_dates[i] - unique_dates[i-1]).days
                    total_days_diff += diff
                    count_intervals += 1
                
                if count_intervals > 0:
                    stats["avg_repurchase_cycle"] = total_days_diff / count_intervals

        # Calculate AOV (Based on completed orders only)
        completed_count = stats["completed_orders"]
        aov = (stats["total_spent"] / completed_count) if completed_count > 0 else 0

        return {
            "info": {
                "username": username,
                "province": stats["province"] or "---",
                "district": stats["district"] or "---",
                "total_spent": stats["total_spent"],
                "aov": aov, # New field
                "total_orders": stats["total_orders"],
                "completed_orders": stats["completed_orders"],
                "cancelled_orders": stats["cancelled_orders"],
                "bomb_orders": stats["bomb_orders"],
                "refunded_orders": stats["refunded_orders"],
                "last_order_date": stats["last_order_date"],
                "avg_repurchase_cycle": stats["avg_repurchase_cycle"]
            },
            "orders": orders
        }

    def search_entities(self, db: Session, brand_id: int, query: str):
        """
        Tìm kiếm thực thể (Đơn hàng hoặc Khách hàng) dựa trên query.
        """
        query = query.strip()
        if not query:
            return None

        # 1. ƯU TIÊN 1: Tìm theo Mã đơn hàng hoặc Mã vận đơn
        order = db.query(Order).filter(
            Order.brand_id == brand_id,
            (Order.order_code == query) | (Order.tracking_id == query)
        ).first()

        if order:
            # Nếu tìm thấy đơn hàng, trả về thông tin chi tiết đơn hàng kèm info khách hàng (nếu có)
            # Tận dụng hàm detail_with_orders nhưng chỉ lấy 1 đơn
            # Ở đây ta sẽ giả lập cấu trúc trả về giống frontend mong đợi
            
            # Lấy thêm net_revenue từ Revenue table
            from models import Revenue
            rev = db.query(Revenue).filter(Revenue.brand_id == brand_id, Revenue.order_code == order.order_code).first()
            
            # Phân loại trạng thái
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
                "return_tracking_code": rev.order_refund if rev else None, # Mã hoàn hàng
                "carrier": order.details.get("shipping_provider_name") if order.details else "---",
                "customer": {
                    "name": order.details.get("customer_name") or order.username if order.details else order.username,
                    "phone": order.details.get("phone") if order.details else "---",
                    "email": "---",
                    "rank": "MEMBER", # Mặc định, có thể query thêm từ bảng Customer
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

        # 2. ƯU TIÊN 2: Tìm khách hàng (theo SĐT hoặc Username) - LOẠI BỎ TÌM THEO TÊN
        customer = db.query(Customer).filter(
            Customer.brand_id == brand_id,
            (Customer.phone == query) | (Customer.username.ilike(f"%{query}%")) 
        ).first()

        if customer:
            # 2.1 Lấy toàn bộ lịch sử đơn hàng
            all_orders = db.query(Order).filter(
                Order.brand_id == brand_id,
                Order.username == customer.username
            ).order_by(Order.order_date.desc()).all()

            # 2.2 Lấy dữ liệu tài chính thực tế từ bảng Revenue cho các đơn hàng này
            order_codes = [o.order_code for o in all_orders if o.order_code]
            revenue_map, fees_map, gmv_map, refunded_codes, refund_tracking_map = self._get_revenue_map(db, brand_id, order_codes)
            
            # 2.2b Lấy Product Map để chuẩn hóa tên sản phẩm
            product_map = self._get_product_map(db, brand_id)

            # 2.3 Tính toán tổng hợp (Aggregation)
            # Thay vì tính toán lại Profit từ đầu (tốn kém), ta lấy trực tiếp từ bảng Customer
            # Tuy nhiên, vẫn cần loop qua đơn hàng để lấy danh sách recentOrders và tính các chỉ số phụ khác nếu cần
            
            real_total_fees = 0.0
            real_net_revenue = 0.0
            
            recent_orders_data = [] # Chuẩn bị data cho list

            for order in all_orders:
                # 1. Tính toán trước các biến cần thiết
                is_refunded = order.order_code in refunded_codes
                category = _classify_order_status(order, is_financial_refund=is_refunded)
                
                net_rev = revenue_map.get(order.order_code, 0.0)
                fees = fees_map.get(order.order_code, 0.0)
                
                # 2. Cộng dồn tài chính (Chỉ để hiển thị thêm, Profit chính lấy từ Customer DB)
                if category == 'completed':
                    real_net_revenue += net_rev
                elif category == 'refunded':
                    real_net_revenue += net_rev
                
                real_total_fees += fees 
                
                # Lấy toàn bộ thông tin chi tiết (items, shipping, payment...)
                full_details = order.details if order.details and isinstance(order.details, dict) else {}
                
                # --- LOGIC MỚI: Cập nhật tên sản phẩm chuẩn từ SKU ---
                if 'items' in full_details and isinstance(full_details['items'], list):
                    for item in full_details['items']:
                        sku = item.get('sku')
                        if sku and sku in product_map:
                            item['product_name'] = product_map[sku] # Ghi đè tên chuẩn
                # -----------------------------------------------------

                recent_orders_data.append({
                    "id": order.order_code,
                    "trackingCode": order.tracking_id,
                    "source": order.source,
                    "date": order.order_date.isoformat() if order.order_date else None,
                    "total": net_rev,
                    "gmv": gmv_map.get(order.order_code, 0.0),
                    "total_fees": fees, 
                    "return_tracking_code": refund_tracking_map.get(order.order_code), 
                    "status": order.status, 
                    "category": category,
                    "details": full_details 
                })

            # 2.4 Tính toán Rank Progress (Tiến độ lên hạng)
            current_spent = customer.total_spent or 0
            next_rank_target = 0
            next_rank_name = "MAX"
            
            if current_spent < 2000000:
                next_rank_target = 2000000
                next_rank_name = "SILVER"
            elif current_spent < 10000000:
                next_rank_target = 10000000
                next_rank_name = "GOLD"
            elif current_spent < 20000000:
                next_rank_target = 20000000
                next_rank_name = "PLATINUM"
            elif current_spent < 50000000:
                next_rank_target = 50000000
                next_rank_name = "DIAMOND"
            
            rank_progress = 100
            if next_rank_target > 0:
                rank_progress = min(round((current_spent / next_rank_target) * 100, 1), 100)

            # 2.5 Construct Response đầy đủ
            return {
                "type": "customer",
                # --- Customer Info ---
                "id": customer.username or str(customer.id),
                "source": customer.source or "---", 
                "name": customer.username or customer.phone or "Khách vãng lai",
                "phone": customer.phone or "---",
                "email": customer.email or "---",
                "gender": customer.gender or "---",
                "defaultAddress": customer.default_address or "---",
                "province": customer.default_province or "---",
                "lastLogin": "Gần đây", 
                "tags": customer.tags or [],
                "notes": customer.notes or "---",
                
                # --- Metrics & Rank ---
                "rank": customer.rank,
                "nextRank": next_rank_name,
                "rankProgress": rank_progress,
                
                # --- Aggregated Financials (Orders + Revenues) ---
                "ltv": customer.total_spent, 
                "totalNetRevenue": real_net_revenue, 
                "totalProfit": customer.profit or 0.0,    # LẤY TRỰC TIẾP TỪ DB
                "totalFees": real_total_fees,        
                "aov": customer.aov,
                
                # --- Order Counts ---
                "orderCount": customer.total_orders,
                "successCount": customer.success_orders,
                "refundedOrders": customer.refunded_orders, 
                "cancelCount": customer.canceled_orders, 
                
                # --- List Orders (Mapped for UI) ---
                "recentOrders": recent_orders_data
            }

        return None

customer = CRUDCustomer()
