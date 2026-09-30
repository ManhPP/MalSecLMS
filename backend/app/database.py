from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Chuẩn hóa DATABASE_URL nếu bắt đầu bằng postgresql:// để dùng psycopg2
db_url = settings.DATABASE_URL
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

# Tạo engine CSDL
engine = create_engine(
    db_url,
    pool_pre_ping=True
)

# Cấu hình Session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class cho các model ORM
Base = declarative_base()

# Dependency để lấy DB Session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
