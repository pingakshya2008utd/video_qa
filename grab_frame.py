import yt_dlp
import cv2
import os
import tempfile
import subprocess


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

def grab_youtube_frame(youtube_url, timestamp, output_file="extracted_frame.jpg"):
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
        
        video_path = download_video(youtube_url)
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

# Example usage
if __name__ == "__main__":
    # Get user input
    youtube_url ="https://www.youtube.com/watch?v=rMj6KnxZu5M"
    timestamp = float(246)
    
    # Extract frame
    result, frame = grab_youtube_frame(youtube_url, timestamp, "frame_at_timestamp.jpg")
    
    if result and frame is not None:
        print(f"Successfully saved frame to: {result}")
        
        # Display the frame using imshow
        cv2.imshow('YouTube Frame at {:.2f} seconds'.format(timestamp), frame)
        
        # Wait for a key press and then close the window
        print("Press any key to close the window...")
        cv2.waitKey(0)
        cv2.destroyAllWindows()
    else:
        print("Failed to extract frame")