# youtube_backend.py - Simplified for DigitalOcean
from fastapi import FastAPI, HTTPException, BackgroundTasks, Response
from fastapi import UploadFile, File, Form, Depends
import shutil
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
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
from typing import List
import httpx
import requests
import asyncio
import threading
from concurrent.futures import ThreadPoolExecutor
from ml_models import OpenAIQuizClient
import boto3
from botocore.client import Config
from dotenv import load_dotenv
import tempfile
from sqlalchemy.orm import Session
from db import Base, engine, get_db, SessionLocal
from models import Video, Folder
from schemas import FolderCreate, FolderOut, VideoOut, MoveVideoRequest


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create directories
video_path = os.path.join(os.path.dirname(__file__), "videos")
frames_path = os.path.join(os.path.dirname(__file__), "frames")
output_path = os.path.join(os.path.dirname(__file__), "output")
download_executor = ThreadPoolExecutor(max_workers=3)  # Thread pool for downloads
formatting_executor = ThreadPoolExecutor(max_workers=3)  # Thread pool for formatting
upload_executor = ThreadPoolExecutor(max_workers=3)  # Thread pool for uploads


for path in [video_path, frames_path, output_path]:
    os.makedirs(path, exist_ok=True)

# Global variables removed - now using database storage

app = FastAPI(
    title="YouTube Backend API - DigitalOcean",
    description="Simple YouTube processing API",
    version="1.0.0"
)

# Initialize database tables
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables ensured (created if missing)")
except Exception as e:
    logger.error(f"DB init failed: {e}")

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

# Load environment for AWS/OpenAI keys
load_dotenv()

# AWS S3 setup
AWS_S3_BUCKET = os.environ.get("AWS_S3_BUCKET", "")
AWS_S3_REGION = os.environ.get("AWS_S3_REGION", "us-east-1")
AWS_S3_ENDPOINT = os.environ.get("AWS_S3_ENDPOINT", "")  # optional for non-AWS providers

def create_s3_client():
    session = boto3.session.Session()
    if AWS_S3_ENDPOINT:
        return session.client(
            's3',
            region_name=AWS_S3_REGION,
            endpoint_url=AWS_S3_ENDPOINT,
            config=Config(s3={"addressing_style": "virtual"})
        )
    return session.client('s3', region_name=AWS_S3_REGION)

s3_client = None
try:
    if AWS_S3_BUCKET:
        s3_client = create_s3_client()
        logger.info(f"S3 client initialized for bucket: {AWS_S3_BUCKET}")
    else:
        logger.warning("AWS_S3_BUCKET not set. S3 features disabled.")
except Exception as e:
    logger.error(f"Failed to initialize S3 client: {e}")
    s3_client = None

class YouTubeRequest(BaseModel):
    url: str
    user_id: Optional[str] = None

class VideoQuery(BaseModel):
    video_id: str
    query: str
    timestamp: Optional[float] = None
    is_image_query: bool = False 

class TranslationRequest(BaseModel):
    youtube_url: str
    source_language: str = "en"
    target_language: str

class QuizRequest(BaseModel):
    video_id: str
    num_questions: int = 5
    difficulty: str = "medium"  # easy | medium | hard
    include_explanations: bool = True
    language: str = "en"

# Database helper functions to replace global variables
def get_or_create_video(db: Session, video_id: str, **kwargs) -> Video:
    """Get existing video or create new one with proper error handling"""
    try:
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            # Ensure source_type is provided
            if 'source_type' not in kwargs:
                raise ValueError(f"source_type is required when creating new video {video_id}")
            
            try:
                video = Video(id=video_id, **kwargs)
                db.add(video)
                db.commit()
                db.refresh(video)
            except Exception as e:
                # Handle race condition where video was created by another process
                db.rollback()
                video = db.query(Video).filter(Video.id == video_id).first()
                if not video:
                    # If still not found, re-raise the original error
                    raise e
        return video
    except Exception as e:
        logger.error(f"Error in get_or_create_video for {video_id}: {e}")
        db.rollback()
        raise

def update_upload_status(db: Session, video_id: str, status: dict):
    """Update upload status in database"""
    # Try to get existing video first
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        # Only create if it doesn't exist
        video = get_or_create_video(db, video_id, source_type="uploaded")
    else:
        # Update existing video's upload status
        video.upload_status = status
        db.add(video)
        db.commit()
    return video

def get_upload_status(db: Session, video_id: str) -> dict:
    """Get upload status from database"""
    video = db.query(Video).filter(Video.id == video_id).first()
    if video and video.upload_status:
        return video.upload_status
    return {"status": "not_found", "message": "No upload record found"}

def update_download_status(db: Session, video_id: str, status: dict):
    """Update download status in database"""
    video = get_or_create_video(db, video_id, source_type="youtube")
    video.download_status = status
    if status.get("path"):
        video.download_path = status["path"]
    db.add(video)
    db.commit()

def get_download_status(db: Session, video_id: str) -> dict:
    """Get download status from database"""
    video = db.query(Video).filter(Video.id == video_id).first()
    if video and video.download_status:
        return video.download_status
    return {"status": "not_found", "message": "No download record found"}

def update_formatting_status(db: Session, video_id: str, status: dict):
    """Update formatting status in database"""
    # Try to get existing video first to determine source_type
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        # If video doesn't exist, we need to determine source_type
        # For now, assume it's a YouTube video if we're formatting transcripts
        video = get_or_create_video(db, video_id, source_type="youtube")
    video.formatting_status = status
    if status.get("formatted_transcript"):
        video.formatted_transcript = status["formatted_transcript"]
    db.add(video)
    db.commit()

def get_formatting_status(db: Session, video_id: str) -> dict:
    """Get formatting status from database"""
    video = db.query(Video).filter(Video.id == video_id).first()
    if video and video.formatting_status:
        return video.formatting_status
    return {
        "status": "not_found",
        "message": "No formatting record found for this video",
        "formatted_transcript": None,
        "error": None
    }

def get_transcript_cache(db: Session, video_id: str) -> dict:
    """Get transcript data from database"""
    video = db.query(Video).filter(Video.id == video_id).first()
    if video:
        return {
            "transcript_data": video.transcript_text or "",
            "json_data": video.transcript_json or {}
        }
    return {}

