"""
database.py - SQLAlchemy models and DB connection.

Defaults to SQLite (zero setup). To use MySQL later, set the DATABASE_URL
environment variable, e.g.:
    mysql+pymysql://user:password@localhost/character_ai_db
and `pip install pymysql`.
"""
import os
from datetime import datetime, timezone

from sqlalchemy import (
    create_engine, Column, Integer, String, Text, ForeignKey, DateTime,
    Boolean, Enum
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./database.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=utcnow)

    characters = relationship("Character", back_populates="creator")
    chats = relationship("Chat", back_populates="user", cascade="all, delete-orphan")


class Character(Base):
    __tablename__ = "characters"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500))
    personality = Column(Text, nullable=False)  # the system prompt
    avatar_url = Column(Text)  # holds either a URL or a compressed base64 data-URI photo
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_public = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    creator = relationship("User", back_populates="characters")
    chats = relationship("Chat", back_populates="character", cascade="all, delete-orphan")


class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    character_id = Column(Integer, ForeignKey("characters.id"), nullable=False)
    title = Column(String(255), default="New Chat")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="chats")
    character = relationship("Character", back_populates="chats")
    messages = relationship(
        "Message", back_populates="chat",
        cascade="all, delete-orphan", order_by="Message.id"
    )


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    # native_enum=False keeps this a plain VARCHAR+CHECK on SQLite instead of
    # a real ENUM type, which SQLite doesn't support natively.
    role = Column(Enum("user", "assistant", "system", native_enum=False), nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=utcnow)

    chat = relationship("Chat", back_populates="messages")


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
