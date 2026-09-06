import { Navigate } from "react-router-dom";
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';

interface PrivateRouteProps {
  children: React.ReactNode;
}

function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch {
    return true;
  }
}

export const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const { isAuthenticated, token } = useSelector((state: RootState) => state.auth);

  const tokenExpired = isTokenExpired(token);

  if (!isAuthenticated || tokenExpired) {
    localStorage.removeItem('token');
    return <Navigate to="/signin" replace />;
  }

  return children;
};
