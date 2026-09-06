import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { TransactionCreate, TransactionWithListing } from '../../types/transaction';
import { API_BASE_URL } from '../../../config';

interface TransactionsState {
  items: TransactionWithListing[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  makeOfferStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  makeOfferError: string | null;
  makeOfferSuccess: boolean;
  completeTransactionStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  completeTransactionError: string | null;
  completeTransactionSuccess: boolean;
  createReviewStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  createReviewError: string | null;
  createReviewSuccess: boolean;
  acceptOfferStatus: 'idle' | 'loading' | 'succeeded' | 'failed';
  acceptOfferError: string | null;
  acceptOfferSuccess: boolean;
}

const initialState: TransactionsState = {
  items: [],
  status: 'idle',
  error: null,
  makeOfferStatus: 'idle',
  makeOfferError: null,
  makeOfferSuccess: false,
  completeTransactionStatus: 'idle',
  completeTransactionError: null,
  completeTransactionSuccess: false,
  createReviewStatus: 'idle',
  createReviewError: null,
  createReviewSuccess: false,
  acceptOfferStatus: 'idle',
  acceptOfferError: null,
  acceptOfferSuccess: false,
};

// Async thunk to make an offer
export const makeOffer = createAsyncThunk(
  'transactions/makeOffer',
  async ({ transactionData, token }: { transactionData: TransactionCreate; token: string }) => {
    const response = await fetch(`${API_BASE_URL}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(transactionData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to make offer');
    }

    return await response.json();
  }
);

// Async thunk to fetch user's transactions
export const fetchUserTransactions = createAsyncThunk(
  'transactions/fetchUserTransactions',
  async ({ token, role, status }: { token: string; role?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (status) params.append('status', status);

    const url = `${API_BASE_URL}/transactions${params.toString() ? `?${params.toString()}` : ''}`;
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to fetch transactions');
    }

    return await response.json();
  }
);

// Async thunk to complete a transaction
export const completeTransaction = createAsyncThunk(
  'transactions/completeTransaction',
  async ({ transactionId, token }: { transactionId: number; token: string }) => {
    const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}/complete`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to complete transaction');
    }

    return await response.json();
  }
);

// Async thunk to create a review
export const createReview = createAsyncThunk(
  'transactions/createReview',
  async ({ reviewData, token }: { reviewData: { transaction_id: number; rating: number; comment?: string }; token: string }) => {
    const response = await fetch(`${API_BASE_URL}/transactions/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(reviewData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to create review');
    }

    return await response.json();
  }
);

// Async thunk to accept an offer
export const acceptOffer = createAsyncThunk(
  'transactions/acceptOffer',
  async ({ transactionId, token }: { transactionId: number; token: string }) => {
    const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: 'Accepted' }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to accept offer');
    }

    return await response.json();
  }
);

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    clearMakeOfferStatus: (state) => {
      state.makeOfferStatus = 'idle';
      state.makeOfferError = null;
      state.makeOfferSuccess = false;
    },
    clearCompleteTransactionStatus: (state) => {
      state.completeTransactionStatus = 'idle';
      state.completeTransactionError = null;
      state.completeTransactionSuccess = false;
    },
    clearCreateReviewStatus: (state) => {
      state.createReviewStatus = 'idle';
      state.createReviewError = null;
      state.createReviewSuccess = false;
    },
    clearAcceptOfferStatus: (state) => {
      state.acceptOfferStatus = 'idle';
      state.acceptOfferError = null;
      state.acceptOfferSuccess = false;
    },
    clearTransactionsError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Make offer
      .addCase(makeOffer.pending, (state) => {
        state.makeOfferStatus = 'loading';
        state.makeOfferError = null;
        state.makeOfferSuccess = false;
      })
      .addCase(makeOffer.fulfilled, (state) => {
        state.makeOfferStatus = 'succeeded';
        state.makeOfferSuccess = true;
      })
      .addCase(makeOffer.rejected, (state, action) => {
        state.makeOfferStatus = 'failed';
        state.makeOfferError = action.error.message || 'Failed to make offer';
      })
      // Fetch transactions
      .addCase(fetchUserTransactions.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchUserTransactions.fulfilled, (state, action: PayloadAction<TransactionWithListing[]>) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchUserTransactions.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch transactions';
      })
      // Complete transaction
      .addCase(completeTransaction.pending, (state) => {
        state.completeTransactionStatus = 'loading';
        state.completeTransactionError = null;
        state.completeTransactionSuccess = false;
      })
      .addCase(completeTransaction.fulfilled, (state) => {
        state.completeTransactionStatus = 'succeeded';
        state.completeTransactionSuccess = true;
      })
      .addCase(completeTransaction.rejected, (state, action) => {
        state.completeTransactionStatus = 'failed';
        state.completeTransactionError = action.error.message || 'Failed to complete transaction';
      })
      // Create review
      .addCase(createReview.pending, (state) => {
        state.createReviewStatus = 'loading';
        state.createReviewError = null;
        state.createReviewSuccess = false;
      })
      .addCase(createReview.fulfilled, (state) => {
        state.createReviewStatus = 'succeeded';
        state.createReviewSuccess = true;
      })
      .addCase(createReview.rejected, (state, action) => {
        state.createReviewStatus = 'failed';
        state.createReviewError = action.error.message || 'Failed to create review';
      })
      // Accept offer
      .addCase(acceptOffer.pending, (state) => {
        state.acceptOfferStatus = 'loading';
        state.acceptOfferError = null;
        state.acceptOfferSuccess = false;
      })
      .addCase(acceptOffer.fulfilled, (state) => {
        state.acceptOfferStatus = 'succeeded';
        state.acceptOfferSuccess = true;
      })
      .addCase(acceptOffer.rejected, (state, action) => {
        state.acceptOfferStatus = 'failed';
        state.acceptOfferError = action.error.message || 'Failed to accept offer';
      });
  },
});

export const { clearMakeOfferStatus, clearCompleteTransactionStatus, clearCreateReviewStatus, clearAcceptOfferStatus, clearTransactionsError } = transactionsSlice.actions;
export default transactionsSlice.reducer; 