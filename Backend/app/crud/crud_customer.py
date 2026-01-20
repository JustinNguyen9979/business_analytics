from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import date
from kpi_utils import _classify_order_status
from collections import defaultdict
from models import Order, Revenue
import sys

# Import helper chuẩn hóa địa chỉ (Fallback logic)
try:
    from vietnam_address_mapping import get_new_province_name
except ImportError:
    try:
        from app.vietnam_address_mapping import get_new_province_name
    except ImportError:
        sys.path.append("..")
        from vietnam_address_mapping import get_new_province_name

class CRUDCustomer:
    """
    CRUDCustomer (Refactored): Tối ưu hóa logic tính toán và truy vấn theo tài chính thực tế.
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

    def _update_order_stats(self, stats: dict, order: Order, net_revenue: float, is_refunded: bool):
        """
        Helper: Cộng dồn số liệu thống kê.
        Dữ liệu tiền (total_spent) được cộng độc lập với trạng thái đơn hàng.
        """
        category = _classify_order_status(order, is_financial_refund=is_refunded)
        
        stats["total_orders"] += 1
        
        # --- LOGIC TÍNH TIỀN MỚI: Cộng toàn bộ doanh thu thực tế từ bảng tài chính ---
        # Sử dụng 'seen_codes' để đảm bảo không cộng trùng nếu database có đơn hàng lặp
        if order.order_code and order.order_code not in stats["seen_codes"]:
            stats["total_spent"] += net_revenue
            stats["seen_codes"].add(order.order_code)
        # --------------------------------------------------------------------------

        # Vẫn phân loại để đếm số lượng đơn theo trạng thái
        if category == 'completed' or category == 'processing':
            stats["completed_orders"] += 1
        elif category == 'cancelled':
            stats["cancelled_orders"] += 1
        elif category == 'bomb':
            stats["bomb_orders"] += 1
        elif category == 'refunded':
            stats["refunded_orders"] += 1

        # Cập nhật Last Date
        if order.order_date:
            o_date = order.order_date
            o_date_val = o_date.date() if hasattr(o_date, 'date') else o_date
            current_last = stats.get("last_date") or stats.get("last_order_date")
            if not current_last or o_date_val >= current_last:
                stats["last_date"] = o_date_val
                stats["last_order_date"] = o_date_val
        
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
        filters = [
            Order.brand_id == brand_id,
            func.date(Order.order_date) >= start_date,
            func.date(Order.order_date) <= end_date,
            Order.username.isnot(None)
        ]
        if source_list and 'all' not in source_list:
            filters.append(Order.source.in_(source_list))

        orders = db.query(Order).filter(*filters).order_by(Order.order_date).all()
        order_codes = [o.order_code for o in orders if o.order_code]
        revenue_map, refunded_codes = self._get_revenue_map(db, brand_id, order_codes)

        customer_stats = defaultdict(lambda: {
            "total_spent": 0.0,
            "total_orders": 0,
            "completed_orders": 0,
            "cancelled_orders": 0,
            "bomb_orders": 0,
            "refunded_orders": 0,
            "last_date": None,
            "province": None,
            "district": None,
            "seen_codes": set() # Tập hợp mã đơn đã tính tiền cho khách này
        })

        for order in orders:
            stats = customer_stats[order.username]
            net_revenue = revenue_map.get(order.order_code, 0.0)
            is_refunded = order.order_code in refunded_codes
            
            self._update_order_stats(stats, order, net_revenue, is_refunded)
            
            prov, dist = self._extract_location_data(order.details)
            if prov:
                stats["province"] = prov
                stats["district"] = dist

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
                "last_order_date": data["last_date"],
                "province": data["province"] or "---",
                "district": data["district"] or "---"
            })

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
        orders = db.query(Order).filter(
            Order.brand_id == brand_id, 
            Order.username == username
        ).order_by(desc(Order.order_date)).all()
        
        if not orders:
            return None

        order_codes = [o.order_code for o in orders if o.order_code]
        revenue_map, refunded_codes = self._get_revenue_map(db, brand_id, order_codes)

        # 3. Aggregation
        # [UPDATED] Tính tổng chi tiêu NGAY LẬP TỨC từ revenue_map
        # revenue_map đã chứa tổng net_revenue duy nhất của từng order_code
        total_spent_calculated = sum(revenue_map.values())

        stats = {
            "total_spent": total_spent_calculated, # Gán trực tiếp
            "total_orders": 0, "completed_orders": 0,
            "cancelled_orders": 0, "bomb_orders": 0, "refunded_orders": 0,
            "last_order_date": None, "province": None, "district": None,
        }

        for order in orders:
            net_revenue = revenue_map.get(order.order_code, 0.0)
            is_refunded = order.order_code in refunded_codes
            
            # Helper chỉ còn nhiệm vụ đếm số lượng đơn (không cộng tiền nữa)
            # Ta truyền net_revenue=0 vào helper để nó không cộng dồn sai vào biến tạm (nếu dùng chung logic cũ)
            # Hoặc ta sửa helper, nhưng để an toàn và nhanh, ta chỉ cần không dựa vào việc helper update tiền cho hàm này.
            # Tuy nhiên, hàm _update_order_stats hiện tại ĐANG cộng tiền. 
            # Để tránh conflict, ta sẽ tự đếm số lượng ở đây cho rõ ràng, hoặc sửa helper.
            # Tốt nhất: Em sẽ tự đếm ở đây cho function này để logic "Clean" nhất theo ý anh.
            
            category = _classify_order_status(order, is_financial_refund=is_refunded)
            
            stats["total_orders"] += 1
            if category == 'completed' or category == 'processing':
                stats["completed_orders"] += 1
            elif category == 'cancelled':
                stats["cancelled_orders"] += 1
            elif category == 'bomb':
                stats["bomb_orders"] += 1
            elif category == 'refunded':
                stats["refunded_orders"] += 1

            # Last Date
            if order.order_date:
                if not stats["last_order_date"] or order.order_date > stats["last_order_date"]:
                    stats["last_order_date"] = order.order_date
            
            setattr(order, "category", category)
            setattr(order, "net_revenue", net_revenue)
            
            if not stats["province"]:
                 prov, dist = self._extract_location_data(order.details)
                 if prov:
                     stats["province"] = prov
                     stats["district"] = dist

        return {
            "info": {
                "username": username,
                "province": stats["province"] or "---",
                "district": stats["district"] or "---",
                "total_spent": stats["total_spent"],
                "total_orders": stats["total_orders"],
                "completed_orders": stats["completed_orders"],
                "cancelled_orders": stats["cancelled_orders"],
                "bomb_orders": stats["bomb_orders"],
                "refunded_orders": stats["refunded_orders"],
                "last_order_date": stats["last_order_date"]
            },
            "orders": orders
        }

customer = CRUDCustomer()