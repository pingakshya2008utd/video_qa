// UserVideoLibrary.jsx - Upload to S3 and show user's uploaded videos as thumbnails
import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Upload, RefreshCw } from 'lucide-react';
import { API_URL, SimpleSpinner } from './utils.jsx';
import { useAuth } from '../context/AuthContext';

const UserVideoLibrary = ({ onSelect }) => {
  const { currentUser } = useAuth();
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [clientUploadProgress, setClientUploadProgress] = useState(0);
  const [serverStatus, setServerStatus] = useState(null); // { status, message, progress, current_step, total_steps, error }
  const [currentUploadId, setCurrentUploadId] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);

  const canUse = !!currentUser?.uid;

  const resetUploadState = () => {
    setIsUploading(false);
    setClientUploadProgress(0);
    setServerStatus(null);
    setCurrentUploadId(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Clear polling
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const fetchItems = async () => {
    if (!canUse) return;
    setIsLoading(true);
    setError('');
    try {
      const resp = await axios.get(`${API_URL}/api/user-videos/list`, {
        params: { user_id: currentUser.uid },
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      setItems(resp.data?.items || []);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.detail || e.message || 'Failed to load library');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUse]);

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
      const resp = await axios.post(`${API_URL}/api/user-videos/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data', 'ngrok-skip-browser-warning': 'true' },
        onUploadProgress: (pe) => {
          if (!pe.total) return;
          const pct = Math.round((pe.loaded / pe.total) * 100);
          setClientUploadProgress(pct);
        }
      });

      const vid = resp.data?.video_id;
      setCurrentUploadId(vid || null);

      if (vid) {
        // Begin polling server-side upload status
        const poll = async () => {
          try {
            const s = await axios.get(`${API_URL}/api/user-videos/upload-status/${vid}`, {
              headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            setServerStatus(s.data);

            if (s.data?.status === 'completed') {
              clearInterval(pollRef.current);
              pollRef.current = null;
              setIsUploading(false);
              setClientUploadProgress(100);
              // Refresh items to include presigned URLs
              await fetchItems();
              // Optionally fetch info
              // await axios.get(`${API_URL}/api/user-videos/info`, { params: { video_id: vid } });
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
            console.error(err);
            // keep polling for transient errors, but if 4xx/5xx persist, consider stopping
          }
        };
        // immediate poll, then interval
        await poll();
        pollRef.current = setInterval(poll, 1500);
      } else {
        // No video id returned; treat as error
        resetUploadState();
        setError('Upload failed: missing video_id');
      }
    } catch (e) {
      console.error(e);
      resetUploadState();
      setError(e.response?.data?.detail || e.message || 'Upload failed');
    }
  };

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold">My Uploaded Videos</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchItems}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm flex items-center gap-2"
            disabled={isLoading}
            title="Refresh"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleUploadClick}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm flex items-center gap-2"
            disabled={!canUse || isUploading}
            title={canUse ? 'Upload video' : 'Login required'}
          >
            <Upload size={16} />
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>
      {!canUse && (
        <div className="text-gray-400 text-sm mb-3">
          Login to upload and access your personal video library.
        </div>
      )}
      {error && (
        <div className="text-red-400 text-sm mb-3">{error}</div>
      )}
      {(isUploading || serverStatus) && (
        <div className="mb-3 bg-gray-800 border border-gray-700 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-white text-sm font-semibold">Upload Progress</div>
            {isUploading && <SimpleSpinner size={16} />}
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
            {serverStatus && (
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-gray-300 text-xs mb-1">Server processing</div>
                  <div className="text-gray-400 text-xs">{serverStatus.progress ?? 0}%</div>
                </div>
                <div className="w-full h-2 bg-gray-700 rounded">
                  <div
                    className="h-2 bg-green-500 rounded"
                    style={{ width: `${serverStatus.progress ?? 0}%` }}
                  />
                </div>
                <div className="text-gray-400 text-xs mt-1">
                  {serverStatus.current_step ? `Step ${serverStatus.current_step}/${serverStatus.total_steps || 6} ` : ''}
                  {serverStatus.message || serverStatus.status}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {items.map((item) => (
          <button
            key={item.video_id}
            onClick={() => onSelect?.(item)}
            className="group rounded-xl overflow-hidden border border-gray-800 hover:border-gray-700 bg-gray-800 text-left"
            title={item.title}
          >
            <div className="aspect-video bg-gray-900 overflow-hidden">
              {item.thumbnail_url ? (
                <img src={item.thumbnail_url} alt={item.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
                  No thumbnail
                </div>
              )}
            </div>
            <div className="px-2 py-2">
              <div className="text-white text-sm line-clamp-2">{item.title}</div>
            </div>
          </button>
        ))}
        {items.length === 0 && (
          <div className="col-span-full text-gray-500 text-sm py-6 text-center">
            {isLoading ? 'Loading your library...' : 'No uploads yet'}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserVideoLibrary;


