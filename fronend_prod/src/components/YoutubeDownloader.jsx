import { useState } from 'react';
import axios from 'axios';
import { Download, AlertCircle } from 'lucide-react';

//const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_URL='https://d2e2ezlz7asnwt.cloudfront.net';

const YoutubeDownloader = ({ videoId, videoTitle }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState('');

  const handleDownload = async () => {
    if (!videoId) return;
    
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadError('');
    
    try {
      // Get video download URL from your backend
      const response = await axios.get(`${API_URL}/api/youtube/download-info`, {
        params: { videoId }
      });
      
      const { downloadUrl, title } = response.data;
      
      if (!downloadUrl) {
        throw new Error("No download URL available");
      }
      
      // Create a hidden anchor to trigger browser download
      // This uses the browser's native download capability
      const downloadLink = document.createElement('a');
      downloadLink.href = downloadUrl;
      downloadLink.download = `${title || videoTitle || videoId}.mp4`;
      document.body.appendChild(downloadLink);
      
      // Trigger the download
      downloadLink.click();
      
      // Clean up
      document.body.removeChild(downloadLink);
      
      setDownloadProgress(100);
      
    } catch (error) {
      console.error("Download error:", error);
      setDownloadError(error.message || "Failed to download video");
    } finally {
      setIsDownloading(false);
    }
  };

  // Alternative implementation using fetch with progress tracking
  const handleDownloadWithProgress = async () => {
    if (!videoId) return;
    
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadError('');
    
    try {
      // Get video download URL from your backend
      const response = await axios.get(`${API_URL}/api/youtube/download-info`, {
        params: { videoId }
      });
      
      const { downloadUrl, title } = response.data;
      
      if (!downloadUrl) {
        throw new Error("No download URL available");
      }
      
      // Download the video with progress tracking
      const videoResponse = await fetch(downloadUrl);
      
      if (!videoResponse.ok) {
        throw new Error(`Failed to download: ${videoResponse.statusText}`);
      }
      
      // Get content length for progress calculation
      const contentLength = videoResponse.headers.get('content-length');
      const total = parseInt(contentLength, 10) || 0;
      
      // Create a ReadableStream to track download progress
      const reader = videoResponse.body.getReader();
      let receivedLength = 0;
      const chunks = [];
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        chunks.push(value);
        receivedLength += value.length;
        
        // Update progress
        if (total > 0) {
          setDownloadProgress(Math.round((receivedLength / total) * 100));
        }
      }
      
      // Combine chunks into a single Blob
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      
      // Create a download link
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `${title || videoTitle || videoId}.mp4`;
      document.body.appendChild(downloadLink);
      
      // Trigger the download
      downloadLink.click();
      
      // Clean up
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);
      
      setDownloadProgress(100);
      
    } catch (error) {
      console.error("Download error:", error);
      setDownloadError(error.message || "Failed to download video");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={handleDownloadWithProgress}
        disabled={isDownloading || !videoId}
        className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
          isDownloading 
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        <Download size={18} className="mr-2" />
        {isDownloading ? `Downloading ${downloadProgress}%` : 'Download Video'}
      </button>
      
      {isDownloading && (
        <div className="mt-2">
          <div className="w-full bg-gray-700 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${downloadProgress}%` }}
            ></div>
          </div>
        </div>
      )}
      
      {downloadError && (
        <div className="mt-2 flex items-center text-red-500">
          <AlertCircle size={16} className="mr-1" />
          <span className="text-sm">{downloadError}</span>
        </div>
      )}
    </div>
  );
};

export default YoutubeDownloader;