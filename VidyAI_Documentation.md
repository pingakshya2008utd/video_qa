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
- **AI Models**: OpenAI GPT-4o, GPT-3.5-turbo
- **Video Processing**: yt-dlp, OpenCV
- **File Management**: Local storage with organized directories
- **CORS**: Cross-origin resource sharing enabled

### Core Components

#### 1. Main Application (`youtube_backend.py`)
The primary FastAPI application that handles all video processing and AI interactions.

**Key Features:**
- YouTube video download and processing
- Transcript extraction and formatting
- AI-powered video analysis
- Quiz generation
- Translation services
- Background task management

#### 2. ML Models (`ml_models.py`)
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
generate_quiz(video_id, difficulty="medium")
```

#### 3. YouTube Utilities (`youtube_utils.py`)
Comprehensive YouTube video processing utilities.

**Key Functions:**
- `download_youtube_video(url)`: Downloads videos using RapidAPI
- `grab_youtube_frame(video_id, timestamp)`: Extracts video frames
- `download_transcript_api(video_id)`: Fetches video transcripts
- `format_transcript_data(transcript)`: Formats transcripts with timestamps

#### 4. Transcript Formatting (`format_transcript.py`)
Intelligent transcript processing and formatting.

**Features:**
- Timestamp-based formatting
- Speaker identification
- Content segmentation
- SRT format support

### API Endpoints

#### Video Processing
- `POST /api/youtube/info` - Get video information and transcript
- `POST /api/youtube/query` - Ask questions about video content
- `POST /api/youtube/frame` - Analyze specific video frames
- `POST /api/youtube/quiz` - Generate quizzes from video content

#### Translation
- `POST /api/translate` - Translate video content between languages

#### File Management
- `GET /api/videos/{video_id}` - Download processed videos
- `GET /api/frames/{frame_id}` - Access video frames

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

## API Reference

### Authentication
All API endpoints require proper CORS configuration and may require authentication tokens.

### Request/Response Formats

#### Video Information Request
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

#### Video Query Request
```json
{
  "video_id": "VIDEO_ID",
  "query": "What is the main topic discussed?",
  "timestamp": 120.5,
  "is_image_query": false
}
```

#### Quiz Generation Request
```json
{
  "video_id": "VIDEO_ID",
  "difficulty": "medium",
  "num_questions": 5
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
```

3. **Directory Structure**
```
backend_prod/
├── videos/          # Downloaded videos
├── frames/          # Extracted video frames
├── output/          # Generated content
└── va_venv/         # Virtual environment
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

1. **Start Backend**
```bash
cd video_qa/backend_prod
python youtube_backend.py
```

2. **Start Frontend**
```bash
cd video_qa/frontend_prod
npm run dev
```

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

2. **AI Model Errors**
   - Verify OpenAI API key
   - Check API rate limits
   - Monitor token usage

3. **CORS Issues**
   - Update allowed origins in backend
   - Check frontend API URL configuration
   - Verify HTTPS/HTTP protocol matching

4. **Authentication Problems**
   - Check Firebase configuration
   - Verify domain whitelist
   - Test with demo mode

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
