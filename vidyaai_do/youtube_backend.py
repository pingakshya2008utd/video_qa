# youtube_backend.py - Simplified for DigitalOcean
from fastapi import FastAPI, HTTPException, BackgroundTasks, Response
from fastapi import UploadFile, File
import shutil
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import logging
import re
import os
import cv2
import uuid
import uvicorn
from youtube_utils import download_video, download_youtube_video, grab_youtube_frame, download_transcript_api, format_transcript_data, extract_youtube_id
from ml_models import OpenAIVisionClient
from typing import Optional
import httpx
import requests

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create directories
video_path = os.path.join(os.path.dirname(__file__), "videos")
frames_path = os.path.join(os.path.dirname(__file__), "frames")
output_path = os.path.join(os.path.dirname(__file__), "output")

for path in [video_path, frames_path, output_path]:
    os.makedirs(path, exist_ok=True)

video_cache = {}
downloaded_videos = {}

app = FastAPI(
    title="YouTube Backend API - DigitalOcean",
    description="Simple YouTube processing API",
    version="1.0.0"
)

@app.options("/{path:path}")
async def options_route(path: str):
    return Response(status_code=200)

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    
    # CORS headers
    response.headers["Access-Control-Allow-Origin"] = "*"  # Update with your domain
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "require-corp"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://d1xrorvpgizypa.cloudfront.net","https://vidyaai.co","http://localhost:5173", "https://www.vidyaai.co"],  # Your React app URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class YouTubeRequest(BaseModel):
    url: str

class VideoQuery(BaseModel):
    video_id: str
    query: str
    timestamp: Optional[float] = None
    is_image_query: bool = False 

class TranslationRequest(BaseModel):
    youtube_url: str
    source_language: str = "en"
    target_language: str

@app.get("/")
def read_root():
    return {"status": "YouTube backend is running on DigitalOcean"}

@app.post("/api/youtube/upload-cookies")
async def upload_cookies(cookie_file: UploadFile = File(...)):
    try:
        # Create directory if it doesn't exist
        os.makedirs("/tmp", exist_ok=True)
        
        # Save the cookie file
        with open("/tmp/cookies.txt", "wb") as buffer:
            shutil.copyfileobj(cookie_file.file, buffer)
        
        # Also save a copy to the current directory for redundancy
        with open("./cookies.txt", "wb") as buffer:
            cookie_file.file.seek(0)  # Reset file pointer to beginning
            shutil.copyfileobj(cookie_file.file, buffer)
        
        return {"success": True, "message": "Cookie file uploaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload cookie file: {str(e)}")





