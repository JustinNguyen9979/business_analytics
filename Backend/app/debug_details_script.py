from sqlalchemy import create_engine, text
from database import DATABASE_URL
import json

engine = create_engine(DATABASE_URL)
with engine.connect() as conn:
    # Lấy 5 dòng có details không null
    result = conn.execute(text("SELECT order_code, details FROM orders WHERE details IS NOT NULL LIMIT 5"))
    for row in result:
        print(f"Order: {row[0]}")
        print(f"Details: {json.dumps(row[1], ensure_ascii=False, indent=2)}")
        print("-" * 20)
