export interface ListingInterface {
  listing_id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  subcategory?: string;
  condition: string;
  location?: string;
  geo_location?: {
    latitude: number;
    longitude: number;
  };
  status: string;
  created_at: string;
  expiration_date?: string;
  images: string[];
  distance?: number;
  created_by: {
    user_id: number;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface SearchParams {
  query: string;
  category_id: number;
  subcategory_id: number;
  min_price: string;
  max_price: string;
  condition: string;
  location: string;
  latitude?: number;
  longitude?: number;
  max_distance?: number;
}

export interface ProductsState {
  items: ListingInterface[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

export interface CategoryState {
  [key: string]: number;
}