def update_transcript_cache(db: Session, video_id: str, transcript_data: str, json_data: dict):
    """Update transcript data in database"""
    # Try to get existing video first to determine source_type
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        # If video doesn't exist, we need to determine source_type
        # For now, assume it's a YouTube video if we're updating transcript cache
        video = get_or_create_video(db, video_id, source_type="youtube")
    video.transcript_text = transcript_data
    video.transcript_json = json_data
    db.add(video)
    db.commit()

def get_video_path(db: Session, video_id: str) -> str:
    """Get downloaded video path from database or S3"""
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        return None
    
    # Check if video is stored in S3
    if video.s3_key and s3_client and AWS_S3_BUCKET:
        # Generate presigned URL for S3 video
        try:
            return s3_presign_url(video.s3_key, expires_in=3600)
        except Exception as e:
            logger.error(f"Failed to generate S3 presigned URL for {video_id}: {e}")
            return None
    
    # Check if video is stored locally
    if video.download_path and os.path.exists(video.download_path):
        return video.download_path
    
    return None

def cleanup_local_videos():
    """Clean up local video files that have been uploaded to S3"""
    db = SessionLocal()
    try:
        # Find videos that have S3 keys but still have local files
        videos = db.query(Video).filter(
            Video.s3_key.isnot(None),
            Video.download_path.isnot(None)
        ).all()
        
        cleaned_videos = 0
        cleaned_thumbnails = 0
        cleaned_transcripts = 0
        
        for video in videos:
            # Clean up local video file
            if video.download_path and os.path.exists(video.download_path):
                try:
                    os.remove(video.download_path)
                    logger.info(f"Cleaned up local video file for {video.id}: {video.download_path}")
                    video.download_path = None
                    cleaned_videos += 1
                except Exception as e:
                    logger.error(f"Failed to clean up local video file {video.download_path}: {e}")
            
            # Clean up local thumbnail files
            thumb_path = os.path.join(frames_path, f"{video.id}_thumb.jpg")
            if os.path.exists(thumb_path) and video.thumb_key:
                try:
                    os.remove(thumb_path)
                    logger.info(f"Cleaned up local thumbnail for {video.id}: {thumb_path}")
                    cleaned_thumbnails += 1
                except Exception as e:
                    logger.error(f"Failed to clean up local thumbnail {thumb_path}: {e}")
            
            # Clean up local transcript files
            transcript_path = os.path.join(output_path, f"{video.id}_formatted_transcript.txt")
            if os.path.exists(transcript_path) and video.transcript_s3_key:
                try:
                    os.remove(transcript_path)
                    logger.info(f"Cleaned up local transcript for {video.id}: {transcript_path}")
                    cleaned_transcripts += 1
                except Exception as e:
                    logger.error(f"Failed to clean up local transcript {transcript_path}: {e}")
        
        db.commit()
        logger.info(f"Local cleanup completed: {cleaned_videos} videos, {cleaned_thumbnails} thumbnails, {cleaned_transcripts} transcripts")
        
    except Exception as e:
        logger.error(f"Local video cleanup failed: {e}")
    finally:
        db.close()

def migrate_local_videos_to_s3():
    """Migrate existing local videos to S3"""
    if not s3_client or not AWS_S3_BUCKET:
        logger.warning("S3 not configured, skipping migration")
        return
    
    db = SessionLocal()
    try:
        # Find videos that have local files but no S3 keys
        videos = db.query(Video).filter(
            Video.download_path.isnot(None),
            Video.s3_key.is_(None)
        ).all()
        
        migrated_count = 0
        for video in videos:
            if video.download_path and os.path.exists(video.download_path):
                try:
                    # Generate S3 key for video
                    s3_key = f"youtube_videos/{video.id}.mp4"
                    
                    # Upload video to S3
                    logger.info(f"Migrating video {video.id} to S3: {s3_key}")
                    s3_upload_file(video.download_path, s3_key, content_type="video/mp4")
                    
                    # Generate and upload thumbnail if not already uploaded
                    thumb_key = None
                    if not video.thumb_key:
                        thumb_path = os.path.join(frames_path, f"{video.id}_thumb.jpg")
                        if not os.path.exists(thumb_path):
                            # Generate thumbnail from video
                            if generate_thumbnail(video.download_path, thumb_path, ts_seconds=1.0):
                                thumb_key = f"youtube_thumbnails/{video.id}.jpg"
                                logger.info(f"Uploading thumbnail to S3: {thumb_key}")
                                s3_upload_file(thumb_path, thumb_key, content_type="image/jpeg")
                                os.remove(thumb_path)
                                logger.info(f"Deleted local thumbnail: {thumb_path}")
                    
                    # Upload formatted transcript if not already uploaded
                    transcript_s3_key = None
                    if not video.transcript_s3_key and video.formatted_transcript:
                        try:
                            # Create temporary file for upload
                            temp_transcript_path = os.path.join(output_path, f"{video.id}_formatted_transcript.txt")
                            with open(temp_transcript_path, 'w', encoding='utf-8') as f:
                                f.write(video.formatted_transcript)
                            
                            # Upload to S3
                            transcript_s3_key = f"youtube_transcripts/{video.id}_formatted.txt"
                            logger.info(f"Uploading formatted transcript to S3: {transcript_s3_key}")
                            s3_upload_file(temp_transcript_path, transcript_s3_key, content_type="text/plain")
                            
                            # Clean up temporary file
                            os.remove(temp_transcript_path)
                            logger.info(f"Deleted temporary transcript file: {temp_transcript_path}")
                            
                        except Exception as transcript_error:
                            logger.error(f"Failed to upload transcript for video {video.id}: {transcript_error}")
                    
                    # Update database
                    video.s3_key = s3_key
                    if thumb_key:
                        video.thumb_key = thumb_key
                    if transcript_s3_key:
                        video.transcript_s3_key = transcript_s3_key
                    video.download_path = None
                    migrated_count += 1
                    
                    # Delete local file
                    os.remove(video.download_path)
                    logger.info(f"Successfully migrated and deleted local file for video {video.id}")
                    
                except Exception as e:
                    logger.error(f"Failed to migrate video {video.id}: {e}")
        
        db.commit()
        logger.info(f"Migration completed: {migrated_count} videos migrated to S3")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
    finally:
        db.close()

