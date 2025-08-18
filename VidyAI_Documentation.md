# VidyAI - AI-Powered Video Learning Platform

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Backend Documentation](#backend-documentation)
4. [Frontend Documentation](#frontend-documentation)
5. [Features](#features)
6. [API Reference](#api-reference)
7. [Setup & Installation](#setup--installation)
8. [Deployment](#deployment)
9. [Security](#security)
10. [Troubleshooting](#troubleshooting)

## Overview

VidyAI is an intelligent video learning platform that combines YouTube video processing with AI-powered features to enhance educational experiences. The platform allows users to chat with videos, generate quizzes, translate content, and solve academic doubts using advanced AI models.

### Key Features
- **Video Chat**: Interactive conversations about YouTube video content
- **AI Doubt Solver**: Academic question answering across multiple subjects
- **Interactive Quizzes**: AI-generated quizzes with adaptive difficulty
- **Smart Translation**: Context-aware text translation
- **Video Frame Analysis**: Visual content understanding using computer vision
- **Transcript Processing**: Intelligent transcript formatting and analysis

## Architecture

The application follows a modern client-server architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   External      │
│   (React/Vite)  │◄──►│   (FastAPI)     │◄──►│   Services      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
│                      │                      │
├─ Authentication      ├─ YouTube Processing  ├─ OpenAI API
├─ Video Player        ├─ AI Models          ├─ YouTube API
├─ Chat Interface      ├─ File Management    ├─ RapidAPI
├─ Quiz System         ├─ CORS Handling      ├─ Firebase
└─ Translation         └─ Background Tasks   └─ Cloud Storage
```

## Backend Documentation

### Technology Stack
- **Framework**: FastAPI (Python)
- **Database**: SQLAlchemy with PostgreSQL support (JSONB columns)
- **AI Models**: OpenAI GPT-4o, GPT-3.5-turbo, Whisper-1
- **Video Processing**: yt-dlp, OpenCV, RapidAPI YouTube services
- **Cloud Storage**: AWS S3 with presigned URLs
- **File Management**: Local storage + S3 cloud storage
- **Authentication**: Cookie-based YouTube authentication
- **Background Tasks**: ThreadPoolExecutor for async operations
- **CORS**: Cross-origin resource sharing enabled

### Core Components

#### 1. Main Application (`youtube_backend.py`)
The primary FastAPI application that handles all video processing and AI interactions.

**Key Features:**
- YouTube video download and processing with background tasks
- User video upload to S3 with automatic transcription
- Transcript extraction, formatting, and AI-powered enhancement
- Video frame extraction and analysis
- AI-powered video chat and query processing
- Interactive quiz generation
- Video gallery and folder organization
- Translation services (placeholder)
- Background task management with status tracking
- S3 integration with presigned URLs

#### 2. Database Models (`models.py`, `schemas.py`, `db.py`)
SQLAlchemy models for data persistence with PostgreSQL support.

**Models:**
- `Video`: Stores video metadata, transcripts, and organization
- `Folder`: Hierarchical folder structure for video organization

**Key Features:**
- Support for both YouTube and uploaded videos
- JSONB columns for flexible transcript and status storage
- Automatic UUID generation
- Timestamp tracking
- Folder-based organization system

#### 3. ML Models (`ml_models.py`)
Handles all AI model interactions using OpenAI's API.

**Classes:**
- `OpenAIVisionClient`: Handles text and image-based queries
- `OpenAIQuizClient`: Generates interactive quizzes

**Key Methods:**
```python
# Text-only queries
ask_text_only(prompt, context="")

# Image + text queries
ask_with_image(prompt, image_path, context="")

# Quiz generation
generate_quiz(transcript, num_questions=5, difficulty="medium", 
              include_explanations=True, language="en")
```

#### 4. YouTube Utilities (`youtube_utils.py`)
Comprehensive YouTube video processing utilities.

**Key Functions:**
- `download_video(url)`: Downloads videos using yt-dlp
- `download_youtube_video(url)`: Downloads videos using RapidAPI (fallback)
- `grab_youtube_frame(video_path, timestamp, output_path)`: Extracts video frames
- `download_transcript_api(video_id)`: Fetches video transcripts via RapidAPI
- `download_transcript_api1(video_id)`: Alternative transcript API
- `format_transcript_data(transcript)`: Basic transcript formatting
- `extract_youtube_id(url)`: Extracts video ID from YouTube URLs

#### 5. Advanced Transcript Formatting (`format_transcript.py`)
AI-powered transcript processing and enhancement.

**Key Functions:**
- `create_formatted_transcript(json_data, video_id)`: AI-enhanced transcript formatting

**Features:**
- AI-powered content enhancement and structuring
- Progress tracking for long transcripts
- Chunk-based processing for large content
- Background task integration
- Timestamp preservation and enhancement
- Intelligent content segmentation

### API Endpoints

#### Core Status
- `GET /` - Health check endpoint

#### YouTube Video Processing
- `POST /api/youtube/info` - Get video information and transcript
- `GET /api/youtube/download-info` - Get YouTube video download information
- `GET /api/youtube/download-status/{video_id}` - Check video download status
- `GET /api/youtube/formatting-status/{video_id}` - Check transcript formatting status
- `GET /api/youtube/formatted-transcript/{video_id}` - Get AI-formatted transcript
- `POST /api/youtube/upload-cookies` - Upload YouTube cookies for authentication

#### Video Query & Analysis
- `POST /api/query/video` - Ask questions about video content (text or image-based)
- `POST /api/query/translate` - Translate video content (placeholder endpoint)
- `GET /api/query/translate/{job_id}` - Get translation job status

#### Quiz Generation
- `POST /api/quiz/generate` - Generate interactive quizzes from video content

#### User Video Management
- `POST /api/user-videos/upload` - Upload user videos to S3 with transcription and progress tracking
- `GET /api/user-videos/upload-status/{video_id}` - Check upload progress and status
- `GET /api/user-videos/list` - List user's uploaded videos
- `GET /api/user-videos/info` - Get information about uploaded video

#### File Serving
- `GET /api/videos/{video_id}` - Serve downloaded video files
- `GET /api/frames/{frame_filename}` - Serve extracted video frames
- `GET /api/translated_videos/{job_id}/{file_name}` - Serve translated video files

#### Storage & Cloud
- `GET /api/storage/presign` - Generate presigned URLs for S3 objects

#### Gallery & Organization
- `POST /api/folders` - Create video folders
- `GET /api/folders` - List user folders
- `GET /api/gallery` - List videos in gallery with folder filtering
- `POST /api/gallery/move` - Move videos between folders

#### Debug & Development
- `GET /api/debug/transcript-raw/{video_id}` - Debug transcript API responses

## Frontend Documentation

### Technology Stack
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS
- **Authentication**: Firebase Auth
- **HTTP Client**: Axios
- **Icons**: Lucide React
- **Routing**: React Router DOM

### Core Components

#### 1. Main Application (`App.jsx`)
The root component that manages authentication and navigation.

**Features:**
- Authentication state management
- Route protection
- Navigation between pages
- Demo mode support

#### 2. Home Page (`HomePage.jsx`)
The main dashboard showcasing all available features.

**Components:**
- Feature cards with descriptions
- User profile management
- Navigation menu
- Responsive design

#### 3. YouTube Player (`ImprovedYouTubePlayer.jsx`)
The core video interaction component.

**Features:**
- YouTube video embedding
- Transcript display
- Chat interface
- Quiz integration
- Frame analysis
- Local storage persistence

#### 4. Authentication (`AuthContext.jsx`)
Firebase authentication with fallback demo mode.

**Features:**
- Email/password authentication
- Google OAuth integration
- User profile management
- Demo mode for testing

### Component Architecture

```
App.jsx
├── AuthProvider
│   ├── AuthForm (Login/Signup)
│   └── Protected Routes
│       ├── HomePage
│       ├── ImprovedYouTubePlayer
│       └── TranslatePage
```

## Features

### 1. Video Chat
- **Real-time Conversations**: Chat with AI about video content
- **Context Awareness**: AI understands video context and timestamps
- **Visual Analysis**: Ask questions about specific video frames
- **Transcript Integration**: AI uses video transcripts for accurate responses

### 2. AI Doubt Solver
- **Multi-subject Support**: Math, science, literature, and more
- **Instant Answers**: Quick responses to academic questions
- **Step-by-step Explanations**: Detailed problem-solving approaches
- **Adaptive Learning**: Personalized responses based on user level

### 3. Interactive Quizzes
- **AI-Generated Questions**: Automatic quiz creation from video content
- **Adaptive Difficulty**: Questions adjust to user performance
- **Multiple Formats**: Multiple choice, true/false, short answer
- **Progress Tracking**: Monitor learning progress over time

### 4. Smart Translation
- **Multi-language Support**: Translate between various languages
- **Context Preservation**: Maintains meaning and context
- **Video Content Translation**: Translate video transcripts and descriptions
- **Real-time Translation**: Instant translation results

### 5. Video Frame Analysis
- **Visual Understanding**: AI analyzes video frames for content
- **Timestamp Integration**: Connect visual analysis with transcript timestamps
- **Object Recognition**: Identify objects, people, and scenes
- **Contextual Questions**: Ask about specific visual elements

### 6. User Video Management
- **Video Upload**: Upload personal videos with automatic transcription and real-time progress tracking
- **Upload Progress**: Real-time status updates during file processing, transcription, and cloud upload
- **Cloud Storage**: S3 integration with presigned URLs for secure access
- **Automatic Thumbnails**: Generate thumbnails from uploaded videos
- **Whisper Transcription**: OpenAI Whisper-1 for accurate speech-to-text
- **Gallery Organization**: Folder-based video organization system

### 7. Background Processing
- **Async Downloads**: Non-blocking video downloads with status tracking
- **AI Transcript Enhancement**: Background AI-powered transcript formatting
- **Progress Tracking**: Real-time status updates for long-running tasks
- **Thread Pool Management**: Efficient resource utilization

## API Reference

### Authentication
All API endpoints require proper CORS configuration and may require authentication tokens.

### Request/Response Formats

#### Video Information Request (`POST /api/youtube/info`)
**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "user_id": "optional_user_id"
}
```

**Response:**
```json
{
  "video_id": "VIDEO_ID",
  "title": "Video Title",
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "transcript": "Full video transcript...",
  "embed_url": "https://www.youtube.com/embed/VIDEO_ID?enablejsapi=1",
  "download_status": "Video download started in background"
}
```

#### Video Query Request (`POST /api/query/video`)
**Request:**
```json
{
  "video_id": "VIDEO_ID",
  "query": "What is the main topic discussed?",
  "timestamp": 120.5,
  "is_image_query": false
}
```

**Response:**
```json
{
  "response": "AI-generated response to the query...",
  "video_id": "VIDEO_ID",
  "timestamp": 120.5,
  "query_type": "text"
}
```

#### Quiz Generation Request (`POST /api/quiz/generate`)
**Request:**
```json
{
  "video_id": "VIDEO_ID",
  "num_questions": 5,
  "difficulty": "medium",
  "include_explanations": true,
  "language": "en"
}
```

**Response:**
```json
{
  "success": true,
  "video_id": "VIDEO_ID",
  "quiz": [
    {
      "id": "q1",
      "question": "What is the main topic?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option A",
      "difficulty": "medium",
      "explanation": "Detailed explanation..."
    }
  ],
  "message": "Successfully generated 5 questions"
}
```

#### User Video Upload Request (`POST /api/user-videos/upload`)
**Request (multipart/form-data):**
- `user_id`: string (form field)
- `file`: video file upload

**Response:**
```json
{
  "success": true,
  "video_id": "generated-uuid",
  "title": "Uploaded Video.mp4",
  "video_url": "presigned-s3-url",
  "thumbnail_url": "presigned-thumbnail-url",
  "has_transcript": true,
  "formatting_status": "started"
}
```

#### Upload Status Request (`GET /api/user-videos/upload-status/{video_id}`)
**Response:**
```json
{
  "status": "processing",
  "message": "Generating thumbnail...",
  "progress": 50,
  "current_step": "generating_thumbnail",
  "total_steps": 6
}
```

**Possible Status Values:**
- `starting` - Upload initialization
- `processing` - Upload in progress
- `completed` - Upload completed successfully
- `failed` - Upload failed with error details

**Processing Steps:**
1. `initializing` - Setting up upload process
2. `saving_file` - Saving uploaded file locally
3. `preparing_upload` - Preparing for cloud upload
4. `uploading_video` - Uploading video to S3
5. `generating_thumbnail` - Creating video thumbnail
6. `transcribing` - Converting audio to text
7. `finalizing` - Completing upload process

#### Folder Creation Request (`POST /api/folders`)
**Request:**
```json
{
  "user_id": "user123",
  "name": "My Folder",
  "parent_id": null,
  "source_type": "youtube"
}
```

**Response:**
```json
{
  "id": "folder-uuid",
  "user_id": "user123",
  "name": "My Folder",
  "parent_id": null,
  "source_type": "youtube"
}
```

#### Translation Request (`POST /api/query/translate`)
**Request:**
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
  "status": "not_implemented",
  "job_id": "uuid",
  "message": "Translation feature not implemented yet..."
}
```

### Error Handling
The API returns standard HTTP status codes:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `404`: Not Found
- `500`: Internal Server Error

## Setup & Installation

### Backend Setup

1. **Environment Setup**
```bash
cd video_qa/backend_prod
python -m venv va_venv
source va_venv/bin/activate  # On Windows: va_venv\Scripts\activate
pip install -r requirements.txt
```

2. **Environment Variables**
Create a `.env` file with:
```
OPENAI_API_KEY=your_openai_api_key
RAPIDAPI_KEY=your_rapidapi_key
AWS_S3_BUCKET=your_s3_bucket_name
AWS_S3_REGION=us-east-1
AWS_S3_ENDPOINT=optional_custom_s3_endpoint
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
DATABASE_URL=postgresql://user:password@localhost/vidyai
PORT=8000
```

3. **Directory Structure**
```
backend_prod/
├── videos/              # Downloaded and uploaded videos
├── frames/              # Extracted video frames
├── output/              # Generated content and translations
├── va_venv/             # Virtual environment
├── youtube_backend.py   # Main FastAPI application
├── main.py              # Alternative entry point
├── ml_models.py         # AI model integrations
├── youtube_utils.py     # YouTube processing utilities
├── format_transcript.py # AI transcript enhancement
├── db.py               # Database configuration
├── models.py           # SQLAlchemy models
├── schemas.py          # Pydantic schemas
├── system_prompt.py    # AI system prompts
└── setup.sh           # Deployment setup script
```

### Frontend Setup

1. **Installation**
```bash
cd video_qa/frontend_prod
npm install
```

2. **Configuration**
Update `src/components/utils.jsx` with your API URL:
```javascript
export const API_URL = 'http://localhost:8000';  // Development
// export const API_URL = 'https://your-production-domain.com';  // Production
```

3. **Firebase Setup** (Optional)
Configure Firebase in `src/firebase/config.js` for authentication.

### Running the Application

1. **Setup Database** (if using PostgreSQL)
```bash
# Create database and run migrations if needed
createdb vidyai
```

2. **Start Backend**
```bash
cd video_qa/backend_prod
source va_venv/bin/activate  # On Windows: va_venv\Scripts\activate
python youtube_backend.py
# Alternative: python main.py
# For production: ./setup.sh
```

3. **Start Frontend**
```bash
cd video_qa/frontend_prod
npm run dev
```

4. **Upload YouTube Cookies** (if needed for restricted videos)
Use the `/api/youtube/upload-cookies` endpoint to upload cookie files for authenticated YouTube access.

## Deployment

### Backend Deployment (DigitalOcean)
The backend is configured for DigitalOcean deployment with:
- CORS configuration for production domains
- Optimized for cloud deployment
- Background task management
- File storage optimization

### Frontend Deployment
The frontend can be deployed to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- Any static hosting service

### Production Considerations
- Set up proper CORS origins
- Configure environment variables
- Set up monitoring and logging
- Implement rate limiting
- Configure CDN for static assets

## Security

### Authentication
- Firebase Authentication integration
- JWT token management
- Protected routes
- Demo mode for testing

### API Security
- CORS configuration
- Input validation
- Rate limiting (recommended)
- Error handling without sensitive data exposure

### Data Privacy
- Local file storage
- No persistent user data storage
- Secure API key management
- HTTPS enforcement in production

## Troubleshooting

### Common Issues

1. **Video Download Failures**
   - Check RapidAPI key validity
   - Verify YouTube URL format
   - Ensure sufficient disk space
   - Upload YouTube cookies for restricted videos
   - Check background download status via API

2. **AI Model Errors**
   - Verify OpenAI API key
   - Check API rate limits
   - Monitor token usage
   - Ensure transcript availability before queries

3. **S3 Storage Issues**
   - Verify AWS credentials and bucket permissions
   - Check S3 bucket configuration
   - Ensure proper IAM policies for presigned URLs
   - Monitor S3 storage costs

4. **Database Connection Problems**
   - Verify PostgreSQL connection string
   - Check database permissions
   - Ensure SQLAlchemy models are up to date
   - Run database migrations if needed

5. **CORS Issues**
   - Update allowed origins in backend
   - Check frontend API URL configuration
   - Verify HTTPS/HTTP protocol matching

6. **Authentication Problems**
   - Check Firebase configuration
   - Verify domain whitelist
   - Test with demo mode

7. **Background Task Issues**
   - Monitor ThreadPoolExecutor status
   - Check formatting and download status endpoints
   - Verify sufficient system resources
   - Review application logs for task failures

### Performance Optimization

1. **Video Processing**
   - Implement video caching
   - Use background tasks for long operations
   - Optimize frame extraction

2. **AI Responses**
   - Implement response caching
   - Use streaming for long responses
   - Optimize prompt engineering

3. **Frontend Performance**
   - Implement lazy loading
   - Use React.memo for expensive components
   - Optimize bundle size

### Monitoring

1. **Backend Monitoring**
   - Log API requests and responses
   - Monitor error rates
   - Track resource usage

2. **Frontend Monitoring**
   - Track user interactions
   - Monitor performance metrics
   - Error boundary implementation

## Contributing

### Development Guidelines
1. Follow existing code structure
2. Add proper error handling
3. Include documentation for new features
4. Test thoroughly before deployment

### Code Style
- Python: PEP 8 compliance
- JavaScript: ESLint configuration
- React: Functional components with hooks
- CSS: Tailwind utility classes

---

**VidyAI** - Transforming video learning with AI-powered intelligence.

*Last Updated: January 2025*
*Version: 1.0.0*
