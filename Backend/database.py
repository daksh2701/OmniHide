from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

#  LOCAL SQLITE SETUP: No internet required!
# This will create a local SQLite database file named "omnihide_local.db" in the current directory.
SQLALCHEMY_DATABASE_URL = "sqlite:///./omnihide_local.db"

# Creating the SQLAlchemy engine and session for database interactions
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, 
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()