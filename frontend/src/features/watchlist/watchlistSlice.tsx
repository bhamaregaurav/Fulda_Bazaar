import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { API_BASE_URL } from '../../../config';

interface WatchlistState {
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  success: boolean;
}

const initialState: WatchlistState = {
  status: 'idle',
  error: null,
  success: false,
};

export const addToWatchlist = createAsyncThunk(
  'watchlist/addToWatchlist',
  async (listingId: string, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      const response = await fetch(`${API_BASE_URL}/watchlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ listing_id: listingId }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to add to watchlist');
      }
      return await response.json();
    } catch (err: any) {
      return rejectWithValue(err.message || 'An error occurred');
    }
  }
);

const watchlistSlice = createSlice({
  name: 'watchlist',
  initialState,
  reducers: {
    clearWatchlistStatus: (state) => {
      state.status = 'idle';
      state.error = null;
      state.success = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(addToWatchlist.pending, (state) => {
        state.status = 'loading';
        state.error = null;
        state.success = false;
      })
      .addCase(addToWatchlist.fulfilled, (state) => {
        state.status = 'succeeded';
        state.error = null;
        state.success = true;
      })
      .addCase(addToWatchlist.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
        state.success = false;
      });
  },
});

export const { clearWatchlistStatus } = watchlistSlice.actions;
export default watchlistSlice.reducer; 