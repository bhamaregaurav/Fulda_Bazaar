import { configureStore } from '@reduxjs/toolkit';
import productsReducer from '../features/products/productsSlice';
import authReducer from '../features/auth/authSlice';
import userReducer from '../features/user/userSlice';
import watchlistReducer from '../features/watchlist/watchlistSlice';
import transactionsReducer from '../features/transactions/transactionsSlice';

export const store = configureStore({
  reducer: {
    products: productsReducer,
    auth: authReducer,
    user: userReducer,
    watchlist: watchlistReducer,
    transactions: transactionsReducer,
  },
});

export type AppDispatch = typeof store.dispatch;

export type RootState = ReturnType<typeof store.getState>;
