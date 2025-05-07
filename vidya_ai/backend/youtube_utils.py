import os
import cv2
import pygame
import subprocess
import threading
from youtube_transcript_api import YouTubeTranscriptApi

def download_video(url):
    output_path = "video.mp4"
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