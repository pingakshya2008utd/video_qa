import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Upload, Youtube, Globe, Menu, Home, MessageSquare, Languages } from 'lucide-react';
import axios from 'axios';

const TranslatePage = () => {
  // State variables
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Translation state
  const [translationJobId, setTranslationJobId] = useState(null);
  const [translationComplete, setTranslationComplete] = useState(false);
  const [translatedVideoUrl, setTranslatedVideoUrl] = useState(null);
  const [statusLogs, setStatusLogs] = useState([]);
  
  // Refs
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const statusCheckInterval = useRef(null);
  
  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuRef]);
  
  // Clean up intervals when component unmounts
  useEffect(() => {
    return () => {
      if (statusCheckInterval.current) {
        console.log("Cleaning up status check interval");
        clearInterval(statusCheckInterval.current);
        statusCheckInterval.current = null;
      }
    };
  }, []);
  
  // Handle file upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type.startsWith('video/')) {
        setVideoFile(file);
        setVideoUrl(URL.createObjectURL(file));
        setError(null);
      } else {
        setError("Please select a valid video file");
      }
    }
  };
  
  // Add a log message with timestamp
  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setStatusLogs(prev => [...prev, logMessage]);
  };
  
  // YouTube submit handler
  const handleYoutubeSubmit = async (e) => {
    e.preventDefault();
    
    if (!youtubeUrl.trim() || !selectedLanguage) {
      setError("Please enter a YouTube URL and select a language");
      return;
    }
    
    setLoading(true);
    setError(null);
    setStatusLogs([]);
    
    try {
      addLog(`Starting translation from English to ${selectedLanguage}`);
      addLog(`Sending request to FastAPI with YouTube URL: ${youtubeUrl}`);
      
      // Call the FastAPI endpoint to start translation
      const response = await axios.post('http://localhost:8000/api/query/translate', {
        youtube_url: youtubeUrl,
        source_language: 'en', // Default source language
        target_language: selectedLanguage,
        use_watermark: true // Using watermark by default
      });
      
      addLog(`Received response from server: ${JSON.stringify(response.data)}`);
      
      if (response.data && response.data.job_id) {
        const jobId = response.data.job_id;
        addLog(`Translation job started with ID: ${jobId}`);
        
        // Store the job ID for status checking
        setTranslationJobId(jobId);
        
        // Clear any existing status check interval
        if (statusCheckInterval.current) {
          clearInterval(statusCheckInterval.current);
        }
        
        // Check status immediately
        checkTranslationStatus(jobId);
        
        // Then set up periodic checking
        statusCheckInterval.current = setInterval(() => {
          checkTranslationStatus(jobId);
        }, 5000);
        
        // Show processing state
        setVideoUrl(null); // Clear any existing video
        setTranslationComplete(false);
        
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err) {
      console.error("Translation error:", err);
      addLog(`Error starting translation: ${err.message}`);
      
      setError(
        err.response?.data?.detail || 
        "Failed to start translation. Please check your YouTube URL and try again."
      );
      
      // Log detailed error information
      if (err.response) {
        addLog(`Error response: ${JSON.stringify(err.response.data)}`);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Function to check translation status
  const checkTranslationStatus = async (jobId = null) => {
    // Use provided job ID or fall back to state
    const currentJobId = jobId || translationJobId;
    if (!currentJobId) return;
    
    try {
      addLog(`Checking translation status for job: ${currentJobId}`);
      const response = await axios.get(`http://localhost:8000/api/query/translate/${currentJobId}`);
      
      addLog(`Status response: ${JSON.stringify(response.data)}`);
      
      // Handle different status values
      if (response.data.status === "completed") {
        addLog("✅ Translation completed successfully!");
        
        // Stop polling
        if (statusCheckInterval.current) {
          clearInterval(statusCheckInterval.current);
          statusCheckInterval.current = null;
        }
        
        setTranslationComplete(true);
        
        // Determine video URL
        let videoUrl = null;
        
        // Use the correct API endpoint based on backend code
        if (response.data.output_url) {
          // If output_url is directly provided in the response
          videoUrl = `http://localhost:8000${response.data.output_url}`;
          addLog(`Using provided output_url: ${videoUrl}`);
        } 
        else if (response.data.output_file) {
          // Construct URL using the translated_videos endpoint from backend
          videoUrl = `http://localhost:8000/api/translated_videos/${currentJobId}/${response.data.output_file}`;
          addLog(`Constructed URL using translated_videos endpoint: ${videoUrl}`);
        }
        else if (response.data.output_path) {
          // Extract filename from output_path as fallback
          const outputFile = response.data.output_path.split('/').pop();
          videoUrl = `http://localhost:8000/api/translated_videos/${currentJobId}/${outputFile}`;
          addLog(`Constructed URL from output_path: ${videoUrl}`);
        }
        
        if (videoUrl) {
          addLog(`Setting translated video URL: ${videoUrl}`);
          setTranslatedVideoUrl(videoUrl);
          setVideoUrl(videoUrl);
        } else {
          addLog("⚠️ No video URL found in completed response");
          setError("Translation completed but video URL is missing");
        }
      } 
      else if (response.data.status === "failed") {
        addLog(`❌ Translation failed: ${response.data.message || response.data.error || "Unknown error"}`);
        
        // Stop polling
        if (statusCheckInterval.current) {
          clearInterval(statusCheckInterval.current);
          statusCheckInterval.current = null;
        }
        
        setError(`Translation failed: ${response.data.message || response.data.error || "Unknown error"}`);
      }
      else {
        // Still in progress
        addLog(`🔄 Translation in progress: ${response.data.status}`);
        
        if (response.data.message) {
          addLog(`Status message: ${response.data.message}`);
        }
      }
    } catch (err) {
      console.error("Error checking status:", err);
      addLog(`Error checking status: ${err.message}`);
      // Don't stop polling on temporary errors
    }
  };
  
  // Video player controls
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
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(!isMuted);
    }
  };
  
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };
  
  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };
  
  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };
  
  // Format time display (e.g., 2:30)
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  // Clean up object URL when component unmounts
  useEffect(() => {
    return () => {
      if (videoUrl && videoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header with Logo and Menu */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <div className="flex-shrink-0 mr-4">
            <img 
              src="/logo-new.png" 
              alt="Website Logo" 
              className="h-16 w-auto max-w-[200px] object-cover object-center"
              style={{ 
                width: '240px',
                height: '50px'
              }}
            />
          </div>
          <h1 className="text-3xl font-bold text-white hidden md:block">Video Translation</h1>
        </div>
        
        {/* Menu Button */}
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-white transition-colors"
          >
            <Menu size={24} />
          </button>
          
          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
              <div className="py-1" role="menu" aria-orientation="vertical">
                <a 
                  href="#" 
                  className="flex items-center px-4 py-3 text-white hover:bg-gray-700 transition-colors"
                  role="menuitem"
                >
                  <Home className="mr-3" size={18} />
                  <span>Home (Login)</span>
                </a>
                <a 
                  href="#" 
                  className="flex items-center px-4 py-3 text-white hover:bg-gray-700 transition-colors"
                  role="menuitem"
                >
                  <MessageSquare className="mr-3" size={18} />
                  <span>Chat with Video</span>
                </a>
                <a 
                  href="#" 
                  className="flex items-center px-4 py-3 text-white hover:bg-gray-700 transition-colors"
                  role="menuitem"
                >
                  <Languages className="mr-3" size={18} />
                  <span>Translate</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* YouTube URL Input */}
      <form onSubmit={handleYoutubeSubmit} className="mb-8">
        <div className="flex flex-col md:flex-row md:items-center gap-2">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Youtube size={18} className="text-red-500" />
            </div>
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="Enter YouTube URL (e.g., https://www.youtube.com/watch?v=...)"
              className="w-full px-12 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-gray-400"
            />
          </div>
          
          <div className="flex items-center bg-gray-800 rounded-lg p-2">
            <Globe size={20} className="text-purple-400 mr-2" />
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="bg-gray-800 text-white border-none focus:outline-none focus:ring-2 focus:ring-purple-500 rounded-lg p-1"
            >
              <option value="">Select Language</option>
              <option value="es">Spanish</option>
              <option value="as">Assamese</option>
              <option value="hi">Hindi</option>
              <option value="bn">Bengali</option>
            </select>
          </div>
          
          <button 
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-200 shadow-lg"
            disabled={loading || !selectedLanguage || !youtubeUrl.trim()}
          >
            {loading ? 'Processing...' : 'Start Translation'}
          </button>
        </div>
        {error && (
          <div className="mt-2 text-red-400 text-sm bg-red-900 bg-opacity-30 p-2 rounded">
            ⚠️ {error}
          </div>
        )}
        
        {/* Status indicator with manual check button */}
        {translationJobId && !translationComplete && !error && (
          <div className="mt-2 text-yellow-400 text-sm bg-yellow-900 bg-opacity-30 p-2 rounded flex justify-between items-center">
            <span>Translation in progress... This may take several minutes.</span>
            <button
              onClick={() => checkTranslationStatus()}
              className="ml-2 px-2 py-1 bg-yellow-700 rounded text-xs hover:bg-yellow-600"
              type="button"
            >
              Check Now
            </button>
          </div>
        )}
      </form>
      
      {/* Alternative Upload Method */}
      <div className="mb-8">
        <div className="text-gray-400 text-center mb-4">OR</div>
        
        <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center">
          <input
            type="file"
            accept="video/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="cursor-pointer"
          >
            <Upload size={40} className="mx-auto mb-3 text-indigo-400" />
            <p className="text-white mb-2">Upload your video file</p>
            <p className="text-sm text-gray-400">Supports MP4, WebM, and MOV formats</p>
          </div>
        </div>
      </div>
      
      {/* Log Messages - Only shown during translation */}
      {translationJobId && !translationComplete && statusLogs.length > 0 && (
        <div className="mb-8 bg-gray-900 rounded-xl p-4">
          <h3 className="text-white font-semibold mb-2 flex items-center">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></span>
            Translation Logs
          </h3>
          <div className="bg-gray-800 p-3 rounded-lg max-h-40 overflow-y-auto text-sm font-mono">
            {statusLogs.map((log, index) => (
              <div key={index} className="text-gray-300 mb-1">{log}</div>
            ))}
          </div>
        </div>
      )}
      
      {/* Video Player */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4 text-white">
          {translationComplete ? 'Translated Video' : 'Video Player'}
        </h2>
        
        <div className="bg-gray-900 rounded-xl overflow-hidden shadow-xl">
          <div className="relative aspect-video">
            {videoUrl && (
              videoUrl.includes('youtube.com/embed/') ? (
                <iframe
                  src={videoUrl}
                  className="absolute inset-0 w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              ) : (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="absolute inset-0 w-full h-full bg-black"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onClick={togglePlay}
                  controls={translationComplete} // Add native controls for translated video
                ></video>
              )
            )}
            
            {/* Video Controls - Only show for local videos */}
            {videoUrl && !videoUrl.includes('youtube.com/embed/') && !translationComplete && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={togglePlay}
                    disabled={!videoFile}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white p-3 rounded-full transition-colors"
                  >
                    {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                  </button>
                  
                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    disabled={!videoFile}
                    className="flex-grow h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  
                  <div className="text-white text-sm">
                    {formatTime(currentTime)} / {formatTime(duration)}
                  </div>
                  
                  <button
                    onClick={toggleMute}
                    disabled={!videoFile}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white p-3 rounded-full transition-colors"
                  >
                    {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                  </button>
                </div>
              </div>
            )}
            
            {/* Placeholder when no video */}
            {!videoUrl && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  {translationJobId && !translationComplete ? (
                    <div>
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                      <p>Translating video... This may take several minutes.</p>
                      <p className="text-xs mt-2">Job ID: {translationJobId}</p>
                    </div>
                  ) : (
                    <div>
                      <div className="mb-4">
                        <Play size={48} className="mx-auto" />
                      </div>
                      <p>Upload a video or enter a YouTube URL to start</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Translation Complete Section */}
      {translationComplete && (
        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4 text-white">Translation Complete</h2>
          <div className="bg-gray-900 rounded-xl p-6 shadow-xl">
            <p className="text-gray-300">
              Video has been successfully translated to: 
              <span className="text-indigo-400 font-semibold ml-2">{selectedLanguage}</span>
            </p>
            <div className="mt-4 flex justify-center">
              <a 
                href={translatedVideoUrl} 
                download
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                Download Translated Video
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TranslatePage;