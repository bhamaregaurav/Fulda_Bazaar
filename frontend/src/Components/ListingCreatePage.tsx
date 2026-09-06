import '../Style/pages/listing-create-page.scss'; // Import your styles for the create listing page

import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';

const removeIconUrl = "/remove.svg";
const starIconUrl = "/star.svg";
import type { RootState } from '../store/store';
import { API_BASE_URL } from '../../config';
import { getAvailableCategories } from '@/utils';
import { categoryMap } from '../../constants';

// Google Maps API key
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

const initialForm = {
  title: '',
  description: '',
  category: '', // store the category name
  subcategory_id: '',
  listing_type: 'Sell', // Default value
  price: 0,
  negotiable: false,
  condition: 'New',
  location: '',
  latitude: 0,
  longitude: 0
};

const conditions = ['New', 'Like New', 'Good', 'Fair', 'Poor'];
const listingTypes = ['Sell', 'Buy', 'Exchange', 'Borrow/Lend', 'Free'];

export const ListingCreatePage = () => {
  const updateListingURL = `${API_BASE_URL}/users/update/listings/`;

  const navigate = useNavigate();
  const { token } = useSelector((state: RootState) => state.auth);
  const [formData, setFormData] = useState(initialForm);
  const [selectedFiles, setSelectedFiles] = useState<(File | any)[]>([]);
  const [hasNewImages, setHasNewImages] = useState(false); // Track if new images were added
  const [existingImages, setExistingImages] = useState<any[]>([]); // Store existing images separately
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState([]);

  // Map related refs and states
  const mapRef = useRef<HTMLDivElement>(null);

  // @ts-ignore - These state variables are used in the Google Maps initialization
  // They appear unused to TypeScript but are used in callback functions and event handlers
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [marker, setMarker] = useState<google.maps.Marker | null>(null);
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null);

  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  // Load Google Maps API
  useEffect(() => {
    const loadGoogleMapsScript = () => {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initMap`;
      script.async = true;
      script.defer = true;

      // Define the global callback function
      window.initMap = () => {
        initializeMap();
      };

      document.head.appendChild(script);

      return () => {
        document.head.removeChild(script);
        window.initMap = () => { }; // Assign an empty function instead of deleting
      };
    };

    loadGoogleMapsScript();
  }, []);

  // Initialize the map with a marker
  const initializeMap = () => {
    if (!mapRef.current) return;

    // Default center (can be set to a university location)
    const center = { lat: 50.5558, lng: 9.6808 }; // Fulda, Germany coordinates

    // Create the map
    const googleMap = new window.google.maps.Map(mapRef.current, {
      center,
      zoom: 13,
      mapTypeControl: false,
    });

    setMap(googleMap);

    // Add a marker
    const newMarker = new window.google.maps.Marker({
      position: center,
      map: googleMap,
      draggable: true,
      title: 'Listing Location'
    });

    setMarker(newMarker);

    // Add click listener to the map
    googleMap.addListener('click', (e: any) => {
      const latLng = e.latLng;
      newMarker.setPosition(latLng);

      // Update form data with new coordinates
      setFormData(prev => ({
        ...prev,
        latitude: latLng.lat(),
        longitude: latLng.lng()
      }));

      // Reverse geocode to get address
      reverseGeocode(latLng.lat(), latLng.lng());
    });

    // Add drag listener to the marker
    newMarker.addListener('dragend', () => {
      const position = newMarker.getPosition();
      if (position) {
        setFormData(prev => ({
          ...prev,
          latitude: position.lat(),
          longitude: position.lng()
        }));

        // Reverse geocode to get address
        reverseGeocode(position.lat(), position.lng());
      }
    });

    // Add a search box
    if (window.google.maps.places) {
      setTimeout(() => {
        const input = document.getElementById('map-search-input') as HTMLInputElement;
        if (input) {
          const searchBoxInstance = new window.google.maps.places.SearchBox(input);
          setSearchBox(searchBoxInstance);

          // Bias the search box results toward the current map viewport
          googleMap.addListener('bounds_changed', () => {
            searchBoxInstance.setBounds(googleMap.getBounds() as google.maps.LatLngBounds);
          });

          // Listen for places selection
          searchBoxInstance.addListener('places_changed', () => {
            const places = searchBoxInstance.getPlaces();
            if (!places || places.length === 0) return;

            // Get the first place
            const place = places[0];
            if (!place.geometry || !place.geometry.location) return;

            // Update the map
            googleMap.setCenter(place.geometry.location);
            googleMap.setZoom(15);

            // Update the marker
            newMarker.setPosition(place.geometry.location);

            // Update form data
            setFormData(prev => ({
              ...prev,
              latitude: place.geometry.location.lat(),
              longitude: place.geometry.location.lng(),
              location: place.formatted_address || ''
            }));
          });
        }
      }, 1000); // Add a small delay to ensure the input is in the DOM
    }

    // If we have coordinates in the form data, center the map there
    if (formData.latitude && formData.longitude) {
      const position = new window.google.maps.LatLng(formData.latitude, formData.longitude);
      googleMap.setCenter(position);
      newMarker.setPosition(position);
    }
  };

  // Reverse geocode coordinates to get address
  const reverseGeocode = (lat: number, lng: number) => {
    if (!window.google) return;

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results: any, status: string) => {
      if (status === 'OK' && results[0]) {
        setFormData(prev => ({
          ...prev,
          location: results[0].formatted_address
        }));
      }
    });
  };

  const removeImage = (indexToRemove: number) => {
    // Check if we're removing an existing image or a new upload
    const fileToRemove = selectedFiles[indexToRemove];
    
    // Remove from selectedFiles array
    setSelectedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
    
    // If removing from existingImages, update that state too
    if (!(fileToRemove instanceof File) && existingImages.length > 0) {
      setExistingImages(prev => prev.filter((_, index) => index !== indexToRemove));
      
      // If all existing images are removed and no new files added, set hasNewImages to true
      // This signals to the backend that we want to clear images
      if (existingImages.length === 1 && selectedFiles.length === 1) {
        setHasNewImages(true);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const total = selectedFiles.length + files.length;
      if (total > 7) {
        setError('Maximum 7 images allowed');
        return;
      }
      setSelectedFiles(prev => [...prev, ...files]);
      setHasNewImages(true); // Mark that new images were added
    }
  };

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setIsLoading(true);
        const availableCategories = await getAvailableCategories();
        setCategories(availableCategories);
        console.log('Categories', availableCategories);
        console.log(categories);
      } catch (err) {
        setError('Failed to load categories');
        console.error('Error loading categories:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    const fetchListing = async () => {
      console.log('Fetching listing with ID:', editId);
      if (!editId || !token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/get_listings/${editId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await res.json();
        console.log('Fetched listing data:', data);
        setFormData({
          ...data,
          latitude: parseFloat(data.geo_location.latitude),
          longitude: parseFloat(data.geo_location.longitude),
        });

        // If there are images, store them separately for display
        if (data.images && data.images.length > 0) {
          setExistingImages(data.images);
          // Display existing images in the UI
          setSelectedFiles(data.images);
        }
      } catch (err) {
        console.error('Error fetching listing:', err);
        setError('Failed to fetch listing data');
      }
    };

    fetchListing();
  }, [editId, token]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData((prev) => ({ ...prev, [name]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    const finalFormData = new FormData();

    // Append text fields
    Object.entries(formData).forEach(([key, value]) => {
      if (key === 'category') {
        // For category, use the name instead of ID
        finalFormData.append('category_id', categoryMap[value as string].toString());
      } else {
        finalFormData.append(key, value?.toString() || '');
      }
    });

    // Handle images
    if (editId) {
      // For editing: If we have existing images and no new files, pass the existing image URLs
      if (existingImages.length > 0 && !hasNewImages) {
        finalFormData.append('images', existingImages[0].image_path || '');
      } else if (hasNewImages) {
        // If we have new files, send all of them as new_images
        selectedFiles.forEach(file => {
          if (file instanceof File) {
            finalFormData.append('new_images', file);
          }
        });
      }
    } else {
      // For creating: Add all files
      selectedFiles.forEach(file => {
        if (file instanceof File) {
          finalFormData.append('images', file);
        }
      });
    }

    try {
      const url = editId
        ? `${updateListingURL}${editId}`
        : `${API_BASE_URL}/listings`;

      const method = editId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: finalFormData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Success:', result);
        setSuccessMsg(
          editId ? 'Listing updated successfully!' : 'Listing created successfully!'
        );
        setTimeout(() => {
          setTimeout(() => navigate(`/listing/${result.listing_id}`), 1000);
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Something went wrong');
        console.error('Error:', errorData);
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Something went wrong while submitting the form');
    } finally {
      setIsLoading(false);
    }
  };

  const changeFeaturedImage = (index: number) => {
    if (index === 0) return; // Already featured

    const newFiles = [...selectedFiles];
    const temp = newFiles[0];
    newFiles[0] = newFiles[index];
    newFiles[index] = temp;
    setSelectedFiles(newFiles);
  };

  return (
    <div className="create-listing-page">
      <h1 className="create-listing-header">
        {editId ? 'Edit Listing' : 'Create New Listing'}
      </h1>
      {error && <p className="error-message">{error}</p>}
      <form className="create-listing-form" onSubmit={handleSubmit}>
        <div className="create-listing-form-input-container">
          <label htmlFor="title" className="create-listing-form-input-title">
            Title *
          </label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="Enter listing title"
            required
          />
        </div>

        <div className="create-listing-form-input-container">
          <label htmlFor="description" className="create-listing-form-input-title">
            Description *
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            placeholder="Enter listing description"
            required
          />
        </div>

        <div className="create-listing-form-input-container">
          <label htmlFor="category" className="create-listing-form-input-title">
            Category *
          </label>
          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
          >
            <option value="">Select a category</option>
            {categories.map((cat: string) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="create-listing-form-input-container">
          <label className="create-listing-form-input-title">Listing Type *</label>
          <div className="listing-type-options">
            {listingTypes.map(type => (
              <label key={type} className="tab-group">
                <input
                  type="radio"
                  name="listing_type"
                  value={type}
                  checked={formData.listing_type === type}
                  onChange={handleChange}
                />
                <span className="name">{type}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="create-listing-form-input-container">
          <label className="create-listing-form-input-title">
            Price (€) {formData.listing_type !== 'Free' ? '*' : '(Not required for free items)'}
          </label>
          <div className="create-listing-form-input-price-container">
            <input
              type="number"
              name="price"
              value={formData.price || ''}
              onChange={handleChange}
              placeholder="e.g. 100"
              disabled={formData.listing_type === 'Free'}
              required={formData.listing_type !== 'Free'}
            />
            <div className="checkbox-wrapper-46">
              <input
                className="inp-cbx"
                id="cbx-46"
                type="checkbox"
                name="negotiable"
                checked={formData.negotiable}
                onChange={handleChange}
              />
              <label className="cbx" htmlFor="cbx-46">
                <span>
                  <svg width="12px" height="10px" viewBox="0 0 12 10">
                    <polyline points="1.5 6 4.5 9 10.5 1"></polyline>
                  </svg>
                </span>
              </label>
              <span className='create-listing-form-negotiable'>Negotiable</span>
            </div>
          </div>
        </div>

        <div className="create-listing-form-input-container">
          <label className="create-listing-form-input-title">Condition *</label>
          <div className="condition-options">
            {conditions.map(cond => (
              <label key={cond} className="tab-group">
                <input
                  type="radio"
                  name="condition"
                  value={cond}
                  checked={formData.condition === cond}
                  onChange={handleChange}
                />
                <span className="name">{cond}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="create-listing-form-input-container">
          <label htmlFor="location" className="create-listing-form-input-title">
            Location *
          </label>
          <input
            type="text"
            name="location"
            value={formData.location || ''}
            onChange={handleChange}
            placeholder="e.g. Fulda, Germany"
            required
          />
        </div>

        <div className="create-listing-form-input-container">
          <label className="create-listing-form-input-title">Coordinates</label>
          <div className="coordinates-container">
            <div className="coordinates-item">
              <input
                type="number"
                name="latitude"
                value={formData.latitude || ''}
                onChange={handleChange}
                placeholder="Latitude e.g. 37.7749"
                step="any"
              />
              <input
                type="number"
                name="longitude"
                value={formData.longitude || ''}
                onChange={handleChange}
                placeholder="Longitude e.g. -122.4194"
                step="any"
              />
            </div>
          </div>
        </div>

        {/* Map for selecting location */}
        <p className="map-instructions">
          You can select the location by clicking on the map. The coordinates will be updated automatically.
        </p>

        <div className="location-map-container">
          <input
            id="map-search-input"
            className="map-search-input"
            type="text"
            placeholder="Search for a location..."
          />
          <div ref={mapRef} className="location-map"></div>
          <div className="map-overlay">
            <p className="map-instructions">Click anywhere on the map to set your location</p>
          </div>
        </div>

        <label className="custom-file-upload" htmlFor="file">
          <div className="icon">
            <svg xmlns="http://www.w3.org/2000/svg" fill="" viewBox="0 0 24 24">
              <g stroke-width="0" id="SVGRepo_bgCarrier"></g>
              <g
                stroke-linejoin="round"
                stroke-linecap="round"
                id="SVGRepo_tracerCarrier"
              ></g>
              <g id="SVGRepo_iconCarrier">
                {' '}
                <path
                  fill=""
                  d="M10 1C9.73478 1 9.48043 1.10536 9.29289 1.29289L3.29289 7.29289C3.10536 7.48043 3 7.73478 3 8V20C3 21.6569 4.34315 23 6 23H7C7.55228 23 8 22.5523 8 22C8 21.4477 7.55228 21 7 21H6C5.44772 21 5 20.5523 5 20V9H10C10.5523 9 11 8.55228 11 8V3H18C18.5523 3 19 3.44772 19 4V9C19 9.55228 19.4477 10 20 10C20.5523 10 21 9.55228 21 9V4C21 2.34315 19.6569 1 18 1H10ZM9 7H6.41421L9 4.41421V7ZM14 15.5C14 14.1193 15.1193 13 16.5 13C17.8807 13 19 14.1193 19 15.5V16V17H20C21.1046 17 22 17.8954 22 19C22 20.1046 21.1046 21 20 21H13C11.8954 21 11 20.1046 11 19C11 17.8954 11.8954 17 13 17H14V16V15.5ZM16.5 11C14.142 11 12.2076 12.8136 12.0156 15.122C10.2825 15.5606 9 17.1305 9 19C9 21.2091 10.7909 23 13 23H20C22.2091 23 24 21.2091 24 19C24 17.1305 22.7175 15.5606 20.9844 15.122C20.7924 12.8136 18.858 11 16.5 11Z"
                  clip-rule="evenodd"
                  fill-rule="evenodd"
                ></path>{' '}
              </g>
            </svg>
          </div>
          <div className="custom-file-upload-text">
            <span>Click to upload image (max 7)</span>
            <span className="file-count">
              {selectedFiles.length > 0
                ? `${selectedFiles.length} image(s) selected`
                : ' (No images selected)'}
            </span>
          </div>
          <input
            type="file"
            name="images"
            id="file"
            multiple
            accept="image/*"
            onChange={handleFileChange}
          />
        </label>

        {selectedFiles.length > 0 && (
          <div className="file-preview-container">
            {selectedFiles.map((file, index) => (
              <div className="file-preview-item" key={index}>
                {index === 0 && (
                  <img
                    src={starIconUrl}
                    alt="Featured"
                    className="featured-icon"
                  />
                )}
                <img
                  className="file-preview-image"
                  src={typeof file === 'string' ? file : URL.createObjectURL(file)}
                  alt={`Preview ${index}`}
                  onClick={() => changeFeaturedImage(index)}
                />
                <button
                  type="button"
                  className="remove-button"
                  onClick={() => removeImage(index)}
                >
                  <img src={removeIconUrl} alt="Remove" />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          className="create-listing-form-submit-button"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Creating...' : editId ? 'Update Add' : 'Create Add'}
        </button>

        {successMsg && <p className="success-msg">{successMsg}</p>}
      </form>
    </div>
  );
};

export default ListingCreatePage;
