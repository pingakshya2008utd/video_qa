import sieve
import shutil
import os
import re

url = "https://www.youtube.com/watch?v=ogMaVI7-A40"

def extract_video_id(url):
    """Extract YouTube video ID from URL"""
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})',
        r'(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return "unknown_video"

# Get video from Sieve
youtube_downloader = sieve.function.get("sieve/youtube-downloader")
output = youtube_downloader.run(url=url, download_type="video", include_audio = True, audio_format = "mp3")

# Process the file
for output_object in output:
    temp_path = output_object.path
    video_id = extract_video_id(url)
    final_filename = f"{video_id}.mp4"
    
    print(f"Temp file: {temp_path}")
    print(f"Moving to: {final_filename}")
    
    # Copy file to current directory with new name
    shutil.copy2(temp_path, final_filename)
    
    # Delete original temp file
    os.remove(temp_path)
    
    print(f"✅ Video saved as: {final_filename}")
    break