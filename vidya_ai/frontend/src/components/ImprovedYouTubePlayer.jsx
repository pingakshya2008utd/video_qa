import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Send, Youtube } from 'lucide-react';
import axios from 'axios';

const ImprovedYouTubePlayer = () => {
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
  
  const videoRef = useRef(null);
  const chatContainerRef = useRef(null);
  
  // Handle YouTube URL input
  const handleYoutubeSubmit = async (e) => {
    e.preventDefault();
    
    if (!youtubeUrl.trim()) return;
    
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
      
      // Send request to backend to get video info
      const response = await axios.post('http://localhost:8000/api/youtube/info', {
        url: youtubeUrl
      });
      
      setCurrentVideo({
        title: response.data.video_title || "YouTube Video", 
        source: `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}&controls=0`,
        videoId: videoId
      });
      
      // Clear chat messages when loading a new video
      setChatMessages([]);
      
    } catch (error) {
      console.error("Error loading video:", error);
      setErrorMessage(error.message || "Failed to load video");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle video playback controls
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.contentWindow.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
      } else {
        videoRef.current.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
      }
      setIsPlaying(!isPlaying);
    }
  };
  
  const toggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.contentWindow.postMessage('{"event":"command","func":"unMute","args":""}', '*');
      } else {
        videoRef.current.contentWindow.postMessage('{"event":"command","func":"mute","args":""}', '*');
      }
      setIsMuted(!isMuted);
    }
  };
  
  const handleTimeUpdate = (newTime) => {
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.contentWindow.postMessage(`{"event":"command","func":"seekTo","args":[${newTime}, true]}`, '*');
    }
  };
  
  // Handle user query submission
  const handleQuerySubmit = async (e) => {
    e.preventDefault();
    
    if (!userQuestion.trim() || !currentVideo.videoId) return;
    
    // Add user message to chat
    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: userQuestion,
      timestamp: queryType === 'frame' ? currentTime : null
    };
    
    setChatMessages(prevMessages => [...prevMessages, userMessage]);
    setUserQuestion('');
    setIsProcessingQuery(true);
    
    try {
      // Pause video when querying about the current frame
      if (queryType === 'frame' && isPlaying) {
        togglePlay();
      }
      
      // Send query to backend
      const response = await axios.post('http://localhost:8000/api/query/video', {
        video_id: currentVideo.videoId,
        query: userMessage.text,
        timestamp: queryType === 'frame' ? currentTime : null,
        is_image_query: queryType === 'frame'
      });
      
      // Add AI response to chat
      const aiMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        text: response.data.response,
        timestamp: queryType === 'frame' ? currentTime : null
      };
      
      setChatMessages(prevMessages => [...prevMessages, aiMessage]);
      
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
    } finally {
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
  
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center text-white">Improved YouTube Player with AI Chat</h1>
      
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
              <iframe
                ref={videoRef}
                src={currentVideo.source}
                title={currentVideo.title}
                className="absolute top-0 left-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
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
                max={duration} 
                value={currentTime} 
                onChange={(e) => handleTimeUpdate(parseFloat(e.target.value))} 
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500" 
                disabled={!currentVideo.videoId}
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Chat Section */}
        <div className="w-full lg:w-1/3 bg-gray-900 rounded-xl shadow-xl overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 bg-gray-800 border-b border-gray-700">
            <h3 className="font-semibold text-lg">AI Video Assistant</h3>
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
                      : 'mr-8 bg-gray-800'
                  } rounded-lg p-3 ${message.isError ? 'border border-red-500' : ''}`}
                >
                  <div className="flex items-center mb-1">
                    <span className={`font-medium text-sm ${
                      message.sender === 'user' ? 'text-indigo-300' : 'text-cyan-300'
                    }`}>
                      {message.sender === 'user' ? 'You' : 'AI Assistant'}
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
                className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
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