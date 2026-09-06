import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.admin.api import router as admin_router
from .api import auth , listings, get_listings, get_categories

from app.api.watchlist import router as watchlist_router

from fastapi.middleware.cors import CORSMiddleware
from app.api import messages
from app.api import ws 
from app.api.users import router as users_router
from app.api.twofa import router as twofa_router
from app.api.transaction import router as transactions_router
from app.api.language_partner import router as language_partner_router
from app.api.language_partner_ws_simple import router as language_partner_ws_router
from app.api.debug_matcher import router as debug_matcher_router

app = FastAPI()

# Nginx adds CORS headers in the Docker setup, but the Vite dev server
# (localhost:5173) talks to this app directly, so it needs them here too.
# Set CORS_ORIGINS as a comma-separated list to lock this down in production.
_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://localhost",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# With STORAGE_BACKEND=local, uploads live on disk and are served from here.
# With s3 they are served by S3/CloudFront and this mount is unused.
from app.core.storage import storage, LocalStorage  # noqa: E402

if isinstance(storage, LocalStorage):
    app.mount(storage.prefix, StaticFiles(directory=storage.root), name="media")


@app.get("/api/health")
def read_root():
    return {"status": "OK"}

app.include_router(auth.router, prefix="/auth", tags=["Auth"])

app.include_router(listings.router, tags=["Listings"])
app.include_router(get_listings.router, tags=["Listings"])

app.include_router(watchlist_router)

app.include_router(messages.router)

app.include_router(ws.router)


app.include_router(get_categories.router)

app.include_router(admin_router)

app.include_router(users_router)

app.include_router(twofa_router)

app.include_router(transactions_router)

app.include_router(language_partner_router)

app.include_router(language_partner_ws_router)

app.include_router(debug_matcher_router, prefix="/debug")