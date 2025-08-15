// src/components/ProtectedRoute.jsx
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block border-2 border-t-transparent border-white rounded-full animate-spin w-12 h-12 mb-4"></div>
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    window.location.href = '/';
    return null;
  }

  return children;
};

export default ProtectedRoute;