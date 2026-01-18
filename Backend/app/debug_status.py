from sqlalchemy.orm import Session
from database import SessionLocal
import models

def inspect_order_statuses():
    db = SessionLocal()
    try:
        # Lấy 50 đơn hàng gần nhất của brand Honeyland (id=1)
        orders = db.query(models.Order).filter(models.Order.brand_id == 1).order_by(models.Order.order_date.desc()).limit(50).all()
        
        print(f"{ 'Order Code':<20} | { 'Status':<30} | { 'Reason':<30}")
        print("-" * 80)
        
        unique_statuses = set()
        
        for o in orders:
            reason = ""
            if o.details and isinstance(o.details, dict):
                reason = o.details.get('cancel_reason', '')
            
            print(f"{o.order_code:<20} | {str(o.status):<30} | {str(reason):<30}")
            unique_statuses.add(str(o.status))
            
        print("\n--- UNIQUE STATUSES FOUND ---")
        for s in unique_statuses:
            print(f"- {s}")

    finally:
        db.close()

if __name__ == "__main__":
    inspect_order_statuses()

