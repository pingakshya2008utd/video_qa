import os
import re
import yt_dlp
import cv2
#import pygame
#import subprocess
#import threading
from youtube_transcript_api import YouTubeTranscriptApi
import http.client
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





def download_url(youtube_url) : #, output_path="videos", output_filename="video65", resolution="720"):
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

        return download_url
        
      
        
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




def download_video(youtube_url, output_path=".", debug=False):
    """Simple YouTube video downloader using RapidAPI with progress checking"""
    
    from urllib.parse import quote
    import time
    
    def log(msg):
        if debug:
            print(msg)
    
    # Extract video ID
    video_id = extract_youtube_id(youtube_url)
    if not video_id:
        print("ERROR: Invalid YouTube URL")
        return None
    
    # Set file path
    file_path = os.path.join(output_path, f"{video_id}.mp4")
    
    # Check if file already exists
    if os.path.exists(file_path):
        print(f"File already exists: {file_path}")
        return file_path
    
    # Create output directory if needed
    os.makedirs(output_path, exist_ok=True)
    
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
    
    try:
        # Get initial response
        log(f"Requesting video info for: {youtube_url}")
        response = requests.get(url, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            log(f"Title: {data.get('title', 'Unknown')}")
            
            # Check if we have direct download URL
            download_url = data.get('url') or data.get('download_url') or data.get('link')
            
            if download_url:
                return download_file_to_path(download_url, file_path, debug)
            
            # Check if we have progress URL (processing in background)
            elif 'progress_url' in data:
                progress_url = data['progress_url']
                log(f"Video is being processed... Checking progress: {progress_url}")
                
                # Wait for processing to complete
                for attempt in range(30):  # Try for 5 minutes
                    time.sleep(10)  # Wait 10 seconds between checks
                    
                    try:
                        progress_response = requests.get(progress_url)
                        if progress_response.status_code == 200:
                            progress_data = progress_response.json()
                            log(f"Progress check {attempt + 1}: {progress_data}")
                            
                            # Look for download URL in progress response
                            download_url = progress_data.get('url') or progress_data.get('download_url') or progress_data.get('download_link')
                            
                            if download_url:
                                log("✅ Processing complete! Starting download...")
                                return download_file_to_path(download_url, file_path, debug)
                            
                            # Check if processing is complete
                            if progress_data.get('status') == 'completed' or progress_data.get('progress') == 100:
                                break
                                
                    except Exception as e:
                        log(f"Progress check failed: {e}")
                
                print("❌ Processing timed out or failed")
            
            else:
                print(f"❌ API Response: {data}")
                print("❌ This API requires contacting them for application use")
                print("❌ Visit: https://video-download-api.com/")
        else:
            print(f"❌ API failed: {response.status_code} - {response.text}")
        
        return None
        
    except Exception as e:
        print(f"❌ Error downloading video: {e}")
        return None


def download_file_to_path(download_url, file_path, debug=False):
    """Download file from URL to specific path"""
    
    def log(msg):
        if debug:
            print(msg)
    
    log(f"Downloading from: {download_url[:80]}...")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        video_response = requests.get(download_url, stream=True, headers=headers, timeout=300)
        
        if video_response.status_code == 200:
            with open(file_path, 'wb') as f:
                downloaded = 0
                for chunk in video_response.iter_content(chunk_size=1024*1024):
                    if chunk:
                        f.write(chunk)
                        downloaded += len(chunk)
                        if downloaded % (5*1024*1024) == 0:
                            log(f"Downloaded: {downloaded / (1024*1024):.1f} MB")
            
            file_size = os.path.getsize(file_path)
            if file_size > 1000:
                print(f"✅ Downloaded: {file_path} ({file_size / (1024*1024):.1f} MB)")
                return file_path
            else:
                print(f"❌ File too small: {file_size} bytes")
                os.remove(file_path)
        else:
            print(f"❌ Download failed: {video_response.status_code}")
    
    except Exception as e:
        print(f"❌ Download error: {e}")
    
    return None




def download_video1(youtube_url, output_path=".", debug=False):
    """
    Downloads a YouTube video using yt-dlp with full cookie support.
    
    Args:
        youtube_url (str): YouTube video URL
        output_path (str): Save location (default: current directory)
        debug (bool): Enable verbose logging
    
    Returns:
        str: File path if downloaded, else None
    """
    def log(msg):
        if debug:
            print(msg)

    video_id = extract_youtube_id(youtube_url)
    if not video_id:
        print("ERROR: Invalid YouTube URL")
        return None

    file_path = os.path.join(output_path, f"{video_id}.mp4")
    if os.path.exists(file_path):
        print(f"File already exists: {file_path}")
        return file_path

    # Find cookies file
    cookie_locations = [
        './cookies.txt',
        '/tmp/cookies.txt',
        os.path.expanduser('~/cookies.txt'),
    ]
    cookie_file = None
    for loc in cookie_locations:
        if os.path.isfile(loc):
            cookie_file = loc
            break

    if not cookie_file:
        print("WARNING: No cookies.txt file found. YouTube may block download.")
        return None

    log(f"Using cookie file: {cookie_file}")

    ydl_opts = {
        'format': 'best[height<=720]/best',
        'outtmpl': file_path,
        'quiet': not debug,
        'cookiefile': cookie_file,
        'retries': 10,
        'fragment_retries': 10,
        'socket_timeout': 30,
        'noplaylist': True,
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': '*/*',
            'Referer': 'https://www.youtube.com/',
        }
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            log(f"Downloading: {youtube_url}")
            ydl.download([youtube_url])
        
        if os.path.exists(file_path) and os.path.getsize(file_path) > 10000:
            print(f"Downloaded: {file_path}")
            return file_path
        else:
            raise Exception("File download failed or incomplete")
    except Exception as e:
        print(f"ERROR during download: {e}")
        if "Sign in to confirm you're not a bot" in str(e):
            print("BOT DETECTION BLOCKED DOWNLOAD.")
            print("Try the following:")
            print("1. Login to YouTube in your browser")
            print("2. Use a cookie exporter like 'Get cookies.txt' extension")
            print("3. Save cookies to ./cookies.txt")
            print("4. Retry")
        return None






'''
    
def download_video(youtube_url, output_path="videos", output_filename="myvideo65", resolution="720", cookies_file="cookies.txt"):
    """
    Download a YouTube video with audio using yt-dlp
    
    Args:
        youtube_url (str): URL of the YouTube video to download
        output_path (str, optional): Directory to save the video. Defaults to "videos".
        output_filename (str, optional): Name for the output file without extension.
                                         If None, uses the video title.
        resolution (str, optional): Video resolution to download. Defaults to "720".
                                    Options include: "144", "240", "360", "480", "720", "1080", etc.
        cookies_file (str, optional): Path to cookies.txt file. Defaults to "cookies.txt".
    
    Returns:
        str: Path to the downloaded video file
    """
    try:
        
        print(f"Fetching video information from: {youtube_url}")
        
        # Create output directory if it doesn't exist
        if output_path != ".":
            os.makedirs(output_path, exist_ok=True)
        
        # Setup options for yt-dlp
        ydl_opts = {
            'format': f'bestvideo[height<={resolution}]+bestaudio/best[height<={resolution}]',
            'merge_output_format': 'mp4',
            'quiet': False,
            'no_warnings': False,
            'progress': True,
            'extractor_args': {
                'youtube': {
                    'player_client': ['android', 'web'],  # Use android client
                    'player_skip': ['webpage', 'js'],     # Skip webpage download
                }
            },
            # Try to avoid bot detection by using a common user agent
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            },
            # Reduce the number of requests to avoid triggering bot detection
            'socket_timeout': 30,
            'retries': 3,
            'fragment_retries': 3,
        }
        
        # Add cookies if file exists
        if os.path.exists(cookies_file):
            ydl_opts['cookiefile'] = cookies_file
            print(f"✅ Using cookies from: {cookies_file}")
        else:
            print(f"⚠️ Cookies file not found: {cookies_file} - trying without cookies")
        
        # If output filename is provided, set the output template
        if output_filename:
            # Clean filename to avoid issues
            clean_filename = re.sub(r'[^\w\s-]', '', output_filename)
            clean_filename = re.sub(r'[-\s]+', '-', clean_filename).strip('-_')
            ydl_opts['outtmpl'] = os.path.join(output_path, f"{clean_filename}.%(ext)s")
        else:
            ydl_opts['outtmpl'] = os.path.join(output_path, "%(title)s.%(ext)s")
        
        # Extract info first to get the title
        info_opts = ydl_opts.copy()
        info_opts['quiet'] = True
        
        with yt_dlp.YoutubeDL(info_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=False)
            video_title = info.get('title', 'video')
            print(f"Video title: {video_title}")
        
        # Now download the video
        print(f"Downloading video with resolution: {resolution}p")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
            
            # Get the output filename
            if output_filename:
                output_file = os.path.join(output_path, f"{clean_filename}.mp4")
            else:
                # Clean title for filename
                clean_title = re.sub(r'[^\w\s-]', '', info.get('title', 'video'))
                clean_title = re.sub(r'[-\s]+', '-', clean_title).strip('-_')
                output_file = os.path.join(output_path, f"{clean_title}.mp4")
        
        print(f"✅ Download complete: {output_file}")
        return output_file
        
    except Exception as e:
        error_msg = str(e)
        if "Sign in to confirm you're not a bot" in error_msg:
            print("❌ Bot detection triggered! Your cookies may have expired.")
            print("💡 Solution: Export fresh cookies.txt from your browser")
        else:
            print(f"❌ Error downloading video: {e}")
        return None
'''


'''
def download_video(url):
    output_path = "video77.mp4"
    if os.path.exists(output_path):
        os.remove(output_path)
    
    
    command = [
        "yt-dlp",
        "-f", "mp4",
        "-o", output_path,
        url
    ]
    subprocess.run(command, check=True)
    return output_path
'''


def download_transcript_api1(video_id):
    conn = http.client.HTTPSConnection("youtube-transcript3.p.rapidapi.com")

    headers = {
        'x-rapidapi-key': "87cb804577msh2f08e931a0d9bacp19e810jsn4f8fd6ff742b",
        'x-rapidapi-host': "youtube-transcript3.p.rapidapi.com"
    }

    url = "https://youtube-transcript3.p.rapidapi.com/api/transcript"
    querystring = {"videoId": video_id}
    response = requests.get(url, headers=headers, params=querystring)

    if response.status_code == 200:
        transcript_data = response.json()
        
        # RapidAPI usually returns the transcript in a specific format
        # Check if we have tr    anscript entries to process
        if "transcript" in transcript_data and transcript_data["transcript"]:
            return transcript_data["transcript"]
        else:
            print("No transcript data in the response")
            return None
    else:
        print(f"Error: {response.status_code} - {response.text}")
        return None





def download_transcript_api(video_id):
    conn = http.client.HTTPSConnection("youtube-transcriptor.p.rapidapi.com/transcript")

    headers = {
        'x-rapidapi-key': "87cb804577msh2f08e931a0d9bacp19e810jsn4f8fd6ff742b",
        'x-rapidapi-host': "youtube-transcriptor.p.rapidapi.com"
    }

    url = "https://youtube-transcriptor.p.rapidapi.com/transcript"
    querystring = {"video_id":video_id,"lang":"en"}
    response = requests.get(url, headers=headers, params=querystring)

    if response.status_code == 200:
        transcript_data = response.json()
       # print("-----transcript data--------",transcript_data)
        
        # RapidAPI usually returns the transcript in a specific format
        # Check if we have tr    anscript entries to process
        if "transcriptionAsText" in transcript_data[0] and transcript_data[0]["transcriptionAsText"]:
            return transcript_data[0]["transcriptionAsText"], response.json()
        else:
            print("No transcript data in the response")
            return None, {}
    else:
        print(f"Error: {response.status_code} - {response.text}")
        return None, {}




def format_transcript_data(transcript_data):
    """Format transcript data into readable text with proper punctuation"""
    if not transcript_data:
        return None
    
    # Check if we're dealing with RapidAPI format
    if isinstance(transcript_data, list) and all(isinstance(item, dict) for item in transcript_data):
        # Extract text from each item and join with proper spacing and punctuation
        full_text = ""
        for item in transcript_data:
            # Get the text, clean HTML entities
            text = item.get('text', '').strip()
            text = text.replace('&#39;', "'")  # Replace HTML apostrophe
            
            # Add to full text with proper spacing and capitalization
            if full_text and not full_text.endswith('.') and not full_text.endswith('?') and not full_text.endswith('!'):
                # If previous text didn't end with punctuation, add a period
                full_text += ". "
            elif full_text:
                # If it ended with punctuation, just add space
                full_text += " "
                
            # Capitalize first letter if it's the start of a sentence
            if not full_text or full_text.endswith('. ') or full_text.endswith('? ') or full_text.endswith('! '):
                text = text[0].upper() + text[1:] if text else text
                
            full_text += text
        
        # Ensure text ends with a period if it doesn't have final punctuation
        if full_text and not full_text.endswith('.') and not full_text.endswith('?') and not full_text.endswith('!'):
            full_text += "."
            
        return full_text
    
    else:
        return "Invalid transcript format"

def download_transcript(video_url_or_id):
    try:
        # Extract video ID
        if "youtube.com" in video_url_or_id or "youtu.be" in video_url_or_id:
            if "youtube.com/watch?v=" in video_url_or_id:
                video_id = video_url_or_id.split("watch?v=")[-1].split("&")[0]
            elif "youtu.be/" in video_url_or_id:
                video_id = video_url_or_id.split("youtu.be/")[-1].split("?")[0]
            else:
                raise ValueError("Invalid YouTube URL.")
        else:
            video_id = video_url_or_id

        # Fetch transcript 
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=["en"])
        transcript_text = " ".join([item['text'] for item in transcript])
        #print(transcript_text)
        return transcript_text
    except Exception as e:
        print(f"Error fetching transcript: {e}")
        return None


def grab_youtube_frame(video_path_func, timestamp, output_file="extracted_frame.jpg"):
    """
    Extract a frame from a YouTube video at a specific timestamp.
    
    Args:
        youtube_url (str): The URL of the YouTube video
        timestamp (float): Time in seconds where you want to capture the frame
        output_file (str): Path to save the extracted frame
    
    Returns:
        tuple: (str, numpy.ndarray) Path to the saved frame image and the frame itself
    """
    frame = None
    video = None
    
    try:
        # Create a temporary directory for video download
        
        video_path = video_path_func
        print(f"Video downloaded to: {video_path}")
            
            # Open the video with OpenCV
        video = cv2.VideoCapture(video_path)
        
        # Get video properties
        fps = video.get(cv2.CAP_PROP_FPS)
        print("Video FPS:", fps)
        total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = total_frames / fps
        
        print(f"Video duration: {duration:.2f} seconds")
        print(f"FPS: {fps}")
        
        # Calculate frame number for the given timestamp
        frame_number = int(timestamp * fps)
        
        # Check if timestamp is within video duration
        if timestamp > duration:
            raise ValueError(f"Timestamp {timestamp} exceeds video duration {duration:.2f}")
        
        # Seek to the specified frame
        video.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        
        # Read the frame
        ret, frame = video.read()
        
        if ret:
            # Save the frame
            cv2.imwrite(output_file, frame)
            print(f"Frame saved to: {output_file}")
            return output_file, frame
        else:
            raise RuntimeError(f"Failed to extract frame at timestamp {timestamp}")
            
    except Exception as e:
        print(f"Error: {str(e)}")
        return None, None
    finally:
        if video is not None:
            video.release()