import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import { useSelector } from 'react-redux';
import type { RootState } from '../store/store';
import '../Style/pages/admin-dashboard.scss';

interface User {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  account_status: string;
  role_name: string;
  registration_date: string;
}

interface Listing {
  listing_id: number;
  title: string;
  status: string;
  created_by: number;
  created_at: string;
  user_name?: string;
}

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'listings'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [listingsError, setListingsError] = useState('');
  const [statusUpdateLoading, setStatusUpdateLoading] = useState<string | null>(null);
  const { token } = useSelector((state: RootState) => state.auth);
  const [reasonInputs, setReasonInputs] = useState<{ [key: number]: string }>({});

  // Fetch users
  useEffect(() => {
    if (activeTab === 'users' && token) {
      setUsersLoading(true);
      setUsersError('');
      fetch(`${API_BASE_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          setUsers(data.users || []);
        })
        .catch(() => setUsersError('Failed to fetch users'))
        .finally(() => setUsersLoading(false));
    }
  }, [activeTab, token]);

  // Fetch listings in review
  useEffect(() => {
    if (activeTab === 'listings' && token) {
      setListingsLoading(true);
      setListingsError('');
      fetch(`${API_BASE_URL}/admin/listings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          const listingsArr = Array.isArray(data) ? data : data.listings;
          
          // Fetch user names for each listing
          const enhancedListings = (listingsArr || []).map((listing: Listing) => {
            // Find user by ID
            const user = users.find(u => u.user_id === listing.created_by);
            return {
              ...listing,
              user_name: user ? `${user.first_name} ${user.last_name}` : `User #${listing.created_by}`
            };
          });
          
          setListings(enhancedListings);
        })
        .catch(() => setListingsError('Failed to fetch listings'))
        .finally(() => setListingsLoading(false));
    }
  }, [activeTab, token, users]);

  // Delete user
  const handleDeleteUser = async (userId: number, isAdmin: boolean) => {
    if (isAdmin) {
      alert('Admin users cannot be deleted');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await fetch(`${API_BASE_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setUsers(users => users.filter(u => u.user_id !== userId));
    } catch {
      alert('Failed to delete user');
    }
  };

  // Update listing status
  const handleReasonChange = (listingId: number, value: string) => {
    setReasonInputs(inputs => ({ ...inputs, [listingId]: value }));
  };

  const handleUpdateStatus = async (listingId: number, newStatus: string) => {
    setStatusUpdateLoading(listingId.toString());
    try {
      await fetch(`${API_BASE_URL}/admin/listings/${listingId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          status: newStatus,
          reason: reasonInputs[listingId] || '' 
        })
      });
      setListings(listings => listings.map(l => l.listing_id === listingId ? { ...l, status: newStatus } : l));
    } catch {
      alert('Failed to update status');
    } finally {
      setStatusUpdateLoading(null);
    }
  };

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>
      <div className="tab-buttons">
        <button 
          className={activeTab === 'users' ? 'active' : ''} 
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button 
          className={activeTab === 'listings' ? 'active' : ''} 
          onClick={() => setActiveTab('listings')}
        >
          Listings
        </button>
      </div>
      
      {activeTab === 'users' && (
        <div>
          <h2>All Users</h2>
          {usersLoading ? (
            <div className="loading-message">Loading users...</div>
          ) : usersError ? (
            <div className="error-message">{usersError}</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Email</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th>Registered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const isAdmin = user.role_name.toLowerCase() === 'admin';
                    return (
                      <tr key={user.user_id}>
                        <td>{user.user_id}</td>
                        <td>{user.email}</td>
                        <td>{user.first_name} {user.last_name}</td>
                        <td>{user.phone_number || '-'}</td>
                        <td>{user.account_status}</td>
                        <td>{user.role_name}</td>
                        <td>{new Date(user.registration_date).toLocaleDateString()}</td>
                        <td>
                          <button 
                            className={`action-button delete ${isAdmin ? 'disabled' : ''}`}
                            onClick={() => handleDeleteUser(user.user_id, isAdmin)}
                            disabled={isAdmin}
                            title={isAdmin ? "Admin users cannot be deleted" : "Delete user"}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      
      {activeTab === 'listings' && (
        <div>
          <h2>Listings in Review</h2>
          {listingsLoading ? (
            <div className="loading-message">Loading listings...</div>
          ) : listingsError ? (
            <div className="error-message">{listingsError}</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Created By</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map(listing => (
                    <tr key={listing.listing_id}>
                      <td>{listing.listing_id}</td>
                      <td>{listing.title}</td>
                      <td>{listing.status}</td>
                      <td>{listing.user_name || `User #${listing.created_by}`}</td>
                      <td>{new Date(listing.created_at).toLocaleDateString()}</td>
                      <td className="actions-cell">
                        <div className="status-action-container">
                          <select
                            className="status-select"
                            value={listing.status}
                            onChange={e => handleUpdateStatus(listing.listing_id, e.target.value)}
                            disabled={statusUpdateLoading === listing.listing_id.toString()}
                          >
                            <option value="Review">Review</option>
                            <option value="Active">Active</option>
                            <option value="Reserved">Reserved</option>
                            <option value="Sold">Sold</option>
                            <option value="Expired">Expired</option>
                          </select>
                          <input
                            className="reason-input"
                            type="text"
                            placeholder="Reason for change"
                            value={reasonInputs[listing.listing_id] || ''}
                            onChange={e => handleReasonChange(listing.listing_id, e.target.value)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard; 