import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '../store';
import {
  fetchUserTransactions,
  createReview,
  clearCompleteTransactionStatus,
  clearCreateReviewStatus
} from '../features/transactions/transactionsSlice';
import type { RootState } from '../store/store';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { API_BASE_URL } from '../../config';
import '../Style/pages/transactions-page.scss';
import ClickableUsername from './shared/ClickableUsername';

export const TransactionsPage = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const { user } = useSelector((state: RootState) => state.auth);
  const {
    items: transactions,
    status,
    error,
    completeTransactionSuccess,
    completeTransactionError,
    createReviewStatus,
    createReviewError,
    createReviewSuccess
  } = useSelector((state: RootState) => state.transactions);
  const dispatch = useAppDispatch();

  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [userDetails, setUserDetails] = useState<{ [key: number]: { first_name: string, last_name: string, email: string } }>({});
  const [listingDetails, setListingDetails] = useState<{ [key: number]: { title: string, price: number, images?: string[] } }>({});
  const [reviewDetails, setReviewDetails] = useState<{ [key: number]: { rating: number, comment?: string, reviewer_name: string, created_at: string } }>({});
  const [userHasReviewed, setUserHasReviewed] = useState<{ [key: number]: boolean }>({});
  const [showReviewModal, setShowReviewModal] = useState<number | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [statusUpdating, setStatusUpdating] = useState<{ [key: number]: boolean }>({});
  const [statusUpdateSuccess, setStatusUpdateSuccess] = useState<string | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [transactionStatusDropdownOpen, setTransactionStatusDropdownOpen] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    if (token) {
      // Clear status update messages when filters change
      setStatusUpdateSuccess(null);
      setStatusUpdateError(null);
      dispatch(fetchUserTransactions({ token, role: roleFilter || undefined, status: statusFilter || undefined }));
    }
  }, [token, roleFilter, statusFilter, dispatch]);

  // Fetch user details
  const fetchUserDetails = async (userId: number) => {
    if (userDetails[userId]) return;
    try {
      const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const userData = await response.json();
        setUserDetails(prev => ({
          ...prev,
          [userId]: {
            first_name: userData.first_name,
            last_name: userData.last_name,
            email: userData.email
          }
        }));
      } else {
        setUserDetails(prev => ({
          ...prev,
          [userId]: {
            first_name: `User`,
            last_name: `#${userId}`,
            email: `user${userId}@example.com`
          }
        }));
      }
    } catch {
      setUserDetails(prev => ({
        ...prev,
        [userId]: {
          first_name: `User`,
          last_name: `#${userId}`,
          email: `user${userId}@example.com`
        }
      }));
    }
  };

  // Fetch listing details
  const fetchListingDetails = async (listingId: number) => {
    if (listingDetails[listingId]) return;
    try {
      const response = await fetch(`${API_BASE_URL}/get_listings/${listingId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const listingData = await response.json();
        setListingDetails(prev => ({
          ...prev,
          [listingId]: {
            title: listingData.title,
            price: listingData.price,
            images: listingData.images
          }
        }));
      } else {
        setListingDetails(prev => ({
          ...prev,
          [listingId]: {
            title: `Listing #${listingId}`,
            price: 0,
            images: []
          }
        }));
      }
    } catch {
      setListingDetails(prev => ({
        ...prev,
        [listingId]: {
          title: `Listing #${listingId}`,
          price: 0,
          images: []
        }
      }));
    }
  };

  // Fetch review details for a completed transaction
  const fetchReviewDetails = async (transactionId: number, reviewerId: number) => {
    if (reviewDetails[transactionId]) return;
    try {
      // Get reviews for the current user (seller - reviewee)
      const response = await fetch(`${API_BASE_URL}/transactions/reviews/user/${user?.user_id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (response.ok) {
        const reviews = await response.json();
        // Find the review for this specific transaction
        const transactionReview = reviews.find((review: any) => review.transaction_id === transactionId);
        if (transactionReview) {
          // Get reviewer name from userDetails
          const reviewerName = userDetails[reviewerId] 
            ? `${userDetails[reviewerId].first_name} ${userDetails[reviewerId].last_name}`
            : `User #${reviewerId}`;
          
          setReviewDetails(prev => ({
            ...prev,
            [transactionId]: {
              rating: transactionReview.rating,
              comment: transactionReview.comment,
              reviewer_name: reviewerName,
              created_at: transactionReview.created_at
            }
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch review details:', error);
    }
  };

  // Check if current user has already reviewed specific transactions
  const checkUserReviews = async () => {
    if (!token || !user?.user_id || transactions.length === 0) return;
    
    const userReviewedTransactions: { [key: number]: boolean } = {};
    
    // For each completed transaction where current user is buyer, check if review exists
    for (const transaction of transactions) {
      if (transaction.status === 'Completed' && transaction.buyer_id === user.user_id) {
        try {
          // Check if there's a review for this specific transaction by getting seller's reviews
          // and checking if any of them are for this transaction (which would mean buyer already reviewed)
          const response = await fetch(`${API_BASE_URL}/transactions/reviews/user/${transaction.seller_id}`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const sellerReviews = await response.json();
            const hasReview = sellerReviews.some((review: any) => 
              review.transaction_id === transaction.transaction_id && 
              review.reviewer_id === user.user_id
            );
            userReviewedTransactions[transaction.transaction_id] = hasReview;
          }
        } catch (error) {
          console.error(`Failed to check review for transaction ${transaction.transaction_id}:`, error);
          userReviewedTransactions[transaction.transaction_id] = false;
        }
      }
    }
    
    setUserHasReviewed(userReviewedTransactions);
  };

  // Fetch user and listing details when transactions change
  useEffect(() => {
    if (transactions.length > 0 && token && user?.user_id) {
      transactions.forEach(transaction => {
        fetchUserDetails(transaction.buyer_id);
        fetchUserDetails(transaction.seller_id);
        fetchListingDetails(transaction.listing_id);
        
        // Fetch review details for completed transactions where current user is seller
        if (transaction.status === 'Completed' && transaction.seller_id === user.user_id) {
          // Add small delay to ensure userDetails are loaded first
          setTimeout(() => {
            fetchReviewDetails(transaction.transaction_id, transaction.buyer_id);
          }, 100);
        }
      });
      
      // Check which transactions the user has already reviewed
      checkUserReviews();
    }
  }, [transactions, token, user?.user_id]);

  // Seller changes status from dropdown
  const handleChangeStatus = async (transactionId: number, newStatus: string) => {
    if (!token) return;
    setStatusUpdating(prev => ({ ...prev, [transactionId]: true }));
    
    // Clear previous messages
    setStatusUpdateSuccess(null);
    setStatusUpdateError(null);
    
    try {
      let url: string;
      let body: any = null;
      
      // Find the current transaction to get its current status
      const currentTransaction = transactions.find(t => t.transaction_id === transactionId);
      const currentStatus = currentTransaction?.status;
      
      // Use different endpoints based on status transition
      if (currentStatus === 'Accepted' && newStatus === 'Completed') {
        // Use the complete endpoint for Accepted → Completed
        url = `${API_BASE_URL}/transactions/${transactionId}/complete`;
        // No body needed for complete endpoint
      } else {
        // Use the regular update endpoint for Pending → Accepted/Rejected
        url = `${API_BASE_URL}/transactions/${transactionId}`;
        body = JSON.stringify({ status: newStatus });
      }
      
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        ...(body && { body })
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to update status');
      }
      
      // Set success message based on status transition
      const statusMessages = {
        'Accepted': 'Transaction accepted successfully!',
        'Rejected': 'Transaction rejected successfully!',
        'Completed': 'Transaction completed successfully!'
      };
      
      setStatusUpdateSuccess(statusMessages[newStatus as keyof typeof statusMessages] || `Status updated to ${newStatus} successfully!`);
      
      // Refresh transaction list
      dispatch(fetchUserTransactions({ token, role: roleFilter || undefined, status: statusFilter || undefined }));
    } catch (e: any) {
      console.error('Status update error:', e);
      setStatusUpdateError(`Failed to update transaction status: ${e.message}`);
    }
    
    setStatusUpdating(prev => ({ ...prev, [transactionId]: false }));
  };

  // Buyer creates review after completion
  const handleCreateReview = (transactionId: number) => {
    if (token) {
      dispatch(createReview({
        reviewData: {
          transaction_id: transactionId,
          rating: reviewRating,
          comment: reviewComment.trim() || undefined
        },
        token
      }));
      setShowReviewModal(null);
      setReviewRating(5);
      setReviewComment('');
    }
  };


  useEffect(() => {
    if (completeTransactionSuccess) {
      const timer = setTimeout(() => {
        dispatch(clearCompleteTransactionStatus());
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [completeTransactionSuccess, dispatch]);

  useEffect(() => {
    if (createReviewSuccess) {
      // Refresh user reviews to hide the review button
      checkUserReviews();
      const timer = setTimeout(() => {
        dispatch(clearCreateReviewStatus());
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [createReviewSuccess, dispatch]);

  // Auto-clear status update messages
  useEffect(() => {
    if (statusUpdateSuccess) {
      const timer = setTimeout(() => {
        setStatusUpdateSuccess(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [statusUpdateSuccess]);

  useEffect(() => {
    if (statusUpdateError) {
      const timer = setTimeout(() => {
        setStatusUpdateError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [statusUpdateError]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pending':
        return 'status-pending';
      case 'Accepted':
        return 'status-accepted';
      case 'Rejected':
        return 'status-rejected';
      case 'Completed':
        return 'status-completed';
      default:
        return 'status-pending';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (status === 'loading') {
    return (
      <div className="transactions-page">
        <div className="transactions-container">
          <div className="loading-message">Loading transactions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="transactions-page">
      <div className="transactions-container">
        <h2 className="transactions-title">My Transactions</h2>

        {error && <div className="error-message">{error}</div>}

        {/* Global success/error notifications */}
        {statusUpdateSuccess && (
          <div className="success-message">{statusUpdateSuccess}</div>
        )}
        {statusUpdateError && (
          <div className="error-message">{statusUpdateError}</div>
        )}
        {completeTransactionSuccess && (
          <div className="success-message">Transaction completed successfully!</div>
        )}
        {completeTransactionError && (
          <div className="error-message">{completeTransactionError}</div>
        )}
        {createReviewSuccess && (
          <div className="success-message">Review submitted successfully!</div>
        )}
        {createReviewError && (
          <div className="error-message">{createReviewError}</div>
        )}

        <div className="filters">
          <div className="filter-group">
            <label htmlFor="role-filter">Role</label>
            <div
              className={`category-dropdown ${roleDropdownOpen ? 'dropdown-open' : ''}`}
              onMouseLeave={() => setRoleDropdownOpen(false)}
            >
              <button
                type="button"
                className={`category-dropdown-button ${roleFilter ? 'has-category' : ''}`}
                onClick={() => setRoleDropdownOpen((prev) => !prev)}
              >
                <span className="category-dropdown-text">
                  {roleFilter === 'buyer' ? 'As Buyer' : 
                   roleFilter === 'seller' ? 'As Seller' : 
                   'All Roles'}
                </span>
                <svg
                  className="down-arrow-icon"
                  width="10"
                  height="6"
                  viewBox="0 0 10 6"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fill="currentColor"
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M9.7803 0.219668C10.0732 0.512558 10.0732 0.987438 9.7803 1.28033L5.53033 5.5303C5.23744 5.8232 4.76256 5.8232 4.46967 5.5303L0.21967 1.28033C-0.0732199 0.987438 -0.0732199 0.512558 0.21967 0.219668C0.51256 -0.0732225 0.98744 -0.0732225 1.28033 0.219668L5 3.93934L8.7197 0.219668C9.0126 -0.0732225 9.4874 -0.0732225 9.7803 0.219668Z"
                  />
                </svg>
              </button>
              {roleDropdownOpen && (
                <div className="category-dropdown-content">
                  <a
                    href="#"
                    className={roleFilter === '' ? "active-category" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      setRoleFilter('');
                      setRoleDropdownOpen(false);
                    }}
                  >
                    All Roles
                  </a>
                  <a
                    href="#"
                    className={roleFilter === 'buyer' ? "active-category" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      setRoleFilter('buyer');
                      setRoleDropdownOpen(false);
                    }}
                  >
                    As Buyer
                  </a>
                  <a
                    href="#"
                    className={roleFilter === 'seller' ? "active-category" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      setRoleFilter('seller');
                      setRoleDropdownOpen(false);
                    }}
                  >
                    As Seller
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="filter-group">
            <label htmlFor="status-filter">Status</label>
            <div
              className={`category-dropdown ${statusDropdownOpen ? 'dropdown-open' : ''}`}
              onMouseLeave={() => setStatusDropdownOpen(false)}
            >
              <button
                type="button"
                className={`category-dropdown-button ${statusFilter ? 'has-category' : ''}`}
                onClick={() => setStatusDropdownOpen((prev) => !prev)}
                style={{ minWidth: '180px' }}
              >
                <span className="category-dropdown-text">
                  {statusFilter || 'All Statuses'}
                </span>
                <svg
                  className="down-arrow-icon"
                  width="10"
                  height="6"
                  viewBox="0 0 10 6"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fill="currentColor"
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M9.7803 0.219668C10.0732 0.512558 10.0732 0.987438 9.7803 1.28033L5.53033 5.5303C5.23744 5.8232 4.76256 5.8232 4.46967 5.5303L0.21967 1.28033C-0.0732199 0.987438 -0.0732199 0.512558 0.21967 0.219668C0.51256 -0.0732225 0.98744 -0.0732225 1.28033 0.219668L5 3.93934L8.7197 0.219668C9.0126 -0.0732225 9.4874 -0.0732225 9.7803 0.219668Z"
                  />
                </svg>
              </button>
              {statusDropdownOpen && (
                <div className="category-dropdown-content">
                  <a
                    href="#"
                    className={statusFilter === '' ? "active-category" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      setStatusFilter('');
                      setStatusDropdownOpen(false);
                    }}
                  >
                    All Statuses
                  </a>
                  <a
                    href="#"
                    className={statusFilter === 'Pending' ? "active-category" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      setStatusFilter('Pending');
                      setStatusDropdownOpen(false);
                    }}
                  >
                    Pending
                  </a>
                  <a
                    href="#"
                    className={statusFilter === 'Accepted' ? "active-category" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      setStatusFilter('Accepted');
                      setStatusDropdownOpen(false);
                    }}
                  >
                    Accepted
                  </a>
                  <a
                    href="#"
                    className={statusFilter === 'Rejected' ? "active-category" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      setStatusFilter('Rejected');
                      setStatusDropdownOpen(false);
                    }}
                  >
                    Rejected
                  </a>
                  <a
                    href="#"
                    className={statusFilter === 'Completed' ? "active-category" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      setStatusFilter('Completed');
                      setStatusDropdownOpen(false);
                    }}
                  >
                    Completed
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {transactions.length === 0 && status === 'succeeded' ? (
          <div className="empty-state">
            <p>No transactions found.</p>
          </div>
        ) : (
          <div className="transactions-list">
            {transactions.map((transaction) => {
              const isSeller = user?.user_id === transaction.seller_id;
              const isPending = transaction.status === 'Pending';
              const isAccepted = transaction.status === 'Accepted';
              const canChangeStatus = isSeller && (isPending || isAccepted);

              return (
                <Card key={transaction.transaction_id} className="transaction-card">
                  <CardHeader>
                    <CardTitle className="transaction-title">
                      {listingDetails[transaction.listing_id]?.title || `Transaction #${transaction.transaction_id}`}
                    </CardTitle>
                    <div className={`transaction-status ${getStatusColor(transaction.status)}`}>
                      {transaction.status}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="transaction-details">
                      <div className="transaction-info">
                        <div className="info-row">
                          <span className="label">Price:</span>
                          <span className="value">{listingDetails[transaction.listing_id]?.price || 'N/A'} €</span>
                        </div>
                        <div className="info-row">
                          <span className="label">Offered:</span>
                          <span className="value">{formatDate(transaction.offered_at)}</span>
                        </div>
                        {transaction.responded_at && (
                          <div className="info-row">
                            <span className="label">Responded:</span>
                            <span className="value">{formatDate(transaction.responded_at)}</span>
                          </div>
                        )}
                        {transaction.message && (
                          <div className="info-row">
                            <span className="label">Message:</span>
                            <span className="value message">{transaction.message}</span>
                          </div>
                        )}
                      </div>

                      <div className="transaction-parties">
                        <div className="party-info">
                          <span className="label">Buyer:</span>
                          <span className={`value ${transaction.buyer_id === user?.user_id ? 'current-user' : ''}`}>
                            {transaction.buyer_id === user?.user_id ? 
                              "Me" :
                              userDetails[transaction.buyer_id] ? (
                                <ClickableUsername
                                  userId={transaction.buyer_id}
                                  firstName={userDetails[transaction.buyer_id].first_name}
                                  lastName={userDetails[transaction.buyer_id].last_name}
                                />
                              ) : (
                                `User #${transaction.buyer_id}`
                              )
                            }
                          </span>
                        </div>
                        <div className="party-info">
                          <span className="label">Seller:</span>
                          <span className={`value ${transaction.seller_id === user?.user_id ? 'current-user' : ''}`}>
                            {transaction.seller_id === user?.user_id ? 
                              "Me" :
                              userDetails[transaction.seller_id] ? (
                                <ClickableUsername
                                  userId={transaction.seller_id}
                                  firstName={userDetails[transaction.seller_id].first_name}
                                  lastName={userDetails[transaction.seller_id].last_name}
                                />
                              ) : (
                                `User #${transaction.seller_id}`
                              )
                            }
                          </span>
                        </div>
                      </div>


                      {transaction.status === 'Completed' && 
                       transaction.seller_id === user?.user_id && 
                       reviewDetails[transaction.transaction_id] && (
                        <div className="transaction-review">
                          <h4>Buyer Review</h4>
                          <div className="review-content">
                            <div className="review-header">
                              <div className="review-rating">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <span
                                    key={star}
                                    className={`review-star ${star <= reviewDetails[transaction.transaction_id].rating ? 'filled' : ''}`}
                                  >
                                    ★
                                  </span>
                                ))}
                                <span className="rating-text">
                                  ({reviewDetails[transaction.transaction_id].rating}/5)
                                </span>
                              </div>
                              <div className="review-meta">
                                <span className="review-date">
                                  {new Date(reviewDetails[transaction.transaction_id].created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                            {reviewDetails[transaction.transaction_id].comment && (
                              <div className="review-comment">
                                "{reviewDetails[transaction.transaction_id].comment}"
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="transaction-actions">
                        {canChangeStatus && (
                          <div
                            className={`category-dropdown ${transactionStatusDropdownOpen[transaction.transaction_id] ? 'dropdown-open' : ''}`}
                            onMouseLeave={() => setTransactionStatusDropdownOpen(prev => ({ ...prev, [transaction.transaction_id]: false }))}
                          >
                            <button
                              type="button"
                              className={`category-dropdown-button ${transaction.status !== 'Pending' ? 'has-category' : ''}`}
                              onClick={() => setTransactionStatusDropdownOpen(prev => ({ ...prev, [transaction.transaction_id]: !prev[transaction.transaction_id] }))}
                              disabled={!!statusUpdating[transaction.transaction_id]}
                              style={{ marginRight: 10 }}
                            >
                              <span className="category-dropdown-text">
                                {transaction.status}
                              </span>
                              <svg
                                className="down-arrow-icon"
                                width="10"
                                height="6"
                                viewBox="0 0 10 6"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  fill="currentColor"
                                  fillRule="evenodd"
                                  clipRule="evenodd"
                                  d="M9.7803 0.219668C10.0732 0.512558 10.0732 0.987438 9.7803 1.28033L5.53033 5.5303C5.23744 5.8232 4.76256 5.8232 4.46967 5.5303L0.21967 1.28033C-0.0732199 0.987438 -0.0732199 0.512558 0.21967 0.219668C0.51256 -0.0732225 0.98744 -0.0732225 1.28033 0.219668L5 3.93934L8.7197 0.219668C9.0126 -0.0732225 9.4874 -0.0732225 9.7803 0.219668Z"
                                />
                              </svg>
                            </button>
                            {transactionStatusDropdownOpen[transaction.transaction_id] && (
                              <div className="category-dropdown-content">
                                <a
                                  href="#"
                                  className={transaction.status === 'Pending' ? "active-category" : undefined}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleChangeStatus(transaction.transaction_id, 'Pending');
                                    setTransactionStatusDropdownOpen(prev => ({ ...prev, [transaction.transaction_id]: false }));
                                  }}
                                >
                                  Pending
                                </a>
                                <a
                                  href="#"
                                  className={transaction.status === 'Accepted' ? "active-category" : undefined}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleChangeStatus(transaction.transaction_id, 'Accepted');
                                    setTransactionStatusDropdownOpen(prev => ({ ...prev, [transaction.transaction_id]: false }));
                                  }}
                                >
                                  Accept
                                </a>
                                <a
                                  href="#"
                                  className={transaction.status === 'Rejected' ? "active-category" : undefined}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleChangeStatus(transaction.transaction_id, 'Rejected');
                                    setTransactionStatusDropdownOpen(prev => ({ ...prev, [transaction.transaction_id]: false }));
                                  }}
                                >
                                  Reject
                                </a>
                                <a
                                  href="#"
                                  className={transaction.status === 'Completed' ? "active-category" : undefined}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleChangeStatus(transaction.transaction_id, 'Completed');
                                    setTransactionStatusDropdownOpen(prev => ({ ...prev, [transaction.transaction_id]: false }));
                                  }}
                                >
                                  Complete
                                </a>
                              </div>
                            )}
                          </div>
                        )}


                        {transaction.status === 'Completed' && 
                         user?.user_id === transaction.buyer_id && 
                         !userHasReviewed[transaction.transaction_id] && (
                          <Button
                            onClick={() => setShowReviewModal(transaction.transaction_id)}
                            className="review-button"
                          >
                            Leave Review
                          </Button>
                        )}


                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}


        {showReviewModal && (
          <div className="review-modal-overlay">
            <div className="review-modal">
              <h3>Leave a Review</h3>
              <div className="review-form">
                <div className="rating-section">
                  <label>Rating:</label>
                  <div className="rating-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`star ${star <= reviewRating ? 'filled' : ''}`}
                        onClick={() => setReviewRating(star)}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
                <div className="comment-section">
                  <label>Comment (optional):</label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share your experience..."
                    rows={4}
                  />
                </div>
                <div className="modal-actions">
                  <Button
                    onClick={() => handleCreateReview(showReviewModal)}
                    disabled={createReviewStatus === 'loading'}
                    className="submit-review-button"
                  >
                    {createReviewStatus === 'loading' ? 'Submitting...' : 'Submit Review'}
                  </Button>
                  <Button
                    onClick={() => setShowReviewModal(null)}
                    variant="outline"
                    className="cancel-button"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransactionsPage;
