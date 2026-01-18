from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import date
from kpi_utils import _classify_order_status
from collections import defaultdict
from models import Order, Revenue
import sys
import os

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
    CRUDCustomer mới: Không còn thao tác với bảng 'customers'.
    Tất cả dữ liệu được tính toán dynamic từ 'orders'.
    """

    def _extract_location_data(self, details: dict):
        """
        Helper function: Trích xuất và chuẩn hóa Province/District từ JSON details của Order.
        Trả về tuple (province, district) hoặc (None, None).
        """
        if not details or not isinstance(details, dict):
            return None, None
            
        raw_prov = details.get('province')
        raw_dist = details.get('district')
        
        if raw_prov:
            mapped_prov = get_new_province_name(raw_prov)
            if mapped_prov:
                return mapped_prov, raw_dist
        
        return None, None

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
        """
        Lấy danh sách Top khách hàng dựa trên giao dịch TRONG KỲ (Orders).
        Dữ liệu Location (City/District) được lấy từ đơn hàng mới nhất của khách trong kỳ.
        """
        # 1. Query Raw Data từ bảng Orders
        filters = [
            Order.brand_id == brand_id,
            func.date(Order.order_date) >= start_date,
            func.date(Order.order_date) <= end_date,
            Order.username.isnot(None)
        ]
        
        if source_list and 'all' not in source_list:
            filters.append(Order.source.in_(source_list))

        # Sắp xếp theo ngày tăng dần để đảm bảo logic cập nhật địa chỉ hoạt động đúng
        # (Lấy địa chỉ từ đơn cũ, giữ nguyên nếu đơn mới không có địa chỉ)
        orders = db.query(Order).filter(*filters).order_by(Order.order_date).all()

        # 2. Python-side Aggregation
        customer_stats = defaultdict(lambda: {
            "total_spent": 0.0,
            "total_orders": 0,
            "completed_orders": 0,
            "cancelled_orders": 0,
            "bomb_orders": 0,
            "refunded_orders": 0,
            "last_date": None,
            "province": None,      # Lưu địa chỉ từ đơn mới nhất
            "district": None
        })

        for order in orders:
            stats = customer_stats[order.username]
            
            # Phân loại trạng thái chuẩn
            category = _classify_order_status(order, is_financial_refund=False)
            
            # Aggregation
            stats["total_orders"] += 1
            
            if category == 'completed' or category == 'processing':
                stats["completed_orders"] += 1
                # Ưu tiên GMV/Selling Price để tính doanh thu
                stats["total_spent"] += (order.gmv or order.selling_price or 0.0)
            elif category == 'cancelled':
                stats["cancelled_orders"] += 1
            elif category == 'bomb':
                stats["bomb_orders"] += 1
            elif category == 'refunded':
                stats["refunded_orders"] += 1
            
            # Update Last Date & Location
            if order.order_date:
                o_date = order.order_date.date()
                # Nếu đơn này mới hơn đơn đã lưu -> Cập nhật Location theo đơn này
                if stats["last_date"] is None or o_date >= stats["last_date"]:
                    stats["last_date"] = o_date
                    
                    # [UPDATED] Sử dụng Helper chung
                    prov, dist = self._extract_location_data(order.details)
                    if prov:
                        stats["province"] = prov
                        stats["district"] = dist

        # 3. Convert to List & Sort
        results = []
        for username, data in customer_stats.items():
            completed = data["completed_orders"]
            spent = data["total_spent"]
            aov = (spent / completed) if completed > 0 else 0
            
            results.append({
                "username": username,
                "total_spent": spent,
                "total_orders": data["total_orders"],
                "completed_orders": completed,
                "cancelled_orders": data["cancelled_orders"],
                "bomb_orders": data["bomb_orders"],
                "refunded_orders": data["refunded_orders"],
                "aov": aov,
                "last_order_date": data["last_date"],
                "province": data["province"] or "---", # Trả về placeholder
                "district": data["district"] or "---"
            })

        # Sort theo total_spent giảm dần
        results.sort(key=lambda x: x["total_spent"], reverse=True)
        
        total_found = len(results)
        if total_found > limit:
            results = results[:limit]
            total_found = limit

        # 4. Pagination Slicing
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_results = results[start_idx:end_idx]

        return {
            "data": paginated_results,
            "total": total_found,
            "page": page,
            "limit": page_size
        }

    def get_customer_detail_with_orders(self, db: Session, *, brand_id: int, username: str):
        """
        Lấy thông tin chi tiết khách hàng và lịch sử đơn hàng.
        [UPDATED] Tính toán chỉ số 'nóng' (Real-time) từ bảng Order/Revenue thay vì đọc bảng Customer.
        Đảm bảo chính xác tuyệt đối tại thời điểm xem.
        """
        
        # 1. Lấy lịch sử đơn hàng
        orders = db.query(Order).filter(
            Order.brand_id == brand_id,
            Order.username == username
        ).order_by(desc(Order.order_date)).all()
        
        if not orders:
            return None

        # 2. Lấy thông tin Revenue (Net Revenue & Refund)
        order_codes = [o.order_code for o in orders if o.order_code]
        revenue_map = {} # Map: order_code -> net_revenue
        refunded_codes = set()
        
        if order_codes:
            # Query lấy order_code, net_revenue, refund
            rev_records = db.query(
                Revenue.order_code, 
                Revenue.net_revenue, 
                Revenue.refund
            ).filter(
                Revenue.brand_id == brand_id,
                Revenue.order_code.in_(order_codes)
            ).all()
            
            for r in rev_records:
                revenue_map[r.order_code] = r.net_revenue or 0.0
                if (r.refund or 0) < -0.1:
                    refunded_codes.add(r.order_code)

        # 3. Tính toán nóng (On-the-fly Calculation)
        stats = {
            "total_spent": 0.0,
            "total_orders": 0,
            "completed_orders": 0,
            "cancelled_orders": 0,
            "bomb_orders": 0,
            "refunded_orders": 0,
            "last_order_date": None
        }
        
        province = None
        district = None

        # [UPDATED] Loop tìm địa chỉ từ đơn mới nhất có thông tin
        # Orders đã được sort desc (mới nhất đầu tiên)
        for order in orders:
            # Chỉ lấy địa chỉ nếu chưa tìm thấy (nghĩa là lấy từ đơn mới nhất có địa chỉ)
            if not province:
                 prov, dist = self._extract_location_data(order.details)
                 if prov:
                     province = prov
                     district = dist

            # Phân loại
            is_refunded = order.order_code in refunded_codes
            category = _classify_order_status(order, is_financial_refund=is_refunded)
            
            # [BONUS] Gắn Category vào object Order để Frontend dùng
            setattr(order, "category", category)
            
            # [BONUS] Gắn Net Revenue vào object Order để trả về Frontend
            setattr(order, "net_revenue", revenue_map.get(order.order_code, 0.0))
            
            # Cộng dồn
            stats["total_orders"] += 1
            
            if category == 'completed' or category == 'processing':
                stats["completed_orders"] += 1
                # [UPDATED] Lấy Net Revenue từ bảng Revenue. Nếu chưa có dữ liệu tài chính => 0
                stats["total_spent"] += revenue_map.get(order.order_code, 0.0)
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

        # 4. Giả lập đối tượng Customer
        mock_customer_info = {
            "username": username,
            "province": province or "---",      # Lấy từ logic extraction ở trên
            "district": district or "---",
            "total_spent": stats["total_spent"],
            "total_orders": stats["total_orders"],
            "completed_orders": stats["completed_orders"],
            "cancelled_orders": stats["cancelled_orders"],
            "bomb_orders": stats["bomb_orders"],
            "refunded_orders": stats["refunded_orders"],
            "last_order_date": stats["last_order_date"]
        }
        
        return {
            "info": mock_customer_info,
            "orders": orders
        }

customer = CRUDCustomer()