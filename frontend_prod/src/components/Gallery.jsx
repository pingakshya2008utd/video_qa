import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { FolderPlus, Folder as FolderIcon, ArrowLeft, Plus, RefreshCw } from 'lucide-react';
import { API_URL } from './utils.jsx';
import { useAuth } from '../context/AuthContext';

const SectionTabs = ({ section, setSection }) => {
  return (
    <div className="flex gap-2 mb-4">
      {['uploaded', 'youtube'].map((s) => (
        <button
          key={s}
          onClick={() => setSection(s)}
          className={`px-3 py-2 rounded-lg text-sm ${section === s ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
        >
          {s === 'uploaded' ? 'Uploaded' : 'YouTube'}
        </button>
      ))}
    </div>
  );
};

const Gallery = () => {
  const { currentUser } = useAuth();
  const userId = currentUser?.uid || '';
  const [section, setSection] = useState('uploaded');
  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const folderMap = useMemo(() => {
    const map = new Map();
    folders.forEach((f) => map.set(f.id, f));
    return map;
  }, [folders]);

  const breadcrumb = useMemo(() => {
    const trail = [];
    let cur = currentFolderId ? folderMap.get(currentFolderId) : null;
    while (cur) {
      trail.unshift(cur);
      cur = cur.parent_id ? folderMap.get(cur.parent_id) : null;
    }
    return trail;
  }, [currentFolderId, folderMap]);

  const fetchFolders = async () => {
    if (!userId) return;
    try {
      const resp = await axios.get(`${API_URL}/api/folders`, {
        params: { user_id: userId, source_type: section },
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      setFolders(resp.data || []);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.detail || e.message || 'Failed to load folders');
    }
  };

  const fetchVideos = async () => {
    if (!userId) return;
    setIsLoading(true);
    setError('');
    try {
      const resp = await axios.get(`${API_URL}/api/gallery`, {
        params: { user_id: userId, source_type: section, folder_id: currentFolderId || undefined },
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      setVideos(resp.data || []);
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.detail || e.message || 'Failed to load videos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setCurrentFolderId(null);
    fetchFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, userId]);

  useEffect(() => {
    fetchVideos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, currentFolderId, userId]);

  const subfolders = useMemo(() => {
    return folders.filter((f) => (f.parent_id || null) === (currentFolderId || null));
  }, [folders, currentFolderId]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    setCreating(true);
    setError('');
    try {
      await axios.post(`${API_URL}/api/folders`, {
        user_id: userId,
        name: newFolderName.trim(),
        parent_id: currentFolderId,
        source_type: section
      }, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      setNewFolderName('');
      await fetchFolders();
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.detail || e.message || 'Failed to create folder');
    } finally {
      setCreating(false);
    }
  };

  const onDragStartVideo = (e, video) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ video_id: video.id, source_type: video.source_type }));
  };

  const onDropFolder = async (e, folderId) => {
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (!data || data.source_type !== section) return; // only within same section
      await axios.post(`${API_URL}/api/gallery/move`, {
        video_id: data.video_id,
        target_folder_id: folderId || null
      }, { headers: { 'ngrok-skip-browser-warning': 'true' } });
      await fetchVideos();
    } catch (err) {
      console.error(err);
    }
  };

  const allowDrop = (e) => e.preventDefault();

  return (
    <div className="w-full bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {currentFolderId && (
            <button
              onClick={() => setCurrentFolderId(folderMap.get(currentFolderId)?.parent_id || null)}
              className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              Up
            </button>
          )}
          <SectionTabs section={section} setSection={setSection} />
          <button
            onClick={() => { fetchFolders(); fetchVideos(); }}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm flex items-center gap-2"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="New folder name"
            className="px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white"
          />
          <button
            onClick={handleCreateFolder}
            disabled={creating || !newFolderName.trim()}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm flex items-center gap-2"
          >
            <FolderPlus size={16} />
            Create
          </button>
        </div>
      </div>

      {error && <div className="text-red-400 text-sm mb-3">{error}</div>}

      {/* Breadcrumb */}
      <div className="text-sm text-gray-400 mb-3">
        <span className="text-gray-500">{section === 'uploaded' ? 'Uploaded' : 'YouTube'}</span>
        {breadcrumb.map((f) => (
          <span key={f.id}>
            {' / '}
            <button className="text-indigo-400 hover:text-indigo-300" onClick={() => setCurrentFolderId(f.id)}>
              {f.name}
            </button>
          </span>
        ))}
      </div>

      {/* Subfolders */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
        {/* Root drop area */}
        <div
          onDragOver={allowDrop}
          onDrop={(e) => onDropFolder(e, null)}
          className="rounded-xl border border-dashed border-gray-700 bg-gray-800 p-3 text-center text-gray-400"
          title="Drop here to move to root"
        >
          Move to Root
        </div>
        {subfolders.map((f) => (
          <button
            key={f.id}
            onClick={() => setCurrentFolderId(f.id)}
            onDragOver={allowDrop}
            onDrop={(e) => onDropFolder(e, f.id)}
            className="group rounded-xl overflow-hidden border border-gray-800 hover:border-gray-700 bg-gray-800 text-left p-3 flex items-center gap-2"
            title={f.name}
          >
            <FolderIcon size={18} className="text-yellow-400" />
            <div className="text-white text-sm line-clamp-2">{f.name}</div>
          </button>
        ))}
      </div>

      {/* Videos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {videos.map((v) => (
          <div
            key={v.id}
            draggable
            onDragStart={(e) => onDragStartVideo(e, v)}
            className="group rounded-xl overflow-hidden border border-gray-800 hover:border-gray-700 bg-gray-800 text-left"
            title={v.title}
          >
            <div className="aspect-video bg-gray-900 overflow-hidden flex items-center justify-center text-gray-600 text-sm">
              {section === 'uploaded' ? 'Uploaded' : 'YouTube'}
            </div>
            <div className="px-2 py-2">
              <div className="text-white text-sm line-clamp-2">{v.title || 'Untitled'}</div>
            </div>
          </div>
        ))}
        {videos.length === 0 && (
          <div className="col-span-full text-gray-500 text-sm py-6 text-center">
            {isLoading ? 'Loading...' : 'No videos in this folder'}
          </div>
        )}
      </div>
    </div>
  );
};

export default Gallery;


