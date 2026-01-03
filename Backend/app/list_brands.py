from database import SessionLocal
from models import Brand

db = SessionLocal()
brands = db.query(Brand).all()
print("Danh sách Brand:")
for b in brands:
    print(f"- ID: {b.id}, Name: {b.name}, Slug: {b.slug}")
db.close()
