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
from youtube_utils import download_video, download_youtube_video, grab_youtube_frame, download_transcript_api, \
    format_transcript_data, extract_youtube_id, download_transcript_api1
from format_transcript import  create_formatted_transcript
from ml_models import OpenAIVisionClient
from typing import Optional
import httpx
import requests
import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create directories
video_path = os.path.join(os.path.dirname(__file__), "videos")
frames_path = os.path.join(os.path.dirname(__file__), "frames")
output_path = os.path.join(os.path.dirname(__file__), "output")
download_status = {}  # Track download status
download_executor = ThreadPoolExecutor(max_workers=3)  # Thread pool for downloads

# Add these global variables after your existing globals (around line 29)
formatting_status = {}  # Track formatting status
formatting_executor = ThreadPoolExecutor(max_workers=3)  # Thread pool for formatting

# Global transcript storage
transcript_cache = {}  # Store transcript data for each video_id


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

# Add this function after your existing functions but before the endpoints
def download_video_background(video_id: str, url: str):
    """Background function to download video"""
    try:
        download_status[video_id] = {
            "status": "downloading", 
            "message": "Video download in progress...",
            "path": None
        }
        
        logger.info(f"Starting background download for video: {video_id}")
        video_path = download_video(url)
        
        if video_path and os.path.exists(video_path):
            downloaded_videos[video_id] = video_path
            download_status[video_id] = {
                "status": "completed",
                "message": "Video download complete", 
                "path": video_path
            }
            logger.info(f"Video download completed: {video_path}")
        else:
            download_status[video_id] = {
                "status": "failed",
                "message": "Video download failed",
                "path": None
            }
            
    except Exception as e:
        download_status[video_id] = {
            "status": "failed",
            "message": f"Video download failed: {str(e)}",
            "path": None
        }
        logger.error(f"Video download error for {video_id}: {str(e)}")

#REPLACE the existing format_transcript_background function with this:
def format_transcript_background(video_id: str, json_data: dict):
    """Background function to format transcript with progress tracking"""
    try:
        formatting_status[video_id] = {
            "status": "formatting",
            "message": "AI-based transcript formatting in progress...",
            "formatted_transcript": None,
            "error": None,
            "progress": 0,          # ADD THIS LINE
            "total_chunks": 0,      # ADD THIS LINE
            "current_chunk": 0      # ADD THIS LINE
        }
        
        logger.info(f"Starting background transcript formatting for video: {video_id}")
        
        # CHANGE THIS LINE: pass video_id to track progress
        formatted_transcript_lines = create_formatted_transcript(json_data, video_id=video_id)
        formatted_transcript_text = ''.join(formatted_transcript_lines)
        logger.info(f"formatted transcript text {formatted_transcript_text}")
        
        formatting_status[video_id] = {
            "status": "completed",
            "message": "AI transcript formatting complete",
            "formatted_transcript": formatted_transcript_text,
            "error": None,
            "progress": 100,        # ADD THIS LINE
            "total_chunks": formatting_status[video_id].get("total_chunks", 0),    # ADD THIS LINE
            "current_chunk": formatting_status[video_id].get("total_chunks", 0)    # ADD THIS LINE
        }
        logger.info(f"Transcript formatting completed for video: {video_id}")
        
    except Exception as e:
        formatting_status[video_id] = {
            "status": "failed",
            "message": f"Transcript formatting failed: {str(e)}",
            "formatted_transcript": None,
            "error": str(e),
            "progress": 0,          # ADD THIS LINE
            "total_chunks": 0,      # ADD THIS LINE
            "current_chunk": 0      # ADD THIS LINE
        }
        logger.error(f"Transcript formatting error for {video_id}: {str(e)}")


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




