import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TranslatePage from './components/TranslatePage';
import ImprovedYoutubePlayer from './components/ImprovedYoutubePlayer';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900">
        <Routes>
          <Route path="/" element={<ImprovedYoutubePlayer />} />
          <Route path="/translate" element={<TranslatePage />} />
          <Route path="/chat" element={<ImprovedYoutubePlayer />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;