from sqlalchemy import Column, Integer, String
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    
    # Admin analytics tracking data
    files_encrypted = Column(Integer, default=0)
    files_decrypted = Column(Integer, default=0)
    
    # NEW: Columns for tracking decrypted media breakdown
    images_decrypted = Column(Integer, default=0)
    audios_decrypted = Column(Integer, default=0)
    videos_decrypted = Column(Integer, default=0)