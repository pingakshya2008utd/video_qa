// src/App.jsx
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthForm from './components/AuthForm';
import HomePage from './components/HomePage';
import ImprovedYoutubePlayer from './components/ImprovedYouTubePlayer'; // Fixed import
import Gallery from './components/Gallery.jsx';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

// Placeholder for TranslatePage if it doesn't exist
const TranslatePagePlaceholder = ({ onNavigateToHome }) => (
  <div className="min-h-screen bg-gray-950 flex items-center justify-center">
    <div className="text-center">
      <h2 className="text-2xl font-bold text-white mb-4">Translation Service</h2>
      <p className="text-gray-400 mb-6">This component will be available soon!</p>
      <button 
        onClick={onNavigateToHome}
        className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
      >
        Back to Home
      </button>
    </div>
  </div>
);

// Try to import TranslatePage, use placeholder if it fails
let TranslatePage;
try {
  TranslatePage = require('./components/TranslatePage').default;
} catch (e) {
  console.warn('TranslatePage component not found, using placeholder');
  TranslatePage = TranslatePagePlaceholder;
}

// Utility function to get initial page from URL
const getInitialPage = () => {
  const path = window.location.pathname;
  if (path === '/chat') return 'chat';
  if (path === '/gallery') return 'gallery';
  if (path === '/translate') return 'translate';
  return 'home';
};

// Main App Content Component
const AppContent = () => {
  const { currentUser } = useAuth();
  const [currentPage, setCurrentPage] = useState(getInitialPage);

  // MOVE ALL HOOKS BEFORE ANY CONDITIONAL LOGIC

  // Handle navigation with browser history
  const handleNavigateToHome = () => {
    setCurrentPage('home');
    window.history.pushState({ page: 'home' }, '', '/');
  };
  
  const handleNavigateToChat = () => {
    setCurrentPage('chat');
    window.history.pushState({ page: 'chat' }, '', '/chat');
  };
  
  const handleNavigateToTranslate = () => {
    setCurrentPage('translate');
    window.history.pushState({ page: 'translate' }, '', '/translate');
  };

  const handleNavigateToGallery = () => {
    setCurrentPage('gallery');
    window.history.pushState({ page: 'gallery' }, '', '/gallery');
  };

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = (event) => {
      const page = event.state?.page || getInitialPage();
      setCurrentPage(page);
    };

    // Set initial history state
    if (!window.history.state) {
      window.history.replaceState({ page: getInitialPage() }, '', window.location.pathname);
    }

    window.addEventListener('popstate', handlePopState);
    
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // NOW AFTER ALL HOOKS, CHECK AUTHENTICATION
  if (!currentUser) {
    return <AuthForm />;
  }

  // Render current page
  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <HomePage 
            onNavigateToChat={handleNavigateToChat}
            onNavigateToTranslate={handleNavigateToTranslate}
            onNavigateToGallery={handleNavigateToGallery}
          />
        );
      case 'chat':
        return (
        <ProtectedRoute>
          <ImprovedYoutubePlayer 
            onNavigateToHome={handleNavigateToHome}
            onNavigateToTranslate={handleNavigateToTranslate}
        />
        </ProtectedRoute>
        );
      case 'gallery':
        return (
          <ProtectedRoute>
            <div className="min-h-screen bg-gray-950 p-6">
              <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-white text-2xl font-bold">My Gallery</h2>
                  <button
                    onClick={handleNavigateToHome}
                    className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm"
                  >
                    Home
                  </button>
                </div>
                <Gallery />
              </div>
            </div>
          </ProtectedRoute>
        );
      case 'translate':
        return (
          <TranslatePage 
            onNavigateToHome={handleNavigateToHome}
            onNavigateToChat={handleNavigateToChat}
          />
        );
      default:
        return (
          <HomePage 
            onNavigateToChat={handleNavigateToChat}
            onNavigateToTranslate={handleNavigateToTranslate}
          />
        );
    }
  };

  return renderCurrentPage();
};

// Main App Component
function App() {
  return (
    <AuthProvider>
      <div className="App">
        <AppContent />
      </div>
    </AuthProvider>
  );
}

export default App;