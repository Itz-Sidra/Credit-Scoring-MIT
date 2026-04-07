import { Navigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'user' | 'admin';
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, userType, isLoading } = useAuth();

  // While loading auth state, don't render anything to prevent flashing redirect
  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requiredRole && userType !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
