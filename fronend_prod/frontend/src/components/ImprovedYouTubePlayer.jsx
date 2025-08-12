import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Youtube, Play, Pause, VolumeX, Volume2, 
  Rewind, FastForward, Copy, Send, Menu, Home,
  MessageSquare, Globe, Loader
} from 'lucide-react';
import YoutubeDownloader from './YoutubeDownloader';

const SimpleSpinner = ({ size = 24, className = "" }) => {
  return (
    <div 
      className={`inline-block border-2 border-t-transparent border-white rounded-full animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  );
};

const API_URL = 'https://7de5d1a559ab.ngrok-free.app';

const saveToLocalStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
};

const loadFromLocalStorage = (key, defaultValue = null) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return defaultValue;
  }
};

const parseMarkdown = (text) => {
  if (!text) return text;
  
  const lines = text.split('\n');
  const elements = [];
  
  lines.forEach((line, index) => {
    if (!line.trim()) {
      elements.push(<br key={`br-${index}`} />);
      return;
    }
    
    const parts = [];
    let currentIndex = 0;
    
    const boldRegex = /(\*\*.*?\*\*|__.*?__)/g;
    let match;
    
    while ((match = boldRegex.exec(line)) !== null) {
      if (match.index > currentIndex) {
        parts.push(line.slice(currentIndex, match.index));
      }
      
      const boldText = match[0].replace(/^\*\*|\*\*$|^__|__$/g, '');
      parts.push(<strong key={`bold-${index}-${match.index}`} className="font-semibold">{boldText}</strong>);
      
      currentIndex = match.index + match[0].length;
    }
    
    if (currentIndex < line.length) {
      parts.push(line.slice(currentIndex));
    }
    
    if (parts.length === 0) {
      parts.push(line);
    }
    
    if (line.trim().startsWith('•') || line.trim().startsWith('-') || line.trim().startsWith('*')) {
      elements.push(
        <div key={`bullet-${index}`} className="flex items-start mb-2 ml-4">
          <span className="text-indigo-400 mr-2 mt-1 flex-shrink-0">•</span>
          <span className="flex-1">{parts}</span>
        </div>
      );
    } 
    else if (line.includes('🎯') || line.includes('🔍') || line.includes('📋') || line.includes('⭐') || line.includes('💡') || line.includes('🚀')) {
      elements.push(
        <div key={`header-${index}`} className="font-bold text-cyan-300 mb-3 mt-4 text-base">
          {parts}
        </div>
      );
    }
    else {
      elements.push(
        <div key={`para-${index}`} className="mb-2 leading-relaxed">
          {parts}
        </div>
      );
    }
  });
  
  return <div className="space-y-1">{elements}</div>;
};

const ImprovedYoutubePlayer = ({ onNavigateToTranslate, onNavigateToHome }) => {

  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentVideo, setCurrentVideo] = useState(() => {
  return loadFromLocalStorage('currentVideo', { title: '', source: '', videoId: '' });});
  const [transcript, setTranscript] = useState(() => {
  return loadFromLocalStorage('transcript', '');});
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
  const [chatMessages, setChatMessages] = useState(() => {
  return loadFromLocalStorage('chatMessages', []);});
  const [userQuestion, setUserQuestion] = useState('');
  const [isProcessingQuery, setIsProcessingQuery] = useState(false);
  const [queryType, setQueryType] = useState('video');
  const [isInitializing, setIsInitializing] = useState(false);
  const [isLoadingTimestampedTranscript, setIsLoadingTimestampedTranscript] = useState(false);
  const [timestampedTranscript, setTimestampedTranscript] = useState('');
  const [showTimestampedVersion, setShowTimestampedVersion] = useState(false);
  const [formattingProgress, setFormattingProgress] = useState({ progress: 0, current: 0, total: 0 });
  
  const chatContainerRef = useRef(null);
  const menuRef = useRef(null);
  const playerContainerRef = useRef(null);
  
  useEffect(() => {
    if (!window.YT) {
      console.log("Loading YouTube iframe API...");
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      
      window.onYouTubeIframeAPIReady = () => {
        console.log("YouTube iframe API loaded successfully");
        window.YT.loaded = true;
      };
    } else if (window.YT.Player && !window.YT.loaded) {
      window.YT.loaded = true;
    }
  }, []);

  const recreatePlayerDiv = () => {
    if (playerContainerRef.current) {
      playerContainerRef.current.innerHTML = '';
      
      const playerDiv = document.createElement('div');
      playerDiv.id = 'youtube-player';
      playerDiv.className = 'absolute top-0 left-0 w-full h-full';
      playerContainerRef.current.appendChild(playerDiv);
    }
  };
  
  const initializeYouTubePlayer = (videoId) => {
    if (!videoId || isInitializing) return;
    
    console.log("Initializing YouTube player with video ID:", videoId);
    setIsInitializing(true);
    
    if (player && typeof player.destroy === 'function') {
      try {
        player.destroy();
      } catch (e) {
        console.warn('Error destroying player:', e);
      }
      setPlayer(null);
      setPlayerReady(false);
    }
    
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
            origin: 'https://vidyaai.co',
            host: 'https://www.youtube.com'
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
    
    if (currentVideo.videoId === videoId && player && playerReady) {
      console.log("Player already exists for this video, skipping initialization");
      setIsInitializing(false);
      return;
    }
    
    if (window.YT && window.YT.Player && window.YT.loaded) {
      setTimeout(initPlayer, 300);
    } else if (window.YT && window.YT.Player) {
      setTimeout(initPlayer, 600);
    } else {
      console.log("YouTube API not ready, setting up callback");
      window.onYouTubeIframeAPIReady = () => {
        console.log("YouTube API ready callback triggered");
        setTimeout(initPlayer, 400);
      };
    }
  };
  
  const onPlayerReady = (event) => {
    console.log("YouTube player is ready");
    try {
      const playerInstance = event.target;
      setDuration(playerInstance.getDuration());
      setPlayerReady(true);
      setPlayer(playerInstance);
      setIsInitializing(false);
      
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
      setIsPlaying(state === 1);
      
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
  
  useEffect(() => {
    const intervalId = setInterval(() => {
      updatePlayerState();
    }, 1000);
    
    return () => clearInterval(intervalId);
  }, [player, isDraggingSlider]);
  
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
  
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };
  
  const seekToTime = (timeInSeconds) => {
    if (!player || typeof player.seekTo !== 'function') {
      console.warn('Player not ready for seeking');
      return;
    }
    
    try {
      player.seekTo(timeInSeconds, true);
      setCurrentTime(timeInSeconds);
      setSliderPosition(timeInSeconds);
      
      if (typeof player.playVideo === 'function') {
        player.playVideo();
      }
    } catch (error) {
      console.error('Error seeking to time:', error);
    }
  };
  
  const parseTimestampedTranscript = (text) => {
    if (!text) return null;
    
    console.log("🔍 PARSING TRANSCRIPT - First 500 chars:", text.substring(0, 500));
    
    const lines = text.split('\n');
    const elements = [];
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      console.log(`🔍 Line ${index}: "${trimmedLine}"`);
      
      if (trimmedLine.match(/^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/)) {
        console.log("🎯 TIMESTAMP DETECTED:", trimmedLine);
        
        const parts = trimmedLine.split('-');
        const startTime = parts[0].trim();
        const endTime = parts[1].trim();
        
        const [minutes, seconds] = startTime.split(':').map(Number);
        const totalSeconds = minutes * 60 + seconds;
        
        console.log(`⏰ Start time: ${startTime} = ${totalSeconds} seconds`);
        
        elements.push(
          <div key={`timestamp-${index}`} className="mb-2">
            <button
              onClick={() => {
                console.log("🚀 BUTTON CLICKED! Seeking to:", totalSeconds);
                seekToTime(totalSeconds);
              }}
              className="text-cyan-400 hover:text-cyan-300 font-mono text-sm bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded transition-colors cursor-pointer"
              title={`Jump to ${startTime}`}
            >
              {trimmedLine}
            </button>
          </div>
        );
      } else if (trimmedLine.startsWith('Title:')) {
        elements.push(
          <div key={`title-${index}`} className="mb-2 text-gray-400 font-medium">
            {trimmedLine}
          </div>
        );
      } else if (trimmedLine.startsWith('Duration:')) {
        elements.push(
          <div key={`duration-${index}`} className="mb-2 text-gray-400 font-medium">
            {trimmedLine}
          </div>
        );
      } else if (trimmedLine.includes('====')) {
        elements.push(
          <div key={`separator-${index}`} className="mb-3 text-gray-600 text-xs">
            {trimmedLine}
          </div>
        );
      } else if (trimmedLine) {
        elements.push(
          <div key={`content-${index}`} className="mb-2 text-gray-300 ml-4">
            {trimmedLine}
          </div>
        );
      }
    });
    
    console.log("✅ Total elements created:", elements.length);
    return <div className="space-y-1">{elements}</div>;
  };
  
  const loadTimestampedTranscript = async () => {
    console.log("🔍 loadTimestampedTranscript called");
    console.log("🔍 currentVideo.videoId:", currentVideo.videoId);
    console.log("🔍 isLoadingTimestampedTranscript:", isLoadingTimestampedTranscript);
    
    if (!currentVideo.videoId || isLoadingTimestampedTranscript) {
      console.log("❌ Early return - no video ID or already loading");
      return;
    }
    
    setIsLoadingTimestampedTranscript(true);
    setFormattingProgress({ progress: 0, current: 0, total: 0 });
    
    // Show immediate feedback that the process has started
    setFormattingProgress({ progress: 1, current: 0, total: 0 });
    
    try {
      console.log("📡 Making API call to:", `${API_URL}/api/youtube/formatting-status/${currentVideo.videoId}`);
      const statusResponse = await axios.get(`${API_URL}/api/youtube/formatting-status/${currentVideo.videoId}`, {
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      
      console.log("📋 API Response:", statusResponse.data);
      
      if (statusResponse.data.status === 'completed') {
        console.log("✅ Status is completed, setting transcript");
        setTimestampedTranscript(statusResponse.data.formatted_transcript);
        setShowTimestampedVersion(true);
        setFormattingProgress({ progress: 100, current: 0, total: 0 });
        setIsLoadingTimestampedTranscript(false);
        console.log("✅ Transcript set and loading finished");
        return;
      }
      
      if (statusResponse.data.status === 'formatting' || statusResponse.data.status === 'not_found') {
        console.log("⏳ Status is formatting or not found, starting polling with progress");
        
        if (statusResponse.data.progress !== undefined) {
          setFormattingProgress({
            progress: statusResponse.data.progress || 0,
            current: statusResponse.data.current_chunk || 0,
            total: statusResponse.data.total_chunks || 0
          });
        }
        
        const pollForCompletionWithProgress = async () => {
          let attempts = 0;
          const maxAttempts = 120;
          
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            try {
              const pollResponse = await axios.get(`${API_URL}/api/youtube/formatting-status/${currentVideo.videoId}`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
              });
              console.log(`📊 Poll attempt ${attempts + 1}:`, pollResponse.data);
              
              if (pollResponse.data.progress !== undefined) {
                setFormattingProgress({
                  progress: pollResponse.data.progress || 0,
                  current: pollResponse.data.current_chunk || 0,
                  total: pollResponse.data.total_chunks || 0
                });
                console.log(`📈 Progress updated: ${pollResponse.data.progress}% (${pollResponse.data.current_chunk}/${pollResponse.data.total_chunks})`);
              }
              
              if (pollResponse.data.status === 'completed') {
                setTimestampedTranscript(pollResponse.data.formatted_transcript);
                setShowTimestampedVersion(true);
                setFormattingProgress({ progress: 100, current: 0, total: 0 });
                setIsLoadingTimestampedTranscript(false);
                console.log("✅ Formatting completed!");
                return;
              }
              
              if (pollResponse.data.status === 'failed') {
                throw new Error(pollResponse.data.error || 'AI formatting failed');
              }
              
              attempts++;
            } catch (error) {
              console.error('Error polling formatting status:', error);
              break;
            }
          }
          
          throw new Error('AI formatting took too long - please try again');
        };
        
        await pollForCompletionWithProgress();
      } else {
        console.log("🔍 Status not completed or formatting, trying direct fetch");
        const transcriptResponse = await axios.get(`${API_URL}/api/youtube/formatted-transcript/${currentVideo.videoId}`, {
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        
        if (transcriptResponse.data.status === 'completed') {
          setTimestampedTranscript(transcriptResponse.data.formatted_transcript);
          setShowTimestampedVersion(true);
          setFormattingProgress({ progress: 100, current: 0, total: 0 });
        } else {
          throw new Error('Timestamped transcript not available yet - AI processing may still be in progress');
        }
      }
      
    } catch (error) {
      console.error('❌ Error loading timestamped transcript:', error);
      setErrorMessage(error.response?.data?.detail || error.message || 'Failed to load timestamped transcript');
    } finally {
      setIsLoadingTimestampedTranscript(false);
    }
  };

  const handleYoutubeSubmit = async (e) => {
    e.preventDefault();
    
    if (!youtubeUrl.trim()) return;
    
    setIsLoading(true);
    setErrorMessage('');
    setTranscript('');
    
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
          url: youtubeUrl
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
            url: youtubeUrl
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
        videoId: videoId
      });

      const newUrl = new URL(window.location);
      newUrl.searchParams.set('v', videoId);
      window.history.replaceState({}, '', newUrl);
      
      setChatMessages([]);
      
      setTimestampedTranscript('');
      setShowTimestampedVersion(false);
      setFormattingProgress({ progress: 0, current: 0, total: 0 });
      
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
  
  const copyTranscript = () => {
    const textToCopy = showTimestampedVersion && timestampedTranscript ? timestampedTranscript : transcript;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };
  
 const handleQuerySubmit = async (e) => {
  e.preventDefault();
  
  if (!userQuestion.trim() || !currentVideo.videoId || isProcessingQuery) return;
  
  const userMessage = {
    id: Date.now(),
    sender: 'user',
    text: userQuestion,
    timestamp: currentTime
  };
  
  setChatMessages(prevMessages => [...prevMessages, userMessage]);
  const currentQuery = userQuestion;
  setUserQuestion('');
  setIsProcessingQuery(true);
  
  try {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    
    const response = await axios.post(`${API_URL}/api/query/video`, {
      video_id: currentVideo.videoId,
      query: currentQuery,
      timestamp: currentTime,
      is_image_query: queryType === 'frame'
    }, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    
    if (response.data.is_downloading) {
      const aiMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        text: response.data.response,
        timestamp: currentTime,
        isDownloading: true
      };
      
      setChatMessages(prevMessages => [...prevMessages, aiMessage]);
    } else {
      const aiMessage = {
        id: Date.now() + 1,
        sender: 'ai',
        text: response.data.response,
        timestamp: currentTime
      };
      
      setChatMessages(prevMessages => [...prevMessages, aiMessage]);
    }
    
  } catch (error) {
    console.error("Error processing query:", error);
    
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
    
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, 100);
  }
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
  
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

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

useEffect(() => {
  if (currentVideo.videoId && !player && !isInitializing) {
    console.log('Restoring video from localStorage:', currentVideo.videoId);
    const timer = setTimeout(() => {
      initializeYouTubePlayer(currentVideo.videoId);
    }, 1000);
    return () => clearTimeout(timer);
  }
}, [currentVideo.videoId, player, isInitializing]);

useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const videoIdFromUrl = urlParams.get('v');
  
  if (videoIdFromUrl && !currentVideo.videoId && !youtubeUrl) {
    setYoutubeUrl(`https://www.youtube.com/watch?v=${videoIdFromUrl}`);
  }
}, []);

