from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime
import os

DATABASE_URL = "sqlite:///./docmind.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    
    # Relationships
    audio_histories = relationship("AudioHistory", back_populates="user")
    summary_histories = relationship("SummaryHistory", back_populates="user")

class AudioHistory(Base):
    __tablename__ = "audio_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String)
    language = Column(String)
    audio_url = Column(String)
    date = Column(String)
    
    user = relationship("User", back_populates="audio_histories")

class SummaryHistory(Base):
    __tablename__ = "summary_history"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    filename = Column(String)
    persona = Column(String)
    model_used = Column(String)
    summary = Column(Text)
    hallucination = Column(Text)
    audio_url = Column(String)
    date = Column(String)
    
    user = relationship("User", back_populates="summary_histories")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

Base.metadata.create_all(bind=engine)
