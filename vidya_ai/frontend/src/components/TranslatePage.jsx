import React, { useState, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, ArrowLeft } from 'lucide-react';

const TranslatePage = ({ onBack }) => {
  const [url, setUrl] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const videoRef = useRef(null);

  const languages = [
    { value: 'hindi', label: 'Hindi' },
    { value: 'spanish', label: 'Spanish' },
    { value: 'french', label: 'French' }
  ];

  const handleUrlSubmit = async () => {
    if (!url.trim()) {
      setErrorMessage('Please enter a valid URL');
      return;
    }

    if (!selectedLanguage) {
      setErrorMessage('Please select a target language');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      // Call your translation API here
      const response = await fetch('http://localhost:8000/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          targetLanguage: selectedLanguage
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to process translation request');
      }

      const data = await response.json();
      console.log('Translation result:', data);
      // Handle the translation result here
      
    } catch (error) {
      console.error('Translation error:', error);
      setErrorMessage(error.message || 'Failed to process translation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      const videoUrl = URL.createObjectURL(file);
      if (videoRef.current) {
        videoRef.current.src = videoUrl;
      }
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVideoEnd = () => {
    setIsPlaying(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="flex items-center justify-between px-6 py-4 bg-white shadow-sm">
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className="text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="text-2xl font-bold text-indigo-600">Video Translation</div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-grow p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* URL Input Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Enter Video URL</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
                  Video URL
                </label>
                <input
                  type="url"
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/video.mp4 or YouTube URL"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Language Selection */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Select Target Language</h2>
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
                Translation Language
              </label>
              <select
                id="language"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              >
                <option value="">Select a language</option>
                {languages.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Translation Action */}
          {url && selectedLanguage && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <button 
                onClick={handleUrlSubmit}
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-3 px-8 rounded-lg font-medium transition-colors"
              >
                {isLoading ? 'Processing...' : `Start Translation to ${languages.find(l => l.value === selectedLanguage)?.label}`}
              </button>
              {errorMessage && (
                <div className="mt-4 text-red-600 text-sm">{errorMessage}</div>
              )}
            </div>
          )}

          {/* Video Upload and Player Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Video Player</h2>
            
            {/* File Upload */}
            <div className="mb-6">
              <label htmlFor="video-upload" className="block text-sm font-medium text-gray-700 mb-2">
                Upload Video File (Optional)
              </label>
              <input
                type="file"
                id="video-upload"
                accept="video/*"
                onChange={handleFileUpload}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
            </div>

            {/* Video Player */}
            <div className="relative bg-black rounded-lg shadow-lg aspect-video">
              <video
                ref={videoRef}
                className="w-full h-full object-contain rounded-lg"
                onEnded={handleVideoEnd}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              >
                Your browser does not support the video tag.
              </video>
              
              {/* Video Controls */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="flex items-center justify-center space-x-4">
                  <button
                    onClick={togglePlay}
                    disabled={!videoFile}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white p-3 rounded-full transition-colors"
                  >
                    {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                  </button>
                  
                  <button
                    onClick={toggleMute}
                    disabled={!videoFile}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white p-3 rounded-full transition-colors"
                  >
                    {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                  </button>
                </div>
              </div>
              
              {/* Placeholder when no video */}
              {!videoFile && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <div className="mb-4">
                      <Play size={48} className="mx-auto" />
                    </div>
                    <p>Upload a video file to start playing</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranslatePage;