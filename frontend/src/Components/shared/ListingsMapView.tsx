import React, { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store/store';
import type { ProductsState, ListingInterface } from '@/types/listing';
import { useAppDispatch } from '@/store';
import { fetchListings } from '@/features/products/productsSlice';
import { useNavigate } from 'react-router-dom';
import '../../Style/pages/map-view.scss';
import { MapPin, Search, Loader } from 'lucide-react';

// Google Maps API key
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Define a more comprehensive window interface for TypeScript
declare global {
  interface Window {
    google: any;
    initMap: () => void;
    googleMapsLoaded: boolean;
  }
}

// Custom map styling
const mapStyles = [
  {
    featureType: "poi",
    elementType: "labels",
    stylers: [{ visibility: "off" }]
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#e9e9e9" }, { lightness: 17 }]
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#f5f5f5" }, { lightness: 20 }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry.fill",
    stylers: [{ color: "#ffffff" }, { lightness: 17 }]
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#ffffff" }, { lightness: 29 }, { weight: 0.2 }]
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }, { lightness: 18 }]
  },
  {
    featureType: "road.local",
    elementType: "geometry",
    stylers: [{ color: "#ffffff" }, { lightness: 16 }]
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#f2f2f2" }, { lightness: 19 }]
  }
];

// App theme colors
const APP_PRIMARY_COLOR = '#00b37e';  // Green theme color
const APP_SECONDARY_COLOR = '#e0e0e0'; // For non-active elements

interface MapViewProps {
  maxDistance?: number;
}

