import os
import re
import requests
from fastapi import HTTPException


def download_youtube_video(youtube_url) : #, output_path="videos", output_filename="video65", resolution="720"):
    try:
        # Extract video ID from URL
        video_id = extract_youtube_id(youtube_url)
        if not video_id:
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")
        
        # Get video info from RapidAPI
        headers = {
            'x-rapidapi-key': "87cb804577msh2f08e931a0d9bacp19e810jsn4f8fd6ff742b",
            'x-rapidapi-host': "youtube-media-downloader.p.rapidapi.com"
        }
        
        params = {
            'videoId': video_id,
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
        title = data['title']
        download_url = data['videos']['items'][0]['url']

        print(f"Title: {title}")
        print(f"Downloading...")
        
        # Download video
        #video_response = requests.get(download_url)

        
        filename = f"{video_id}.mp4"

        with requests.get(download_url, stream=True) as video_response:
            video_response.raise_for_status()  # Raise exception for HTTP errors
            
            with open(filename, 'wb') as f:
                # Use a smaller chunk size (1MB) to avoid memory issues
                for chunk in video_response.iter_content(chunk_size=1024*1024): 
                    if chunk:
                        f.write(chunk)
                        f.flush()  # Ensure data is written to disk
        
        print(f"***********Downloaded video to: {filename}*******************")
        
        # Verify file size is reasonable
        file_size = os.path.getsize(filename)
        if file_size < 10000:  # Less than 10KB is probably an error
            raise ValueError(f"Downloaded file is too small ({file_size} bytes), likely corrupted")
        
        #with open(filename, 'wb') as f:
         #   f.write(video_response.content)
        
        return filename
    except Exception as e:
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

if __name__ == "__main__":
    youtube_url = "https://www.youtube.com/watch?v=TZW6D9jhgb4"  # Replace with actual URL
    try:
        download_youtube_video(youtube_url)
    except HTTPException as e:
        print(f"Error: {e.detail}")
    except Exception as e:
        print(f"Unexpected error: {str(e)}")