useEffect(() => {
  console.log("🔍 React State Debug:", {
    currentVideoId: currentVideo.videoId,
    showTimestampedVersion,
    timestampedTranscript: timestampedTranscript ? "HAS DATA" : "NO DATA",
    isLoadingTimestampedTranscript,
    transcriptLength: timestampedTranscript ? timestampedTranscript.length : 0
  });
}, [currentVideo.videoId, showTimestampedVersion, timestampedTranscript, isLoadingTimestampedTranscript]);
  
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
      
      {currentVideo.videoId && (
        <YoutubeDownloader
          videoId={currentVideo.videoId}
          videoTitle={currentVideo.title}
        />
      )}
      
      <div className="flex flex-col xl:flex-row gap-8 mt-6 w-full">
        <div className="w-full xl:w-3/5">
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
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setShowTimestampedVersion(false)}
                  className={`text-sm px-3 py-2 rounded-lg transition-colors ${
                    !showTimestampedVersion 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  }`}
                  disabled={!transcript}
                >
                  Video Transcript
                </button>
                
                <button 
                  onClick={async () => {
                    console.log("🔘 Timestamp button clicked");
                    
                    // If we already have the transcript, just show it
                    if (timestampedTranscript) {
                      console.log("✅ Already have timestamped transcript, showing it");
                      setShowTimestampedVersion(true);
                      return;
                    }
                    
                    // Otherwise, load the transcript with progress tracking
                    console.log("⏳ Loading timestamped transcript with progress...");
                    await loadTimestampedTranscript();
                  }}
                  className={`text-sm px-3 py-2 rounded-lg transition-colors flex items-center ${
                    showTimestampedVersion 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  } ${!currentVideo.videoId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  disabled={!currentVideo.videoId || isLoadingTimestampedTranscript}
                >
                  {isLoadingTimestampedTranscript ? (
                    <>
                      <div className="relative mr-2">
                        <SimpleSpinner size={14} />
                        {formattingProgress.progress > 0 && (
                          <div className="absolute -top-1 -right-1 text-xs font-bold text-cyan-300 bg-gray-800 rounded px-1 min-w-[20px] text-center">
                            {formattingProgress.progress}%
                          </div>
                        )}
                      </div>
                      <span className="flex flex-col">
                        <span className="text-xs">
                          {formattingProgress.progress > 0 
                            ? `AI Processing ${formattingProgress.progress}%`
                            : 'Starting AI...'
                          }
                        </span>
                        {formattingProgress.total > 0 && (
                          <span className="text-xs opacity-75">
                            ({formattingProgress.current}/{formattingProgress.total} chunks)
                          </span>
                        )}
                      </span>
                    </>
                  ) : (
                    <span>Transcript with Timestamps</span>
                  )}
                </button>
              </div>
              {(transcript || timestampedTranscript) && (
                <button 
                  onClick={copyTranscript}
                  className="text-xs flex items-center px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 transition-colors"
                >
                  <Copy size={14} className="mr-2" />
                  {isCopied ? "Copied!" : "Copy to clipboard"}
                </button>
              )}
            </div>
            
            {/* Progress bar for formatting */}
            {isLoadingTimestampedTranscript && formattingProgress.progress > 0 && (
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>AI Formatting Progress</span>
                  <span>{formattingProgress.progress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${formattingProgress.progress}%` }}
                  ></div>
                </div>
                {formattingProgress.total > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    Processing chunk {formattingProgress.current} of {formattingProgress.total}
                  </div>
                )}
              </div>
            )}
            
            <div 
              className="bg-gray-800 rounded-xl p-5 h-56 overflow-y-auto text-gray-300 text-sm leading-relaxed scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 shadow-inner"
            >
              {showTimestampedVersion ? (
                timestampedTranscript ? (
                  parseTimestampedTranscript(timestampedTranscript)
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <p className="text-gray-500 italic">Timestamped transcript is being processed...</p>
                    {isLoadingTimestampedTranscript && (
                      <div className="mt-4">
                        <SimpleSpinner size={24} />
                        {formattingProgress.progress > 0 && (
                          <p className="text-xs text-gray-400 mt-2">
                            {formattingProgress.progress}% complete
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              ) : transcript ? (
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
        
        <div className="w-full xl:w-2/5 bg-gray-900 rounded-xl shadow-xl overflow-hidden flex flex-col h-[750px]">
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
                  <div className="text-white">{parseMarkdown(message.text)}</div>
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