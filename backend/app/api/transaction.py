from fastapi import APIRouter, Depends, HTTPException, status, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import and_, desc, func
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.transaction_model import Transaction
from app.models.review_model import Review
from app.models.listing_model import Listing
from app.models.user_models import User
from app.schemas.transaction import (
    TransactionCreate, 
    TransactionResponse, 
    TransactionUpdate,
    ReviewCreate,
    ReviewResponse
)

router = APIRouter(prefix="/transactions")

# Create a new transaction (make offer)
@router.post("", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction: TransactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check if listing exists and is active
    result = await db.execute(select(Listing).filter(Listing.listing_id == transaction.listing_id))
    listing = result.scalar_one_or_none()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    
    if listing.status != "Active":
        raise HTTPException(status_code=400, detail="Listing is not available for offers")
    
    # User can't make an offer on their own listing
    if listing.created_by == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot make offer on your own listing")
    
    # Check if user already has a pending transaction for this listing
    result = await db.execute(
        select(Transaction).filter(
            and_(
                Transaction.listing_id == transaction.listing_id,
                Transaction.buyer_id == current_user.user_id,
                Transaction.status == 'Pending'
            )
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have a pending offer for this listing")
    
    # Create new transaction
    new_transaction = Transaction(
        listing_id=transaction.listing_id,
        buyer_id=current_user.user_id,
        seller_id=listing.created_by,
        message=transaction.message
    )
    
    db.add(new_transaction)
    await db.commit()
    await db.refresh(new_transaction)
    
    return new_transaction

# Get all transactions for current user (both as buyer and seller)
@router.get("", response_model=List[TransactionResponse])
async def get_my_transactions(
    role: Optional[str] = Query(None, enum=["buyer", "seller"]),
    status: Optional[str] = Query(None, enum=["Pending", "Accepted", "Rejected", "Completed"]),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Transaction)
    
    # Filter by role
    if role == "buyer":
        query = query.filter(Transaction.buyer_id == current_user.user_id)
    elif role == "seller":
        query = query.filter(Transaction.seller_id == current_user.user_id)
    else:
        # Both roles - show all user's transactions
        query = query.filter(
            (Transaction.buyer_id == current_user.user_id) | 
            (Transaction.seller_id == current_user.user_id)
        )
    
    # Filter by status
    if status:
        query = query.filter(Transaction.status == status)
    
    # Order by most recent first
    query = query.order_by(desc(Transaction.offered_at))
    
    result = await db.execute(query)
    transactions = result.scalars().all()
    
    return transactions

# Get a specific transaction
@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: int = Path(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Transaction).filter(Transaction.transaction_id == transaction_id))
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Only buyer or seller can view their transaction
    if transaction.buyer_id != current_user.user_id and transaction.seller_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return transaction

# Update transaction status (accept or reject offer)
@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    update_data: TransactionUpdate,
    transaction_id: int = Path(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get transaction
    result = await db.execute(select(Transaction).filter(Transaction.transaction_id == transaction_id))
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Only seller can update status
    if transaction.seller_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the seller can accept or reject offers")
    
    # Transaction must be in Pending state
    if transaction.status != 'Pending':
        raise HTTPException(status_code=400, detail=f"Cannot update transaction in {transaction.status} status")
    
    # Update status
    transaction.status = update_data.status
    transaction.responded_at = datetime.utcnow()
    
    # If completed (accepted), update listing status to Sold and set completed_at
    if update_data.status == 'Completed':
        transaction.completed_at = datetime.utcnow()
        
        result = await db.execute(select(Listing).filter(Listing.listing_id == transaction.listing_id))
        listing = result.scalar_one_or_none()
        if listing:
            listing.status = 'Sold'
    
    await db.commit()
    await db.refresh(transaction)
    
    return transaction

# Complete a transaction
@router.put("/{transaction_id}/complete", response_model=TransactionResponse)
async def complete_transaction(
    transaction_id: int = Path(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get transaction
    result = await db.execute(select(Transaction).filter(Transaction.transaction_id == transaction_id))
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Only seller can mark as completed
    if transaction.seller_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the seller can complete transactions")
    
    # Transaction must be in Accepted state
    if transaction.status != 'Accepted':
        raise HTTPException(status_code=400, detail=f"Cannot complete transaction in {transaction.status} status")
    
    # Update transaction status
    transaction.status = 'Completed'
    transaction.completed_at = datetime.utcnow()
    
    # Update listing status to Sold
    result = await db.execute(select(Listing).filter(Listing.listing_id == transaction.listing_id))
    listing = result.scalar_one_or_none()
    if listing:
        listing.status = 'Sold'
    
    await db.commit()
    await db.refresh(transaction)
    
    return transaction

# Add a review after a completed transaction
@router.post("/reviews", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    review: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get transaction
    result = await db.execute(select(Transaction).filter(Transaction.transaction_id == review.transaction_id))
    transaction = result.scalar_one_or_none()
    
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Only buyer can leave reviews
    if transaction.buyer_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only the buyer can leave a review")
    
    # Transaction must be completed
    if transaction.status != 'Completed':
        raise HTTPException(status_code=400, detail="Can only review completed transactions")
    
    # Check if review already exists
    result = await db.execute(select(Review).filter(Review.transaction_id == review.transaction_id))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Review already exists for this transaction")
    
    # Create review
    new_review = Review(
        transaction_id=review.transaction_id,
        reviewer_id=current_user.user_id,
        reviewee_id=transaction.seller_id,
        rating=review.rating,
        comment=review.comment
    )
    
    db.add(new_review)
    
    # Update seller's trust score based on reviews
    result = await db.execute(
        select(func.avg(Review.rating))
        .filter(Review.reviewee_id == transaction.seller_id)
    )
    avg_rating = result.scalar_one_or_none() or 0
    
    # Convert 5-star rating to 0-1 scale for trust score
    normalized_score = avg_rating / 5.0
    
    # Get seller and update trust score
    seller = await db.get(User, transaction.seller_id)
    if seller:
        seller.trust_score = normalized_score
    
    await db.commit()
    await db.refresh(new_review)
    
    return new_review

# Get reviews for a user
@router.get("/reviews/user/{user_id}", response_model=List[ReviewResponse])
async def get_user_reviews(
    user_id: int = Path(...),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Review).filter(Review.reviewee_id == user_id))
    reviews = result.scalars().all()
    
    return reviews