# Add this new endpoint after your existing endpoints
@app.get("/api/youtube/download-status/{video_id}")
async def get_download_status(video_id: str):
    """Check the download status of a video"""
    if video_id in downloaded_videos and os.path.exists(downloaded_videos[video_id]):
        return {"status": "completed", "message": "Video download complete", "path": downloaded_videos[video_id]}
    
    if video_id in download_status:
        return download_status[video_id]
    
    return {"status": "not_found", "message": "No download record found"}


          


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
        if video_id in downloaded_videos and os.path.exists(downloaded_videos[video_id]):
            download_message = f"Video already downloaded: {downloaded_videos[video_id]}"
        elif video_id in download_status:
            status = download_status[video_id]
            download_message = f"Download status: {status['status']} - {status['message']}"
        else:
            # Start background download
            download_executor.submit(download_video_background, video_id, url)
            download_message = "Video download started in background"
            
        # Get transcript and store in global cache
        print("Downloading transcript for video ID:", video_id)
        
        # Check if transcript is already cached
        if video_id in transcript_cache:
            print(f"Using cached transcript for video: {video_id}")
            transcript_data = transcript_cache[video_id]["transcript_data"]
            json_data = transcript_cache[video_id]["json_data"]
        else:
            print(f"Downloading new transcript for video: {video_id}")
            transcript_data, json_data = download_transcript_api(video_id)
            
            # Store in global cache
            transcript_cache[video_id] = {
                "transcript_data": transcript_data,
                "json_data": json_data
            }
            print(f"Cached transcript for video: {video_id}")
        
        formatting_message = "Transcript not formatted"
        if video_id in formatting_status:
            status = formatting_status[video_id]
            formatting_message = f"Formatting status: {status['status']} - {status['message']}"
        else:
            # Start background formatting if we have json_data
            if json_data:
                formatting_executor.submit(format_transcript_background, video_id, json_data)
                formatting_message = "AI transcript formatting started in background"
            else:
                formatting_message = "No JSON data available for formatting"
       
        logger.info(f"Video info: ID={video_id}, Title={title}")
        
        print(f"--------------Video title: {title}----------")
        return {
            "video_id": video_id,
            "title": title,
            "url": url,
            "transcript": transcript_data,
            "embed_url": f"https://www.youtube.com/embed/{video_id}?enablejsapi=1",
            "download_status": download_message
        }
        
    except Exception as e:
        logger.error(f"Error processing YouTube URL: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Add this new endpoint to check formatting status
@app.get("/api/youtube/formatting-status/{video_id}")
async def get_formatting_status(video_id: str):
    """Check the formatting status of a video transcript"""
    if video_id in formatting_status:
        return formatting_status[video_id]
    
    return {
        "status": "not_found",
        "message": "No formatting record found for this video",
        "formatted_transcript": None,
        "error": None
    }

#Add this endpoint to get the formatted transcript
@app.get("/api/youtube/formatted-transcript/{video_id}")
async def get_formatted_transcript(video_id: str):
    """Get the formatted transcript for a video"""
    if video_id in formatting_status:
        status = formatting_status[video_id]
        print(f"Formatting status for video {video_id}: {status}")
        if status["status"] == "completed":
            return {
                "video_id": video_id,
                "status": "completed",
                "formatted_transcript": status["formatted_transcript"]
            }
        elif status["status"] == "formatting":
            return {
                "video_id": video_id,
                "status": "formatting",
                "message": "Transcript is still being formatted. Please wait..."
            }
        elif status["status"] == "failed":
            return {
                "video_id": video_id,
                "status": "failed",
                "error": status["error"]
            }
    
    raise HTTPException(status_code=404, detail="Formatted transcript not found")


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
        
        # Get transcript from global cache instead of downloading again
        if video_id in transcript_cache:
            print(f"Using cached transcript data for query processing: {video_id}")
            transcript_data = transcript_cache[video_id]["transcript_data"]
            # Use original transcript data directly instead of formatted version
            formatted_transcript = transcript_data
        else:
            print(f"Transcript not cached for video {video_id}, downloading...")
            # Fallback: download if not in cache (shouldn't happen if get_youtube_info was called first)
            transcript_data, _ = download_transcript_api(video_id)
            # Use original transcript data directly
            formatted_transcript = transcript_data
            
            # Cache it for future use
            transcript_cache[video_id] = {
                "transcript_data": transcript_data,
                "json_data": _
            }
        
        response = ""
        
        if is_image_query:
            if timestamp is None:
                raise HTTPException(status_code=400, detail="Timestamp is required for image queries")
            
            # Get video path
            if video_id in downloaded_videos and os.path.exists(downloaded_videos[video_id]):
                video_path_local = downloaded_videos[video_id]
            else:
                # Check download status instead of downloading synchronously
                if video_id in download_status:
                    status = download_status[video_id]
                    if status["status"] == "downloading":
                        # Return a special response instead of raising an exception
                        return {
                            "response": "🎬 Something amazing is being loaded! The video is still downloading in the background. Please continue to chat with the video content in the meantime, and try frame-specific questions again in a moment!",
                            "video_id": video_id,
                            "timestamp": timestamp,
                            "query_type": "downloading",
                            "is_downloading": True
                        }
                    elif status["status"] == "failed":
                        raise HTTPException(status_code=500, detail=f"Video download failed: {status['message']}")
                else:
                    # Start download and ask user to wait
                    download_executor.submit(download_video_background, video_id, url)
                    return {
                         "response": "🎬 Something amazing is being loaded! Video download has started in the background. Please continue to chat with the video content in the meantime, and try frame-specific questions again in a moment!",
                        "video_id": video_id,
                        "timestamp": timestamp,
                        "query_type": "downloading",
                        "is_downloading": True
                    }
            
            # Extract frame using simple method (since youtube_frame_extractor might not exist)
            frame_filename = f"frame_{video_id}_{int(timestamp)}.jpg"
            frame_path = os.path.join(frames_path, frame_filename)
            
            try:
                # Use the grab_youtube_frame function from your utils
                output_file, frame = grab_youtube_frame(video_path_local, timestamp, frame_path)
                if not output_file:
                    raise Exception("Failed to extract frame")
                
                # Use the image-based query function
                response = vision_client.ask_with_image(query, frame_path, formatted_transcript)
                
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


#ADD THE DEBUG ENDPOINT HERE:
@app.get("/api/debug/transcript-raw/{video_id}")
async def debug_transcript_raw(video_id: str):
    """Debug endpoint to see raw transcript API response"""
    try:
        print(f"DEBUG: Testing transcript API for video: {video_id}")
        
        # Test the raw API call
        import http.client
        import requests
        
        headers = {
            'x-rapidapi-key': "87cb804577msh2f08e931a0d9bacp19e810jsn4f8fd6ff742b",
            'x-rapidapi-host': "youtube-transcriptor.p.rapidapi.com"
        }

        url = "https://youtube-transcriptor.p.rapidapi.com/transcript"
        querystring = {"video_id": video_id, "lang": "en"}
        
        print(f"DEBUG: Making request to {url} with params {querystring}")
        response = requests.get(url, headers=headers, params=querystring)
        
        print(f"DEBUG: Response status: {response.status_code}")
        print(f"DEBUG: Response headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            response_data = response.json()
            print(f"DEBUG: Response JSON type: {type(response_data)}")
            print(f"DEBUG: Response JSON: {response_data}")
            
            # Now test the download_transcript_api function
            from youtube_utils import download_transcript_api
            transcript_result = download_transcript_api(video_id)
            
            return {
                "video_id": video_id,
                "raw_api_response": response_data,
                "raw_status_code": response.status_code,
                "download_transcript_api_result": {
                    "type": str(type(transcript_result)),
                    "value": transcript_result,
                    "is_tuple": isinstance(transcript_result, tuple),
                    "length": len(transcript_result) if isinstance(transcript_result, (tuple, list)) else "N/A"
                }
            }
        else:
            return {
                "video_id": video_id,
                "error": f"API returned {response.status_code}",
                "response_text": response.text
            }
            
    except Exception as e:
        import traceback
        return {
            "video_id": video_id,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("youtube_backend:app", host="0.0.0.0", port=port, reload=False)