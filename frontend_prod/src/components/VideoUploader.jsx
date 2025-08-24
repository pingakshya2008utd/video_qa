// VideoUploader.jsx - Upload functionality extracted from UserVideoLibrary
import { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import { Upload } from 'lucide-react';
import { API_URL, SimpleSpinner } from './utils.jsx';
import { useAuth } from '../context/AuthContext';

const VideoUploader = ({ onUploadComplete, onUploadSuccess }) => {
  const { currentUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [clientUploadProgress, setClientUploadProgress] = useState(0);
  const [serverStatus, setServerStatus] = useState(null); // { status, message, progress, current_step, total_steps, error }
  const [currentUploadId, setCurrentUploadId] = useState(null);
  const [error, setError] = useState('');
  const [hasCalledOnUploadComplete, setHasCalledOnUploadComplete] = useState(false);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);
  const isMountedRef = useRef(true);
  


  const canUse = !!currentUser?.uid;
  
  console.log("VideoUploader: API_URL is:", API_URL);

  // Cleanup on unmount
  useEffect(() => {
    console.log("VideoUploader: Component mounted, isMountedRef set to true");
    return () => {
      console.log("VideoUploader: Component unmounting, setting isMountedRef to false");
      isMountedRef.current = false;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  const resetUploadState = () => {
    setIsUploading(false);
    setClientUploadProgress(0);
    setCurrentUploadId(null);
    setError('');
    setHasCalledOnUploadComplete(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Clear polling
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    // Clear server status after a delay so user can see completion
    setTimeout(() => {
      if (isMountedRef.current) {
        setServerStatus(null);
      }
    }, 3000);
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !canUse) return;
    setIsUploading(true);
    setClientUploadProgress(0);
    setServerStatus(null);
    setError('');
    try {
      const form = new FormData();
      form.append('user_id', currentUser.uid);
      form.append('file', file);
      console.log("VideoUploader: Starting upload to:", `${API_URL}/api/user-videos/upload`);
      const resp = await axios.post(`${API_URL}/api/user-videos/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data', 'ngrok-skip-browser-warning': 'true' },
        onUploadProgress: (pe) => {
          if (!pe.total) return;
          const pct = Math.round((pe.loaded / pe.total) * 100);
          setClientUploadProgress(pct);
        }
      });
      console.log("VideoUploader: Upload response:", resp.data);

      const vid = resp.data?.video_id;
      console.log("VideoUploader: Received video ID:", vid);
      setCurrentUploadId(vid || null);

      if (vid) {
        console.log("VideoUploader: Starting polling for video ID:", vid);
        // Begin polling server-side upload status
        const poll = async () => {
          console.log("VideoUploader: Poll function called for video ID:", vid);
          console.log("VideoUploader: isMountedRef.current is:", isMountedRef.current);
          // Temporarily disable mount check to debug
          // if (!isMountedRef.current) {
          //   console.log("VideoUploader: Component unmounted, stopping poll");
          //   return;
          // }
          
          try {
            const statusUrl = `${API_URL}/api/user-videos/upload-status/${vid}`;
            console.log("VideoUploader: Making API call to check status for video ID:", vid);
            console.log("VideoUploader: Status URL:", statusUrl);
            const s = await axios.get(statusUrl, {
              headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            
            // Check again after API call
            // Temporarily disable mount check to debug
            // if (!isMountedRef.current) {
            //   console.log("VideoUploader: Component unmounted after API call, stopping poll");
            //   return;
            // }
            
            console.log("VideoUploader: Server status received:", s.data);
            setServerStatus(s.data);

            if (s.data?.status === 'completed') {
              clearInterval(pollRef.current);
              pollRef.current = null;
              setIsUploading(false);
              setClientUploadProgress(100);
              // Call the callback to notify parent component only once
              if (!hasCalledOnUploadComplete) {
                console.log("VideoUploader: Calling onUploadComplete for video ID:", vid);
                setHasCalledOnUploadComplete(true);
                onUploadComplete?.(vid);
                // Notify parent that upload was successful
                onUploadSuccess?.();
              } else {
                console.log("VideoUploader: Skipping onUploadComplete call - already called for video ID:", vid);
              }
              // Reset after a short delay
              setTimeout(() => {
                if (isMountedRef.current) {
                  resetUploadState();
                }
              }, 2000);
            } else if (s.data?.status === 'failed') {
              clearInterval(pollRef.current);
              pollRef.current = null;
              resetUploadState();
              setError(s.data?.message || s.data?.error || 'Upload failed');
            } else if (s.data?.status === 'not_found') {
              // Upload record was deleted/rolled back - treat as failure
              clearInterval(pollRef.current);
              pollRef.current = null;
              resetUploadState();
              setError('Upload failed. Try with a shorter video.');
            }
          } catch (err) {
            console.error("VideoUploader: Poll error for video ID:", vid, err);
            console.error("VideoUploader: Error response:", err.response?.data);
            console.error("VideoUploader: Error status:", err.response?.status);
            // keep polling for transient errors, but if 4xx/5xx persist, consider stopping
          }
        };
        // immediate poll, then interval
        console.log("VideoUploader: Starting immediate poll");
        await poll();
        // Check if still mounted before setting interval
        // Temporarily disable mount check to debug
        // if (isMountedRef.current) {
          console.log("VideoUploader: Setting up interval poll every 1.5 seconds");
          pollRef.current = setInterval(poll, 1500);
        // } else {
        //   console.log("VideoUploader: Component unmounted, not setting interval");
        // }
      } else {
        // No video id returned; treat as error
        resetUploadState();
        setError('Upload failed: missing video_id');
      }
    } catch (e) {
      console.error("VideoUploader: Upload error:", e);
      console.error("VideoUploader: Upload error response:", e.response?.data);
      console.error("VideoUploader: Upload error status:", e.response?.status);
      resetUploadState();
      setError(e.response?.data?.detail || e.message || 'Upload failed');
    }
  };

  return (
    <>
      <button
        onClick={handleUploadClick}
        className="px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-200 shadow-lg flex items-center justify-center"
        disabled={!canUse || isUploading}
        title={canUse ? 'Upload video' : 'Login required'}
      >
        {isUploading ? (
          <>
            <SimpleSpinner size={20} className="mr-2" />
            <span>Uploading...</span>
          </>
        ) : (
          <>
            <Upload size={20} className="mr-2" />
            <span>Upload</span>
          </>
        )}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFileChange}
      />
      
      {/* Upload Progress UI */}
      {(isUploading || serverStatus || (currentUploadId && !hasCalledOnUploadComplete)) && (
        <div className="absolute top-full right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg p-3 z-50 min-w-[300px] shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white text-sm font-semibold">Upload Progress</div>
            {(isUploading || (currentUploadId && !hasCalledOnUploadComplete)) && <SimpleSpinner size={16} />}
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-gray-300 text-xs mb-1">Client upload to server</div>
              <div className="w-full h-2 bg-gray-700 rounded">
                <div
                  className="h-2 bg-indigo-500 rounded"
                  style={{ width: `${clientUploadProgress}%` }}
                />
              </div>
              <div className="text-gray-400 text-xs mt-1">{clientUploadProgress}%</div>
            </div>
            {(serverStatus || (currentUploadId && !hasCalledOnUploadComplete)) && (
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-gray-300 text-xs mb-1">Server processing</div>
                  <div className="text-gray-400 text-xs">
                    {serverStatus?.progress !== undefined ? `${serverStatus.progress}%` : 'Waiting...'}
                  </div>
                </div>
                <div className="w-full h-2 bg-gray-700 rounded">
                  <div
                    className="h-2 bg-green-500 rounded transition-all duration-300"
                    style={{ width: `${serverStatus?.progress ?? 0}%` }}
                  />
                </div>
                <div className="text-gray-400 text-xs mt-1">
                  {serverStatus?.current_step ? `Step ${serverStatus.current_step}/${serverStatus.total_steps || 6} ` : ''}
                  {serverStatus?.message || serverStatus?.status || 'Processing...'}
                </div>
              </div>
            )}
          </div>
          {error && (
            <div className="text-red-400 text-sm mt-2">{error}</div>
          )}
        </div>
      )}
    </>
  );
};

export default VideoUploader;
