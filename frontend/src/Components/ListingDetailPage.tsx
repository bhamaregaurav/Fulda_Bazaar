import { useParams } from 'react-router-dom';
import '../Style/pages/listing-detail.scss';
import { useEffect, useState, useRef } from 'react';
import type { ListingInterface } from '../types/listing';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '../store';
import { addToWatchlist, clearWatchlistStatus } from '../features/watchlist/watchlistSlice';
import { makeOffer, clearMakeOfferStatus } from '../features/transactions/transactionsSlice';
import type { RootState } from '../store/store';
import { API_BASE_URL } from '../../config';
import { useSocket } from '../context/SocketContext';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "./ui/carousel";
import type UserInterface from '../types/user';
import ClickableUsername from './shared/ClickableUsername';
import { getDistance } from '@/utils/geoDistance';
import type { TransactionCreate } from '../types/transaction';

// Google Maps API key
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
// Use URL approach for placeholder image
const placeholderImageUrl = '/image-placeholder.png';

declare global {
  interface Window {
    google: any;
    initDetailMap: () => void;
  }
}

export const ListingDetailPage = () => {
  const { token } = useSelector((state: RootState) => state.auth);
  const { user } = useSelector((state: RootState) => state.auth);
  const { id } = useParams<{ id: string }>();
  // Remove unused navigate variable
  const [messageInput, setMessageInput] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [sellerDetail, setSellerDetail] = useState<UserInterface | null>(null);
  const [productDetails, setProductDetails] = useState<ListingInterface | null>(
    null
  );
  const socket = useSocket();
  const sendMessageToChatURL = `${API_BASE_URL}/chats/send`;
  const dispatch = useAppDispatch();
  const watchlistStatus = useSelector((state: RootState) => state.watchlist.status);
  const watchlistError = useSelector((state: RootState) => state.watchlist.error);
  const watchlistSuccess = useSelector((state: RootState) => state.watchlist.success);
  const makeOfferStatus = useSelector((state: RootState) => state.transactions.makeOfferStatus);
  const makeOfferError = useSelector((state: RootState) => state.transactions.makeOfferError);
  const makeOfferSuccess = useSelector((state: RootState) => state.transactions.makeOfferSuccess);
  const [showWatchlistSuccess, setShowWatchlistSuccess] = useState(false);
  const [showOfferSuccess, setShowOfferSuccess] = useState(false);
  const isListingBelongsToCurrentUser = productDetails?.created_by?.user_id === user?.user_id;

  const mapRef = useRef<HTMLDivElement>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const sendMessageToSellerChat = () => {
    console.log('Sending message to seller chat...');
    const messageObjectToSend = {
      receiver_id: productDetails?.created_by.user_id,
      listing_id: productDetails?.listing_id,
      text: messageInput.trim()
    };
    fetch(sendMessageToChatURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(messageObjectToSend)
    })
      .then(response => response.json())
      .then(data => {
        const { conversation_id } = data;
        console.log('Current conversation ID:', conversation_id);
        if (socket) {
          socket.send(
            JSON.stringify({
              cmd: 'join',
              conversation_id
            })
          );
        } else {
          console.error('WebSocket is not connected. (ListingDetailPage)');
        }
      })
      .catch(err => {
        console.error('Error sending message:', err);
      });
  };

  // Add to Watchlist handler
  const handleAddToWatchlist = () => {
    if (productDetails?.listing_id) {
      dispatch(addToWatchlist(productDetails.listing_id));
    }
  };

  // Make Offer handler
  const handleMakeOffer = () => {
    if (productDetails?.listing_id && token) {
      const transactionData: TransactionCreate = {
        listing_id: parseInt(productDetails.listing_id),
      };
      
      if (offerMessage.trim()) {
        transactionData.message = offerMessage.trim();
      }
      
      dispatch(makeOffer({ transactionData, token }));
    }
  };

  // Show watchlist success message temporarily
  useEffect(() => {
    if (watchlistSuccess) {
      setShowWatchlistSuccess(true);
      const timer = setTimeout(() => {
        setShowWatchlistSuccess(false);
        dispatch(clearWatchlistStatus());
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [watchlistSuccess, dispatch]);

  // Show offer success message temporarily
  useEffect(() => {
    if (makeOfferSuccess) {
      setShowOfferSuccess(true);
      setOfferMessage(''); // Clear input field
      const timer = setTimeout(() => {
        setShowOfferSuccess(false);
        dispatch(clearMakeOfferStatus());
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [makeOfferSuccess, dispatch]);

  // Reset success message when product changes
  useEffect(() => {
    setShowWatchlistSuccess(false);
    setShowOfferSuccess(false);
    dispatch(clearWatchlistStatus());
    dispatch(clearMakeOfferStatus());
  }, [productDetails?.listing_id, dispatch]);

  // Fix the mapping between API response and our UserInterface
  useEffect(() => {
    const fetchProductDetails = async () => {
      try {
        const data = await fetch(`${API_BASE_URL}/get_listings/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const json = await data.json();
        setProductDetails(json);
        
        // Map API response properties to our UserInterface properties
        if (json.created_by) {
          setSellerDetail({
            user_id: json.created_by.user_id,
            firstName: json.created_by.first_name,
            lastName: json.created_by.last_name,
            email: json.created_by.email,
            password: '' // Required by interface but not used
          });
        }
      } catch (err) {
        setError('Failed to load listing details. Please try again later.');
        console.error('Error fetching listing details:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (token) {
      fetchProductDetails();
    }
  }, [id, token]);

  // Get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting user location:", error);
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
    }
  }, []);

  // Update the map initialization part
  useEffect(() => {
    if (!productDetails?.geo_location?.latitude || !productDetails?.geo_location?.longitude) {
      console.log("No geo_location data available for this listing");
      return;
    }

    // Debug log
    console.log("Attempting to initialize map with location:", {
      lat: productDetails.geo_location.latitude,
      lng: productDetails.geo_location.longitude
    });

    const loadGoogleMapsScript = () => {
      // Check if the API is already loaded
      if (window.google && window.google.maps) {
        console.log("Google Maps API already loaded, initializing map");
        initializeMap();
        return;
      }

      console.log("Loading Google Maps API script");
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initDetailMap`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        console.error("Error loading Google Maps API script");
      };

      // Define the global callback function
      window.initDetailMap = () => {
        console.log("Google Maps API loaded, initializing map");
        initializeMap();
      };
      
      document.head.appendChild(script);
      
      return () => {
        if (script.parentNode) {
          document.head.removeChild(script);
        }
        window.initDetailMap = () => {}; // Cleanup
      };
    };

    const initializeMap = () => {
      if (!mapRef.current) {
        console.error("Map container ref is not available");
        return;
      }
      
      if (!productDetails?.geo_location) {
        console.error("Listing geo_location is missing");
        return;
      }

      try {
        const position = {
          lat: productDetails.geo_location.latitude,
          lng: productDetails.geo_location.longitude
        };
        
        console.log("Creating map with position:", position);
        
        // Ensure the map container has height
        mapRef.current.style.height = '350px';
        
        const mapOptions = {
          center: position,
          zoom: 14,
          mapTypeControl: true,
          fullscreenControl: true
        };
        
        const map = new window.google.maps.Map(mapRef.current, mapOptions);
        
        // Add marker for listing location
        new window.google.maps.Marker({
          position,
          map,
          title: productDetails.title || 'Listing Location'
        });
        
        console.log("Map initialized successfully");
      } catch (error) {
        console.error("Error initializing map:", error);
      }
    };

    loadGoogleMapsScript();
  }, [productDetails]);

  if (isLoading) {
    return (
      <div className="listing-detail-page">
        <div className="loading-message">Loading listing details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="listing-detail-page">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!productDetails) {
    return (
      <div className="listing-detail-page">
        <div className="error-message">Listing not found.</div>
      </div>
    );
  }

  // Fix the component structure
  return (
    <div className="listing-detail-page">
      <div className="listing-content-wrap">
        {/* Image section */}
        <div className="listing-detail-container">
          <div className="listing-detail-image">
            <Carousel>
              <CarouselContent>
                {productDetails.images && productDetails.images.length > 0 ? (
                  productDetails.images.map((img, idx) => (
                    <CarouselItem key={`${img}_${idx}`} className='carousel-item'>
                      <img
                        src={img || placeholderImageUrl}
                        alt={productDetails.title}
                        onError={e => {
                          const target = e.target as HTMLImageElement;
                          target.src = placeholderImageUrl;
                        }}
                      />
                    </CarouselItem>
                  ))
                ) : (
                  <CarouselItem>
                    <img
                      src={placeholderImageUrl}
                      alt="Placeholder"
                    />
                  </CarouselItem>
                )}
              </CarouselContent>
              <CarouselPrevious className="carousel-arrow carousel-prev" />
              <CarouselNext className="carousel-arrow carousel-next" />
            </Carousel>
          </div>
        </div>

        {/* Sidebar section */}
        <div className="side-bar">
          {/* Seller detail card */}
          <div className="seller-detail">
            <div className="seller-card">
              <div className="seller-header">
                <h3>
                  {sellerDetail?.user_id && sellerDetail?.firstName && sellerDetail?.lastName ? (
                    <ClickableUsername
                      userId={sellerDetail.user_id}
                      firstName={sellerDetail.firstName}
                      lastName={sellerDetail.lastName}
                    />
                  ) : (
                    "Unknown Seller"
                  )}
                </h3>
              </div>
              <div className="seller-content">
                <p>{sellerDetail?.email}</p>
                
                {/* Add seller rating section */}
                <div className="seller-rating">
                  <h4>Seller Rating</h4>
                  <div className="stars">
                    {/* Simple 5 stars display - in a real app, this would be dynamic */}
                    <span className="star filled">★</span>
                    <span className="star filled">★</span>
                    <span className="star filled">★</span>
                    <span className="star filled">★</span>
                    <span className="star filled">★</span>
                  </div>
                  <div className="rating-count">5/5 (1 review)</div>
                </div>
              </div>
            </div>
          </div>

          <div className="action-bar">
            <button className="watchlist-button" onClick={handleAddToWatchlist} disabled={watchlistStatus === 'loading'}>
              {watchlistStatus === 'loading' ? 'Adding...' : 'Watchlist'}
            </button>
            {showWatchlistSuccess && <div className="success-message">Added to watchlist!</div>}
            {watchlistError && <div className="error-message">{watchlistError}</div>}
            
            {!isListingBelongsToCurrentUser && (
              <>
                {/* Make Offer section */}
                <div className="message-container make-offer-container">
                  <input
                    type="text"
                    placeholder="Sent an offer to seller"
                    className="message-input"
                    value={offerMessage}
                    onChange={e => setOfferMessage(e.target.value)}
                  />
                  <button 
                    className="action-button make-offer-button" 
                    onClick={handleMakeOffer}
                    disabled={makeOfferStatus === 'loading'}
                  >
                    {makeOfferStatus === 'loading' ? 'Sending...' : 'MAKE OFFER'}
                  </button>
                </div>
                {showOfferSuccess && <div className="success-message">Offer sent successfully!</div>}
                {makeOfferError && <div className="error-message">{makeOfferError}</div>}

                {/* Message input */}
                <div className="message-container">
                  <input
                    type="text"
                    placeholder="Type your message..."
                    className="message-input"
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && messageInput.trim()) {
                        sendMessageToSellerChat();
                        setMessageInput('');
                      }
                    }}
                  />
                  <button
                    className='send-button'
                    onClick={() => {
                      if (messageInput.trim()) {
                        sendMessageToSellerChat();
                        setMessageInput('');
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Info cards row */}
      <div className="info-cards-row">
        {/* Basic info card */}
        <div className="basic-info-card">
          <h2 className="listing-title">{productDetails.title}</h2>
          <div className="price">{productDetails.price} €</div>
          <div className="location-date-info">
            <div className="info-item">
              <span className="info-icon">📍</span>
              <span>{productDetails.location}</span>
            </div>
            <div className="info-item">
              <span className="info-icon">📅</span>
              <span>{productDetails.created_at && new Date(productDetails.created_at).toLocaleDateString('de-DE')}</span>
            </div>
          </div>
        </div>
        
        {/* More details card */}
        <div className="detail-info-card">
          <h2>More Details</h2>
          <div className="detail-row"><span className="label">Description:</span> <span>{productDetails.description}</span></div>
          <div className="detail-row"><span className="label">Category:</span> <span>{productDetails.category}</span></div>
          <div className="detail-row"><span className="label">Condition:</span> <span>{productDetails.condition}</span></div>
          <div className="detail-row"><span className="label">Expiration Date:</span> <span>{productDetails.expiration_date}</span></div>
          {productDetails.subcategory && (
            <div className="detail-row"><span className="label">Subcategory:</span> <span>{productDetails.subcategory}</span></div>
          )}
        </div>
      </div>
      
      {/* Location section with map */}
      <div className="location-card">
        <h2>Location</h2>
        <div className="location-map-container">
          <div 
            ref={mapRef} 
            className="map"
            style={{ 
              width: '100%',
              height: '350px',
              borderRadius: '8px',
              border: '1px solid #eee'
            }}
          ></div>
          {userLocation && productDetails?.geo_location && (
            <div className="distance-info">
              <span className="distance-icon">📍</span>
              <span className="distance-text">
                {getDistance(
                  userLocation.lat,
                  userLocation.lng,
                  productDetails.geo_location.latitude,
                  productDetails.geo_location.longitude
                ).toFixed(2)} km from your location
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListingDetailPage;