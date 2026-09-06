import '../Style/pages/main-page.scss';
import type { ListingInterface, ProductsState } from '../types/listing';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { fetchListings } from '../features/products/productsSlice';
import type { RootState } from '../store/store';
import { useAppDispatch } from '../store';
import { Button } from './ui/button';
import { FilterPanel } from './shared/FilterPanel';
import { categoryMap, SORT_OPTIONS } from '../../constants';
import { getDistance } from '@/utils/geoDistance';
import { ListingsMapView } from './shared/ListingsMapView';
import { Sliders } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from './ui/dropdown-menu';

// Use URL approach for placeholder image
const placeholderImageUrl = '/image-placeholder.png';

export type SortOptionType = keyof typeof SORT_OPTIONS;

const LISTING_VIEWING_TYPE = {
  GRID: 'grid',
  LIST: 'list',
  MAP: 'map'
};

export const MainPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const filterByUser = location.state?.filterByUser;
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [condition, setCondition] = useState('');
  const [category, setCategory] = useState('');
  const [listingViewType, setListingViewType] = useState(
    LISTING_VIEWING_TYPE.GRID
  );
  const [sortBy, setSortBy] = useState<SortOptionType>(SORT_OPTIONS.DATE);
  const [maxDistance, setMaxDistance] = useState<number>(5);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const {
    items: listings,
    status,
    error
  } = useSelector((state: RootState) => state.products) as ProductsState;

  // Initial fetch of listings when component mounts
  useEffect(() => {
    if (status === 'idle') {
      dispatch(
        fetchListings({
          query: '',
          category_id: category ? categoryMap[category] : 0,
          subcategory_id: 0,
          min_price: '',
          max_price: '',
          condition: '',
          location: ''
        })
      );
    }
  }, [dispatch, status, category]); // Removed searchQuery to prevent loops

  // Get user's location for distance calculation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
        },
        error => {
          console.error('Error getting location:', error);
        }
      );
    }
  }, []); // Only run this once on component mount

  const sortedListings = [...listings]; // Don't mutate the original array!

  if (sortBy === SORT_OPTIONS.PRICE_ASC) {
    sortedListings.sort((a, b) => a.price - b.price);
  } else if (sortBy === SORT_OPTIONS.PRICE_DESC) {
    sortedListings.sort((a, b) => b.price - a.price);
  } else if (sortBy === SORT_OPTIONS.DATE) {
    sortedListings.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  } else if (sortBy === SORT_OPTIONS.DISTANCE && userLocation) {
    sortedListings.sort((a, b) => {
      if (!a.geo_location || !b.geo_location) {
        return 0;
      }
      return (
        getDistance(
          a.geo_location.latitude,
          a.geo_location.longitude,
          userLocation.lat,
          userLocation.lng
        ) -
        getDistance(
          b.geo_location.latitude,
          b.geo_location.longitude,
          userLocation.lat,
          userLocation.lng
        )
      );
    });
  }

  const handleListingClick = (listing: ListingInterface) => {
    navigate(`/listing/${listing.listing_id}`);
  };

  const onSearchItem = () => {
    dispatch(
      fetchListings({
        query: searchQuery,
        category_id: category ? categoryMap[category] : 0,
        subcategory_id: 0,
        min_price: minPrice,
        max_price: maxPrice,
        condition: condition,
        location: '',
        ...(maxDistance > 0 && userLocation
          ? {
            latitude: userLocation.lat,
            longitude: userLocation.lng,
            max_distance: maxDistance
          }
          : {})
      })
    );
  };

  const onResetFilters = () => {
    setMinPrice('');
    setMaxPrice('');
    setCondition('');
    setCategory('');
    setMaxDistance(0);
    dispatch(
      fetchListings({
        query: searchQuery,
        category_id: 0,
        subcategory_id: 0,
        min_price: '',
        max_price: '',
        condition: '',
        location: ''
      })
    );
    setShowFilter(false);
  };

  // Fix min and max price types to match FilterPanel props
  const onApplyFilters = () => {
    dispatch(
      fetchListings({
        query: searchQuery,
        category_id: category ? categoryMap[category] : 0,
        subcategory_id: 0,
        min_price: minPrice,
        max_price: maxPrice,
        condition,
        location: '',
        ...(maxDistance > 0 && userLocation
          ? {
            latitude: userLocation.lat,
            longitude: userLocation.lng,
            max_distance: maxDistance
          }
          : {})
      })
    );
    setShowFilter(false);
  };

  const currentSortByTextFormat = (sortBy: keyof typeof SORT_OPTIONS) => {
    switch (sortBy) {
      case SORT_OPTIONS.PRICE_ASC:
        return 'Lowest Price';
      case SORT_OPTIONS.PRICE_DESC:
        return 'Highest Price';
      case SORT_OPTIONS.DATE:
        return 'Most recent';
      case SORT_OPTIONS.DISTANCE:
        return 'Nearest';
      default:
        return 'Sort';
    }
  }

  if (status === 'loading' && listings.length === 0) {
    return (
      <div className="main-page">
        <div className="loading-message">Loading listings...</div>
      </div>
    );
  }

  return (
    <div className="main-page">
      {filterByUser && (
        <div
          className="user-filter-notice"
          style={{
            background: '#3cb371',
            color: 'white',
            padding: '1rem',
            marginBottom: '1rem',
            borderRadius: '8px',
            textAlign: 'center'
          }}
        >
          Showing listings by {filterByUser.firstName} {filterByUser.lastName}
          <button
            onClick={() => navigate('/app', { replace: true })}
            style={{
              marginLeft: '1rem',
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              color: 'white',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Clear Filter
          </button>
        </div>
      )}
      <div className="main-page-container">
        <div className="main-page-header">
          <form
            className="main-page-header-search-form"
            onSubmit={e => {
              e.preventDefault();
              onSearchItem();
            }}
          >
            <div className="main-page-header-search">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
                <g>
                  <path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z"></path>
                </g>
              </svg>
              <input
                className="input"
                type="search"
                placeholder="Search listings..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSearchItem();
                  }
                }}
              />
            </div>
            <Button type="submit" className="search-button">
              Search
            </Button>
          </form>
        </div>

        {/* Filter section */}
        <div className="filter-container">
          <div className="filter-sort-buttons">
            <div className="filter-button-container">
              <button
                className="filter-button"
                onClick={e => {
                  e.stopPropagation(); // Prevent this from triggering the outside click handler
                  setShowFilter(!showFilter);
                }}
                aria-label="Filter listings"
              >
                <Sliders size={16} /> Filter
              </button>
              {/* Place the filter panel here, directly under the button */}
              {showFilter && (
                <div className="filter-dropdown">
                  <FilterPanel
                    minPrice={minPrice}
                    setMinPrice={setMinPrice}
                    maxPrice={maxPrice}
                    setMaxPrice={setMaxPrice}
                    condition={condition}
                    setCondition={setCondition}
                    category={category}
                    setCategory={setCategory}
                    maxDistance={maxDistance}
                    setMaxDistance={setMaxDistance}
                    onApply={onApplyFilters}
                    onClose={() => setShowFilter(false)}
                    onReset={onResetFilters}
                  />
                </div>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="sort-button"
              >{currentSortByTextFormat(sortBy)}
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>{currentSortByTextFormat(sortBy)}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setSortBy(SORT_OPTIONS.PRICE_ASC)}>Lowest Price</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortBy(SORT_OPTIONS.PRICE_DESC)}>Highest Price</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortBy(SORT_OPTIONS.DATE)}>Most recent</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortBy(SORT_OPTIONS.DISTANCE)}>Nearest</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortBy(SORT_OPTIONS.DATE)}>Reset Sort</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div
            className="view-toggle-container"
            role="group"
            aria-label="View options"
          >
            <button
              className={`view-toggle-btn ${listingViewType === LISTING_VIEWING_TYPE.GRID ? 'active' : ''
                }`}
              onClick={() => setListingViewType(LISTING_VIEWING_TYPE.GRID)}
              aria-pressed={listingViewType === LISTING_VIEWING_TYPE.GRID}
              aria-label="Grid view"
            >
              Grid
            </button>
            <button
              className={`view-toggle-btn ${listingViewType === LISTING_VIEWING_TYPE.LIST ? 'active' : ''
                }`}
              onClick={() => setListingViewType(LISTING_VIEWING_TYPE.LIST)}
              aria-pressed={listingViewType === LISTING_VIEWING_TYPE.LIST}
              aria-label="List view"
            >
              List
            </button>
            <button
              className={`view-toggle-btn ${listingViewType === LISTING_VIEWING_TYPE.MAP ? 'active' : ''
                }`}
              onClick={() => { setListingViewType(LISTING_VIEWING_TYPE.MAP); }}
              aria-pressed={listingViewType === LISTING_VIEWING_TYPE.MAP}
              aria-label="Map view"
            >
              Map
            </button>
          </div>
        </div>

        <div className="main-page-body">
          {error && <p className="error-message">{error}</p>}
          {status === 'loading' && listings.length === 0 && (
            <p className="loading-message">Loading listings...</p>
          )}

          {/* Map View */}
          {listingViewType === LISTING_VIEWING_TYPE.MAP ? (
            <div className="map-view-wrapper">
              <ListingsMapView maxDistance={maxDistance} />
            </div>
          ) : (
            /* Grid or List View */
            <div
              className={`main-page-body-listings ${listingViewType === LISTING_VIEWING_TYPE.GRID
                ? 'grid-view'
                : 'list-view'
                }`}
            >
              {sortedListings.length === 0 && status !== 'loading' ? (
                <p className="no-results">
                  {searchQuery
                    ? 'No listings match your search.'
                    : 'No listings available.'}
                </p>
              ) : (
                sortedListings.map(listing => (
                  <div
                    className="main-page-body-listings-item"
                    key={listing.listing_id}
                    onClick={() => handleListingClick(listing)}
                  >
                    <div className="main-page-body-listings-item-image-container">
                      <img
                        src={listing.images[0] || placeholderImageUrl}
                        alt={listing.title}
                        onError={e => {
                          const target = e.target as HTMLImageElement;
                          target.src = placeholderImageUrl;
                        }}
                      />
                    </div>
                    <div className="main-page-body-listings-item-details-container">
                      <div className="main-page-body-listings-item-details-title">
                        <h3>{listing.title}</h3>
                      </div>
                      <div className="main-page-body-listings-item-details-description">
                        <p>{listing.description.substring(0, 100)}...</p>
                      </div>
                      <div className="main-page-body-listings-item-details-category">
                        <span className="category">
                          Category: {listing.category}
                        </span>
                      </div>
                      <div className="main-page-body-listings-item-details-price">
                        <span>€{listing.price}</span>
                      </div>
                      {/* Display distance if available */}
                      {userLocation && listing.geo_location && (
                        <div className="main-page-body-listings-item-details-distance">
                          <span className="distance">
                            {getDistance(
                              userLocation.lat,
                              userLocation.lng,
                              listing.geo_location.latitude,
                              listing.geo_location.longitude
                            ).toFixed(2)}{' '}
                            km
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MainPage;
