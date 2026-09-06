from pydantic import BaseModel, EmailStr, constr, HttpUrl
from datetime import datetime
from typing import Optional
# ─── image sub-schema ─────────────────────────────────────────────────────
class ListingImageOut(BaseModel):
    image_id    : int
    image_path  : HttpUrl
    is_primary  : bool
    upload_date : datetime

    model_config = {"from_attributes": True}  

class UserCreate(BaseModel):
    email: EmailStr
    password: constr(min_length=8)
    first_name: str
    last_name: str
   


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TempToken(BaseModel):
    temp_token: str
    two_fa_required: bool = True
class UserCreateInternal(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    profile_picture: Optional[str] = None 