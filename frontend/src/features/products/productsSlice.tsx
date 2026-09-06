import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { API_BASE_URL } from '../../../config';

export const fetchListings = createAsyncThunk(
  "products/fetchListings",
  async ({
    query,
    category_id,
    subcategory_id,
    min_price,
    max_price,
    condition,
    location,
    latitude,
    longitude,
    max_distance,
  }: {
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
  }) => {
    let url = `${API_BASE_URL}/get_listings?`;
    
    // Add standard filters
    if (query) url += `query=${encodeURIComponent(query)}&`;
    if (category_id) url += `category_id=${category_id}&`;
    if (subcategory_id) url += `subcategory_id=${subcategory_id}&`;
    if (min_price) url += `min_price=${min_price}&`;
    if (max_price) url += `max_price=${max_price}&`;
    if (condition) url += `condition=${encodeURIComponent(condition)}&`;
    if (location) url += `location=${encodeURIComponent(location)}&`;
    
    // Add proximity search parameters
    if (latitude !== undefined) url += `latitude=${latitude}&`;
    if (longitude !== undefined) url += `longitude=${longitude}&`;
    if (max_distance !== undefined) url += `max_distance=${max_distance}&`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    return data;
  }
);

const productsSlice = createSlice({
    name: 'products',
    initialState : {
        items: [],
        status : 'idle',
        error: null,
    },
    reducers: {},
    extraReducers : (builder)=>{
        builder
        .addCase(fetchListings.pending, (state)=>{
            state.status = 'loading';
        })
        .addCase(fetchListings.fulfilled, (state, action)=>{
            state.status = 'succeeded';
            state.items = action.payload;
        })
        .addCase(fetchListings.rejected, (state : any, action)=>{
            state.status = 'failed';
            state.error = action.error.message;
        });
    },
})

export default productsSlice.reducer;