def download_video_background(video_id: str, url: str):
    """Background function to download video and upload to S3"""
    db = SessionLocal()
    try:
        status = {
            "status": "downloading", 
            "message": "Video download in progress...",
            "path": None
        }
        update_download_status(db, video_id, status)
        
        logger.info(f"Starting background download for video: {video_id}")
        video_path = download_video(url)
        
        if video_path and os.path.exists(video_path):
            # Upload to S3 if configured
            s3_key = None
            if s3_client and AWS_S3_BUCKET:
                try:
                    # Generate S3 key for the video
                    s3_key = f"youtube_videos/{video_id}.mp4"
                    
                    # Upload to S3
                    logger.info(f"Uploading video to S3: {s3_key}")
                    s3_upload_file(video_path, s3_key, content_type="video/mp4")
                    
                    # Generate and upload thumbnail
                    thumb_key = None
                    thumb_path = os.path.join(frames_path, f"{video_id}_thumb.jpg")
                    if generate_thumbnail(video_path, thumb_path, ts_seconds=1.0):
                        thumb_key = f"youtube_thumbnails/{video_id}.jpg"
                        logger.info(f"Uploading thumbnail to S3: {thumb_key}")
                        s3_upload_file(thumb_path, thumb_key, content_type="image/jpeg")
                        # Clean up local thumbnail
                        os.remove(thumb_path)
                        logger.info(f"Deleted local thumbnail: {thumb_path}")
                    
                    # Update database with S3 keys
                    video = db.query(Video).filter(Video.id == video_id).first()
                    if video:
                        video.s3_key = s3_key
                        video.thumb_key = thumb_key
                        video.download_path = None  # Clear local path
                        db.commit()
                        logger.info(f"Updated database with S3 keys: video={s3_key}, thumbnail={thumb_key}")
                    
                    # Delete local file after successful upload
                    os.remove(video_path)
                    logger.info(f"Deleted local file: {video_path}")
                    
                    status = {
                        "status": "completed",
                        "message": "Video and thumbnail uploaded to S3 successfully", 
                        "path": None,
                        "s3_key": s3_key,
                        "thumb_key": thumb_key
                    }
                    
                except Exception as s3_error:
                    logger.error(f"S3 upload failed for {video_id}: {str(s3_error)}")
                    # Keep local file if S3 upload fails
                    status = {
                        "status": "completed",
                        "message": "Video download complete (S3 upload failed)", 
                        "path": video_path
                    }
            else:
                # S3 not configured, keep local file
                status = {
                    "status": "completed",
                    "message": "Video download complete (S3 not configured)", 
                    "path": video_path
                }
            
            update_download_status(db, video_id, status)
            logger.info(f"Video processing completed for: {video_id}")
        else:
            status = {
                "status": "failed",
                "message": "Video download failed",
                "path": None
            }
            update_download_status(db, video_id, status)
            
    except Exception as e:
        status = {
            "status": "failed",
            "message": f"Video download failed: {str(e)}",
            "path": None
        }
        update_download_status(db, video_id, status)
        logger.error(f"Video download error for {video_id}: {str(e)}")
    finally:
        db.close()

def format_transcript_background(video_id: str, json_data: dict):
    """Background function to format transcript with progress tracking for YouTube videos"""
    db = SessionLocal()
    try:
        status = {
            "status": "formatting",
            "message": "AI-based transcript formatting in progress...",
            "formatted_transcript": None,
            "error": None,
            "progress": 0,
            "total_chunks": 0,
            "current_chunk": 0
        }
        update_formatting_status(db, video_id, status)
        
        logger.info(f"Starting background transcript formatting for video: {video_id}")
        
        # Create formatted transcript without saving to local file
        formatted_transcript_lines = create_formatted_transcript(json_data, video_id=video_id)
        formatted_transcript_text = ''.join(formatted_transcript_lines)
        logger.info(f"Formatted transcript text length: {len(formatted_transcript_text)}")
        
        # Upload formatted transcript to S3 if configured
        transcript_s3_key = None
        if s3_client and AWS_S3_BUCKET and formatted_transcript_text:
            try:
                # Create temporary file for upload
                temp_transcript_path = os.path.join(output_path, f"{video_id}_formatted_transcript.txt")
                with open(temp_transcript_path, 'w', encoding='utf-8') as f:
                    f.write(formatted_transcript_text)
                
                # Upload to S3
                transcript_s3_key = f"youtube_transcripts/{video_id}_formatted.txt"
                logger.info(f"Uploading formatted transcript to S3: {transcript_s3_key}")
                s3_upload_file(temp_transcript_path, transcript_s3_key, content_type="text/plain")
                
                # Clean up temporary file
                os.remove(temp_transcript_path)
                logger.info(f"Deleted temporary transcript file: {temp_transcript_path}")
                
            except Exception as s3_error:
                logger.error(f"S3 upload failed for formatted transcript {video_id}: {str(s3_error)}")
        
        # Update database with formatted transcript and S3 key
        video = db.query(Video).filter(Video.id == video_id).first()
        if video:
            video.formatted_transcript = formatted_transcript_text
            if transcript_s3_key:
                video.transcript_s3_key = transcript_s3_key
            db.commit()
            logger.info(f"Updated database with formatted transcript and S3 key: {transcript_s3_key}")
        
        # Get current status to preserve progress info
        current_status = get_formatting_status(db, video_id)
        status = {
            "status": "completed",
            "message": "AI transcript formatting complete",
            "formatted_transcript": formatted_transcript_text,
            "error": None,
            "progress": 100,
            "total_chunks": current_status.get("total_chunks", 0),
            "current_chunk": current_status.get("total_chunks", 0),
            "transcript_s3_key": transcript_s3_key
        }
        update_formatting_status(db, video_id, status)
        logger.info(f"Transcript formatting completed for video: {video_id}")
        
    except Exception as e:
        status = {
            "status": "failed",
            "message": f"Transcript formatting failed: {str(e)}",
            "formatted_transcript": None,
            "error": str(e),
            "progress": 0,
            "total_chunks": 0,
            "current_chunk": 0
        }
        update_formatting_status(db, video_id, status)
        logger.error(f"Transcript formatting error for {video_id}: {str(e)}")
    finally:
        db.close()

