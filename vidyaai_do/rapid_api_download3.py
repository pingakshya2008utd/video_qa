import os
import re
import requests
from fastapi import HTTPException
import time
import random


def download_youtube_video(youtube_url):
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
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"RapidAPI error: {response.text}")
        
        data = response.json()
        title = data['title']
        download_url = data['videos']['items'][0]['url']

        print(f"Title: {title}")
        print(f"Download URL: {download_url}")
        print(f"Downloading...")
        
        # Try multiple download strategies
        filename = f"{video_id}.mp4"
        
        # Strategy 1: Basic download with proper headers
        success = download_with_headers(download_url, filename)
        
        if not success:
            print("Basic download failed, trying with session...")
            # Strategy 2: Use session with cookies
            success = download_with_session(download_url, filename)
            
        if not success:
            print("Session download failed, trying with proxy headers...")
            # Strategy 3: Mimic browser more closely
            success = download_with_browser_mimicking(download_url, filename)
            
        if not success:
            raise Exception("All download strategies failed")
        
        print(f"***********Downloaded video to: {filename}*******************")
        return filename
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def download_with_headers(download_url, filename):
    """Download with proper headers to mimic a browser"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'identity',  # Don't use gzip to avoid issues
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Referer': 'https://www.youtube.com/',
        }
        
        with requests.get(download_url, headers=headers, stream=True, timeout=30) as video_response:
            video_response.raise_for_status()
            
            with open(filename, 'wb') as f:
                for chunk in video_response.iter_content(chunk_size=1024*1024):
                    if chunk:
                        f.write(chunk)
                        f.flush()
            
            # Verify file size
            file_size = os.path.getsize(filename)
            if file_size < 10000:
                os.remove(filename) if os.path.exists(filename) else None
                return False
            
            return True
            
    except Exception as e:
        print(f"Download with headers failed: {str(e)}")
        os.remove(filename) if os.path.exists(filename) else None
        return False


def download_with_session(download_url, filename):
    """Download using a session with cookies"""
    try:
        session = requests.Session()
        
        # Set headers
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity',
            'Connection': 'keep-alive',
            'Referer': 'https://www.youtube.com/',
        })
        
        # First, make a request to YouTube to get cookies
        try:
            session.get('https://www.youtube.com/', timeout=10)
            time.sleep(random.uniform(1, 3))  # Random delay
        except:
            pass  # Continue even if this fails
        
        with session.get(download_url, stream=True, timeout=60) as video_response:
            video_response.raise_for_status()
            
            with open(filename, 'wb') as f:
                for chunk in video_response.iter_content(chunk_size=1024*1024):
                    if chunk:
                        f.write(chunk)
                        f.flush()
            
            # Verify file size
            file_size = os.path.getsize(filename)
            if file_size < 10000:
                os.remove(filename) if os.path.exists(filename) else None
                return False
            
            return True
            
    except Exception as e:
        print(f"Download with session failed: {str(e)}")
        os.remove(filename) if os.path.exists(filename) else None
        return False


def download_with_browser_mimicking(download_url, filename):
    """Download with extensive browser mimicking"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Pragma': 'no-cache',
            'Referer': 'https://www.youtube.com/',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Linux"',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'cross-site',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
        }
        
        # Add random delay to avoid rate limiting
        time.sleep(random.uniform(2, 5))
        
        with requests.get(download_url, headers=headers, stream=True, timeout=120) as video_response:
            if video_response.status_code == 403:
                print(f"Still getting 403. Response headers: {dict(video_response.headers)}")
                return False
                
            video_response.raise_for_status()
            
            with open(filename, 'wb') as f:
                downloaded = 0
                for chunk in video_response.iter_content(chunk_size=1024*1024):
                    if chunk:
                        f.write(chunk)
                        f.flush()
                        downloaded += len(chunk)
                        if downloaded % (10*1024*1024) == 0:  # Print progress every 10MB
                            print(f"Downloaded: {downloaded / (1024*1024):.1f} MB")
            
            # Verify file size
            file_size = os.path.getsize(filename)
            print(f"Final file size: {file_size / (1024*1024):.1f} MB")
            
            if file_size < 10000:
                os.remove(filename) if os.path.exists(filename) else None
                return False
            
            return True
            
    except Exception as e:
        print(f"Download with browser mimicking failed: {str(e)}")
        os.remove(filename) if os.path.exists(filename) else None
        return False


def extract_youtube_id(url: str) -> str:
    """Extract the YouTube video ID from different URL formats"""
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
    youtube_url = "https://www.youtube.com/watch?v=TZW6D9jhgb4"
    try:
        download_youtube_video(youtube_url)
    except HTTPException as e:
        print(f"Error: {e.detail}")
    except Exception as e:
        print(f"Unexpected error: {str(e)}")