// utils.js - Shared utilities and helpers
import React from 'react';

// export const API_URL = 'https://7de5d1a559ab.ngrok-free.app';
export const API_URL = 'http://localhost:8000';
// export const API_URL = 'http://vidya-ai-environment.eba-umbehpru.us-east-1.elasticbeanstalk.com';

export const saveToLocalStorage = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
};

export const loadFromLocalStorage = (key, defaultValue = null) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  } catch (error) {
    console.warn('Failed to load from localStorage:', error);
    return defaultValue;
  }
};

export const formatTime = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export const parseMarkdown = (text, onSeekToTime = null) => {
  if (!text) return text;
  
  // Function to convert time string to seconds
  const timeToSeconds = (timeStr) => {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      const [minutes, seconds] = parts.map(Number);
      return minutes * 60 + seconds;
    } else if (parts.length === 3) {
      const [hours, minutes, seconds] = parts.map(Number);
      return hours * 3600 + minutes * 60 + seconds;
    }
    return 0;
  };

  const lines = text.split('\n');
  const elements = [];
  
  lines.forEach((line, index) => {
    if (!line.trim()) {
      elements.push(<br key={`br-${index}`} />);
      return;
    }
    
    const parts = [];
    let currentIndex = 0;
    
    // Updated regex to match timestamps with or without $ signs
    // This matches: $mm:ss$, $mm:ss, mm:ss$, or mm:ss (when surrounded by $ or spaces)
    const timestampRegex = /(\$?\d{1,2}:\d{2}\$?)/g;
    const boldRegex = /(\*\*.*?\*\*|__.*?__)/g;
    
    // Combine both regexes to process in order
    const combinedRegex = /(\$?\d{1,2}:\d{2}\$?|\*\*.*?\*\*|__.*?__)/g;
    let match;
    
    while ((match = combinedRegex.exec(line)) !== null) {
      if (match.index > currentIndex) {
        parts.push(line.slice(currentIndex, match.index));
      }
      
      // Check if this is a timestamp (contains digits and colon)
      if (/\d{1,2}:\d{2}/.test(match[0])) {
        // Extract just the time part (remove $ signs)
        const timeStr = match[0].replace(/\$/g, '');
        const totalSeconds = timeToSeconds(timeStr);
        
        if (onSeekToTime) {
          parts.push(
            <button
              key={`timestamp-${index}-${match.index}`}
              onClick={() => {
                console.log("🚀 TIMESTAMP CLICKED! Seeking to:", totalSeconds);
                onSeekToTime(totalSeconds);
              }}
              className="text-cyan-400 hover:text-cyan-300 font-mono text-sm bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded mx-1 transition-colors cursor-pointer inline-block"
              title={`Jump to ${timeStr}`}
            >
              {timeStr}
            </button>
          );
        } else {
          // If no seek function is provided, just render as styled text
          parts.push(
            <span
              key={`timestamp-${index}-${match.index}`}
              className="text-cyan-400 font-mono text-sm bg-gray-700 px-2 py-1 rounded mx-1 inline-block"
            >
              {timeStr}
            </span>
          );
        }
      } else {
        // This is bold text
        const boldText = match[0].replace(/^\*\*|\*\*$|^__|__$/g, '');
        parts.push(<strong key={`bold-${index}-${match.index}`} className="font-semibold">{boldText}</strong>);
      }
      
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
    else if (line.includes('🎯') || line.includes('📝') || line.includes('📋') || line.includes('⭐') || line.includes('💡') || line.includes('🚀')) {
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

export const SimpleSpinner = ({ size = 24, className = "" }) => {
  return (
    <div 
      className={`inline-block border-2 border-t-transparent border-white rounded-full animate-spin ${className}`}
      style={{ width: size, height: size }}
    />
  );
};