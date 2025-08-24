// PlayerComponent.jsx - YouTube player with controls
import { useState, useRef, useEffect } from 'react';
import { Play, Pause, VolumeX, Volume2, Rewind, FastForward } from 'lucide-react';
import { formatTime } from './utils';

const PlayerComponent = ({ 
  currentVideo, 
  onPlayerReady, 
  onTimeUpdate,
  seekToTime 
}) => {
  const [player, setPlayer] = useState(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sliderPosition, setSliderPosition] = useState(0);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isHtml5, setIsHtml5] = useState(false);
  
  const playerContainerRef = useRef(null);
  const html5Ref = useRef(null);
  
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
            onReady: onPlayerReadyInternal,
            onStateChange: onPlayerStateChange,
            onError: onPlayerError
          }
        });
        
        setPlayer(newPlayer);
        console.log("YouTube player created successfully");
      } catch (error) {
        console.error('Error creating YouTube player:', error);
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
  
  const onPlayerReadyInternal = (event) => {
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
      
      // Notify parent component
      if (onPlayerReady) {
        onPlayerReady(playerInstance);
      }
      
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
    setIsInitializing(false);
  };
  
  const updatePlayerState = () => {
    if (isHtml5) {
      const el = html5Ref.current;
      if (!el) return;
      setIsPlaying(!el.paused);
      setIsMuted(el.muted);
      const cur = el.currentTime || 0;
      setCurrentTime(cur);
      setSliderPosition(cur);
      if (onTimeUpdate) onTimeUpdate(cur);
      setDuration(el.duration || 0);
      return;
    }
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
        
        // Notify parent component about time updates
        if (onTimeUpdate) {
          onTimeUpdate(current);
        }
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
  
  useEffect(() => {
    const html5Source = currentVideo?.sourceType === 'uploaded' && currentVideo?.videoUrl;
    setIsHtml5(!!html5Source);
    setCurrentTime(0);
    setSliderPosition(0);
    setDuration(0);
    if (html5Source) {
      if (player && typeof player.destroy === 'function') {
        try { player.destroy(); } catch (e) {}
      }
      setPlayer(null);
      setPlayerReady(false);
      const el = html5Ref.current;
      if (el) {
        // Force reload of the media element when URL changes
        try { el.pause(); } catch (e) {}
        el.removeAttribute('src');
        el.preload = 'metadata';
        el.playsInline = true;
        el.muted = false;
        el.src = currentVideo.videoUrl;

        const handleLoadedMetadata = () => {
          setDuration(el.duration || 0);
          if (onPlayerReady) onPlayerReady(null);
        };
        const handleCanPlay = () => {
          // Best-effort autoplay to show first frame; ignore failures
          el.play().catch(() => {});
        };
        const handleError = () => {
          // Surface a simple log to help debugging network/cors issues
          // eslint-disable-next-line no-console
          console.warn('HTML5 video error event fired');
        };

        el.addEventListener('loadedmetadata', handleLoadedMetadata);
        el.addEventListener('canplay', handleCanPlay);
        el.addEventListener('error', handleError);
        try { el.load(); } catch (e) {}

        return () => {
          el.removeEventListener('loadedmetadata', handleLoadedMetadata);
          el.removeEventListener('canplay', handleCanPlay);
          el.removeEventListener('error', handleError);
        };
      }
    } else if (currentVideo.videoId && !isInitializing) {
      if (!player) {
        const timer = setTimeout(() => {
          initializeYouTubePlayer(currentVideo.videoId);
        }, 500);
        return () => clearTimeout(timer);
      } else if (player && playerReady) {
        try {
          if (typeof player.loadVideoById === 'function') {
            player.loadVideoById(currentVideo.videoId);
          }
        } catch (error) {
          console.error('Error loading new video:', error);
          initializeYouTubePlayer(currentVideo.videoId);
        }
      }
    }
  }, [currentVideo.videoId, currentVideo.videoUrl, currentVideo.sourceType]);

  // Expose seekToTime function to parent
  useEffect(() => {
    if (isHtml5) {
      const el = html5Ref.current;
      if (!el) return;
      window.playerSeekTo = (timeInSeconds) => {
        try {
          el.currentTime = timeInSeconds;
          setCurrentTime(timeInSeconds);
          setSliderPosition(timeInSeconds);
          el.play().catch(() => {});
        } catch (error) {
          console.error('Error seeking HTML5:', error);
        }
      };
      return;
    }
    if (seekToTime && player && typeof player.seekTo === 'function') {
      window.playerSeekTo = (timeInSeconds) => {
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
    }
  }, [player, seekToTime, isHtml5]);
  
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
    if (isHtml5) {
      const el = html5Ref.current;
      if (!el) return;
      try { el.paused ? el.play() : el.pause(); } catch (e) {}
      return;
    }
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
    if (isHtml5) {
      const el = html5Ref.current; if (!el) return;
      el.muted = !el.muted;
      setIsMuted(el.muted);
      return;
    }
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
    if (isHtml5) {
      const el = html5Ref.current; if (!el) return;
      const newTime = Math.max(0, (el.currentTime || 0) - 10);
      el.currentTime = newTime;
      setCurrentTime(newTime);
      setSliderPosition(newTime);
      return;
    }
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
    if (isHtml5) {
      const el = html5Ref.current; if (!el) return;
      const newTime = Math.min(el.duration || 0, (el.currentTime || 0) + 10);
      el.currentTime = newTime;
      setCurrentTime(newTime);
      setSliderPosition(newTime);
      return;
    }
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

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-2xl bg-black shadow-2xl aspect-video">
        {isHtml5 ? (
          <video key={currentVideo.videoUrl || 'html5'} ref={html5Ref} className="absolute top-0 left-0 w-full h-full" controls={false} crossOrigin="anonymous" />
        ) : currentVideo.videoId ? (
          <div ref={playerContainerRef} className="absolute top-0 left-0 w-full h-full"></div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <p className="text-gray-500">Enter a YouTube URL to load a video</p>
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-6 flex items-center space-x-4">
        <button 
          onClick={togglePlay} 
          className="p-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-lg"
          disabled={!currentVideo.videoId && !isHtml5}
        >
          {isPlaying ? <Pause size={22} /> : <Play size={22} />}
        </button>
        
        <button 
          onClick={toggleMute} 
          className="p-3 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-lg"
          disabled={!currentVideo.videoId && !isHtml5}
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
            disabled={!currentVideo.videoId && !isHtml5}
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
          disabled={!currentVideo.videoId && !isHtml5}
        >
          <Rewind size={16} />
          <span className="sr-only">Skip backward</span>
        </button>
        
        <button 
          onClick={skipForward}
          className="p-2 rounded-full bg-gray-800 hover:bg-gray-700 text-white transition-colors"
          disabled={!currentVideo.videoId && !isHtml5}
        >
          <FastForward size={16} />
          <span className="sr-only">Skip forward</span>
        </button>
      </div>
    </div>
  );
};

export default PlayerComponent;
