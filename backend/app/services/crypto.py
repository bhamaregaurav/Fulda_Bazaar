from __future__ import annotations
import os
from cryptography.fernet import Fernet, InvalidToken

_KEY = os.environ["MESSAGE_CRYPT_KEY"].encode()
_FERNET = Fernet(_KEY)

def encrypt(plaintext: str) -> tuple[bytes, bytes]:
    token: bytes = _FERNET.encrypt(plaintext.encode("utf-8"))
    # Split into nonce  |  real ciphertext
    nonce, blob = token[:16], token[16:]
    return blob, nonce

def decrypt(ciphertext: bytes, nonce: bytes) -> str:
    token = nonce + ciphertext
    try:
        return _FERNET.decrypt(token).decode("utf-8")
    except InvalidToken:
        return "[decrypt-error]"