@app.post("/api/youtube/info")
async def get_youtube_info(request: YouTubeRequest):
    """Get information about a YouTube video from its URL"""
    url = request.url
    
    logger.info(f"Processing YouTube URL: {url}")
    
    # Extract video ID from the URL
    video_id = extract_youtube_id(url)
    
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    
    try:
        title = await get_video_title(video_id)
        
        # Download video using yt-dlp (works great on DigitalOcean)
        video_path1 = download_video(url)
        if video_path1:
            downloaded_videos[video_id] = video_path1
            
        # Get transcript
        transcript_data = download_transcript_api(video_id)
        formatted_transcript = format_transcript_data(transcript_data)
        
        logger.info(f"Video info: ID={video_id}, Title={title}")
        
        print(f"--------------Video title: {title}----------")
        return {
            "video_id": video_id,
            "title": title,
            "url": url,
            "transcript": formatted_transcript,
            "embed_url": f"https://www.youtube.com/embed/{video_id}?enablejsapi=1"
        }
        
    except Exception as e:
        logger.error(f"Error processing YouTube URL: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def get_video_title(video_id: str) -> str:
    """Get the title of a YouTube video"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v={video_id}&format=json")
            if response.status_code == 200:
                data = response.json()
                return data.get("title", f"YouTube Video ({video_id})")
    except Exception:
        pass
    
    return f"YouTube Video ({video_id})"

@app.get("/api/youtube/download-info")
async def get_download_info(videoId: str):
    """Get YouTube video download info"""
    try:
        # Try yt-dlp first (works better on DigitalOcean)
        import yt_dlp
        
        ydl_opts = {
            'quiet': True,
            'no_download': True,
            'format': 'best[height<=720]/best',
        }
        
        url = f"https://www.youtube.com/watch?v={videoId}"
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            title = info.get('title', 'YouTube Video')
            download_url = info.get('url', None)
            
            return {
                "title": title,
                "downloadUrl": download_url,
                "duration": info.get('duration'),
                "description": info.get('description', '')[:500] + "..." if info.get('description') else ""
            }
            
    except Exception as e:
        # Fallback to RapidAPI
        logger.warning(f"yt-dlp failed, trying RapidAPI: {e}")
        try:
            headers = {
                'x-rapidapi-key': "87cb804577msh2f08e931a0d9bacp19e810jsn4f8fd6ff742b",
                'x-rapidapi-host': "youtube-media-downloader.p.rapidapi.com"
            }
            
            params = {
                'videoId': videoId,
                'urlAccess': 'normal',
                'videos': 'auto',
                'audios': 'auto'
            }
            
            response = requests.get(
                "https://youtube-media-downloader.p.rapidapi.com/v2/video/details",
                params=params,
                headers=headers
            )
            
            data = response.json()
            title = data.get('title', 'YouTube Video')
            download_url = None
            if 'videos' in data and 'items' in data['videos'] and data['videos']['items']:
                download_url = data['videos']['items'][0]['url']
            
            return {
                "title": title,
                "downloadUrl": download_url
            }
        except Exception as e2:
            raise HTTPException(status_code=500, detail=str(e2))

@app.post("/api/query/video")
async def process_query(query_request: VideoQuery):
    """Process a query about a YouTube video - either text-only or image-based"""
    try:
        video_id = query_request.video_id
        query = query_request.query
        timestamp = query_request.timestamp
        is_image_query = query_request.is_image_query

        print("query-----:", query)
        
        logger.info(f"Processing {'image' if is_image_query else 'text'} query for video {video_id}")
        logger.info(f"Query: {query}")
        logger.info(f"Timestamp: {timestamp}")
        
        vision_client = OpenAIVisionClient()
        
        url = f"https://www.youtube.com/watch?v={video_id}"
        
        # Get transcript for context
        transcript_data = download_transcript_api(video_id)
        formatted_transcript = format_transcript_data(transcript_data)
        
        response = ""
        
        if is_image_query:
            if timestamp is None:
                raise HTTPException(status_code=400, detail="Timestamp is required for image queries")
            
            # Get video path
            if video_id in downloaded_videos and os.path.exists(downloaded_videos[video_id]):
                video_path_local = downloaded_videos[video_id]
            else:
                video_path_local = download_video(url)
                if video_path_local:
                    downloaded_videos[video_id] = video_path_local
            
            if not video_path_local or not os.path.exists(video_path_local):
                raise HTTPException(status_code=404, detail="Video file not found")
            
            # Extract frame using simple method (since youtube_frame_extractor might not exist)
            frame_filename = f"frame_{video_id}_{int(timestamp)}.jpg"
            frame_path = os.path.join(frames_path, frame_filename)
            
            try:
                # Use the grab_youtube_frame function from your utils
                output_file, frame = grab_youtube_frame(video_path_local, timestamp, frame_path)
                if not output_file:
                    raise Exception("Failed to extract frame")
                
                # Use the image-based query function
                response = vision_client.ask_with_image(query, frame_path)
                
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Frame extraction failed: {str(e)}")
            
        else:
            # Text-only query about the video content
            response = vision_client.ask_text_only(query, formatted_transcript)
        
        return {
            "response": response,
            "video_id": video_id,
            "timestamp": timestamp,
            "query_type": "image" if is_image_query else "text"
        }
        
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process query: {str(e)}")

# Simplified translation endpoint (without dub_video dependency)
@app.post("/api/query/translate")
async def translate_youtube_video(request: TranslationRequest, background_tasks: BackgroundTasks):
    """Placeholder for video translation - implement when you have translation module"""
    try:
        job_id = str(uuid.uuid4())
        
        return {
            "status": "not_implemented",
            "job_id": job_id,
            "message": "Translation feature not implemented yet. Add translate_elevenlabs.py to enable this feature."
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# Store job status
translation_jobs = {}

@app.get("/api/translated_videos/{job_id}/{file_name}")
async def get_translated_video(job_id: str, file_name: str):
    """Serve translated video files"""
    file_path = os.path.join(output_path, job_id, file_name)
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="video/mp4", filename=file_name)
    else:
        raise HTTPException(status_code=404, detail="Video file not found")

@app.get("/api/query/translate/{job_id}")
async def get_translation_status(job_id: str):
    """Get the status of a translation job"""
    if job_id not in translation_jobs:
        raise HTTPException(status_code=404, detail="Translation job not found")
    
    return translation_jobs[job_id]

# Optional: Serve video files directly
@app.get("/api/videos/{video_id}")
async def serve_video(video_id: str):
    """Serve downloaded video files"""
    if video_id in downloaded_videos:
        video_path = downloaded_videos[video_id]
        if os.path.exists(video_path):
            return FileResponse(video_path, media_type="video/mp4")
    
    raise HTTPException(status_code=404, detail="Video not found")

# Optional: Serve frame images
@app.get("/api/frames/{frame_filename}")
async def serve_frame(frame_filename: str):
    """Serve extracted frame images"""
    frame_path = os.path.join(frames_path, frame_filename)
    if os.path.exists(frame_path):
        return FileResponse(frame_path, media_type="image/jpeg")
    
    raise HTTPException(status_code=404, detail="Frame not found")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("youtube_backend:app", host="0.0.0.0", port=port, reload=False)