// Change the default radius from 10km to 5km
export const ListingsMapView: React.FC<MapViewProps> = ({ maxDistance = 5 }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState<string | null>(null);
  const [radiusCircle, setRadiusCircle] = useState<google.maps.Circle | null>(null);
  const [currentRadius, setCurrentRadius] = useState(maxDistance);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(null);

  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { items: listings, status: listingsStatus } = useSelector(
    (state: RootState) => state.products
  ) as ProductsState;

  // Update slider gradient background
  const updateSliderBackground = () => {
    if (sliderRef.current) {
      const min = 1;
      const max = 50;
      const val = currentRadius;
      const percentage = ((val - min) / (max - min)) * 100;

      sliderRef.current.style.background = `linear-gradient(to right, 
        ${APP_PRIMARY_COLOR} 0%, 
        ${APP_PRIMARY_COLOR} ${percentage}%, 
        ${APP_SECONDARY_COLOR} ${percentage}%, 
        ${APP_SECONDARY_COLOR} 100%)`;
    }
  };

  // Update slider when radius changes or component mounts
  useEffect(() => {
    updateSliderBackground();
  }, [currentRadius]);

  // Add an additional useEffect for initializing slider on component mount
  useEffect(() => {
    // Initialize the slider background on component mount
    setTimeout(() => {
      updateSliderBackground();
    }, 100);
  }, []);

  // Load Google Maps API
  useEffect(() => {
    const loadGoogleMapsScript = () => {
      // If script is already loaded, initialize map
      if (window.google && window.google.maps) {
        window.googleMapsLoaded = true;
        setMapLoading(false);
        return;
      }

      try {
        // Check if script is already being loaded
        if (document.querySelector('script[src*="maps.googleapis.com/maps/api"]')) {
          console.log("Google Maps script is already loading");

          // Set a timeout to check if the API has loaded
          const checkGoogleMapsLoaded = setInterval(() => {
            if (window.google && window.google.maps) {
              clearInterval(checkGoogleMapsLoaded);
              window.googleMapsLoaded = true;
              setMapLoading(false);
            }
          }, 100);

          // Stop checking after 10 seconds
          setTimeout(() => {
            clearInterval(checkGoogleMapsLoaded);
            if (!window.google || !window.google.maps) {
              setMapError("Timeout loading Google Maps API");
              setMapLoading(false);
            }
          }, 10000);

          return;
        }

        console.log("Loading Google Maps script");
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&callback=initMap`;
        script.async = true;
        script.defer = true;
        script.onerror = () => {
          setMapError("Failed to load Google Maps API");
          setMapLoading(false);
        };

        // Define the global callback function
        window.initMap = () => {
          console.log('Google Maps API loaded');
          window.googleMapsLoaded = true;
          setMapLoading(false);
        };

        document.head.appendChild(script);

        return () => {
          // Cleanup
          if (script.parentNode) {
            document.head.removeChild(script);
          }
        };
      } catch (error) {
        console.error("Error loading Google Maps script:", error);
        setMapError("Error loading map");
        setMapLoading(false);
      }
    };

    loadGoogleMapsScript();
  }, []);

  // Get user's location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          setLocationLoading(false);

          // REMOVED: Don't fetch listings automatically here to prevent infinite loop
          // The listings should already be available from MainPage component
        },
        (error) => {
          console.error("Error getting user location:", error);
          setLocationLoading(false);

          // Show appropriate error message based on the error code
          switch (error.code) {
            case error.PERMISSION_DENIED:
              setMapError("Location access denied. Please enable location permissions in your browser settings.");
              break;
            case error.POSITION_UNAVAILABLE:
              setMapError("Location information is unavailable. Please try again later.");
              break;
            case error.TIMEOUT:
              setMapError("Request to get location timed out. Please try again.");
              break;
            default:
              setMapError("An unknown error occurred while trying to access your location.");
          }
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
      setLocationLoading(false);
      setMapError("Your browser doesn't support geolocation. Please try a different browser.");
    }
  }, []); // Only run once on component mount

  // Initialize map when user location is available and Google Maps API is loaded
  useEffect(() => {
    const initializeMap = () => {
      if (!mapRef.current || !window.google || !window.google.maps) {
        return;
      }

      if (userLocation) {
        try {
          // Create the map
          const googleMap = new window.google.maps.Map(mapRef.current, {
            center: userLocation,
            zoom: 13,
            mapTypeControl: true,
            fullscreenControl: true,
            streetViewControl: false,
            mapTypeControlOptions: {
              position: window.google.maps.ControlPosition.TOP_RIGHT,
            },
            styles: mapStyles // Use custom map styling
          });

          setMap(googleMap);

          // Create info window for markers
          const newInfoWindow = new window.google.maps.InfoWindow({
            pixelOffset: new window.google.maps.Size(0, -5),
            disableAutoPan: false
          });
          setInfoWindow(newInfoWindow);

          // Add user marker
          new window.google.maps.Marker({
            position: userLocation,
            map: googleMap,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: APP_PRIMARY_COLOR, // Use app primary color
              fillOpacity: 1,
              strokeColor: 'white',
              strokeWeight: 2,
            },
            title: 'Your Location',
            zIndex: 1000, // Make sure user marker is above other markers
          });

          // Add radius circle
          const circle = new window.google.maps.Circle({
            strokeColor: APP_PRIMARY_COLOR, // Use app primary color
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: APP_PRIMARY_COLOR, // Use app primary color
            fillOpacity: 0.1,
            map: googleMap,
            center: userLocation,
            radius: currentRadius * 1000, // Convert km to meters
            clickable: false,
          });

          setRadiusCircle(circle);

          // Add map click listener to close info window
          googleMap.addListener('click', () => {
            if (newInfoWindow) {
              newInfoWindow.close();
            }
          });

          // Add listings markers if they exist
          addMarkers(googleMap, newInfoWindow, listings);

          console.log("Map initialized successfully");
        } catch (error) {
          console.error("Error initializing map:", error);
          setMapError("Failed to initialize map");
        }
      }
    };

    // Initialize map when both location and maps API are ready
    if (!locationLoading && !mapLoading && userLocation && !map) {
      initializeMap();
    }
  }, [locationLoading, mapLoading, userLocation, listings]);

  // Update markers when listings change
  useEffect(() => {
    if (map && infoWindow && listings) {
      addMarkers(map, infoWindow, listings);
    }
  }, [map, infoWindow, listings]);

  // Function to add listing markers
  const addMarkers = (map: google.maps.Map, infoWindow: google.maps.InfoWindow, listings: ListingInterface[]) => {
    // Remove existing markers
    markers.forEach(marker => marker.setMap(null));

    const newMarkers: google.maps.Marker[] = [];

    listings.forEach((listing) => {
      if (listing.geo_location && listing.geo_location.latitude && listing.geo_location.longitude) {
        const position = {
          lat: listing.geo_location.latitude,
          lng: listing.geo_location.longitude
        };

        const marker = new window.google.maps.Marker({
          position,
          map,
          title: listing.title,
          animation: window.google.maps.Animation.DROP,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#FF5722', // Keep the orange for listings to differentiate
            fillOpacity: 0.9,
            strokeColor: 'white',
            strokeWeight: 2,
          }
        });

        marker.addListener('click', () => {
          // Create info window content
          const content = `
            <div class="info-window">
              <div class="info-window-image">
                <img src="${listing.images[0] || '/image-placeholder.png'}" alt="${listing.title}">
              </div>
              <div class="info-window-content">
                <h3>${listing.title}</h3>
                <p class="price">€${listing.price}</p>
                ${listing.distance !== undefined ? `<p class="distance"><small>${listing.distance.toFixed(2)} km away</small></p>` : ''}
                <button id="view-details-${listing.listing_id}" class="view-button">View Details</button>
              </div>
            </div>
          `;

          infoWindow.setContent(content);
          infoWindow.open(map, marker);

          // Add click listener after info window is shown
          setTimeout(() => {
            const button = document.getElementById(`view-details-${listing.listing_id}`);
            if (button) {
              button.addEventListener('click', () => {
                navigate(`/listing/${listing.listing_id}`);
              });
            }
          }, 10);
        });

        newMarkers.push(marker);
      }
    });

    setMarkers(newMarkers);
  };

  // Update radius when slider changes
  const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const radius = parseInt(e.target.value);
    setCurrentRadius(radius);

    // Update the circle radius
    if (radiusCircle) {
      radiusCircle.setRadius(radius * 1000); // Convert km to meters
    }

    updateSliderBackground();
  };

  // Apply radius filter
  const applyRadiusFilter = () => {
    if (userLocation) {
      dispatch(fetchListings({
        query: "",
        category_id: 0,
        subcategory_id: 0,
        min_price: '',
        max_price: '',
        condition: "",
        location: "",
        latitude: userLocation.lat,
        longitude: userLocation.lng,
        max_distance: currentRadius
      }));
    }
  };

  // Show loading state
  if (locationLoading || mapLoading) {
    return (
      <div className="map-loading">
        <div className="loading-content">
          <Loader className="loading-spinner" size={32} />
          <p>Loading map...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (mapError || !userLocation) {
    return (
      <div className="map-error">
        <div className="error-content">
          <MapPin size={32} />
          <p>{mapError || "Unable to get your location. Please enable location services and refresh the page."}</p>
          <button onClick={() => window.location.reload()} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="map-container">
      <div className="map-controls">
        <div className="radius-control">
          <label htmlFor="radius-slider">Search Radius: <strong>{currentRadius} km</strong></label>
          <input
            id="radius-slider"
            ref={sliderRef}
            type="range"
            min="1"
            max="50"
            value={currentRadius}
            onChange={handleRadiusChange}
            className="radius-slider"
          />
          <button onClick={applyRadiusFilter} className="apply-radius">
            <Search size={16} /> Apply
          </button>
        </div>
        <div className="results-info">
          <strong>{listings.length}</strong> listings
          {listingsStatus === 'loading' && <Loader className="loading-spinner-small" size={16} />}
        </div>
      </div>
      <div ref={mapRef} className="google-map"></div>
    </div>
  );
}; 
