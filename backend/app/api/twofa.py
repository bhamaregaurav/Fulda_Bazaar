from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, verify_password
from app.core.database import get_db
from app.services.twofa import generate_setup_payload, store_secret, retrieve_secret, verify_code
from app.models.user_models import User
from pydantic import BaseModel, Field
from datetime import datetime

class DisableIn(BaseModel):
    password: str
    code: str

class CodeIn(BaseModel):
    code: str = Field(
        ...,
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$"
    )

router = APIRouter(prefix="/2fa", tags=["2-FA"])


@router.post("/setup")
async def setup_2fa(
    current_user: User        = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    if current_user.two_fa:
        raise HTTPException(status_code=400, detail="2-FA already enabled")

    secret, qr_svg = generate_setup_payload(current_user.email)
    blob, nonce    = store_secret(secret)

    current_user.two_fa_secret_blob  = blob
    current_user.two_fa_secret_nonce = nonce
    await db.commit()

    return {"secret": secret, "qr_svg": qr_svg}


@router.post("/confirm", status_code=status.HTTP_200_OK)
async def confirm_2fa(
    payload: CodeIn,
    current_user: User                  = Depends(get_current_user),
    db:           AsyncSession          = Depends(get_db),
):
    if current_user.two_fa:
        raise HTTPException(status_code=400, detail="2-FA already confirmed")

    if not current_user.two_fa_secret_blob or not current_user.two_fa_secret_nonce:
        raise HTTPException(status_code=400, detail="2-FA not initialised; call /setup first")
    secret = retrieve_secret(current_user.two_fa_secret_blob, current_user.two_fa_secret_nonce)

    if not verify_code(secret, payload.code):
        raise HTTPException(status_code=400, detail="Invalid verification code")

    current_user.two_fa = True
    await db.commit()
    return {"message": "2-FA enabled successfully"}


@router.post("/disable", status_code=status.HTTP_200_OK)
async def disable_2fa(
    payload: DisableIn,
    current_user: User         = Depends(get_current_user),
    db:           AsyncSession = Depends(get_db),
):
    if not verify_password(payload.password, current_user.password):
        raise HTTPException(status_code=401, detail="Wrong password")

    secret = retrieve_secret(current_user.two_fa_secret_blob, current_user.two_fa_secret_nonce)
    if not verify_code(secret, payload.code):
        raise HTTPException(status_code=401, detail="Invalid 2-FA code")

    current_user.two_fa = False
    current_user.two_fa_secret_blob  = None
    current_user.two_fa_secret_nonce = None
    await db.commit()
    return {"message": "2-FA disabled successfully"}