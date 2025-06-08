import { useState } from 'react';
import ImprovedYouTubePlayer from './components/ImprovedYoutubePlayer';
import TranslatePage from './components/TranslatePage';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('youtube'); // 'youtube' or 'translate'

  const showTranslatePage = () => {
    setCurrentPage('translate');
  };

  const showYouTubePage = () => {
    setCurrentPage('youtube');
  };

  return (
    <div className="App">
      {currentPage === 'youtube' && (
        <ImprovedYouTubePlayer onNavigateToTranslate={showTranslatePage} />
      )}
      {currentPage === 'translate' && (
        <TranslatePage onBack={showYouTubePage} />
      )}
    </div>
  );
}

export default App;