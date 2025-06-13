from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from ml_models import OpenAIVisionClient
import logging
import re
import os
import cv2
import uuid
from youtube_utils import download_video, download_transcript, grab_youtube_frame
from ml_models import OpenAIVisionClient
from typing import Optional
from translate_elevenlabs import dub_video

import httpx

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Enable CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Your React app URL
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
    source_language: str = "en"  # Default source language is English
    target_language: str
    


@app.get("/")
def read_root():
    return {"status": "YouTube backend is running"}

@app.post("/api/youtube/info")
async def get_youtube_info(request: YouTubeRequest):
    """
    Get information about a YouTube video from its URL
    """
    url = request.url
    
    logger.info(f"Processing YouTube URL: {url}")
    
    # Extract video ID from the URL
    video_id = extract_youtube_id(url)
    
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    
    try:
        # In a production app, you would use the YouTube Data API to get video details
        # For this example, we'll return basic information based on the video ID
        
        # Simulate getting the video title
        # In reality, you would make a request to the YouTube API
        # Example: https://www.googleapis.com/youtube/v3/videos?id={video_id}&key={api_key}&part=snippet
        
        video_path = download_video(url)
        transcript = download_transcript(video_id)
        
        title = await get_video_title(video_id)
        
        return {
            "video_id": video_id,
            "title": title,
            "url": url,
            "embed_url": f"https://www.youtube.com/embed/{video_id}?enablejsapi=1"
        }
        
    except Exception as e:
        logger.error(f"Error processing YouTube URL: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/api/query/video")
async def process_query(query_request: VideoQuery):
    """
    Process a query about a YouTube video - either text-only or image-based
    """
    try:
        video_id = query_request.video_id
        query = query_request.query
        timestamp = query_request.timestamp
        is_image_query = query_request.is_image_query

        print("query-----:", query)
        
        logger.info(f"Processing {'image' if is_image_query else 'text'} query for video {video_id}")
        logger.info(f"Query: {query}")
        logger.info(f"Timestamp: {timestamp}")
        
        # Make sure we have the video downloaded
        video_path = "video.mp4"  # This assumes the video is already downloaded
        vision_client = OpenAIVisionClient()
        if not os.path.exists(video_path):
            url = f"https://www.youtube.com/watch?v={video_id}"
            video_path = download_video(url)
        
        # Get transcript for context
        transcript = download_transcript(video_id)
        
        response = ""
        
        if is_image_query:
            # This is a query about the current frame
            if timestamp is None:
                raise HTTPException(status_code=400, detail="Timestamp is required for image queries")
                
            # Get frame from the video at the timestamp
            #frame = extract_frame_at_timestamp(video_path, timestamp)
            outputfile,frame=grab_youtube_frame(video_path, timestamp)
            frame_path = f"frames/{video_id}_{int(timestamp)}.jpg"
            os.makedirs("frames", exist_ok=True)
            cv2.imwrite(frame_path, frame)
            
            # Use the image-based query function
            response = vision_client.ask_with_image(query, frame_path)
            
        else:
            # This is a text-only query about the video content
            # Use the transcript as context if available
            context = transcript if transcript else f"No transcript available for video {video_id}"
            
            # Use the text-only query function
            response = vision_client.ask_text_only(query, context)
        
        return {
            "response": response,
            "video_id": video_id,
            "timestamp": timestamp,
            "query_type": "image" if is_image_query else "text"
        }
        
    except Exception as e:
        logger.error(f"Error processing query: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to process query: {str(e)}")


def extract_youtube_id(url: str) -> str:
    """
    Extract the YouTube video ID from different URL formats
    """
    # Regular expressions to match various YouTube URL formats
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    
    return None

async def get_video_title(video_id: str) -> str:
    """
    Get the title of a YouTube video (simplified version)
    In a real app, you would use the YouTube Data API
    """
    # This is a very basic way to get the title without using API keys
    # In production, use the official YouTube API
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v={video_id}&format=json")
            if response.status_code == 200:
                data = response.json()
                return data.get("title", f"YouTube Video ({video_id})")
    except Exception:
        pass
    
    # Fallback title if unable to fetch
    return f"YouTube Video ({video_id})"



@app.post("/api/query/translate")
async def translate_youtube_video(request: TranslationRequest, background_tasks: BackgroundTasks):
    """
    Translates a YouTube video from source language to target language.
    
    Args:
        youtube_url: URL of the YouTube video
        source_language: Source language code (default: 'en' for English)
        target_language: Target language code
    
    Returns:
        JSON with status, job_id, and message
    """
    try:
        # Generate a unique job ID
        job_id = str(uuid.uuid4())
        
        # Create output directory if it doesn't exist
        output_dir = os.path.join("output", job_id)
        os.makedirs(output_dir, exist_ok=True)
        
        # Download the YouTube video
        try:
            video_path = download_video(request.youtube_url)
            if not video_path:
                raise HTTPException(status_code=400, detail="Failed to download YouTube video")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error downloading YouTube video: {str(e)}")
        
        # Process translation in the background
        background_tasks.add_task(
            process_translation,
            job_id=job_id,
            video_path=video_path,
            output_dir=output_dir,
            source_language=request.source_language,
            target_language=request.target_language
        )
        
        return {
            "status": "processing",
            "job_id": job_id,
            "message": f"Translation started. You can check the status using the job ID: {job_id}"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing translation request: {str(e)}")


# Store job status
translation_jobs = {}

async def process_translation(job_id: str, video_path: str, output_dir: str, source_language: str, target_language: str):
    """Background task to process the video translation"""
    try:
        translation_jobs[job_id] = {"status": "processing", "progress": 0}
        
        # Call the dub_video function
        result = dub_video(video_path, output_dir, source_language, target_language)
        
        if result:
            # Get the relative path to the output file
            output_file = os.path.basename(result)
            translation_jobs[job_id] = {
                "status": "completed",
                "progress": 100,
                "output_file": output_file,
                "output_url": f"/api/translated_videos/{job_id}/{output_file}"
            }
        else:
            translation_jobs[job_id] = {"status": "failed", "error": "Translation process failed"}
            
    except Exception as e:
        translation_jobs[job_id] = {"status": "failed", "error": str(e)}


@app.get("/api/translated_videos/{job_id}/{file_name}")
async def get_translated_video(job_id: str, file_name: str):
    """Serve translated video files"""
    file_path = f"output/{job_id}/{file_name}"
    if os.path.exists(file_path):
        return FileResponse(file_path)
    else:
        raise HTTPException(status_code=404, detail="Video file not found")

@app.get("/api/query/translate/{job_id}")
async def get_translation_status(job_id: str):
    """Get the status of a translation job"""
    if job_id not in translation_jobs:
        raise HTTPException(status_code=404, detail="Translation job not found")
    
    return translation_jobs[job_id]



if __name__ == "__main__":
    import uvicorn
    uvicorn.run("youtube_backend:app", host="0.0.0.0", port=8000, reload=True)


 