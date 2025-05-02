import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, ExternalLink, Youtube, Send, MessageCircle, User, Bot } from 'lucide-react';

const EnhancedYouTubePlayer = () => {
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
  const [progress, setProgress] = useState(0);
  const [chatMessages, setChatMessages] = useState([
    {
      id: 1,
      text: "Hi there! I'm ready to answer questions about this video. What would you like to know?",
      isUser: false,
      timestamp: 0
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const chatContainerRef = useRef(null);
  
  // Initialize YouTube API
  useEffect(() => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    
    window.onYouTubeIframeAPIReady = () => {
      console.log('YouTube IFrame API ready');
    };
    
    return () => {
      window.onYouTubeIframeAPIReady = null;
    };
  }, []);
  
  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);
  
  // Handle YouTube URL input and fetch video info
  const handleYoutubeSubmit = async (e) => {
    e.preventDefault();
    
    if (!youtubeUrl.trim()) {
      setErrorMessage('Please enter a YouTube URL');
      return;
    }
    
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const response = await fetch('http://localhost:8000/api/youtube/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: youtubeUrl
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to process YouTube URL');
      }
      
      const data = await response.json();
      
      // Update video state with the data from the API
      setCurrentVideo({
        title: data.title,
        source: data.url,
        videoId: data.video_id,
        embedUrl: data.embed_url
      });
      
      // Reset playback state
      setIsPlaying(false);
      setCurrentTime(0);
      setProgress(0);
      
      // Add welcome message specific to the new video
      setChatMessages([
        {
          id: Date.now(),
          text: `Hi there! I'm ready to answer questions about "${data.title}". What would you like to know?`,
          isUser: false,
          timestamp: 0
        }
      ]);
      
    } catch (error) {
      console.error('Error fetching YouTube info:', error);
      setErrorMessage(error.message || 'Failed to load video. Please check the URL and try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Setup YouTube player when videoId changes
  useEffect(() => {
    if (!currentVideo.videoId || !window.YT) return;
    
    // If we already have a player, destroy it
    if (playerRef.current) {
      playerRef.current.destroy();
    }
    
    // Create a new player
    playerRef.current = new window.YT.Player(videoRef.current, {
      videoId: currentVideo.videoId,
      playerVars: {
        'playsinline': 1,
        'rel': 0,
        'modestbranding': 1,
        'controls': 0  // Hide default controls
      },
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange
      }
    });
    
    function onPlayerReady(event) {
      // Player is ready
      setDuration(event.target.getDuration());
    }
    
    function onPlayerStateChange(event) {
      // Update play state based on player state
      setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
      
      // Update time while playing
      if (event.data === window.YT.PlayerState.PLAYING) {
        const timeUpdateInterval = setInterval(() => {
          if (playerRef.current) {
            const currentTime = playerRef.current.getCurrentTime();
            const duration = playerRef.current.getDuration();
            setCurrentTime(currentTime);
            setProgress((currentTime / duration) * 100);
          }
        }, 1000);
        
        return () => clearInterval(timeUpdateInterval);
      }
    }
  }, [currentVideo.videoId]);
  
  // Video playback control
  const handlePlayPause = () => {
    if (!playerRef.current) return;
    
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };
  
  const handleMuteToggle = () => {
    if (!playerRef.current) return;
    
    if (isMuted) {
      playerRef.current.unMute();
    } else {
      playerRef.current.mute();
    }
    
    setIsMuted(!isMuted);
  };
  
  // Handle progress bar click to seek
  const handleProgressClick = (e) => {
    if (!playerRef.current) return;
    
    const progressBar = e.currentTarget;
    const clickPosition = (e.clientX - progressBar.getBoundingClientRect().left) / progressBar.offsetWidth;
    const seekToTime = clickPosition * duration;
    
    playerRef.current.seekTo(seekToTime, true);
    setCurrentTime(seekToTime);
    setProgress(clickPosition * 100);
  };
  
  // Handle chat input submission
  const handleSendMessage = (e) => {
    e.preventDefault();
    
    if (!chatInput.trim()) return;
    
    // Add user message to chat
    const newMessage = {
      id: Date.now(),
      text: chatInput,
      isUser: true,
      timestamp: currentTime
    };
    
    setChatMessages(prev => [...prev, newMessage]);
    setChatInput('');
    
    // UI-only simulation of a response (no actual backend call)
    setTimeout(() => {
      // Simulate an AI response
      const demoResponses = [
        `I noticed you asked that at ${formatTime(currentTime)}. This is where the video discusses that topic.`,
        "Great question! The video covers that concept in the next few minutes.",
        "Based on the video content, I'd say the key point here is...",
        "The speaker is explaining this concept by using the analogy shown on screen.",
        "Looking at the visual, I can see why you're asking. The diagram shows..."
      ];
      
      const randomResponse = demoResponses[Math.floor(Math.random() * demoResponses.length)];
      
      setChatMessages(prev => [...prev, {
        id: Date.now() + 1,
        text: randomResponse,
        isUser: false,
        timestamp: currentTime
      }]);
    }, 1000);
  };
  
  // Format time (seconds) to MM:SS
  const formatTime = (seconds) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-900 to-indigo-900 text-white">
      {/* Header */}
      <header className="bg-indigo-800 px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Youtube size={24} className="text-red-500" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-red-500 to-purple-500 bg-clip-text text-transparent">
              YouTube Player with Q&A
            </h1>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="flex-grow p-6">
        <div className="max-w-7xl mx-auto">
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
                {/* This div will be replaced by the YouTube player */}
                <div 
                  id="youtube-player" 
                  ref={videoRef} 
                  className="absolute inset-0 w-full h-full rounded-xl"
                >
                  {!currentVideo.videoId && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-opacity-70 bg-gradient-to-r from-gray-800 to-gray-900">
                      <Youtube size={64} className="text-red-500 mb-4 opacity-50" />
                      <p className="text-xl">No video loaded</p>
                      <p className="text-sm mt-2">Enter a YouTube URL above to get started</p>
                    </div>
                  )}
                </div>
                
                {/* Custom Video Controls */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/70 to-transparent px-4 py-6">
                  {/* Progress bar */}
                  <div 
                    className="w-full h-1 bg-gray-700 rounded-full mb-4 cursor-pointer"
                    onClick={handleProgressClick}
                  >
                    <div 
                      className="h-full bg-gradient-to-r from-red-500 to-pink-500 rounded-full relative"
                      style={{ width: `${progress}%` }}
                    >
                      <div className="absolute right-0 top-1/2 transform -translate-y-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg"></div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button 
                        className="text-white hover:text-red-400 transition-colors p-2 rounded-full hover:bg-white/10"
                        onClick={handlePlayPause}
                        disabled={!currentVideo.videoId}
                      >
                        {isPlaying ? 
                          <Pause size={28} className="fill-current" /> : 
                          <Play size={28} className="fill-current" />
                        }
                      </button>
                      <button 
                        className="text-white hover:text-red-400 transition-colors p-2 rounded-full hover:bg-white/10"
                        onClick={handleMuteToggle}
                        disabled={!currentVideo.videoId}
                      >
                        {isMuted ? 
                          <VolumeX size={24} /> : 
                          <Volume2 size={24} />
                        }
                      </button>
                      <div className="text-white text-sm font-mono">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </div>
                    </div>
                    
                    {currentVideo.source && (
                      <a 
                        href={currentVideo.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-300 hover:text-white flex items-center space-x-1 transition-colors"
                      >
                        <span>YouTube</span>
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Video Source */}
              {currentVideo.source && (
                <div className="mt-4 text-sm text-gray-400 border-t border-gray-800 pt-4">
                  <div className="flex items-center space-x-2">
                    <span>Source:</span>
                    <a 
                      href={currentVideo.source} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-indigo-400 hover:text-indigo-300 break-all hover:underline flex items-center"
                    >
                      {currentVideo.source}
                      <ExternalLink size={14} className="ml-1 inline-block" />
                    </a>
                  </div>
                </div>
              )}
            </div>
            
            {/* Q&A Chat Section */}
            <div className="w-full lg:w-1/3 bg-gray-800 bg-opacity-50 rounded-xl shadow-lg overflow-hidden border border-gray-700 flex flex-col">
              {/* Chat Header */}
              <div className="bg-indigo-900 bg-opacity-70 px-4 py-3 border-b border-gray-700">
                <div className="flex items-center space-x-2">
                  <MessageCircle size={20} className="text-indigo-400" />
                  <h3 className="font-semibold text-lg">Video Q&A</h3>
                </div>
                <p className="text-xs text-gray-400 mt-1">Ask questions about any part of the video</p>
              </div>
              
              {/* Chat Messages */}
              <div 
                ref={chatContainerRef}
                className="flex-grow p-4 overflow-y-auto scroll-smooth"
                style={{ maxHeight: 'calc(100vh - 400px)' }}
              >
                <div className="space-y-4">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`flex items-start max-w-[85%] ${msg.isUser ? 'flex-row-reverse' : ''}`}>
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${
                          msg.isUser ? 'bg-indigo-700 ml-2' : 'bg-purple-800 mr-2'
                        }`}>
                          {msg.isUser ? 
                            <User size={16} className="text-indigo-200" /> : 
                            <Bot size={16} className="text-purple-200" />
                          }
                        </div>
                        <div className={`p-3 rounded-lg ${
                          msg.isUser 
                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                            : 'bg-gray-700 text-gray-100 rounded-tl-none'
                        }`}>
                          <p className="text-sm">{msg.text}</p>
                          {msg.timestamp > 0 && (
                            <span className="block text-xs opacity-75 mt-1">
                              at {formatTime(msg.timestamp)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Chat Input */}
              <div className="bg-gray-900 bg-opacity-50 p-4 border-t border-gray-700">
                <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask a question about the video..."
                    className="flex-grow px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent text-white placeholder-gray-400"
                  />
                  <button 
                    type="submit"
                    className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                    disabled={!currentVideo.videoId}
                  >
                    <Send size={20} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-gray-900 py-4 px-6 text-center text-gray-500 text-sm">
        <p>YouTube Player with Q&A &copy; {new Date().getFullYear()} - Built with React and Python</p>
      </footer>
    </div>
  );
};

export default EnhancedYouTubePlayer;