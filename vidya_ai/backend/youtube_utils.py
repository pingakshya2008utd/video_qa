import os
import re
import yt_dlp
import cv2
import pygame
import subprocess
import threading
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter


def download_video(youtube_url, output_path="videos", output_filename="video65", resolution="720"):
    """
    Download a YouTube video with audio using yt-dlp
    
    Args:
        youtube_url (str): URL of the YouTube video to download
        output_path (str, optional): Directory to save the video. Defaults to "videos".
        output_filename (str, optional): Name for the output file without extension.
                                         If None, uses the video title.
        resolution (str, optional): Video resolution to download. Defaults to "720".
                                    Options include: "144", "240", "360", "480", "720", "1080", etc.
    
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
        }
        
        # If output filename is provided, set the output template
        if output_filename:
            # Clean filename to avoid issues
            clean_filename = re.sub(r'[^\w\s-]', '', output_filename)
            clean_filename = re.sub(r'[-\s]+', '-', clean_filename).strip('-_')
            ydl_opts['outtmpl'] = os.path.join(output_path, f"{clean_filename}.%(ext)s")
        else:
            ydl_opts['outtmpl'] = os.path.join(output_path, "%(title)s.%(ext)s")
        
        # Extract info first to get the title
        with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
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
            
        
        print(f"Download complete: {output_file}")
        return output_file
        
    except Exception as e:
        print(f"Error downloading video: {e}")
        return None

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
        transcript_api = YouTubeTranscriptApi()
        transcript = transcript_api.fetch(video_id, languages=["en"])
        formatter = TextFormatter()
        transcript_text = formatter.format_transcript(transcript)
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