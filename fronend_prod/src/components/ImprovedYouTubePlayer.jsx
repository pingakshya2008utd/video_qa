import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Youtube, Play, Pause, VolumeX, Volume2, 
  Rewind, FastForward, Copy, Send, Menu, Home,
  MessageSquare, Globe, Loader
} from 'lucide-react';
import YoutubeDownloader from './YoutubeDownloader';

// Simple Spinner Component
const SimpleSpinner = ({ size = 24, className = "" }) => {
  return (
    <div 
      className={`inline-block border-2 border-t-transparent border-white rounded-full animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

// Keep the API URL as is
const API_URL = 'https://ebc8342e5d47.ngrok-free.app';

const ImprovedYoutubePlayer = ({ onNavigateToTranslate, onNavigateToHome }) => {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentVideo, setCurrentVideo] = useState({
    title: '',
    source: '',
    videoId: ''
  });
  const [transcript, setTranscript] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [player, setPlayer] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sliderPosition, setSliderPosition] = useState(0);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [userQuestion, setUserQuestion] = useState('');
  const [isProcessingQuery, setIsProcessingQuery] = useState(false);
  const [queryType, setQueryType] = useState('video');
  const [isInitializing, setIsInitializing] = useState(false);
  
  const chatContainerRef = useRef(null);
  const menuRef = useRef(null);
  const playerContainerRef = useRef(null); // Add ref for player container
  
  // Initialize YouTube iframe API
  useEffect(() => {
    if (!window.YT) {
      console.log("Loading YouTube iframe API...");
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      
      // Set up a global callback
      window.onYouTubeIframeAPIReady = () => {
        console.log("YouTube iframe API loaded successfully");
        window.YT.loaded = true;
      };
    } else if (window.YT.Player && !window.YT.loaded) {
      window.YT.loaded = true;
    }
  }, []);
  
  // Function to recreate the player div
  const recreatePlayerDiv = () => {
    if (playerContainerRef.current) {
      // Remove any existing player elements
      playerContainerRef.current.innerHTML = '';
      
      // Create a new div for the YouTube player
      const playerDiv = document.createElement('div');
      playerDiv.id = 'youtube-player';
      playerDiv.className = 'absolute top-0 left-0 w-full h-full';
      playerContainerRef.current.appendChild(playerDiv);
    }
  };
  
  // Initialize YouTube player
  const initializeYouTubePlayer = (videoId) => {
    if (!videoId || isInitializing) return;
    
    console.log("Initializing YouTube player with video ID:", videoId);
    setIsInitializing(true);
    
    // Destroy existing player if it exists
    if (player && typeof player.destroy === 'function') {
      try {
        player.destroy();
      } catch (e) {
        console.warn('Error destroying player:', e);
      }
      setPlayer(null);
      setPlayerReady(false);
    }
    
    // Recreate the player div
    recreatePlayerDiv();
    
    const initPlayer = () => {
      try {
        console.log("Creating new YouTube player...");
        const newPlayer = new window.YT.Player('youtube-player', {
          height: '100%',
          width: '100%',
          videoId: videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            rel: 0,
            showinfo: 0,
            modestbranding: 1,
            enablejsapi: 1,
            origin: 'https://vidyaai.co',  // Fixed: Remove www
            host: 'https://www.youtube.com'  // Use regular YouTube
          },
          events: {
            onReady: onPlayerReady,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
          }
        });
        
        setPlayer(newPlayer);
        console.log("YouTube player created successfully");
      } catch (error) {
        console.error('Error creating YouTube player:', error);
        setErrorMessage('Failed to initialize video player');
        setIsInitializing(false);
      }
    };
    
    // Prevent double initialization
    if (currentVideo.videoId === videoId && player && playerReady) {
      console.log("Player already exists for this video, skipping initialization");
      setIsInitializing(false);
      return;
    }
    
    // Check if YouTube API is ready
    if (window.YT && window.YT.Player && window.YT.loaded) {
      // API is fully loaded, initialize immediately
      setTimeout(initPlayer, 300);
    } else if (window.YT && window.YT.Player) {
      // API exists but might not be fully ready
      setTimeout(initPlayer, 600);
    } else {
      // API not loaded yet, set up callback
      console.log("YouTube API not ready, setting up callback");
      window.onYouTubeIframeAPIReady = () => {
        console.log("YouTube API ready callback triggered");
        setTimeout(initPlayer, 400);
      };
    }
  };
  
  // Player event handlers
  const onPlayerReady = (event) => {
    console.log("YouTube player is ready");
    try {
      const playerInstance = event.target;
      setDuration(playerInstance.getDuration());
      setPlayerReady(true);
      setPlayer(playerInstance);
      setIsInitializing(false); // Clear initializing flag
      
      // Force initial state update
      setTimeout(() => {
        updatePlayerState();
      }, 100);
      
      console.log("Player setup completed");
    } catch (error) {
      console.error("Error in onPlayerReady:", error);
      setIsInitializing(false);
    }
  };
  
  const onPlayerStateChange = (event) => {
    updatePlayerState();
  };
  
  const onPlayerError = (event) => {
    console.error("YouTube player error:", event.data);
    setErrorMessage(`Player error: ${event.data}`);
    setIsInitializing(false);
  };
  
  const updatePlayerState = () => {
    if (!player || typeof player.getPlayerState !== 'function') return;
    
    try {
      const state = player.getPlayerState();
      setIsPlaying(state === 1); // 1 = playing
      
      if (typeof player.isMuted === 'function') {
        setIsMuted(player.isMuted());
      }
      
      if (!isDraggingSlider && typeof player.getCurrentTime === 'function') {
        const current = player.getCurrentTime() || 0;
        setCurrentTime(current);
        setSliderPosition(current);
      }
      
      if (typeof player.getDuration === 'function') {
        setDuration(player.getDuration() || 0);
      }
    } catch (e) {
      console.error("Error updating player state", e);
    }
  };
  
  // Update player state periodically
  useEffect(() => {
    const intervalId = setInterval(() => {
      updatePlayerState();
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [player, isDraggingSlider]);
  
  // Handle slider changes
  const handleSliderChange = (e) => {
    setSliderPosition(parseFloat(e.target.value));
    if (!isDraggingSlider) {
      setIsDraggingSlider(true);
    }
  };
  
  const handleSliderRelease = () => {
    if (player && isDraggingSlider && typeof player.seekTo === 'function') {
      try {
        player.seekTo(sliderPosition);
        setCurrentTime(sliderPosition);
      } catch (error) {
        console.error("Error seeking to position:", error);
      } finally {
        setIsDraggingSlider(false);
      }
    }
  };
  
  // Player controls
  const togglePlay = () => {
    if (!player) return;
    
    try {
      if (isPlaying && typeof player.pauseVideo === 'function') {
        player.pauseVideo();
      } else if (!isPlaying && typeof player.playVideo === 'function') {
        player.playVideo();
      }
    } catch (error) {
      console.error("Error toggling play:", error);
    }
  };
  
  const toggleMute = () => {
    if (!player) return;
    
    try {
      if (isMuted && typeof player.unMute === 'function') {
        player.unMute();
      } else if (!isMuted && typeof player.mute === 'function') {
        player.mute();
      }
    } catch (error) {
      console.error("Error toggling mute:", error);
    }
  };
  
  const skipBackward = () => {
    if (!player || typeof player.seekTo !== 'function') return;
    
    try {
      const newTime = Math.max(0, currentTime - 10);
      player.seekTo(newTime);
      setCurrentTime(newTime);
      setSliderPosition(newTime);
    } catch (error) {
      console.error("Error skipping backward:", error);
    }
  };
  
  const skipForward = () => {
    if (!player || typeof player.seekTo !== 'function') return;
    
    try {
      const newTime = Math.min(duration, currentTime + 10);
      player.seekTo(newTime);
      setCurrentTime(newTime);
      setSliderPosition(newTime);
    } catch (error) {
      console.error("Error skipping forward:", error);
    }
  };
  
  // Format time display
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Handle YouTube URL submission
  const handleYoutubeSubmit = async (e) => {
    e.preventDefault();
    
    if (!youtubeUrl.trim()) return;
    
    setIsLoading(true);
    setErrorMessage('');
    setTranscript(''); // Clear transcript when loading new video
    
    try {
      // Extract video ID from URL
      let videoId = '';
      
      if (youtubeUrl.includes('youtube.com/watch?v=')) {
        const urlParams = new URLSearchParams(new URL(youtubeUrl).search);
        videoId = urlParams.get('v');
      } else if (youtubeUrl.includes('youtu.be/')) {
        videoId = youtubeUrl.split('youtu.be/')[1].split('?')[0];
      } else {
        throw new Error("Invalid YouTube URL format");
      }
      
      if (!videoId) {
        throw new Error("Could not extract video ID from URL");
      }
      
      // Check if it's the same video to prevent unnecessary reloading
      if (currentVideo.videoId === videoId) {
        console.log("Same video already loaded");
        setIsLoading(false);
        return;
      }
      
      // Get video info from backend with retry logic
      let response;
      try {
        response = await axios.post(`${API_URL}/api/youtube/info`, {
          url: youtubeUrl
        }, {
          timeout: 60000, // 60 second timeout
          headers: {
            'Content-Type': 'application/json'
          }
        });
      } catch (networkError) {
        if (networkError.code === 'ERR_NETWORK_CHANGED') {
          // Retry once on network change
          console.log("Network changed, retrying...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          response = await axios.post(`${API_URL}/api/youtube/info`, {
            url: youtubeUrl
          });
        } else {
          throw networkError;
        }
      }
      
      // Set transcript if available
      if (response.data.transcript) {
        setTranscript(response.data.transcript);
      } else {
        setTranscript("No transcript available for this video.");
      }
      
      // Set current video info
      setCurrentVideo({
        title: response.data.title || "YouTube Video", 
        source: `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=https://vidyaai.co&controls=0`,
        videoId: videoId
      });
      
      // Clear chat messages when loading a new video
      setChatMessages([]);
      
      // Initialize YouTube player with a small delay to ensure state is updated
      setTimeout(() => {
        initializeYouTubePlayer(videoId);
      }, 100);
      
    } catch (error) {
      console.error("Error loading video:", error);
      setErrorMessage(error.message || "Failed to load video");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Copy transcript to clipboard
  const copyTranscript = () => {
    if (transcript) {
      navigator.clipboard.writeText(transcript);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };
  
  // Handle user query submission
  const handleQuerySubmit = async (e) => {
    e.preventDefault();
    
    if (!userQuestion.trim() || !currentVideo.videoId || isProcessingQuery) return;
    
    // Add user message to chat
    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: userQuestion,
      timestamp: currentTime
    };
    
    setChatMessages(prevMessages => [...prevMessages, userMessage]);
    const currentQuery = userQuestion; // Store the query before clearing
    setUserQuestion('');
    setIsProcessingQuery(true);
    
    try {
      // Scroll to bottom of chat
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
      
      // Send query to backend
      const response = await axios.post(`${API_URL}/api/query/video`, {
        video_id: currentVideo.videoId,
        query: currentQuery,
        timestamp: currentTime,
        is_image_query: queryType === 'frame'
      });
      
      // Add AI response to chat
      const aiMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        text: response.data.response,
        timestamp: currentTime
      };
      
      setChatMessages(prevMessages => [...prevMessages, aiMessage]);
      
    } catch (error) {
      console.error("Error processing query:", error);
      
      // Add error message to chat
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'system',
        text: `Error: ${error.response?.data?.detail || error.message || "Something went wrong"}`,
        timestamp: null,
        isError: true
      };
      
      setChatMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsProcessingQuery(false);
      
      // Scroll to bottom of chat
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 100);
    }
  };
  
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
  
  // Scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-8 bg-gray-950">
      <div className="flex items-center justify-between mb-8">
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
          <h1 className="text-3xl font-bold text-white">Chat with My Video</h1>
        </div>
        
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-white transition-colors"
          >
            <Menu size={24} />
          </button>
          
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
              <div className="py-1" role="menu" aria-orientation="vertical">
                <button 
                  onClick={onNavigateToHome}
                  className="flex items-center w-full px-4 py-3 text-white hover:bg-gray-700 transition-colors text-left"
                  role="menuitem"
                >
                  <Home className="mr-3" size={18} />
                  <span>Home</span>
                </button>
                <button 
                  onClick={() => {}}
                  className="flex items-center w-full px-4 py-3 text-white hover:bg-gray-700 transition-colors text-left"
                  role="menuitem"
                >
                  <MessageSquare className="mr-3" size={18} />
                  <span>Chat with Video</span>
                </button>
                <button 
                  onClick={onNavigateToTranslate}
                  className="flex items-center w-full px-4 py-3 text-white hover:bg-gray-700 transition-colors text-left"
                  role="menuitem"
                >
                  <Globe className="mr-3" size={18} />
                  <span>Translate</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <form onSubmit={handleYoutubeSubmit} className="mb-8">
        <div className="relative flex flex-col md:flex-row md:items-center gap-2">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <Youtube size={18} className="text-red-500" />
            </div>
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="Enter YouTube URL (e.g., https://www.youtube.com/watch?v=...)"
              className="w-full pl-12 pr-4 py-4 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-gray-400 shadow-lg"
            />
          </div>
          <button 
            type="submit"
            className="px-6 py-4 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-xl hover:from-red-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-200 shadow-lg flex items-center justify-center"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <SimpleSpinner size={20} className="mr-2" />
                <span>Loading...</span>
              </>
            ) : (
              'Load Video'
            )}
          </button>
        </div>
        {errorMessage && (
          <div className="mt-3 text-red-400 text-sm bg-red-900 bg-opacity-30 p-3 rounded-lg">
            ⚠️ {errorMessage}
          </div>
        )}
      </form>
      
      <h2 className="text-2xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">
        {currentVideo.title || "Enter a YouTube URL to get started"}
      </h2>
      
      {/* Add the download component when a video is loaded */}
      {currentVideo.videoId && (
        <YoutubeDownloader
          videoId={currentVideo.videoId}
          videoTitle={currentVideo.title}
        />
      )}
      
      <div className="flex flex-col lg:flex-row gap-6 mt-6">
        <div className="w-full lg:w-2/3">
          <div className="relative overflow-hidden rounded-2xl bg-black shadow-2xl aspect-video">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10">
                <div className="flex flex-col items-center">
                  <SimpleSpinner size={48} className="mb-4" />
                  <p className="text-white text-lg">Loading video...</p>
                </div>
              </div>
            )}
            
            {currentVideo.videoId ? (
              <div 
                ref={playerContainerRef}
                className="absolute top-0 left-0 w-full h-full"
              >
                {/* YouTube player will be inserted here */}
              </div>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                <div className="text-center">
                  <Youtube size={64} className="text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-500">Enter a YouTube URL to load a video</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex items-center space-x-4">
            <button 
              onClick={togglePlay} 
              className="p-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-lg"
              disabled={!currentVideo.videoId}
            >
              {isPlaying ? <Pause size={22} /> : <Play size={22} />}
            </button>
            
            <button 
              onClick={toggleMute} 
              className="p-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-lg"
              disabled={!currentVideo.videoId}
            >
              {isMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}
            </button>
            
            <div className="flex-grow">
              <input 
                type="range" 
                min="0" 
                max={duration || 100} 
                value={sliderPosition || 0}
                onChange={handleSliderChange}
                onMouseUp={handleSliderRelease}
                onTouchEnd={handleSliderRelease}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500" 
                disabled={!currentVideo.videoId}
                style={{
                  background: `linear-gradient(to right, rgb(168, 85, 247) 0%, rgb(168, 85, 247) ${(sliderPosition / (duration || 1)) * 100}%, rgb(55, 65, 81) ${(sliderPosition / (duration || 1)) * 100}%, rgb(55, 65, 81) 100%)`
                }}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{formatTime(currentTime || 0)}</span>
                <span>{formatTime(duration || 0)}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-2 flex justify-center space-x-4">
            <button 
              onClick={skipBackward}
              className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-white transition-colors"
              disabled={!currentVideo.videoId}
            >
              <Rewind size={16} />
              <span className="sr-only">Skip backward</span>
            </button>
            
            <button 
              onClick={skipForward}
              className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-white transition-colors"
              disabled={!currentVideo.videoId}
            >
              <FastForward size={16} />
              <span className="sr-only">Skip forward</span>
            </button>
          </div>
          
          <div className="mt-8 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white">Video Transcript</h3>
              {transcript && (
                <button 
                  onClick={copyTranscript}
                  className="text-xs flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
                >
                  <Copy size={14} className="mr-2" />
                  {isCopied ? "Copied!" : "Copy to clipboard"}
                </button>
              )}
            </div>
            
            <div 
              className="bg-gray-800 rounded-xl p-5 h-56 overflow-y-auto text-gray-300 text-sm leading-relaxed scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 shadow-inner"
            >
              {transcript ? (
                transcript.split('\n').map((line, index) => (
                  <p key={index} className="mb-2">
                    {line}
                  </p>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <p className="text-gray-500 italic">Transcript will appear here after loading a video.</p>
                  {isLoading && (
                    <SimpleSpinner size={24} className="mt-4" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="w-full lg:w-1/3 bg-gray-900 rounded-xl shadow-xl overflow-hidden flex flex-col h-[650px]">
          <div className="p-4 bg-gray-800 border-b border-gray-700">
            <h3 className="font-semibold text-lg text-white">AI Video Assistant</h3>
            <p className="text-xs text-gray-400">Current time: {formatTime(currentTime || 0)}</p>
          </div>
          
          <div 
            ref={chatContainerRef}
            className="flex-grow overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
          >
            {chatMessages.length === 0 ? (
              <div className="text-center text-gray-500 my-12 flex flex-col items-center">
                <MessageSquare size={40} className="mb-4 text-gray-700" />
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
                  } rounded-xl p-4 ${message.isError ? 'border border-red-500' : ''} shadow-md`}
                >
                  <div className="flex items-center mb-2">
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
              <div className="mr-8 bg-gray-800 rounded-xl p-4 shadow-md">
                <div className="flex items-center mb-2">
                  <span className="font-medium text-sm text-cyan-300">AI Assistant</span>
                </div>
                <div className="flex items-center text-white">
                  <SimpleSpinner size={16} className="mr-3" />
                  Thinking...
                </div>
              </div>
            )}
          </div>
          
          <div className="p-4 border-t border-gray-700 bg-gray-800 bg-opacity-50">
            <div className="flex space-x-4 mb-3">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="queryType"
                  value="video"
                  checked={queryType === 'video'}
                  onChange={() => setQueryType('video')}
                  className="mr-2 accent-indigo-500"
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
                  className="mr-2 accent-indigo-500"
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
                className="flex-grow px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-gray-400 shadow-inner"
                disabled={!currentVideo.videoId || isProcessingQuery}
              />
              <button
                type="submit"
                className="p-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors text-white disabled:opacity-50 disabled:hover:bg-indigo-600"
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

export default ImprovedYoutubePlayer;