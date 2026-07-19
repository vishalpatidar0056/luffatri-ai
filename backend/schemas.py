from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, ConfigDict


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    created_at: datetime


class CharacterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    personality: str = Field(min_length=1, max_length=4000)
    avatar_url: str | None = None
    is_public: bool = True


class CharacterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str | None
    personality: str
    avatar_url: str | None
    created_by: int | None
    is_public: bool


class ChatMessageRequest(BaseModel):
    character_id: int
    message: str = Field(min_length=1, max_length=4000)


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    role: str
    content: str
    timestamp: datetime


class ChatReplyResponse(BaseModel):
    chat_id: int
    reply: str


class ChatOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    character_id: int
    title: str
    updated_at: datetime
