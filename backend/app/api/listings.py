from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from typing    import List, Optional
from decimal   import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from geoalchemy2.elements import WKTElement
import os

from app.core.database  import get_db
from app.core.security  import get_current_user
from app.models.listing_model import Listing, ListingImage
from ..models.user_models    import User
from ..schemas.listing      import ListingOut

router = APIRouter()

# ─────────────────────────────  GCS client  ───────────────────────────────
from app.core.gcs import bucket as _bucket

# ───────────────────────────────  route  ──────────────────────────────────
@router.post(
    "/listings",
    response_model = ListingOut,
    status_code    = status.HTTP_201_CREATED,
    dependencies   = [Depends(get_current_user)],
)
async def create_listing(
    title           : str               = Form(...),
    description     : str               = Form(...),
    category_id     : int               = Form(...),
    subcategory_id  : Optional[int]     = Form(None),
    listing_type    : str               = Form(...),
    price           : Optional[Decimal] = Form(None),
    negotiable      : bool              = Form(False),
    condition       : str               = Form(...),
    location        : Optional[str]     = Form(None),
    latitude        : float             = Form(...),
    longitude       : float             = Form(...),
    images          : List[UploadFile]  = File(...),
    db              : AsyncSession      = Depends(get_db),
    current_user    : User              = Depends(get_current_user),
):
    # ─── 1. input guardrails ──────────────────────────────────────────────
    if len(images) > 7:
        raise HTTPException(
            status_code = status.HTTP_400_BAD_REQUEST,
            detail      = "Maximum 7 images per listing allowed.",
        )

    # ─── 2. Listing row ───────────────────────────────────────────────────
    geom = WKTElement(f"POINT({longitude} {latitude})", srid=4326)

    new_listing = Listing(
        title=title,
        description=description,
        category_id=category_id,
        subcategory_id=subcategory_id,
        listing_type=listing_type,
        price=price,
        negotiable=negotiable,
        condition=condition,
        location=location,
        geo_coordinates=geom,
        created_by=current_user.user_id,
        status="Review",
    )
    db.add(new_listing)
    await db.flush()                # gets listing_id

    # ─── 3. images on GCS + ListingImage rows ────────────────────────────
    for idx, img in enumerate(images):
        blob = _bucket.blob(f"listings/{new_listing.listing_id}/{img.filename}")
        blob.upload_from_file(img.file, content_type=img.content_type)
        url = blob.public_url

        db.add(
            ListingImage(
                listing_id    = new_listing.listing_id,
                image_path    = url,
                is_primary    = (idx == 0),
                display_order = idx,
            )
        )

    await db.commit()

    # ─── 4. reload with relationship eagerly loaded ──────────────────────
    result = await db.execute(
        select(Listing)
        .options(selectinload(Listing.images))
        .where(Listing.listing_id == new_listing.listing_id)
    )
    listing = result.scalar_one()

    return ListingOut.from_orm(listing)