def format_uploaded_transcript_background(video_id: str, transcript_text: str, title: str = "Uploaded Video"):
    """Background function to format transcript for uploaded videos with plain text"""
    db = SessionLocal()
    try:
        status = {
            "status": "formatting",
            "message": "AI-based transcript formatting in progress...",
            "formatted_transcript": None,
            "error": None,
            "progress": 0,
            "total_chunks": 0,
            "current_chunk": 0
        }
        # For uploaded videos, we need to create the video record with correct source_type
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            video = Video(id=video_id, source_type="uploaded", title=title)
            db.add(video)
            db.commit()
            db.refresh(video)
        
        # Update formatting status
        video.formatting_status = status
        db.add(video)
        db.commit()
        
        logger.info(f"Starting background transcript formatting for uploaded video: {video_id}")
        
        # Create transcript data in the format expected by create_formatted_transcript
        transcript_data = {
            'plain_text': transcript_text,
            'title': title,
            'duration': 0  # We don't have duration info for uploaded videos
        }
        
        # Format the transcript with progress tracking
        formatted_transcript_lines = create_formatted_transcript(transcript_data, video_id=video_id)
        formatted_transcript_text = ''.join(formatted_transcript_lines)
        logger.info(f"Formatted transcript text length: {len(formatted_transcript_text)}")
        
        # Upload formatted transcript to S3 if configured
        transcript_s3_key = None
        if s3_client and AWS_S3_BUCKET and formatted_transcript_text:
            try:
                # Create temporary file for upload
                temp_transcript_path = os.path.join(output_path, f"{video_id}_formatted_transcript.txt")
                with open(temp_transcript_path, 'w', encoding='utf-8') as f:
                    f.write(formatted_transcript_text)
                
                # Upload to S3
                transcript_s3_key = f"uploaded_transcripts/{video_id}_formatted.txt"
                logger.info(f"Uploading formatted transcript to S3: {transcript_s3_key}")
                s3_upload_file(temp_transcript_path, transcript_s3_key, content_type="text/plain")
                
                # Clean up temporary file
                os.remove(temp_transcript_path)
                logger.info(f"Deleted temporary transcript file: {temp_transcript_path}")
                
            except Exception as s3_error:
                logger.error(f"S3 upload failed for formatted transcript {video_id}: {str(s3_error)}")
        
        # Update video record with formatted transcript and S3 key
        video = db.query(Video).filter(Video.id == video_id).first()
        if video:
            video.formatted_transcript = formatted_transcript_text
            if transcript_s3_key:
                video.transcript_s3_key = transcript_s3_key
            db.commit()
            logger.info(f"Updated database with formatted transcript and S3 key: {transcript_s3_key}")
        
        # Get current status to preserve progress info
        current_status = get_formatting_status(db, video_id)
        status = {
            "status": "completed",
            "message": "AI transcript formatting complete",
            "formatted_transcript": formatted_transcript_text,
            "error": None,
            "progress": 100,
            "total_chunks": current_status.get("total_chunks", 0),
            "current_chunk": current_status.get("total_chunks", 0),
            "transcript_s3_key": transcript_s3_key
        }
        # Update formatting status directly
        video.formatting_status = status
        video.formatted_transcript = formatted_transcript_text
        db.add(video)
        db.commit()
        logger.info(f"Transcript formatting completed for uploaded video: {video_id}")
        
    except Exception as e:
        status = {
            "status": "failed",
            "message": f"Transcript formatting failed: {str(e)}",
            "formatted_transcript": None,
            "error": str(e),
            "progress": 0,
            "total_chunks": 0,
            "current_chunk": 0
        }
        # Update formatting status directly
        video = db.query(Video).filter(Video.id == video_id).first()
        if video:
            video.formatting_status = status
            db.add(video)
            db.commit()
        logger.error(f"Transcript formatting error for uploaded video {video_id}: {str(e)}")
    finally:
        db.close()


@app.get("/")
def read_root():
    return {"status": "YouTube backend is running on DigitalOcean"}

# ---------- S3 helper functions ----------
def s3_upload_file(local_path: str, bucket_key: str, content_type: Optional[str] = None):
    if not s3_client or not AWS_S3_BUCKET:
        raise HTTPException(status_code=500, detail="S3 is not configured")
    extra_args = {"ACL": "private"}
    if content_type:
        extra_args["ContentType"] = content_type
    s3_client.upload_file(local_path, AWS_S3_BUCKET, bucket_key, ExtraArgs=extra_args)

def s3_presign_url(bucket_key: str, expires_in: int = 3600) -> str:
    if not s3_client or not AWS_S3_BUCKET:
        raise HTTPException(status_code=500, detail="S3 is not configured")
    return s3_client.generate_presigned_url(
        'get_object',
        Params={'Bucket': AWS_S3_BUCKET, 'Key': bucket_key},
        ExpiresIn=expires_in
    )


