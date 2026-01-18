from sqlalchemy.orm import Session
from database import SessionLocal
import models
import json

def inspect_order_details():
    db = SessionLocal()
    try:
        # Lấy 5 đơn hàng gần nhất có details
        orders = db.query(models.Order).filter(models.Order.details.isnot(None)).order_by(models.Order.order_date.desc()).limit(5).all()
        
        print(f"{ 'Order Code':<20} | {'Details Keys'}")
        print("-" * 80)
        
        for o in orders:
            keys = list(o.details.keys()) if o.details else []
            print(f"{o.order_code:<20} | {keys}")
            # In thử mẫu 1 cái detail đầy đủ
            if o == orders[0]:
                print("\n--- SAMPLE DETAIL ---")
                print(json.dumps(o.details, indent=2, ensure_ascii=False))

    finally:
        db.close()

if __name__ == "__main__":
    inspect_order_details()

