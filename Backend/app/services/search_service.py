from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, cast, String
from collections import defaultdict
from models import Order, Revenue, Product, Customer
from kpi_utils import _classify_order_status
from vietnam_address_mapping import get_new_province_name

class SearchService:
    """
    SearchService: Chuyên trách xử lý logic tìm kiếm và gợi ý (Search & Suggestion).
    Tách biệt khỏi CRUD để giảm tải và dễ dàng mở rộng logic tìm kiếm phức tạp.
    """

    def search_entities(self, db: Session, brand_id: int, query: str):
        """
        Tìm kiếm thông minh: 
        - Hỗ trợ tìm gần đúng (ilike %...%) cho Order Code và Tracking ID.
        - Order: order_code, tracking_id, return_tracking_code (via Revenue)
        - Customer: username, phone, email
        """
        query = query.strip()
        if not query:
            return None

        # 1. TÌM KIẾM ĐƠN HÀNG (Order Code hoặc Tracking ID)
        # Sử dụng ilike %...% để tìm kiếm gần đúng (Contains)
        order = db.query(Order).filter(
            Order.brand_id == brand_id,
            or_(
                Order.order_code.ilike(f"%{query}%"), 
                Order.tracking_id.ilike(f"%{query}%")
            )
        ).first()

        # Nếu không tìm thấy trong Order, thử tìm trong Revenue (Mã vận đơn hoàn - Return Tracking Code)
        if not order:
            rev_match = db.query(Revenue).filter(
                Revenue.brand_id == brand_id,
                Revenue.order_refund.ilike(f"%{query}%")
            ).first()
            
            if rev_match:
                order = db.query(Order).filter(
                    Order.brand_id == brand_id,
                    Order.order_code == rev_match.order_code
                ).first()

        if order:
            return self._build_order_search_result(db, brand_id, order)

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
            return self.get_customer_profile(db, brand_id, customer)

        return None

    def suggest_entities(self, db: Session, brand_id: int, query: str, limit: int = 10):
        """
        Gợi ý kết quả Toàn cục (Global Search & Ranking).
        Chiến thuật: UNION ALL + Global Sorting.
        - Không giới hạn số lượng từng bảng con.
        - Tìm quét toàn bộ DB.
        - Sắp xếp dựa trên độ khớp (Exact > Prefix > Contains) và độ dài chuỗi.
        """
        from sqlalchemy import literal, case, union_all, text
        
        if not query or len(query) < 2:
            return []
        
        # Chuẩn bị pattern
        pattern = f"%{query}%"
        
        # --- 1. SUB-QUERY: CUSTOMERS ---
        # Logic: Nếu username khớp thì lấy username làm match_text, ngược lại lấy phone
        c_stmt = db.query(
            literal("customer").label("type"),
            Customer.username.label("value"),
            Customer.username.label("label"),
            (Customer.phone + " - " + func.coalesce(Customer.email, "")).label("sub_label"),
            case(
                (Customer.username.ilike(pattern), Customer.username),
                else_=Customer.phone
            ).label("match_text")
        ).filter(
            Customer.brand_id == brand_id,
            or_(
                Customer.username.ilike(pattern),
                Customer.phone.ilike(pattern),
                Customer.email.ilike(pattern)
            )
        )

        # --- 2. SUB-QUERY: ORDERS ---
        # Logic hiển thị động:
        # - Nếu khớp Tracking ID -> Label = Tracking ID (để user dễ nhận biết)
        # - Nếu khớp Order Code -> Label = Order Code
        
        # Biến boolean kiểm tra xem Tracking có khớp query không
        is_tracking_match = and_(
            Order.tracking_id.ilike(pattern),
            Order.tracking_id != '',
            func.length(Order.tracking_id) > 2
        )

        o_stmt = db.query(
            literal("order").label("type"),
            Order.order_code.label("value"), # Value vẫn giữ Order Code để frontend navigate đúng
            case(
                (is_tracking_match, "Vận đơn: " + Order.tracking_id),
                else_="Đơn hàng: " + Order.order_code
            ).label("label"),
            case(
                (is_tracking_match, "Đơn hàng: " + Order.order_code),
                else_=func.coalesce(func.nullif(Order.tracking_id, ''), Order.source)
            ).label("sub_label"),
            case(
                (Order.order_code.ilike(pattern), Order.order_code),
                else_=Order.tracking_id
            ).label("match_text")
        ).filter(
            Order.brand_id == brand_id,
            or_(
                Order.order_code.ilike(pattern),
                is_tracking_match
            )
        )

        # --- 3. SUB-QUERY: REVENUES (RETURN ORDERS) ---
        # Loại bỏ dữ liệu rác: '0', '0.0', chuỗi rỗng
        r_stmt = db.query(
            literal("order").label("type"),
            Revenue.order_code.label("value"),
            ("Đơn hoàn: " + Revenue.order_code).label("label"),
            ("Mã hoàn: " + Revenue.order_refund).label("sub_label"),
            Revenue.order_refund.label("match_text")
        ).filter(
            Revenue.brand_id == brand_id,
            Revenue.order_refund.ilike(pattern),
            Revenue.order_refund != '0',
            Revenue.order_refund != '0.0',
            Revenue.order_refund != '',
            func.length(Revenue.order_refund) > 2
        )

        # --- 4. UNION ALL & GLOBAL SORTING ---
        # Gộp tất cả lại thành 1 query duy nhất
        combined_query = union_all(c_stmt, o_stmt, r_stmt).alias("combined_results")
        
        # Tính điểm ưu tiên (Priority Score)
        # 0: Khớp chính xác (Exact)
        # 1: Bắt đầu bằng (Prefix)
        # 2: Chứa (Contains)
        priority_score = case(
            (combined_query.c.match_text.ilike(query), 0),       # Exact match
            (combined_query.c.match_text.ilike(f"{query}%"), 1), # Prefix match
            else_=2                                              # Contains match
        )

        final_query = db.query(
            combined_query.c.type,
            combined_query.c.value,
            combined_query.c.label,
            combined_query.c.sub_label
        ).order_by(
            priority_score.asc(),                 # Ưu tiên độ khớp
            func.length(combined_query.c.match_text).asc(), # Ưu tiên chuỗi ngắn hơn
            combined_query.c.label.asc()          # Alphabetical
        ).limit(limit)

        results = final_query.all()

        return [
            {
                "type": r.type,
                "value": r.value,
                "label": r.label,
                "sub_label": r.sub_label
            }
            for r in results
        ]

    # =========================================================================
    # HELPERS (Private methods for internal use)
    # =========================================================================

    def _build_order_search_result(self, db: Session, brand_id: int, order: Order):
        """Xây dựng kết quả trả về khi tìm thấy Order."""
        rev = db.query(Revenue).filter(Revenue.brand_id == brand_id, Revenue.order_code == order.order_code).first()
        is_refunded = (rev.refund or 0) < -0.1 if rev else False
        category = _classify_order_status(order, is_financial_refund=is_refunded)
        
        # --- ENRICH CUSTOMER DATA ---
        customer_info = self._get_enriched_customer_info(db, brand_id, order)

        # --- ENRICH PRODUCT NAMES ---
        enriched_items = self._enrich_order_items(db, brand_id, order.details)

        if category == 'refunded':
            calc_cogs = 0.0
        else:
            calc_cogs = order.cogs or 0.0

        net_profit = rev.net_revenue - calc_cogs

        calculated_original_price = sum((
            item.get("original_price", 0.0) * item.get("quantity") or 0)
            for item in order.details.get("items", [])
        ) if order.details else 0.0

        return {
            "type": "order",
            "id": order.order_code,
            "status": category,
            "createdDate": order.order_date.strftime("%d/%m/%Y %H:%M") if order.order_date else "---",
            "shippedDate": order.shipped_time.strftime("%d/%m/%Y %H:%M") if order.shipped_time else None,
            "deliveredDate": order.delivered_date.strftime("%d/%m/%Y %H:%M") if order.delivered_date else None,
            "paymentMethod": order.details.get("payment_method") if order.details else "---",
            "source": order.source,
            "trackingCode": order.tracking_id or "---",
            "orderCode": order.order_code or "---",
            "return_tracking_code": rev.order_refund if rev and rev.order_refund else "---",
            "carrier": order.details.get("shipping_provider_name") if order.details else "---",
            
            "customer": customer_info,
            "items": enriched_items,
            
            "original_price": calculated_original_price,
            "subsidy_amount": order.subsidy_amount or 0.0,
            "sku_price": order.sku_price or 0.0,
            "totalCollected": rev.net_revenue if rev else 0.0,
            
            "cogs": calc_cogs, 
            "netProfit": net_profit,
            "netRevenue": rev.net_revenue if rev else 0.0,
            "totalFees": rev.total_fees if rev else 0.0,
            "profitMargin": (net_profit / rev.net_revenue * 100) if rev and rev.net_revenue and rev.net_revenue > 0 else 0.0,
            "takeRate": ((rev.total_fees / rev.gmv) * 100) if rev and rev.gmv and rev.gmv > 0 else 0.0,
        }

    def _get_enriched_customer_info(self, db: Session, brand_id: int, order: Order):
        """Lấy thông tin khách hàng từ Order và enrich thêm từ bảng Customer nếu có."""
        # Default info from Order Details
        details = order.details or {}
        customer_info = {
            "name": details.get("customer_name") or order.username,
            "phone": details.get("phone") or "---",
            "email": "---",
            "rank": "MEMBER", 
            "fullAddress": f"{details.get('address', '')}, {details.get('province', '')}",
            "id": order.username,
            "total_orders": 0,
            "success_orders": 0,
            "refunded_orders": 0,
            "bomb_orders": 0,
            "nextRank": "SILVER",
            "rankProgress": 0,
            "notes": "---",
            "tags": []
        }

        if order.username:
            db_customer = db.query(Customer).filter(
                Customer.brand_id == brand_id,
                Customer.username == order.username
            ).first()
            
            if db_customer:
                # Tính toán Rank Progress
                current_spent = db_customer.total_spent or 0.0
                next_rank_target, next_rank_name = self._calculate_next_rank(current_spent)
                
                rank_progress = 100
                if next_rank_target > 0:
                    rank_progress = min(round((current_spent / next_rank_target) * 100, 1), 100)

                # Merge data
                customer_info.update({
                    "name": db_customer.username,
                    "source": db_customer.source or "---",
                    "phone": db_customer.phone or customer_info["phone"],
                    "email": db_customer.email or customer_info["email"],
                    "gender": db_customer.gender or "---",
                    "rank": db_customer.rank or "MEMBER",
                    "nextRank": next_rank_name,
                    "rankProgress": rank_progress,
                    "defaultAddress": db_customer.default_address or customer_info["fullAddress"],
                    "province": db_customer.default_province or "---",
                    "notes": db_customer.notes or "---",
                    "tags": db_customer.tags or [],
                    
                    "ltv": db_customer.total_spent,
                    "totalProfit": db_customer.profit,
                    "aov": db_customer.aov,
                    
                    "orderCount": db_customer.total_orders,
                    "successCount": db_customer.success_orders,
                    "refundedOrders": db_customer.refunded_orders,
                    "cancelCount": db_customer.canceled_orders,
                    "bombOrders": db_customer.bomb_orders or 0
                })
        
        return customer_info

    def _enrich_order_items(self, db: Session, brand_id: int, details: dict):
        """Map SKU to Product Name."""
        items = details.get("items", []) if details else []
        product_map = self._get_product_map(db, brand_id)
        
        for item in items:
            sku = item.get('sku')
            if sku and sku in product_map:
                item['product_name'] = product_map[sku]
            else:
                item['product_name'] = item.get('name') or item.get('item_name') or sku
        return items

    def get_customer_profile(self, db: Session, brand_id: int, customer: Customer):
        """Lấy dữ liệu chi tiết khách hàng để hiển thị."""
        # 1. Lấy lịch sử đơn hàng
        all_orders = db.query(Order).filter(
            Order.brand_id == brand_id,
            Order.username == customer.username
        ).order_by(Order.order_date.desc()).limit(100).all()

        # 2. Lấy dữ liệu tài chính
        order_codes = [o.order_code for o in all_orders if o.order_code]
        revenue_map, fees_map, gmv_map, refunded_codes, refund_tracking_map = self._get_revenue_map(db, brand_id, order_codes)
        product_map = self._get_product_map(db, brand_id)

        # 3. Build Response
        return self._build_customer_response(
            customer, all_orders, revenue_map, fees_map, gmv_map, refunded_codes, refund_tracking_map, product_map
        )

    def _build_customer_response(self, customer: Customer, orders: list, revenue_map: dict, fees_map: dict, gmv_map: dict, refunded_codes: set, refund_tracking_map: dict, product_map: dict):
        """Helper tạo object Customer Response."""
        formatted_orders = []
        count_bomb = 0
        count_cancel = 0
        
        for order in orders:
            net_rev = revenue_map.get(order.order_code, 0.0)
            fees = fees_map.get(order.order_code, 0.0)
            gmv = gmv_map.get(order.order_code, 0.0)
            refund_code = refund_tracking_map.get(order.order_code)
            
            is_financial_refund = order.order_code in refunded_codes
            category = _classify_order_status(order, is_financial_refund=is_financial_refund)
            
            if category == 'bomb': count_bomb += 1
            elif category == 'cancelled': count_cancel += 1
            
            formatted_orders.append(self._format_unified_order(
                order, net_rev, gmv, fees, category, refund_code, product_map
            ))

        # Tính Rank Progress
        current_spent = customer.total_spent or 0.0
        next_rank_target, next_rank_name = self._calculate_next_rank(current_spent)
        rank_progress = min(round((current_spent / next_rank_target) * 100, 1), 100) if next_rank_target > 0 else 100

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
            "tags": customer.tags or [],
            "notes": customer.notes or "---",
            "lastOrderDate": orders[0].order_date if orders else None,
            
            "rank": customer.rank,
            "nextRank": next_rank_name,
            "rankProgress": rank_progress,
            
            "ltv": customer.total_spent or 0.0,
            "totalProfit": customer.profit or 0.0,
            "aov": customer.aov or 0.0,
            
            "orderCount": customer.total_orders or 0,
            "successCount": customer.success_orders or 0,
            "refundedOrders": customer.refunded_orders or 0,
            "cancelCount": count_cancel,
            "bombOrders": count_bomb,
            "recentOrders": formatted_orders
        }

    def _format_unified_order(self, order: Order, net_revenue: float, gmv: float, total_fees: float, category: str, refund_tracking_code: str = None, product_map: dict = None):
        """Helper chuẩn hóa dữ liệu đơn hàng cho UI."""
        full_details = order.details if order.details and isinstance(order.details, dict) else {}
        
        if product_map and 'items' in full_details and isinstance(full_details['items'], list):
            for item in full_details['items']:
                sku = item.get('sku')
                if sku and sku in product_map:
                    item['product_name'] = product_map[sku]

        return {
            "id": order.id,
            "brand_id": order.brand_id,
            "username": order.username,
            "total_quantity": order.total_quantity or 0,
            "cogs": order.cogs or 0.0,
            "original_price": order.original_price or 0.0,
            "sku_price": order.sku_price or 0.0,
            
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

    def _get_product_map(self, db: Session, brand_id: int):
        """Helper: Lấy Map SKU -> Product Name."""
        products = db.query(Product.sku, Product.name).filter(
            Product.brand_id == brand_id,
            Product.name.isnot(None)
        ).all()
        return {p.sku: p.name for p in products}

    def _get_revenue_map(self, db: Session, brand_id: int, order_codes: list):
        """Helper: Lấy dữ liệu tài chính."""
        revenue_map = defaultdict(float)
        fees_map = defaultdict(float)
        gmv_map = defaultdict(float)
        refunded_codes = set()
        refund_tracking_map = {}
        
        if not order_codes:
            return revenue_map, fees_map, gmv_map, refunded_codes, refund_tracking_map

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
                if net_rev: revenue_map[code] += net_rev
                if fees: fees_map[code] += fees
                if gmv: gmv_map[code] += gmv
                if (refund or 0) < -0.1: refunded_codes.add(code)
                if order_refund: refund_tracking_map[code] = order_refund

        return revenue_map, fees_map, gmv_map, refunded_codes, refund_tracking_map

    def _calculate_next_rank(self, current_spent: float):
        """Logic tính hạng tiếp theo."""
        if current_spent < 2000000: return 2000000, "SILVER"
        elif current_spent < 10000000: return 10000000, "GOLD"
        elif current_spent < 20000000: return 20000000, "PLATINUM"
        elif current_spent < 50000000: return 50000000, "DIAMOND"
        else: return 0, "MAX"

search_service = SearchService()
