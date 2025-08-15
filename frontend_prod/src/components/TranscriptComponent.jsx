// TranscriptComponent.jsx - Transcript display with timestamps
import { useState, useEffect } from 'react';
import { Copy } from 'lucide-react';
import axios from 'axios';
import { API_URL, SimpleSpinner } from './utils.jsx';

const TranscriptComponent = ({ 
  currentVideo, 
  transcript, 
  onSeekToTime 
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isLoadingTimestampedTranscript, setIsLoadingTimestampedTranscript] = useState(false);
  const [timestampedTranscript, setTimestampedTranscript] = useState('');
  const [showTimestampedVersion, setShowTimestampedVersion] = useState(false);
  const [formattingProgress, setFormattingProgress] = useState({ progress: 0, current: 0, total: 0 });

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
                if (onSeekToTime) {
                  onSeekToTime(totalSeconds);
                }
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
      // Handle error appropriately - you might want to pass this to parent component
    } finally {
      setIsLoadingTimestampedTranscript(false);
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

  // Reset timestamped transcript when video changes
  useEffect(() => {
    setTimestampedTranscript('');
    setShowTimestampedVersion(false);
    setFormattingProgress({ progress: 0, current: 0, total: 0 });
  }, [currentVideo.videoId]);

  return (
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
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptComponent;