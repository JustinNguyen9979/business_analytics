from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import date
from collections import defaultdict
from models import Order, Revenue
from kpi_utils import _classify_order_status
from vietnam_address_mapping import get_new_province_name

class CRUDCustomer:
    """
    CRUDCustomer (Refactored): Tối ưu hóa logic tính toán, loại bỏ code lặp lại.
    Sử dụng Single Source of Truth cho việc phân loại và cộng dồn số liệu.
    """

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
        Helper: Lấy Net Revenue và Refund Status từ bảng Revenue.
        Trả về:
            - revenue_map: Dict[order_code, net_revenue]
            - refunded_codes: Set[order_code] (Các đơn có refund thực tế)
        """
        revenue_map = defaultdict(float) # order_code -> total_net_revenue
        refunded_codes = set()
        
        if not order_codes:
            return revenue_map, refunded_codes

        chunk_size = 1000
        for i in range(0, len(order_codes), chunk_size):
            chunk = order_codes[i:i + chunk_size]
            rev_records = db.query(
                Revenue.order_code, 
                Revenue.net_revenue,
                Revenue.refund
            ).filter(
                Revenue.brand_id == brand_id, 
                Revenue.order_code.in_(chunk)
            ).all()
            
            for code, net_rev, refund in rev_records:
                if net_rev:
                    revenue_map[code] += net_rev
                if (refund or 0) < -0.1:
                    refunded_codes.add(code)
                    
        return revenue_map, refunded_codes

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
        
        if category == 'completed' or category == 'processing':
            stats["completed_orders"] += 1
        elif category == 'cancelled':
            stats["cancelled_orders"] += 1
        elif category == 'bomb':
            stats["bomb_orders"] += 1
        elif category == 'refunded':
            stats["refunded_orders"] += 1

        # 3. Cộng tiền (An toàn với seen_codes để tránh cộng trùng order_code)
        if order.order_code and order.order_code not in stats["seen_codes"]:
            stats["total_spent"] += net_revenue
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
        revenue_map, refunded_codes = self._get_revenue_map(db, brand_id, order_codes)

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
        revenue_map, refunded_codes = self._get_revenue_map(db, brand_id, order_codes)

        # 3. Aggregation (Sử dụng chung Helper với hàm trên)
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
            is_refunded = order.order_code in refunded_codes
            
            # Gọi Helper để tính toán tổng quan
            category = self._accumulate_order_data(stats, order, net_revenue, is_refunded)
            
            # Collect dates for repurchase cycle calculation (Successful orders only)
            if category == 'completed' and order.order_date:
                completed_dates.append(order.order_date)
            
            # Gán thuộc tính bổ sung vào object order để API trả về hiển thị
            setattr(order, "category", category)
            setattr(order, "net_revenue", net_revenue)

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

customer = CRUDCustomer()
