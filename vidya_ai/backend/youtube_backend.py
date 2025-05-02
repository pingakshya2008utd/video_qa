from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import re
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("youtube_backend:app", host="0.0.0.0", port=8000, reload=True)