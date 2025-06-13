# Vidya AI Video Assistant

In this project, I have created an edtech platform where the user can interact with online eductional or any other video. I have created an interface where you can chat with the video using RAG and ask question to a particular frame in a video. Let's say the frame contains a digital circuit. You can ask what does the circuit represent and it will explain the image in that frame.

## Features
 ### AI Agents
- **YouTube Video Analysis**: Load any YouTube video and ask AI questions about its content
- **Frame-based Queries**: Ask questions about specific video frames at any timestamp
- **Video Translation**: Translate YouTube videos into multiple languages using ElevenLabs AI

### Video Player Features
- **Video Controls**: Custom video player with playback controls
- **Multi-language Support**: Support for Spanish, Hindi, Bengali, and Assamese translations

## Tech Stack

### Backend
- **FastAPI**: Modern, fast web framework for building APIs
- **OpenAI GPT-4o**: For vision-based queries
- **GPT-4.5 turbo**: For chat with transcript
- **[LLama Index](https://www.llamaindex.ai/blog/multimodal-rag-for-advanced-video-processing-with-llamaindex-lancedb-33be4804822e)**: For video RAG
- **ElevenLabs API**: For video dubbing and translation
- **yt-dlp**: YouTube video downloading
- **OpenCV**: Video frame extraction
- **YouTube Transcript API**: Transcript extraction

### Frontend
- **React**: UI framework
- **Tailwind CSS**: Styling
- **Lucide React**: Icons
- **Axios**: HTTP client
- **YouTube IFrame API**: Video player integration

## Prerequisites

- Python 3.8+
- Node.js 16+
- OpenAI API Key
- ElevenLabs API Key

## Installation & Setup

### Backend Setup

1. **Clone the repository**
```bash
git clone https://github.com/pingakshya2008utd/video_qa.git
git checkout dev_branch
cd vidya_ai
```

2. **Create and activate virtual environment**
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install Python dependencies**
```bash
pip install fastapi uvicorn openai python-dotenv yt-dlp opencv-python youtube-transcript-api elevenlabs moviepy httpx
```

4. **Create environment file**
Create a `.env` file in the root directory:
```env
OPENAI_API_KEY=your_openai_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

5. **Create necessary directories**
```bash
mkdir videos frames output
```

6. **Run the backend server**
```bash
cd backend
python youtube_backend.py
```
The backend will be available at `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory** (if separate)
```bash
cd frontend  # Adjust path as needed
```

2. **Install dependencies**
```bash
npm install react react-dom axios lucide-react
npm install -D tailwindcss postcss autoprefixer
```

3. **Initialize Tailwind CSS**
```bash
npx tailwindcss init -p
```

4. **Start the development server**
```bash
npm run dev
```
The frontend will be available at `http://localhost:5173`

## API Documentation

### Base URL
```
http://localhost:8000
```

### Endpoints

#### 1. Get YouTube Video Information
```http
POST /api/youtube/info
```

**Request Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:**
```json
{
  "video_id": "VIDEO_ID",
  "title": "Video Title",
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "embed_url": "https://www.youtube.com/embed/VIDEO_ID?enablejsapi=1"
}
```

#### 2. Query Video Content
```http
POST /api/query/video
```

**Request Body:**
```json
{
  "video_id": "VIDEO_ID",
  "query": "What is this video about?",
  "timestamp": 120.5,
  "is_image_query": false
}
```

**Response:**
```json
{
  "response": "AI response to your query",
  "video_id": "VIDEO_ID",
  "timestamp": 120.5,
  "query_type": "text"
}
```

**Query Types:**
- `is_image_query: false` - Ask about video content using transcript
- `is_image_query: true` - Ask about specific video frame at timestamp

#### 3. Start Video Translation
```http
POST /api/query/translate
```

**Request Body:**
```json
{
  "youtube_url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "source_language": "en",
  "target_language": "es"
}
```

**Response:**
```json
{
  "status": "processing",
  "job_id": "uuid-job-id",
  "message": "Translation started. You can check the status using the job ID"
}
```

**Supported Languages:**
- `en` - English (source)
- `es` - Spanish
- `hi` - Hindi
- `bn` - Bengali
- `as` - Assamese

#### 4. Check Translation Status
```http
GET /api/query/translate/{job_id}
```

**Response (Processing):**
```json
{
  "status": "processing",
  "progress": 50
}
```

**Response (Completed):**
```json
{
  "status": "completed",
  "progress": 100,
  "output_file": "video5_es.mp4",
  "output_url": "/api/translated_videos/job_id/video5_es.mp4"
}
```

**Response (Failed):**
```json
{
  "status": "failed",
  "error": "Error message"
}
```

#### 5. Download Translated Video
```http
GET /api/translated_videos/{job_id}/{file_name}
```

Returns the translated video file for download.

## Usage Guide

### 1. Video Analysis

1. **Load a YouTube video:**
   - Enter a YouTube URL in the input field
   - Click "Load Video"
   - The video will be embedded and ready for queries

2. **Ask questions about the video:**
   - Select "Ask about video" for general content questions
   - Select "Ask about current frame" for frame-specific questions
   - Type your question and press Enter or click Send

3. **Frame-based queries:**
   - Pause the video at the desired frame
   - Select "Ask about current frame"
   - Ask questions like "What objects do you see?" or "Describe this scene"

### 2. Video Translation

1. **Start translation:**
   - Enter a YouTube URL
   - Select target language from dropdown
   - Click "Start Translation"

2. **Monitor progress:**
   - Check the status logs for real-time updates
   - Use "Check Now" button for manual status updates
   - Translation typically takes 2-10 minutes depending on video length

3. **Download result:**
   - Once complete, the translated video will be displayed
   - Click "Download Translated Video" to save locally

## File Structure

```
youtube-video-ai/
├── backend/                          # Python FastAPI backend
│   ├── frames/                       # Extracted video frames
│   ├── output/                       # Translation output directory
│   │   └── [job-id]/                # Translation job folders
│   │       ├── [video-id]/          # Individual video translations
│   │       │   ├── meta.json        # Translation metadata
│   │       │   └── dubbed_video.mp4 # Translated video output
│   ├── videos/                       # Downloaded YouTube videos
│   ├── ml_models.py                  # AI model integration
│   ├── translate_elevenlabs.py       # ElevenLabs translation service
│   ├── translate_video.py            # Video translation logic
│   ├── youtube_backend.py            # Main FastAPI application
│   └── youtube_utils.py              # YouTube utility functions
├── frontend/                         # React frontend application
│   ├── public/
│   │   └── logo-new.png             # Application logo
│   ├── src/
│   │   ├── components/
│   │   │   ├── ImprovedYouTubePlayer.jsx  # Main video player component
│   │   │   └── TranslatePage.jsx          # Translation interface
│   │   ├── App.jsx                  # Main application component
│   │   ├── App.css                  # Application styles
│   │   ├── index.css                # Global styles
│   │   └── main.jsx                 # React entry point
│   ├── index.html                   # HTML template
│   ├── package.json                 # Dependencies and scripts
│   ├── postcss.config.js            # PostCSS configuration
│   ├── tailwind.config.js           # Tailwind CSS configuration
│   └── vite.config.js               # Vite configuration
├── README.md                        # Project documentation
└── tailwind.html                    # Static HTML template
```

## Configuration

### OpenAI Models
- **Text queries**: `gpt-3.5-turbo`
- **Image queries**: `gpt-4o` (vision model)

### ElevenLabs Settings
- **Dubbing model**: Default ElevenLabs dubbing
- **Watermark**: Enabled by default
- **Output format**: MP4

### Video Settings
- **Download quality**: 720p (configurable)
- **Output format**: MP4
- **Audio**: Included

## Error Handling

### Common Issues

1. **"Invalid YouTube URL"**
   - Ensure URL format is correct
   - Supported formats: `youtube.com/watch?v=`, `youtu.be/`

2. **"Failed to download YouTube video"**
   - Video might be private or restricted
   - Check internet connection
   - Some videos may not be downloadable due to copyright

3. **"Translation failed"**
   - Check ElevenLabs API key and quota
   - Ensure video has audio track
   - Some videos may be too long for translation

4. **"Frame extraction failed"**
   - Ensure timestamp is within video duration
   - Check if video file exists and is accessible

### Debugging

Enable detailed logging by setting environment variable:
```bash
export LOG_LEVEL=DEBUG
```

## API Rate Limits

- **OpenAI**: Depends on your plan
- **ElevenLabs**: Check your subscription limits
- **YouTube**: No official API used, but respect fair use

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is for educational and research purposes. Ensure compliance with:
- YouTube Terms of Service
- OpenAI Usage Policies
- ElevenLabs Terms of Service
- Copyright laws for video content

## Support

For issues and questions:
1. Check the error logs in the console
2. Verify API keys are correctly set
3. Ensure all dependencies are installed
4. Check network connectivity

## Roadmap

- [ ] Support for more languages
- [ ] Batch video processing
- [ ] Real-time translation
- [ ] Advanced video analytics
- [ ] User authentication
- [ ] Video upload from local files
- [ ] Subtitle generation and editing
