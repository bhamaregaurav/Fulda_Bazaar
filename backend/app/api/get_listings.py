from sqlalchemy.orm import selectinload
from sqlalchemy.future import select
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_, func, text
from typing import Optional
from ..schemas.auth import UserCreate, UserLogin, Token
from ..core.database import get_db
from app.models.listing_model import Listing

router = APIRouter()

# --------- Geo extraction helper ----------


def extract_lat_lng(point):
    """
    Extracts (latitude, longitude) from a spatial POINT field.
    Adjust if you use separate latitude/longitude columns!
    """
    if not point:
        return None, None
    try:

        coords = list(point.coords)[0]  # Usually (longitude, latitude)
        return coords[1], coords[0]     # (latitude, longitude)
    except Exception:

        try:

            from geoalchemy2.shape import to_shape
            shapely_point = to_shape(point)
            return shapely_point.y, shapely_point.x
        except Exception:
            return None, None


@router.get("/get_listings")
async def get_all_listings(
    query: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    subcategory_id: Optional[int] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    condition: Optional[str] = Query(None),
    location: Optional[str] = Query(None),
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    max_distance: Optional[float] = Query(None, description="Maximum distance in kilometers"),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Listing)
        .options(
            selectinload(Listing.category),
            selectinload(Listing.subcategory),
            selectinload(Listing.images),
            selectinload(Listing.creator)
        )
        .where(Listing.status == "Active")
    )

    # Keyword search across title + description
    if query:
        keywords = query.strip().split()
        for word in keywords:
            stmt = stmt.where(
                or_(
                    Listing.title.ilike(f"%{word}%"),
                    Listing.description.ilike(f"%{word}%")
                )
            )

    if category_id:
        stmt = stmt.where(Listing.category_id == category_id)

    if subcategory_id:
        stmt = stmt.where(Listing.subcategory_id == subcategory_id)

    if min_price is not None:
        stmt = stmt.where(Listing.price >= min_price)

    if max_price is not None:
        stmt = stmt.where(Listing.price <= max_price)

    if condition:
        stmt = stmt.where(Listing.condition == condition)

    if location:
        stmt = stmt.where(Listing.location.ilike(f"%{location}%"))

    # Distance-based filtering
    if latitude is not None and longitude is not None and max_distance is not None:
        # Create a point from the provided coordinates
        user_point = func.ST_GeomFromText(f'POINT({longitude} {latitude})', 4326)
        
        # Calculate distance in kilometers using ST_Distance_Sphere
        distance_expr = func.ST_Distance_Sphere(Listing.geo_coordinates, user_point) / 1000
        
        # Add the distance calculation to the query
        stmt = stmt.add_columns(distance_expr.label("distance"))
        
        # Filter by max_distance
        stmt = stmt.where(distance_expr <= max_distance)
        
        # Order by distance (closest first)
        stmt = stmt.order_by(distance_expr)

    result = await db.execute(stmt)
    
    # Handle result differently if we added the distance column
    if latitude is not None and longitude is not None and max_distance is not None:
        query_results = result.all()
        listings = []
        distances = {}
        
        # Extract listings and distances
        for row in query_results:
            listing = row[0]  # The Listing object
            distance = row[1]  # The calculated distance
            listings.append(listing)
            distances[listing.listing_id] = round(distance, 2)
    else:
        listings = result.scalars().all()
        distances = {}

    response = []
    for listing in listings:
        lat, lng = extract_lat_lng(
            listing.geo_coordinates)  # <-- Add geo location
        listing_data = {
            "listing_id": listing.listing_id,
            "title": listing.title,
            "description": listing.description,
            "price": str(listing.price),
            "condition": listing.condition,
            "location": listing.location,
            "geo_location": {
                "latitude": lat,
                "longitude": lng
            },
            "status": listing.status,
            "created_at": listing.created_at,
            "created_by": {
                "user_id": listing.creator.user_id,
                "first_name": listing.creator.first_name,
                "last_name": listing.creator.last_name,
                "email": listing.creator.email,
            } if listing.creator else None,
            "expiration_date": listing.expiration_date,
            "category": listing.category.name if listing.category else None,
            "subcategory": listing.subcategory.name if listing.subcategory else None,
            "images": [img.image_path for img in listing.images],
        }
        
        # Add distance if available
        if listing.listing_id in distances:
            listing_data["distance"] = distances[listing.listing_id]
            
        response.append(listing_data)

    return response


@router.get("/get_listings/{listing_id}")
async def get_listing_by_id(
    listing_id: int,
    latitude: Optional[float] = Query(None),
    longitude: Optional[float] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a single listing by its ID (no auth required). 
    If not found, raises a 404.
    """
    stmt = (
        select(Listing)
        .options(
            selectinload(Listing.category),
            selectinload(Listing.subcategory),
            selectinload(Listing.images),
            selectinload(Listing.creator)
        )
        .where(Listing.listing_id == listing_id)
    )
    
    # Add distance calculation if coordinates provided
    distance = None
    if latitude is not None and longitude is not None:
        user_point = func.ST_GeomFromText(f'POINT({longitude} {latitude})', 4326)
        distance_expr = func.ST_Distance_Sphere(Listing.geo_coordinates, user_point) / 1000
        stmt = stmt.add_columns(distance_expr.label("distance"))
        
        result = await db.execute(stmt)
        row = result.first()
        
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Listing not found"
            )
            
        listing = row[0]  # The Listing object
        distance = round(row[1], 2)  # The calculated distance
    else:
        result = await db.execute(stmt)
        listing = result.scalars().first()
        
        if listing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Listing not found"
            )

    lat, lng = extract_lat_lng(listing.geo_coordinates)  # <-- Add geo location

    response = {
        "listing_id": listing.listing_id,
        "title": listing.title,
        "description": listing.description,
        "price": str(listing.price),
        "condition": listing.condition,
        "location": listing.location,
        "geo_location": {
            "latitude": lat,
            "longitude": lng
        },
        "status": listing.status,
        "created_at": listing.created_at,
        "created_by": {
            "user_id": listing.creator.user_id,
            "first_name": listing.creator.first_name,
            "last_name": listing.creator.last_name,
            "email": listing.creator.email,
        } if listing.creator else None,
        "expiration_date": listing.expiration_date,
        "category": listing.category.name if listing.category else None,
        "subcategory": listing.subcategory.name if listing.subcategory else None,
        "images": [img.image_path for img in listing.images],
        "category_id": listing.category_id,
        "subcategory_id": listing.subcategory_id,
        "listing_type": listing.listing_type,
        "negotiable": listing.negotiable,
    }
    
    # Add distance if available
    if distance is not None:
        response["distance"] = distance
        
    return response
