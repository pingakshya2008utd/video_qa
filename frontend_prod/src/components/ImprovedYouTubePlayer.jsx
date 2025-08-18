// ImprovedYoutubePlayer.jsx - Main component with Quiz integration
import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Youtube, Menu, Home, MessageSquare, Globe, Upload } from 'lucide-react';
import YoutubeDownloader from './YoutubeDownloader';
import PlayerComponent from './PlayerComponent';
import TranscriptComponent from './TranscriptComponent';
import ChatBoxComponent from './ChatBoxComponent';
import QuizPanel from './QuizPanel';
import { API_URL, saveToLocalStorage, loadFromLocalStorage, SimpleSpinner } from './utils.jsx';
import { useAuth } from '../context/AuthContext';
import VideoUploader from './VideoUploader.jsx';

const ImprovedYoutubePlayer = ({ onNavigateToTranslate, onNavigateToHome, selectedVideo }) => {
  const { currentUser } = useAuth();
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(() => {
    return loadFromLocalStorage('currentVideo', { title: '', source: '', videoId: '', sourceType: 'youtube', videoUrl: '' });
  });
  const [transcript, setTranscript] = useState(() => {
    return loadFromLocalStorage('transcript', '');
  });
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState(() => {
    return loadFromLocalStorage('chatMessages', []);
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [player, setPlayer] = useState(null);
  
  // Quiz state
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [systemMessages, setSystemMessages] = useState([]);
  const [isUploadCompleting, setIsUploadCompleting] = useState(false);
  const [showVideoUploader, setShowVideoUploader] = useState(true);
  
  const menuRef = useRef(null);

  // Load selected video from gallery
  useEffect(() => {
    if (selectedVideo && selectedVideo.videoId && selectedVideo.videoId !== currentVideo.videoId && !isUploadCompleting) {
      loadSelectedVideo(selectedVideo);
    }
  }, [selectedVideo, isUploadCompleting]); // Add isUploadCompleting to prevent interference during upload

  const loadSelectedVideo = async (videoData) => {
    console.log("loadSelectedVideo called with:", videoData);
    if (!videoData || !videoData.videoId) {
      console.error("Invalid video data provided");
      setErrorMessage("Invalid video data provided");
      return;
    }

    // Prevent loading if we're in the middle of an upload completion
    if (isUploadCompleting) {
      console.log("Skipping loadSelectedVideo - upload completion in progress");
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setTranscript('');
    setChatMessages([]);
    setIsQuizOpen(false);
    setSystemMessages([]);
    setShowVideoUploader(true); // Show uploader when loading selected video

    try {
      if (videoData.sourceType === 'youtube') {
        // For YouTube videos, we need to fetch transcript
        const response = await axios.post(`${API_URL}/api/youtube/info`, {
          url: `https://www.youtube.com/watch?v=${videoData.videoId}`,
          user_id: currentUser?.uid || null
        }, {
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          }
        });

        if (response.data.transcript) {
          setTranscript(response.data.transcript);
        } else {
          setTranscript("No transcript available for this video.");
        }

        setCurrentVideo({
          title: response.data.title || videoData.title || "YouTube Video",
          source: videoData.source,
          videoId: videoData.videoId,
          sourceType: 'youtube',
          videoUrl: ''
        });
      } else {
        // For uploaded videos, fetch info from API
        const response = await axios.get(`${API_URL}/api/user-videos/info`, {
          params: { video_id: videoData.videoId },
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });

        if (response.data) {
          setTranscript(response.data.transcript || '');
          setCurrentVideo({
            title: response.data.title || videoData.title || 'Uploaded Video',
            videoId: videoData.videoId,
            source: '',
            sourceType: 'uploaded',
            videoUrl: response.data.video_url || videoData.videoUrl
          });
        } else {
          setCurrentVideo({
            title: videoData.title || 'Uploaded Video',
            videoId: videoData.videoId,
            source: '',
            sourceType: 'uploaded',
            videoUrl: videoData.videoUrl
          });
        }
      }

      // Update URL
      const newUrl = new URL(window.location);
      newUrl.searchParams.set('v', videoData.videoId);
      window.history.replaceState({}, '', newUrl);

    } catch (error) {
      console.error("Error loading selected video:", error);
      setErrorMessage(error.response?.data?.detail || error.message || "Failed to load video");
    } finally {
      setIsLoading(false);
    }
  };

  const handleYoutubeSubmit = async (e) => {
    e.preventDefault();
    
    if (!youtubeUrl.trim()) return;
    
    setIsLoading(true);
    setErrorMessage('');
    setTranscript('');
    setShowVideoUploader(true); // Show uploader when loading new video
    
    try {
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
      
      if (currentVideo.videoId === videoId) {
        console.log("Same video already loaded");
        setIsLoading(false);
        return;
      }
      
      let response;
      try {
        response = await axios.post(`${API_URL}/api/youtube/info`, {
          url: youtubeUrl,
          user_id: currentUser?.uid || null
        }, {
          timeout: 60000,
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true'
          }
        });
      } catch (networkError) {
        if (networkError.code === 'ERR_NETWORK_CHANGED') {
          console.log("Network changed, retrying...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          response = await axios.post(`${API_URL}/api/youtube/info`, {
            url: youtubeUrl,
            user_id: currentUser?.uid || null
          }, {
            headers: {
              'Content-Type': 'application/json',
              'ngrok-skip-browser-warning': 'true'
            }
          });
        } else {
          throw networkError;
        }
      }
      
      if (response.data.transcript) {
        setTranscript(response.data.transcript);
      } else {
        setTranscript("No transcript available for this video.");
      }
      
      setCurrentVideo({
        title: response.data.title || "YouTube Video", 
        source: `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=https://vidyaai.co&controls=0`,
        videoId: videoId,
        sourceType: 'youtube',
        videoUrl: ''
      });

      const newUrl = new URL(window.location);
      newUrl.searchParams.set('v', videoId);
      window.history.replaceState({}, '', newUrl);
      
      setChatMessages([]);
      setIsQuizOpen(false); // Close quiz when new video loads
      setSystemMessages([]);
      
    } catch (error) {
      console.error("Error loading video:", error);
      setErrorMessage(error.message || "Failed to load video");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadComplete = useCallback(async (videoId) => {
    console.log("Upload completion started for video ID:", videoId);
    setIsUploadCompleting(true);
    setYoutubeUrl('');
    setTranscript('');
    setChatMessages([]);
    setIsQuizOpen(false);
    setSystemMessages([]);
    
    try {
      // Fetch video info from API
      const response = await axios.get(`${API_URL}/api/user-videos/info`, {
        params: { video_id: videoId },
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });

      if (response.data) {
        console.log("Upload completion: Setting video data for ID:", videoId);
        setTranscript(response.data.transcript || '');
        setCurrentVideo({
          title: response.data.title || 'Uploaded Video',
          videoId: videoId,
          source: '',
          sourceType: 'uploaded',
          videoUrl: response.data.video_url
        });
        
        // Update URL to reflect the uploaded video
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('v', videoId);
        window.history.replaceState({}, '', newUrl);
      }
    } catch (e) {
      console.warn('Failed to fetch uploaded video info', e);
      setErrorMessage('Upload completed but failed to load video details');
    } finally {
      console.log("Upload completion finished for video ID:", videoId);
      setIsUploadCompleting(false);
    }
  }, []);

  const handleUploadSuccess = useCallback(() => {
    console.log("Upload successful, hiding VideoUploader");
    setShowVideoUploader(false);
  }, []);

  const handlePlayerReady = (playerInstance) => {
    setPlayer(playerInstance);
  };

  const handleTimeUpdate = (time) => {
    setCurrentTime(time);
  };

  const handleSeekToTime = (timeInSeconds) => {
    if (window.playerSeekTo) {
      window.playerSeekTo(timeInSeconds);
    }
  };

  const handleQuizSystemMessage = (message) => {
    setSystemMessages(prev => [...prev, message]);
    
  };

  const handleStartQuiz = () => {
    if (!currentVideo.videoId) {
      handleQuizSystemMessage({
        id: Date.now(),
        sender: 'system',
        text: 'Please load a video first to start the quiz.',
        isError: true
      });
      return;
    }
    setIsQuizOpen(true);
  };

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

  // Save to localStorage when state changes
  useEffect(() => {
    if (currentVideo.videoId) {
      saveToLocalStorage('currentVideo', currentVideo);
    }
  }, [currentVideo]);

  useEffect(() => {
    if (transcript) {
      saveToLocalStorage('transcript', transcript);
    }
  }, [transcript]);

  useEffect(() => {
    saveToLocalStorage('chatMessages', chatMessages);
  }, [chatMessages]);

  // Handle URL parameters - only on initial load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const videoIdFromUrl = urlParams.get('v');
    
    // Only handle URL parameters if no selectedVideo is provided and no video is currently loaded
    // and we're not in the middle of an upload process
    if (videoIdFromUrl && !currentVideo.videoId && !youtubeUrl && !selectedVideo) {
      setYoutubeUrl(`https://www.youtube.com/watch?v=${videoIdFromUrl}`);
    }
  }, []); // Empty dependency array - only run once on mount
  
  return (
    <div className="w-full min-h-screen px-6 py-8 bg-gray-950">
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
          <div>
            <h1 className="text-3xl font-bold text-white">Chat with My Video</h1>
            {selectedVideo && (
              <p className="text-sm text-indigo-400 mt-1">
                Video loaded from gallery: {selectedVideo.title}
              </p>
            )}
          </div>
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
          {showVideoUploader ? (
            <div className="relative">
              <VideoUploader 
                onUploadComplete={handleUploadComplete} 
                onUploadSuccess={handleUploadSuccess}
              />
            </div>
          ) : (
            <button
              onClick={() => setShowVideoUploader(true)}
              className="px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-200 shadow-lg flex items-center justify-center"
              title="Upload another video"
            >
              <Upload size={20} className="mr-2" />
              <span>Upload Another Video</span>
            </button>
          )}
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
      
      {currentVideo.videoId && currentVideo.sourceType === 'youtube' && (
        <YoutubeDownloader
          videoId={currentVideo.videoId}
          videoTitle={currentVideo.title}
        />
      )}
      
      <div className="flex flex-col xl:flex-row gap-8 mt-6 w-full">
        <div className="w-full xl:w-3/5">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10">
              <div className="flex flex-col items-center">
                <SimpleSpinner size={48} className="mb-4" />
                <p className="text-white text-lg">Loading video...</p>
              </div>
            </div>
          )}
          
          <PlayerComponent
            currentVideo={currentVideo}
            onPlayerReady={handlePlayerReady}
            onTimeUpdate={handleTimeUpdate}
            seekToTime={handleSeekToTime}
          />
          
          {/* Transcript and Quiz Container */}
          <div className="mt-6 space-y-4">
            {/* Quiz Start Button */}
            {currentVideo.videoId && !isQuizOpen && (
              <div className="flex justify-center">
                <button
                  onClick={handleStartQuiz}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl hover:from-purple-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-200 shadow-lg font-semibold"
                >
                  Start Quiz
                </button>
              </div>
            )}
            
            {/* Quiz Panel */}
            <QuizPanel
              isOpen={isQuizOpen}
              videoId={currentVideo.videoId}
              onClose={() => setIsQuizOpen(false)}
              onSystemMessage={handleQuizSystemMessage}
            />
            
            {/* Transcript Component */}
            <TranscriptComponent
              currentVideo={currentVideo}
              transcript={transcript}
              onSeekToTime={handleSeekToTime}
            />
          </div>
        </div>
        
        <div className="w-full xl:w-2/5">
          <ChatBoxComponent
            currentVideo={currentVideo}
            currentTime={currentTime}
            chatMessages={chatMessages}
            setChatMessages={setChatMessages}
            onSeekToTime={handleSeekToTime}
            

          />
        </div>
      </div>
    </div>
  );
};

export default ImprovedYoutubePlayer;