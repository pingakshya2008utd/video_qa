import requests
import os
import time
from urllib.parse import quote

def download_youtube_video(youtube_url):
    """Simple YouTube video downloader using RapidAPI with progress checking"""
    
    # Your RapidAPI key
    api_key = "87cb804577msh2f08e931a0d9bacp19e810jsn4f8fd6ff742b"
    
    # Encode the YouTube URL
    encoded_url = quote(youtube_url, safe='')
    
    # API endpoint
    url = f"https://youtube-info-download-api.p.rapidapi.com/ajax/download.php?format=720&add_info=1&url={encoded_url}&audio_quality=128&allow_extended_duration=true&no_merge=false"
    
    headers = {
        'x-rapidapi-key': api_key,
        'x-rapidapi-host': "youtube-info-download-api.p.rapidapi.com"
    }
    
    # Get initial response
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        print(f"Title: {data.get('title', 'Unknown')}")
        
        # Check if we have direct download URL
        download_url = data.get('url') or data.get('download_url') or data.get('link')
        
        if download_url:
            return download_file(download_url)
        
        # Check if we have progress URL (processing in background)
        elif 'progress_url' in data:
            progress_url = data['progress_url']
            print(f"Video is being processed... Checking progress: {progress_url}")
            
            # Wait for processing to complete
            for attempt in range(30):  # Try for 5 minutes
                time.sleep(10)  # Wait 10 seconds between checks
                
                try:
                    progress_response = requests.get(progress_url)
                    if progress_response.status_code == 200:
                        progress_data = progress_response.json()
                        print(f"Progress check {attempt + 1}: {progress_data}")
                        
                        # Look for download URL in progress response
                        download_url = progress_data.get('url') or progress_data.get('download_url') or progress_data.get('download_link')
                        
                        if download_url:
                            print("✅ Processing complete! Starting download...")
                            return download_file(download_url)
                        
                        # Check if processing is complete
                        if progress_data.get('status') == 'completed' or progress_data.get('progress') == 100:
                            break
                            
                except Exception as e:
                    print(f"Progress check failed: {e}")
            
            print("❌ Processing timed out or failed")
        
        else:
            print(f"❌ API Response: {data}")
            print("❌ This API requires contacting them for application use")
            print("❌ Visit: https://video-download-api.com/")
    else:
        print(f"❌ API failed: {response.status_code} - {response.text}")
    
    return None

def download_file(download_url):
    """Download file from URL"""
    print(f"Downloading from: {download_url[:80]}...")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        video_response = requests.get(download_url, stream=True, headers=headers, timeout=300)
        
        if video_response.status_code == 200:
            filename = "video.mp4"
            
            with open(filename, 'wb') as f:
                downloaded = 0
                for chunk in video_response.iter_content(chunk_size=1024*1024):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if downloaded % (5*1024*1024) == 0:
                            print(f"Downloaded: {downloaded / (1024*1024):.1f} MB")
            
            file_size = os.path.getsize(filename)
            if file_size > 1000:
                print(f"✅ Downloaded: {filename} ({file_size / (1024*1024):.1f} MB)")
                return filename
            else:
                print(f"❌ File too small: {file_size} bytes")
                os.remove(filename)
        else:
            print(f"❌ Download failed: {video_response.status_code}")
    
    except Exception as e:
        print(f"❌ Download error: {e}")
    
    return None

# Usage
if __name__ == "__main__":
    youtube_url = "https://www.youtube.com/watch?v=TZW6D9jhgb4"
    download_youtube_video(youtube_url)