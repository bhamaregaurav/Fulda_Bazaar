import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { API_BASE_URL } from '../../../config';

interface User {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  permission_id: number;
  role_name: string;
  two_fa: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  tempToken: string | null; // Add temp token for 2FA
  isAuthenticated: boolean;
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
  requires2FA: boolean; // Add 2FA requirement flag
}

const initialState: AuthState = {
  user: localStorage.getItem('user') ? JSON.parse(localStorage.getItem('user')!) : null,
  token: localStorage.getItem('token'),
  tempToken: null,
  isAuthenticated: !!localStorage.getItem('token'),
  status: 'idle',
  error: null,
  requires2FA: false,
};

export const login = createAsyncThunk(
  'auth/login',
  async (credentials: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        // Provide a more specific error message for authentication failures
        if (response.status === 401) {
          throw new Error('Incorrect email or password');
        } else {
          throw new Error('Login failed. Please try again later.');
        }
      }

      const data = await response.json();

      // Check if 2FA is required
      if (data.two_fa_required) {
        return {
          temp_token: data.temp_token,
          two_fa_required: true
        };
      }

      localStorage.setItem('token', data.access_token);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      localStorage.removeItem('token');
      return null;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchUserProfile = createAsyncThunk(
  'auth/fetchUserProfile',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/users/view/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

// New thunk for 2FA verification
export const verify2FA = createAsyncThunk(
  'auth/verify2FA',
  async (payload: { tempToken: string; code: string }, { rejectWithValue }) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login/2fa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          temp_token: payload.tempToken,
          code: payload.code,
        }),
      });

      if (!response.ok) {
        throw new Error('Invalid verification code');
      }

      const data = await response.json();
      localStorage.setItem('token', data.access_token);
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const setup2FA = createAsyncThunk(
  'auth/setup2FA',
  async (_, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/2fa/setup`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to setup 2FA');
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const confirm2FA = createAsyncThunk(
  'auth/confirm2FA',
  async (payload: { code: string }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/2fa/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: payload.code }),
      });

      if (!response.ok) {
        throw new Error('Invalid verification code');
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

export const disable2FA = createAsyncThunk(
  'auth/disable2FA',
  async (payload: { password: string; code: string }, { rejectWithValue }) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/2fa/disable`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to disable 2FA');
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      return rejectWithValue(error.message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    resetStatus: (state) => {
      state.status = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.error = null;

        if (action.payload.two_fa_required) {
          // 2FA required - store temp token but clear any previous auth state
          state.tempToken = action.payload.temp_token;
          state.requires2FA = true;
          state.isAuthenticated = false;
          state.token = null; // Clear any previous token
        } else {
          // Normal login - store access token and clear 2FA state
          state.token = action.payload.access_token;
          state.isAuthenticated = true;
          state.requires2FA = false;
          state.tempToken = null; // Clear temp token
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      // Logout
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.tempToken = null;
        state.isAuthenticated = false;
        state.requires2FA = false;
        state.status = 'idle';
      })
      // Fetch Profile
      .addCase(fetchUserProfile.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.user = action.payload;
        state.error = null;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      // Verify 2FA
      .addCase(verify2FA.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(verify2FA.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.token = action.payload.access_token;
        state.isAuthenticated = true;
        state.error = null;
        state.requires2FA = false; // Reset 2FA requirement
        state.tempToken = null; // Clear temp token after successful verification
      })
      .addCase(verify2FA.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      // Setup 2FA
      .addCase(setup2FA.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(setup2FA.fulfilled, (state) => {
        state.status = 'succeeded';
        state.error = null;
      })
      .addCase(setup2FA.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      // Confirm 2FA
      .addCase(confirm2FA.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(confirm2FA.fulfilled, (state) => {
        state.status = 'succeeded';
        state.error = null;
      })
      .addCase(confirm2FA.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      })
      // Disable 2FA
      .addCase(disable2FA.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(disable2FA.fulfilled, (state) => {
        state.status = 'succeeded';
        state.error = null;
        if (state.user) {
          state.user.two_fa = false;
        }
      })
      .addCase(disable2FA.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      });
  },
});

export const { clearError, resetStatus } = authSlice.actions;
export default authSlice.reducer;
