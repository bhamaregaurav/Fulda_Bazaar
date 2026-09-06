import { Navigate } from "react-router-dom";
import { useSelector } from 'react-redux';
import type { RootState } from '../../store/store';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute = ({ children }: AdminRouteProps) => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const isAdmin = (user as any)?.permission_id === 1;

  if (!isAuthenticated) {
    return <Navigate to="/signin" />;
  }
  if (!isAdmin) {
    return <Navigate to="/app" />;
  }
  return children;
};

export default AdminRoute;
