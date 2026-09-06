from fastapi import APIRouter, Depends, HTTPException, status, Form, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from ..schemas.auth import UserCreate, UserLogin, Token, TempToken
from ..repositories.users import get_by_email, create
from ..core.database import get_db
from ..core.security import create_temp_token, verify_password, create_access_token
import re
from app.services.twofa import retrieve_secret, verify_code
from jose import jwt, JWTError
from ..core.config import settings
from pydantic import BaseModel
from typing import Union, Optional
import os

from app.core.gcs import bucket as _bucket

router = APIRouter()

class Login2FAIn(BaseModel):
    temp_token: str
    code: str

class UserCreateInternal(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    profile_picture: Optional[str] = None

@router.post("/register", response_model=Token)
async def register(
    email: str = Form(...),
    password: str = Form(...),
    first_name: str = Form(...),
    last_name: str = Form(...),
    profile_picture: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db)
):
    # Validate university email
    if not email.endswith("@hs-fulda.de"):
        raise HTTPException(status_code=400, detail="Invalid university email")
    
    # Check if user already exists
    if await get_by_email(db, email):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Handle profile picture upload if provided
    profile_picture_url = None
    if profile_picture and profile_picture.filename:
        # Validate file type
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.webp'}
        file_extension = os.path.splitext(profile_picture.filename)[1].lower()
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only JPG, JPEG, PNG, and WEBP files are allowed"
            )
        
        # Validate file size (max 5MB)
        max_size = 5 * 1024 * 1024  # 5MB
        content = await profile_picture.read()
        if len(content) > max_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size must be less than 5MB"
            )
        
        # Reset file pointer
        await profile_picture.seek(0)
        
        # Upload to GCP bucket
        blob_name = f"profiles/{email}/{profile_picture.filename}"
        blob = _bucket.blob(blob_name)
        blob.upload_from_file(profile_picture.file, content_type=profile_picture.content_type)
        profile_picture_url = blob.public_url
    
    # Create user data object
    user_data = UserCreateInternal(
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        profile_picture=profile_picture_url
    )
    
    # Create user in database
    new_user = await create(db, user_data)
    access_token = create_access_token({"sub": new_user.email})
    return {"access_token": access_token}

@router.post("/login", response_model=Union[Token, TempToken])
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await get_by_email(db, credentials.email)
    if not user or not verify_password(credentials.password, user.password):
        raise HTTPException(
          status_code=status.HTTP_401_UNAUTHORIZED,
          detail="Incorrect email or password"
        )

    if user.two_fa:
        temp_token = create_temp_token(user.email)
        return {"temp_token": temp_token, "two_fa_required": True}

    access_token = create_access_token({"sub": user.email})
    return {"access_token": access_token}

@router.post("/login/2fa", response_model=Token)
async def login_2fa(payload: Login2FAIn, db: AsyncSession = Depends(get_db)):
    try:
        data = jwt.decode(payload.temp_token, settings.SECRET_KEY, algorithms=["HS256"])
        if data.get("stage") != "pre-2fa":
            raise JWTError("Not a temp token")
        email = data["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired temp token")

    from app.repositories.users import get_by_email  # local import to avoid circular deps
    user = await get_by_email(db, email)
    if not user or not user.two_fa:
        raise HTTPException(status_code=401, detail="2-FA not enabled for this user")

    secret = retrieve_secret(user.two_fa_secret_blob, user.two_fa_secret_nonce)
    if not verify_code(secret, payload.code):
        raise HTTPException(status_code=401, detail="Invalid 2-FA code")

    access_token = create_access_token({"sub": user.email})
    return {"access_token": access_token}