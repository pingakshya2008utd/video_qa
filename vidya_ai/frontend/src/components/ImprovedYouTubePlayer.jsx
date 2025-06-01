import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Send, Youtube, Globe, Menu, Home, MessageSquare } from 'lucide-react';
import axios from 'axios';

// Mock function for testing without actual YouTube API
const mockYouTubePlayer = {
  playVideo: () => console.log("Play video"),
  pauseVideo: () => console.log("Pause video"),
  mute: () => console.log("Mute video"),
  unMute: () => console.log("Unmute video"),
  seekTo: (time) => console.log("Seek to", time),
  getCurrentTime: () => 30, // Mock current time
  getDuration: () => 300, // Mock duration (5 minutes)
  destroy: () => console.log("Player destroyed")
};

const ImprovedYouTubePlayer = () => {
  // State variables
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [currentVideo, setCurrentVideo] = useState({ 
    title: 'No video loaded', 
    source: '', 
    videoId: null 
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [userQuestion, setUserQuestion] = useState('');
  const [isProcessingQuery, setIsProcessingQuery] = useState(false);
  const [queryType, setQueryType] = useState('video'); // 'video' or 'frame'
  
  // New state for menu
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Refs
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const chatContainerRef = useRef(null);
  const timeUpdateIntervalRef = useRef(null);
  const menuRef = useRef(null);
  
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
  
  // Handle YouTube URL input
  const handleYoutubeSubmit = async (e) => {
    e.preventDefault();
    
    if (!youtubeUrl.trim()) {
      setErrorMessage("Please enter a YouTube URL");
      return;
    }
    
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      // Extract video ID from YouTube URL
      let videoId = '';
      
      // Handle different YouTube URL formats
      if (youtubeUrl.includes('youtube.com/watch?v=')) {
        // Standard YouTube URL
        const urlParams = new URLSearchParams(new URL(youtubeUrl).search);
        videoId = urlParams.get('v');
      } else if (youtubeUrl.includes('youtu.be/')) {
        // Shortened YouTube URL
        videoId = youtubeUrl.split('youtu.be/')[1].split('?')[0];
      } else {
        throw new Error("Invalid YouTube URL format");
      }
      
      // In a real implementation, you would call your backend here
      // For now, we'll just simulate a successful response
      
      setCurrentVideo({
        title: "Sample YouTube Video", 
        source: `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}&controls=0`,
        videoId: videoId
      });
      
      // Clear chat messages when loading a new video
      setChatMessages([]);
      
      // Initialize mock YouTube player
      initializeYouTubePlayer(videoId);
      
    } catch (error) {
      console.error("Error loading video:", error);
      setErrorMessage(error.message || "Failed to load video");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Initialize YouTube Player API (mock implementation)
  const initializeYouTubePlayer = (videoId) => {
    console.log("Initializing YouTube player for video:", videoId);
    
    // In a real implementation, this would initialize the YouTube iframe API
    // For now, we'll just use our mock player
    playerRef.current = mockYouTubePlayer;
    
    // Set some initial values
    setDuration(playerRef.current.getDuration());
    startTimeTracking();
  };
  
  // Start tracking video time
  const startTimeTracking = () => {
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
    }
    
    timeUpdateIntervalRef.current = setInterval(() => {
      if (playerRef.current) {
        try {
          const time = playerRef.current.getCurrentTime();
          setCurrentTime(time);
        } catch (error) {
          console.error("Error getting current time:", error);
        }
      }
    }, 1000); // Update every second
  };
  
  // Handle video playback controls
  const togglePlay = () => {
    if (!playerRef.current) return;
    
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error("Error toggling play state:", error);
    }
  };
  
  const toggleMute = () => {
    if (!playerRef.current) return;
    
    try {
      if (isMuted) {
        playerRef.current.unMute();
      } else {
        playerRef.current.mute();
      }
      setIsMuted(!isMuted);
    } catch (error) {
      console.error("Error toggling mute state:", error);
    }
  };
  
  const handleTimeUpdate = (newTime) => {
    if (!playerRef.current) return;
    
    try {
      playerRef.current.seekTo(newTime);
      setCurrentTime(newTime);
    } catch (error) {
      console.error("Error seeking to time:", error);
    }
  };
  
  // Handle user query submission
  const handleQuerySubmit = async (e) => {
    e.preventDefault();
    
    if (!userQuestion.trim() || !currentVideo.videoId) return;
    
    // Get current exact timestamp
    let exactCurrentTime = currentTime;
    if (playerRef.current) {
      try {
        exactCurrentTime = playerRef.current.getCurrentTime();
      } catch (error) {
        console.error("Error getting exact current time:", error);
      }
    }
    
    // Add user message to chat
    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: userQuestion,
      timestamp: queryType === 'frame' ? exactCurrentTime : null
    };
    
    setChatMessages(prevMessages => [...prevMessages, userMessage]);
    setUserQuestion('');
    setIsProcessingQuery(true);
    
    try {
      // Pause video when querying about the current frame
      if (queryType === 'frame' && isPlaying) {
        togglePlay();
      }
      
      // In a real implementation, you would call your backend here
      // For now, we'll just simulate a response after a delay
      setTimeout(() => {
        // Simulate AI response
        const aiMessage = {
          id: Date.now() + 1,
          sender: 'ai',
          text: `This is a mock response to your question: "${userQuestion}"`,
          timestamp: queryType === 'frame' ? exactCurrentTime : null
        };
        
        setChatMessages(prevMessages => [...prevMessages, aiMessage]);
        setIsProcessingQuery(false);
      }, 1500);
      
    } catch (error) {
      console.error("Error processing query:", error);
      
      // Add error message to chat
      const errorMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: `Sorry, I couldn't process your question: ${error.message || "Unknown error"}`,
        isError: true
      };
      
      setChatMessages(prevMessages => [...prevMessages, errorMsg]);
      setIsProcessingQuery(false);
    }
  };
  
  // Scroll to bottom of chat when new messages are added
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Format time display (e.g., 2:30)
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (timeUpdateIntervalRef.current) {
        clearInterval(timeUpdateIntervalRef.current);
      }
      
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, []);
  
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
          <h1 className="text-3xl font-bold text-white hidden md:block">Improved YouTube Player with AI Chat</h1>
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
                  <Globe className="mr-3" size={18} />
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
          <button 
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg hover:from-red-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-200 shadow-lg"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Load Video'}
          </button>
        </div>
        {errorMessage && (
          <div className="mt-2 text-red-400 text-sm bg-red-900 bg-opacity-30 p-2 rounded">
            ⚠️ {errorMessage}
          </div>
        )}
      </form>
      
      {/* Video Title */}
      <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">
        {currentVideo.title}
      </h2>
      
      {/* Video and Chat Container */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Video Player */}
        <div className="w-full lg:w-2/3">
          <div className="relative overflow-hidden rounded-xl bg-black shadow-2xl aspect-video">
            {currentVideo.videoId ? (
              <div id="youtube-player" className="absolute top-0 left-0 w-full h-full">
                <iframe
                  src={currentVideo.source}
                  title={currentVideo.title}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <p className="text-gray-500">No video loaded</p>
              </div>
            )}
          </div>
          
          {/* Video Controls */}
          <div className="mt-4 flex items-center space-x-4">
            <button 
              onClick={togglePlay} 
              className="p-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-colors"
              disabled={!currentVideo.videoId}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
            
            <button 
              onClick={toggleMute} 
              className="p-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-colors"
              disabled={!currentVideo.videoId}
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
            
            <div className="flex-grow">
              <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={currentTime || 0}
                onChange={(e) => handleTimeUpdate(parseFloat(e.target.value))} 
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" 
                disabled={!currentVideo.videoId}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{formatTime(currentTime || 0)}</span>
                <span>{formatTime(duration || 0)}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Chat Section */}
        <div className="w-full lg:w-1/3 bg-gray-900 rounded-xl shadow-xl overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 bg-gray-800 border-b border-gray-700">
            <h3 className="font-semibold text-lg text-white">AI Video Assistant</h3>
            <p className="text-xs text-gray-400">Current time: {formatTime(currentTime || 0)}</p>
          </div>
          
          {/* Chat Messages */}
          <div 
            ref={chatContainerRef}
            className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
          >
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 my-8">
                <p>No messages yet</p>
                <p className="text-sm mt-2">Ask me anything about this video!</p>
              </div>
            ) : (
              chatMessages.map(message => (
                <div 
                  key={message.id} 
                  className={`${
                    message.sender === 'user' 
                      ? 'ml-8 bg-indigo-900 bg-opacity-50' 
                      : message.sender === 'system'
                        ? 'bg-gray-700 bg-opacity-70'
                        : 'mr-8 bg-gray-800'
                  } rounded-lg p-3 ${message.isError ? 'border border-red-500' : ''}`}
                >
                  <div className="flex items-center mb-1">
                    <span className={`font-medium text-sm ${
                      message.sender === 'user' ? 'text-indigo-300' : 
                      message.sender === 'system' ? 'text-yellow-300' : 'text-cyan-300'
                    }`}>
                      {message.sender === 'user' ? 'You' : 
                       message.sender === 'system' ? 'System' : 'AI Assistant'}
                    </span>
                    {message.timestamp !== null && (
                      <span className="text-gray-500 text-xs ml-2">
                        at {formatTime(message.timestamp)}
                      </span>
                    )}
                  </div>
                  <div className="text-white">{message.text}</div>
                </div>
              ))
            )}
            {isProcessingQuery && (
              <div className="mr-8 bg-gray-800 rounded-lg p-3 animate-pulse">
                <div className="flex items-center mb-1">
                  <span className="font-medium text-sm text-cyan-300">AI Assistant</span>
                </div>
                <div className="text-white">Thinking...</div>
              </div>
            )}
          </div>
          
          {/* Query Input */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex space-x-2 mb-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="queryType"
                  value="video"
                  checked={queryType === 'video'}
                  onChange={() => setQueryType('video')}
                  className="mr-1"
                />
                <span className="text-sm text-white">Ask about video</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="queryType"
                  value="frame"
                  checked={queryType === 'frame'}
                  onChange={() => setQueryType('frame')}
                  className="mr-1"
                />
                <span className="text-sm text-white">Ask about current frame</span>
              </label>
            </div>
            <form onSubmit={handleQuerySubmit} className="flex space-x-2">
              <input
                type="text"
                value={userQuestion}
                onChange={(e) => setUserQuestion(e.target.value)}
                placeholder="Ask a question about the video..."
                className="flex-grow px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white"
                disabled={!currentVideo.videoId || isProcessingQuery}
              />
              <button
                type="submit"
                className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors text-white"
                disabled={!userQuestion.trim() || !currentVideo.videoId || isProcessingQuery}
              >
                <Send size={20} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImprovedYouTubePlayer;