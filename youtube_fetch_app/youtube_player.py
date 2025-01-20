import os
import cv2
import pygame
import subprocess
import threading
#from moviepy.editor import VideoFileClip
from moviepy import VideoFileClip
#from playsound import playsound

# Download video using yt-dlp
def download_video(url):
    output_path = "video.mp4"
    if os.path.exists(output_path):
        os.remove(output_path)
    command = [
        "yt-dlp",
        "-f", "best[ext=mp4]",
        "-o", output_path,
        url
    ]
    subprocess.run(command, check=True)
    return output_path

def extract_audio(video_path, output_audio_path):
    """
    Extract audio from the MP4 video and save it as an MP3 file.
    """
    video_clip = VideoFileClip(video_path)
    audio_clip = video_clip.audio
    audio_clip.write_audiofile(output_audio_path, logger=None)  # Suppress output
    audio_clip.close()
    video_clip.close()


def play_audio(audio_path):
    """
    Play audio using pygame.
    """
    print(audio_path)
    #playsound(audio_path)
    pygame.mixer.init()
    pygame.mixer.music.load(audio_path)
    pygame.mixer.music.play()

def wait_and_input():
    input()
    pygame.mixer.music.stop()
    

def play_video1(video_path):
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)  # Get frames per second
    frame_delay = int(1000 / fps)    # Calculate delay between frames

    is_paused = False
    while True:
        if not is_paused:
            ret, frame = cap.read()
            if not ret:
                break
            cv2.imshow("YouTube Video", frame)
            
        key = cv2.waitKey(frame_delay if not is_paused else 100) & 0xFF
        if key == ord('p'):  # Pause or resume
            is_paused = not is_paused
            if is_paused:
                pygame.mixer.music.pause()  # Pause audio
            else:
                pygame.mixer.music.unpause()  # Resume audio

        elif key == ord('q'):  # Quit
            pygame.mixer.music.stop()
            cv2.destroyAllWindows()  # Close video player
            break

    cap.release()
    cv2.destroyAllWindows()

    

def play_audio_video(video_path, audio_path):
    """
    Play video and audio in sync using threading.
    """
    # Start audio in a separate thread
    play_audio(audio_path)
    music_thread=threading.Thread(target=play_audio, args=(audio_path,))
    input_thread=threading.Thread(target=wait_and_input)
    music_thread.start()
    input_thread.start()
    #audio_thread = threading.Thread(target=play_audio, args=(audio_path,))
    #audio_thread.start()

    # Play video
    play_video1(video_path)

# Main function
def main():
    video_url = "https://www.youtube.com/watch?v=F8AbOfQwl1c"
    print("Downloading video...")
    #video_path = download_video(video_url)
    #print(f"Playing video from: {video_path}")
    video_path = "video.mp4"
    audio_path = "audio.mp3"  # Temporary file to store audio
    print("Extracting audio from video...")
    #extract_audio(video_path, audio_path)
    
    print("Starting audio and video playback...")
    play_audio_video(video_path, audio_path)
    #play_video1(video_path)
    #ret, frame = cap.read()

    #cv2.imshow("YouTube Video", frame)
    
    # Play video
    #video_thread = threading.Thread(target=play_video)
    #video_thread.start()

if __name__ == "__main__":
    main()
