import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { RootState } from '../store/store';
import { API_BASE_URL } from '../../config';
import '../Style/pages/watchlist-page.scss';
const placeholderImageUrl = "/image-placeholder.png"; 

interface Listing {
  listing_id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  created_at: string;
  images: Array<{ image_id: number, image_path: string }>;
}

export const WatchlistPage = () => {
  const navigate = useNavigate();
  const { token } = useSelector((state: RootState) => state.auth);
  const [watchlistItems, setWatchlistItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchWatchlist = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${API_BASE_URL}/watchlist`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to fetch watchlist items');
        }

        const data = await response.json();
        setWatchlistItems(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchWatchlist();
  }, [token, navigate]);

  const removeFromWatchlist = async (listingId: string) => {

    if (!token) return;

    try {
      const response = await fetch(`${API_BASE_URL}/watchlist/${listingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to remove from watchlist');
      }

      // Update the local state to remove the item
      setWatchlistItems(prevItems =>
        prevItems.filter(item => item.listing_id !== listingId)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const navigateToListing = (listingId: string) => {
    navigate(`/listing/${listingId}`);
  };

  console.log(watchlistItems, "Watchlist items fetched successfully.");

  return (
    <div className="watchlist-page">
      <h1 className="watchlist-title">My Watchlist</h1>
      <div className="watchlist-container">
        {loading && <p className="watchlist-loading">Loading your watchlist...</p>}
        {error && <p className="watchlist-error">{error}</p>}

        {!loading && watchlistItems.length === 0 && !error && (
          <div className="watchlist-empty">
            <p>Your watchlist is empty.</p>
            <button
              className="watchlist-browse-button"
              onClick={() => navigate('/app')}>Browse Listings</button>
          </div>
        )}

        <div className="watchlist-list">
          {watchlistItems.map(item => (
            <div key={item.listing_id} className="watchlist-item" >
              <div className="watchlist-item-image" >
                <img
                  src={item.images && item.images.length > 0 ? item.images[0].image_path : placeholderImageUrl}
                  alt={item.title || "Listing image"}
                />
              </div>
              <div className="watchlist-item-details">
                <h3 onClick={() => navigateToListing(item.listing_id)}>{item.title}</h3>
                <p className="watchlist-item-price">€{item.price}</p>
                <p className="watchlist-item-category">{item.category}</p>
                <p className="watchlist-item-description">{item.description}</p>
                <div className="watchlist-item-actions">
                  <button
                    onClick={() => navigateToListing(item.listing_id)}
                    className="watchlist-view-button"
                    type="button"
                  >
                    View
                  </button>
                  <button
                    onClick={() => removeFromWatchlist(item.listing_id)}
                    className="watchlist-remove-button"
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
