import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Input } from './ui/input';
import { Button } from './ui/button';
import type { RootState } from '../store/store';
import { API_BASE_URL } from '../../config';
import '../Style/pages/my-adds.scss';
import { useNavigate } from 'react-router-dom';

interface Listing {
  listing_id: string;
  title: string;
  description: string;
  price: number;
  [key: string]: any;
}

export const MyAddsPage = () => {
  const navigate = useNavigate();
  const { token } = useSelector((state: RootState) => state.auth);
  const allListings = useSelector((state: RootState) => state.products.items) as any[];
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Listing>>({});
  const [success, setSuccess] = useState('');

  const navigateToCreateListing = () => {
    navigate('/create-listing')
  };

  useEffect(() => {
    const fetchListings = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`${API_BASE_URL}/users/listings`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || 'Failed to fetch listings');
        }
        const data = await response.json();
        setListings(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchListings();
  }, [token, success]);


  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: name === 'price' ? Number(value) : value }));
  };

  const handleEditSubmit = async (listing_id: string) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`${API_BASE_URL}/users/update/listings/${listing_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(editData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update listing');
      }
      setSuccess('Listing updated successfully!');
      setEditId(null);
      setEditData({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (listing_id: string) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`${API_BASE_URL}/users/del/listings/${listing_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete listing');
      }
      setSuccess('Listing deleted successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="my-adds-page">
      <h2 className="my-adds-title">My Adds</h2>
      <div className="my-adds-container">
        {loading && <p className="my-adds-message">Loading...</p>}
        {error && listings.length !== 0 && <p className="my-adds-error">{error}</p>}
        {success && <p className="my-adds-success">{success}</p>}
        {listings.length === 0 && !loading && <div className="my-adds-empty">
          <p>You have no adds yet.</p>
          <button
            className="my-adds-create-button"
            onClick={() => navigateToCreateListing()}>Create Add</button>
        </div>}
        <div className="my-adds-list">
          {listings.map(listing => {
            const match = allListings.find(l => l.listing_id === listing.listing_id);
            const status = match ? match.status : 'Review';
            return (
              <div key={listing.listing_id} className="my-adds-card">
                {editId === listing.listing_id ? (
                  <form onSubmit={e => { e.preventDefault(); handleEditSubmit(listing.listing_id); }} className="my-adds-edit-form">
                    <Input name="title" value={editData.title || ''} onChange={handleEditChange} required style={{ fontWeight: 600, fontSize: 18 }} />
                    <textarea name="description" value={editData.description || ''} onChange={handleEditChange} required />
                    <Input name="price" type="number" value={editData.price?.toString() || ''} onChange={handleEditChange} required min={0} />
                    <div className="my-adds-edit-actions">
                      <Button type="submit">Save</Button>
                      <Button type="button" variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="my-add-header">
                      <h3 className="my-adds-card-title">{listing.title}</h3>
                      <span className={`my-adds-card-status ${status.toLowerCase()}`}>
                        {status}</span>
                    </div>
                    <p className="my-adds-card-desc">{listing.description}</p>
                    <p className="my-adds-card-price">Price: <b>€{listing.price}</b></p>
                    <div className="my-adds-card-actions">
                      {status !== 'Active' && (
                        <button
                          className="my-adds-edit-button"
                          type="button"
                          onClick={() => navigate(`/create-listing?edit=${listing.listing_id}`)}
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(listing.listing_id)}
                        className="my-adds-delete-button"
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MyAddsPage; 
