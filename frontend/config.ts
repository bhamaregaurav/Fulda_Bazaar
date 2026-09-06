// API Configuration
// Single source of truth for the backend URL. Set VITE_API_URL at build time
// (see .env.example); falls back to the local backend for development.
export const getApiBaseUrl = (): string =>
  import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const API_BASE_URL = getApiBaseUrl();

// ws:// or wss:// counterpart of the API base URL
export const getWebSocketBaseUrl = (): string =>
  getApiBaseUrl().replace(/^http/, 'ws');

export const WS_BASE_URL = getWebSocketBaseUrl();

import { ROUTES } from './src/constants/routes';

export const navItems = {
    [ROUTES.HOME]: { path: ROUTES.SIGN_IN, label: 'Sign In' },
    [ROUTES.SIGN_IN]: { path: ROUTES.SIGN_UP, label: 'Sign Up' },
    [ROUTES.SIGN_UP]: { path: ROUTES.SIGN_IN, label: 'Sign In' },
    [ROUTES.FORGOT_PASSWORD]: { path: ROUTES.SIGN_IN, label: 'Sign In' },
    [ROUTES.APP]: { label: 'Signout', isLogout: true }
};

export const UserList = [
    {
      first_name: "Mohammed",
      last_name: "Zikrullah",
      email: "zik@gmail.com",
      password: "zik",
      token : "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    },
    {
      first_name: "Bob",
      last_name: "Smith",
      email: "bob.smith@example.com",
      password: "bobpassword",
      token : "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    },
    {
      first_name: "Charlie",
      last_name: "Brown",
      email: "charlie.brown@example.com",
      password: "charliepass",
      token : "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    },
    {
      first_name: "Diana",
      last_name: "Prince",
      email: "diana.prince@example.com",
      password: "wonderwoman",
      token : "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    },
    {
      first_name: "Ethan",
      last_name: "Hunt",
      email: "ethan.hunt@example.com",
      password: "mission123",
      token : "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    }
  ];