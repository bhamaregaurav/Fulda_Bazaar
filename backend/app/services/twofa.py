from __future__ import annotations

import base64
import io

import pyotp
import qrcode

from app.services.crypto import encrypt, decrypt
from datetime import datetime



def _qr_png(secret: str, email: str, issuer: str = "Fulda Bazaar") -> str:
    uri = pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=issuer)
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def generate_setup_payload(email: str) -> tuple[str, str]:
    secret = pyotp.random_base32()
    return secret, _qr_png(secret, email)


def store_secret(raw_secret: str) -> tuple[bytes, bytes]:
    return encrypt(raw_secret)


def retrieve_secret(blob: bytes, nonce: bytes) -> str:
    return decrypt(blob, nonce)

def verify_code(raw_secret: str, code: str) -> bool:
    totp = pyotp.TOTP(raw_secret)
    return totp.verify(code, valid_window=1)