@app.get("/api/storage/presign")
def presign_storage_key(key: str, expires_in: int = 3600):
    if not s3_client or not AWS_S3_BUCKET:
        raise HTTPException(status_code=500, detail="S3 is not configured")
    try:
        url = s3_presign_url(key, expires_in)
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def generate_thumbnail(input_video_path: str, output_image_path: str, ts_seconds: float = 1.0) -> bool:
    try:
        cap = cv2.VideoCapture(input_video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 24
        frame_number = int(ts_seconds * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        success, frame = cap.read()
        if success:
            cv2.imwrite(output_image_path, frame)
            return True
        return False
    except Exception as e:
        logger.error(f"Thumbnail generation failed: {e}")
        return False
    finally:
        try:
            cap.release()
        except Exception:
            pass

def transcribe_video_with_openai(local_video_path: str) -> str:
    """Transcribe audio using OpenAI Whisper-1. Returns plain text transcript."""
    try:
        from openai import OpenAI
        client = OpenAI()
        with open(local_video_path, "rb") as f:
            transcript = client.audio.transcriptions.create(model="whisper-1", file=f)
        text = getattr(transcript, 'text', None)
        if isinstance(transcript, dict):
            text = transcript.get('text')
        return text or ""
    except Exception as e:
        logger.error(f"OpenAI transcription failed: {e}")
        raise Exception(f"OpenAI transcription failed: {str(e)}")

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
async def get_download_status_endpoint(video_id: str, db: Session = Depends(get_db)):
    """Check the download status of a video"""
    # Check if video file exists
    video_path = get_video_path(db, video_id)
    if video_path:
        return {"status": "completed", "message": "Video download complete", "path": video_path}
    
    # Return status from database
    return get_download_status(db, video_id)

@app.get("/api/user-videos/upload-status/{video_id}")
async def get_upload_status_endpoint(video_id: str, db: Session = Depends(get_db)):
    """Check the upload status of a video"""
    return get_upload_status(db, video_id)


          


@app.post("/api/user-videos/upload")
async def upload_user_video(user_id: str = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Upload a user video to S3, generate thumbnail and transcript, and register it."""
    if not s3_client or not AWS_S3_BUCKET:
        raise HTTPException(status_code=500, detail="S3 is not configured on server")
    
    # Generate video ID early for progress tracking
    vid = str(uuid.uuid4())

    # Persist the uploaded file to a temp path within the request lifecycle
    try:
        suffix = os.path.splitext(file.filename or "video.mp4")[1] or ".mp4"
        if suffix.lower() not in [".mp4", ".mov", ".mkv", ".webm", ".avi"]:
            suffix = ".mp4"
        temp_fd, temp_path = tempfile.mkstemp(suffix=suffix)
        os.close(temp_fd)
        
        # Stream copy from the async upload file to our temp file
        chunk_size = 1024 * 1024
        with open(temp_path, 'wb') as out:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                out.write(chunk)
        original_filename = file.filename or 'Uploaded Video'
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to buffer uploaded file: {str(e)}")

    # Start background upload with the temp file path (avoid using request-scoped file stream)
    upload_executor.submit(process_upload_background, vid, user_id, temp_path, original_filename)

    return {
        'success': True,
        'video_id': vid,
        'title': file.filename or 'Uploaded Video',
        'message': f'Upload started. Use /api/user-videos/upload-status/{vid} to track progress.'
    }
    
def process_upload_background(video_id: str, user_id: str, temp_path: str, original_filename: str):
    vid = video_id
    # Create an isolated DB session for the background task
    db = SessionLocal()
    
    # Track uploaded S3 objects for rollback
    uploaded_s3_objects = []
    local_files_to_cleanup = []
    
    # Initialize upload progress
    update_upload_status(db, vid, {
        "status": "starting",
        "message": "Upload started",
        "progress": 0,
        "current_step": "initializing",
        "total_steps": 6
    })
    
    def rollback_upload():
        """Rollback function to clean up uploaded S3 objects and local files"""
        logger.info(f"Rolling back upload for video {vid}")
        
        # Delete uploaded S3 objects
        for s3_key in uploaded_s3_objects:
            try:
                if s3_client and AWS_S3_BUCKET:
                    s3_client.delete_object(Bucket=AWS_S3_BUCKET, Key=s3_key)
                    logger.info(f"Deleted S3 object: {s3_key}")
            except Exception as e:
                logger.error(f"Failed to delete S3 object {s3_key}: {e}")
        
        # Clean up local files
        for file_path in local_files_to_cleanup:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                    logger.info(f"Deleted local file: {file_path}")
            except Exception as e:
                logger.error(f"Failed to delete local file {file_path}: {e}")
        
        # Remove video record from database if it exists
        try:
            video_row = db.query(Video).filter(Video.id == vid).first()
            if video_row:
                db.delete(video_row)
                db.commit()
                logger.info(f"Removed video record from database: {vid}")
        except Exception as e:
            logger.error(f"Failed to remove video record from database: {e}")
            db.rollback()

    """Background function to process video upload"""
    try:
        # Step 1: Save upload to temp file
        update_upload_status(db, vid, {
            "status": "processing",
            "message": "Saving uploaded file...",
            "progress": 10,
            "current_step": "saving_file",
            "total_steps": 6
        })
        
        # We already have the uploaded file saved at temp_path
        # Track file size for progress (informational)
        try:
            file_size = os.path.getsize(temp_path)
        except Exception:
            file_size = 0

        # Step 2: Prepare for S3 upload
        update_upload_status(db, vid, {
            "status": "processing",
            "message": "Preparing for cloud upload...",
            "progress": 20,
            "current_step": "preparing_upload",
            "total_steps": 6
        })
        
        safe_name = re.sub(r'[^A-Za-z0-9._-]+', '-', original_filename or "video.mp4").strip('-')
        s3_key = f"user_videos/{user_id}/{vid}_{safe_name}"
        thumb_key = f"thumbnails/{user_id}/{vid}.jpg"
        transcript_key = f"transcripts/{user_id}/{vid}.txt"

        # Step 3: Upload video to S3
        update_upload_status(db, vid, {
            "status": "processing",
            "message": "Uploading video to cloud storage...",
            "progress": 35,
            "current_step": "uploading_video",
            "total_steps": 6
        })
        
        s3_upload_file(temp_path, s3_key, content_type="video/mp4")
        uploaded_s3_objects.append(s3_key)  # Track for potential rollback

        # Step 4: Generate thumbnail
        update_upload_status(db, vid, {
            "status": "processing",
            "message": "Generating thumbnail...",
            "progress": 50,
            "current_step": "generating_thumbnail",
            "total_steps": 6
        })
        
        thumb_fd, thumb_path = tempfile.mkstemp(suffix=".jpg")
        os.close(thumb_fd)
        local_files_to_cleanup.append(thumb_path)  # Track for cleanup
        
        if generate_thumbnail(temp_path, thumb_path, ts_seconds=1.0):
            s3_upload_file(thumb_path, thumb_key, content_type="image/jpeg")
            uploaded_s3_objects.append(thumb_key)  # Track for potential rollback
        else:
            logger.warning("Thumbnail generation failed; proceeding without thumbnail upload")

        # Step 5: Transcribe video
        update_upload_status(db, vid, {
            "status": "processing",
            "message": "Transcribing audio (this may take a while)...",
            "progress": 65,
            "current_step": "transcribing",
            "total_steps": 6
        })
        
        transcript_text = transcribe_video_with_openai(temp_path)
        
        if transcript_text:
            # Upload transcript to S3 for persistence
            with tempfile.NamedTemporaryFile('w', encoding='utf-8', delete=False, suffix='.txt') as tf:
                tf.write(transcript_text)
                transcript_tmp = tf.name
                local_files_to_cleanup.append(transcript_tmp)  # Track for cleanup
            try:
                s3_upload_file(transcript_tmp, transcript_key, content_type="text/plain")
                uploaded_s3_objects.append(transcript_key)  # Track for potential rollback
            except Exception as e:
                logger.error(f"Failed to upload transcript to S3: {e}")
                raise  # This will trigger rollback

        # Step 6: Finalizing
        update_upload_status(db, vid, {
            "status": "processing",
            "message": "Finalizing upload...",
            "progress": 85,
            "current_step": "finalizing",
            "total_steps": 6
        })

        # Move temp video to local videos store for frame extraction reuse
        local_copy = os.path.join(video_path, f"{vid}.mp4")
        try:
            os.makedirs(video_path, exist_ok=True)
            shutil.move(temp_path, local_copy)
            local_files_to_cleanup.append(local_copy)  # Track for cleanup
        except Exception:
            # If move fails, keep temp where it is
            local_copy = temp_path

        # Update the existing video record with final details
        video_row = db.query(Video).filter(Video.id == vid).first()
        if video_row:
            video_row.user_id = user_id
            video_row.title = original_filename or 'Uploaded Video'
            video_row.s3_key = s3_key
            video_row.thumb_key = thumb_key
            video_row.transcript_s3_key = transcript_key
            video_row.local_path = local_copy
            video_row.transcript_text = transcript_text or None
            db.add(video_row)
            db.commit()
        else:
            # Fallback: create the video record if it doesn't exist
            video_row = Video(
                id=vid,
                user_id=user_id,
                source_type="uploaded",
                title=original_filename or 'Uploaded Video',
                s3_key=s3_key,
                thumb_key=thumb_key,
                transcript_s3_key=transcript_key,
                local_path=local_copy,
                transcript_text=transcript_text or None,
            )
            db.add(video_row)
            db.commit()

        # Start background transcript formatting if we have transcript text
        if transcript_text:
            logger.info(f"Starting background transcript formatting for uploaded video: {vid}")
            formatting_executor.submit(format_uploaded_transcript_background, vid, transcript_text, original_filename or 'Uploaded Video')

        # Mark upload as completed
        update_upload_status(db, vid, {
            "status": "completed",
            "message": "Upload completed successfully!",
            "progress": 100,
            "current_step": "completed",
            "total_steps": 6
        })

        # Presigned URLs
        video_url = s3_presign_url(s3_key, expires_in=3600)
        thumb_url = s3_presign_url(thumb_key, expires_in=3600)

        return {
            'success': True,
            'video_id': vid,
            'title': video_row.title,
            'video_url': video_url,
            'thumbnail_url': thumb_url,
            'has_transcript': bool(transcript_text),
            'formatting_status': 'started' if transcript_text else 'no_transcript'
        }
    
    except Exception as e:
        # Rollback all uploaded resources
        rollback_upload()
        
        # Mark upload as failed
        update_upload_status(db, vid, {
            "status": "failed",
            "message": f"Upload failed: {str(e)}",
            "progress": 0,
            "current_step": "error",
            "total_steps": 6,
            "error": str(e)
        })
        logger.error(f"Upload failed for video {vid}: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
    finally:
        try:
            db.close()
        except Exception:
            pass
        # Cleanup temp files (only if not already cleaned up by rollback)
        try:
            if 'temp_path' in locals() and os.path.exists(temp_path):
                os.remove(temp_path)
            if 'thumb_path' in locals() and os.path.exists(thumb_path):
                os.remove(thumb_path)
        except Exception:
            pass


@app.get("/api/user-videos/list")
async def list_user_videos(user_id: str, db: Session = Depends(get_db)):
    try:
        rows = (
            db.query(Video)
            .filter(Video.user_id == user_id, Video.source_type == "uploaded")
            .order_by(Video.created_at.desc())
            .all()
        )
        items = []
        for v in rows:
            # generate URLs if S3 available
            try:
                video_url = s3_presign_url(v.s3_key, expires_in=3600) if (s3_client and AWS_S3_BUCKET and v.s3_key) else None
                thumb_url = s3_presign_url(v.thumb_key, expires_in=3600) if (s3_client and AWS_S3_BUCKET and v.thumb_key) else None
            except Exception:
                video_url = None
                thumb_url = None
            items.append({
                'video_id': v.id,
                'title': v.title or 'Uploaded Video',
                'video_url': video_url,
                'thumbnail_url': thumb_url,
                'sourceType': 'uploaded'
            })
        return {'success': True, 'items': items}
    except Exception as e:
        logger.error(f"List user videos failed: {e}")
        raise HTTPException(status_code=500, detail=f"List failed: {str(e)}")


@app.get("/api/user-videos/info")
async def get_user_video_info(video_id: str, db: Session = Depends(get_db)):
    v: Video = db.query(Video).filter(Video.id == video_id, Video.source_type == "uploaded").first()
    if not v:
        raise HTTPException(status_code=404, detail="Unknown video_id")
    try:
        video_url = s3_presign_url(v.s3_key, expires_in=3600) if (s3_client and AWS_S3_BUCKET and v.s3_key) else None
        thumb_url = s3_presign_url(v.thumb_key, expires_in=3600) if (s3_client and AWS_S3_BUCKET and v.thumb_key) else None
    except Exception:
        video_url = None
        thumb_url = None
    # Prefer DB transcript, fallback to S3 if missing and cache
    transcript_text = v.transcript_text or ""
    if not transcript_text and s3_client and AWS_S3_BUCKET and v.transcript_s3_key:
        try:
            obj = s3_client.get_object(Bucket=AWS_S3_BUCKET, Key=v.transcript_s3_key)
            transcript_text = obj['Body'].read().decode('utf-8')
            v.transcript_text = transcript_text
            db.add(v)
            db.commit()
        except Exception as e:
            logger.warning(f"Could not load transcript from S3: {e}")
    return {
        'video_id': v.id,
        'title': v.title or 'Uploaded Video',
        'video_url': video_url,
        'thumbnail_url': thumb_url,
        'transcript': transcript_text,
    }


@app.post("/api/youtube/info")
async def get_youtube_info(request: YouTubeRequest, db: Session = Depends(get_db)):
    """Get information about a YouTube video from its URL"""
    url = request.url
    
    logger.info(f"Processing YouTube URL: {url}")
    
    # Extract video ID from the URL
    video_id = extract_youtube_id(url)
    
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    
    try:
        title = await get_video_title(video_id)
        
        # Check if video is already available (local or S3)
        video_path = get_video_path(db, video_id)
        if video_path:
            if video_path.startswith('http'):
                download_message = "Video available in cloud storage"
            else:
                download_message = f"Video available locally: {video_path}"
        else:
            status = get_download_status(db, video_id)
            if status["status"] != "not_found":
                download_message = f"Download status: {status['status']} - {status['message']}"
            else:
                # Start background download and S3 upload
                download_executor.submit(download_video_background, video_id, url)
                download_message = "Video download, thumbnail generation, and cloud upload started in background"
            
        # Get transcript and store in DB and cache
        print("Downloading transcript for video ID:", video_id)
        
        # Check if transcript is already cached in DB
        transcript_info = get_transcript_cache(db, video_id)
        if transcript_info and transcript_info.get("transcript_data"):
            print(f"Using cached transcript for video: {video_id}")
            transcript_data = transcript_info["transcript_data"]
            json_data = transcript_info["json_data"]
        else:
            print(f"Downloading new transcript for video: {video_id}")
            transcript_data, json_data = download_transcript_api(video_id)
            
            # Upsert in DB
            try:
                v = db.query(Video).filter(Video.id == video_id).first()
                if v is None:
                    v = Video(
                        id=video_id,
                        user_id=request.user_id,
                        source_type="youtube",
                        title=title,
                        youtube_id=video_id,
                        youtube_url=url,
                        transcript_text=transcript_data,
                        transcript_json=json_data,
                    )
                    db.add(v)
                else:
                    v.user_id = v.user_id or request.user_id
                    v.source_type = "youtube"
                    v.title = title or v.title
                    v.youtube_id = video_id
                    v.youtube_url = url
                    v.transcript_text = transcript_data or v.transcript_text
                    v.transcript_json = json_data or v.transcript_json
                db.commit()
            except Exception as e:
                logger.warning(f"DB upsert failed for youtube video {video_id}: {e}")
            
            print(f"Cached transcript for video: {video_id}")
        
        formatting_message = "Transcript not formatted"
        status = get_formatting_status(db, video_id)
        if status["status"] != "not_found":
            formatting_message = f"Formatting status: {status['status']} - {status['message']}"
        else:
            # Start background formatting if we have json_data
            if json_data:
                formatting_executor.submit(format_transcript_background, video_id, json_data)
                formatting_message = "AI transcript formatting started in background"
            else:
                formatting_message = "No JSON data available for formatting"
       
        # Get S3 URLs if available
        video_url = None
        thumbnail_url = None
        formatted_transcript_url = None
        
        video_record = db.query(Video).filter(Video.id == video_id).first()
        if video_record:
            if video_record.s3_key and s3_client and AWS_S3_BUCKET:
                try:
                    video_url = s3_presign_url(video_record.s3_key, expires_in=3600)
                except Exception as e:
                    logger.error(f"Failed to generate video presigned URL: {e}")
            
            if video_record.thumb_key and s3_client and AWS_S3_BUCKET:
                try:
                    thumbnail_url = s3_presign_url(video_record.thumb_key, expires_in=3600)
                except Exception as e:
                    logger.error(f"Failed to generate thumbnail presigned URL: {e}")
            
            if video_record.transcript_s3_key and s3_client and AWS_S3_BUCKET:
                try:
                    formatted_transcript_url = s3_presign_url(video_record.transcript_s3_key, expires_in=3600)
                except Exception as e:
                    logger.error(f"Failed to generate transcript presigned URL: {e}")
        
        logger.info(f"Video info: ID={video_id}, Title={title}")
        
        print(f"--------------Video title: {title}----------")
        return {
            "video_id": video_id,
            "title": title,
            "url": url,
            "transcript": transcript_data,
            "embed_url": f"https://www.youtube.com/embed/{video_id}?enablejsapi=1",
            "download_status": download_message,
            "formatting_status": formatting_message,
            "video_url": video_url,
            "thumbnail_url": thumbnail_url,
            "formatted_transcript_url": formatted_transcript_url
        }
        
    except Exception as e:
        logger.error(f"Error processing YouTube URL: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Add this new endpoint to check formatting status
@app.get("/api/youtube/formatting-status/{video_id}")
async def get_formatting_status_endpoint(video_id: str, db: Session = Depends(get_db)):
    """Check the formatting status of a video transcript"""
    return get_formatting_status(db, video_id)

#Add this endpoint to get the formatted transcript
@app.get("/api/youtube/formatted-transcript/{video_id}")
async def get_formatted_transcript(video_id: str, db: Session = Depends(get_db)):
    """Get the formatted transcript for a video"""
    status = get_formatting_status(db, video_id)
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
    
    # fallback to check if we have formatted transcript in DB directly
    video = db.query(Video).filter(Video.id == video_id).first()
    if video and video.formatted_transcript:
        return {
            "video_id": video_id,
            "status": "completed",
            "formatted_transcript": video.formatted_transcript
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
async def process_query(query_request: VideoQuery, db: Session = Depends(get_db)):
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
        
        # Determine if video is uploaded by checking DB
        v = db.query(Video).filter(Video.id == video_id, Video.source_type == "uploaded").first()
        is_uploaded = v is not None
        if not is_uploaded:
            url = f"https://www.youtube.com/watch?v={video_id}"
        
        # First check if we have a formatted transcript
        transcript_to_use = None
        formatting_status_info = get_formatting_status(db, video_id)
        if formatting_status_info["status"] == "completed":
            logger.info(f"Using AI-formatted transcript with timestamps for query processing: {video_id}")
            transcript_to_use = formatting_status_info["formatted_transcript"]
        
        # If no formatted transcript, fall back to regular transcript
        if not transcript_to_use:
            # Get transcript from database instead of global cache
            transcript_info = get_transcript_cache(db, video_id)
            if transcript_info and transcript_info.get("transcript_data"):
                logger.info(f"Using regular cached transcript data for query processing: {video_id}")
                transcript_to_use = transcript_info["transcript_data"]
            else:
                logger.info(f"Transcript not cached for video {video_id}, downloading...")
                # Fallback: download if not in cache (shouldn't happen if get_youtube_info was called first)
                transcript_data, json_data = download_transcript_api(video_id)
                # Use original transcript data directly
                transcript_to_use = transcript_data
                
                # Cache it in database for future use
                update_transcript_cache(db, video_id, transcript_data, json_data)
        
        response = ""
        
        if is_image_query:
            if timestamp is None:
                raise HTTPException(status_code=400, detail="Timestamp is required for image queries")
            
            # Get video path (uploaded or YouTube)
            video_path_local = get_video_path(db, video_id)
            if not video_path_local:
                # Check download status instead of downloading synchronously
                download_status_info = get_download_status(db, video_id)
                if download_status_info["status"] == "downloading":
                    # Return a special response instead of raising an exception
                    return {
                        "response": "🎬 Something amazing is being loaded! The video is still downloading in the background. Please continue to chat with the video content in the meantime, and try frame-specific questions again in a moment!",
                        "video_id": video_id,
                        "timestamp": timestamp,
                        "query_type": "downloading",
                        "is_downloading": True
                    }
                elif download_status_info["status"] == "failed":
                    raise HTTPException(status_code=500, detail=f"Video download failed: {download_status_info['message']}")
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
                
                # Use the image-based query function with formatted transcript when available
                response = vision_client.ask_with_image(query, frame_path, transcript_to_use)
                
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Frame extraction failed: {str(e)}")
            
        else:
            # Text-only query about the video content - use formatted transcript when available
            response = vision_client.ask_text_only(query, transcript_to_use)
        
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

@app.post("/api/quiz/generate")
async def generate_quiz(request: QuizRequest, db: Session = Depends(get_db)):
    """
    Generate a structured quiz JSON from a video's transcript using OpenAI GPT-4o.

    Request body: QuizRequest
    Response: Dict containing quiz and metadata.
    """
    try:
        video_id = request.video_id
        num_questions = request.num_questions
        difficulty = request.difficulty
        include_explanations = request.include_explanations
        language = request.language
        
        logger.info(f"Generating quiz for video {video_id} with {num_questions} questions")
        
        # Ensure transcript is available from DB
        transcript_info = get_transcript_cache(db, video_id)
        if not transcript_info or not transcript_info.get("transcript_data"):
            # Check if it's an uploaded video and try to load from S3
            video = db.query(Video).filter(Video.id == video_id, Video.source_type == "uploaded").first()
            if video and video.transcript_s3_key:
                try:
                    if s3_client and AWS_S3_BUCKET:
                        obj = s3_client.get_object(Bucket=AWS_S3_BUCKET, Key=video.transcript_s3_key)
                        content = obj['Body'].read().decode('utf-8')
                        update_transcript_cache(db, video_id, content, {})
                        transcript_info = {"transcript_data": content, "json_data": {}}
                except Exception as e:
                    logger.warning(f"Could not load transcript for quiz from S3: {e}")
            else:
                # YouTube path: fetch transcript
                try:
                    transcript_data, json_data = download_transcript_api(video_id)
                    update_transcript_cache(db, video_id, transcript_data, json_data)
                    transcript_info = {"transcript_data": transcript_data, "json_data": json_data}
                except Exception as e:
                    raise HTTPException(
                        status_code=404, 
                        detail=f"Could not retrieve transcript for video {video_id}: {str(e)}"
                    )
        
        # Get transcript data
        transcript_data = transcript_info.get("transcript_data", "")
        
        if not transcript_data or transcript_data.strip() == "":
            raise HTTPException(
                status_code=400, 
                detail="No transcript available for this video"
            )
        
        # Initialize quiz client (using OpenAI instead of Gemini)
        quiz_client = OpenAIQuizClient()
        
        # Generate quiz
        quiz_result = quiz_client.generate_quiz(
            transcript=transcript_data,
            num_questions=num_questions,
            difficulty=difficulty,
            include_explanations=include_explanations,
            language=language
        )

        print("quiz result: ", quiz_result)
        
        # Transform the response to match frontend expectations
        questions = quiz_result.get('questions', [])
        
        # Add IDs to questions and ensure proper format
        formatted_questions = []
        for i, question in enumerate(questions):
            formatted_question = {
                "id": f"q{i+1}",  # Add missing ID field
                "question": question.get("question", ""),
                "options": question.get("options", []),
                "answer": question.get("answer", ""),
                "difficulty": difficulty  # Add difficulty to each question
            }
            
            # Add explanation if available and requested
            if include_explanations and "explanation" in question:
                formatted_question["explanation"] = question["explanation"]
            
            formatted_questions.append(formatted_question)
        
        logger.info(f"Quiz generation completed for video {video_id}")
        
        # Return in the format frontend expects
        response = {
            "success": True,
            "video_id": video_id,
            "quiz": formatted_questions,  # Use 'quiz' key with formatted questions
            "message": f"Successfully generated {len(formatted_questions)} questions"
        }
        
        print("Final response format:", response)
        
        return response
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error generating quiz for video {video_id}: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to generate quiz: {str(e)}"
        )


# Optional: Serve video files directly
@app.get("/api/videos/{video_id}")
async def serve_video(video_id: str, db: Session = Depends(get_db)):
    """Serve downloaded video files from local storage or redirect to S3"""
    video_path = get_video_path(db, video_id)
    if video_path:
        if video_path.startswith('http'):
            # Redirect to S3 presigned URL
            return RedirectResponse(url=video_path)
        else:
            # Serve local file
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


# ----- Folder & Gallery Endpoints -----

@app.post("/api/folders", response_model=FolderOut)
def create_folder(folder: FolderCreate, db: Session = Depends(get_db)):
    f = Folder(
        user_id=folder.user_id,
        name=folder.name,
        parent_id=folder.parent_id,
        source_type=folder.source_type,
    )
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


@app.get("/api/folders", response_model=List[FolderOut])
def list_folders(user_id: str, source_type: str, db: Session = Depends(get_db)):
    rows = (
        db.query(Folder)
        .filter(Folder.user_id == user_id, Folder.source_type == source_type)
        .order_by(Folder.created_at.desc())
        .all()
    )
    return rows


@app.get("/api/gallery", response_model=List[VideoOut])
def list_gallery(user_id: str, source_type: str, folder_id: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Video).filter(Video.source_type == source_type)
    # Filter by user for both uploaded and youtube if provided
    if user_id:
        q = q.filter(Video.user_id == user_id)
    if folder_id is None:
        q = q.filter(Video.folder_id.is_(None))
    else:
        q = q.filter(Video.folder_id == folder_id)
    rows = q.order_by(Video.created_at.desc()).all()
    return rows


@app.post("/api/gallery/move")
def move_video(req: MoveVideoRequest, db: Session = Depends(get_db)):
    v = db.query(Video).filter(Video.id == req.video_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Video not found")
    v.folder_id = req.target_folder_id
    db.add(v)
    db.commit()
    return {"success": True}


#ADD THE DEBUG ENDPOINT HERE:
@app.post("/api/admin/cleanup-local-videos")
async def cleanup_local_videos_endpoint():
    """Admin endpoint to clean up local video files that have been uploaded to S3"""
    try:
        cleanup_local_videos()
        return {"success": True, "message": "Local video cleanup completed"}
    except Exception as e:
        logger.error(f"Cleanup endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/migrate-local-videos-to-s3")
async def migrate_local_videos_to_s3_endpoint():
    """Admin endpoint to migrate existing local videos to S3"""
    try:
        migrate_local_videos_to_s3()
        return {"success": True, "message": "Local videos migration to S3 completed"}
    except Exception as e:
        logger.error(f"Migration endpoint failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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