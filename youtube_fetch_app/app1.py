from flask import Flask, render_template, request, jsonify, send_file
from flask_socketio import SocketIO, emit
import os
import pygame
import moviepy as mp
from time import time, sleep
import threading
from youtubefetch import handle_qa_session, download_transcript  # Your existing functions
from youtube_player import download_video, extract_audio, play_audio_video
app = Flask(__name__)
socketio = SocketIO(app)

# Store the current video state
video_state = {
    'path': None,
    'transcript': None,
    'playing': False,
    'current_time': 0
}

def play_video_thread(video_path):
    print("Starting video thread...")
    try:
        video = mp.VideoFileClip(video_path)
        fps = video.fps
        frame_duration = 1.0 / fps
        total_duration = video.duration
        start_time = time()
        pause_time = 0

        # Get video dimensions
        width = int(video.w)
        height = int(video.h)

        while video_state['current_time'] < total_duration:
            if not video_state['playing']:
                if pause_time == 0:
                    pause_time = time() - start_time
                    result = handle_qa_session(video_state['transcript'])
                    if not result:
                        video.close()
                        return
                continue
            else:
                if pause_time > 0:
                    start_time = time() - pause_time
                    pause_time = 0

            current_time = time() - start_time
            video_state['current_time'] = current_time

            if current_time < total_duration:
                # Get frame and convert to correct format
                frame = video.get_frame(current_time)
                
                # Convert frame to RGBA format (4 channels)
                rgba_frame = []
                for row in frame:
                    for pixel in row:
                        rgba_frame.extend([int(pixel[0]), int(pixel[1]), int(pixel[2]), 255])  # RGB + Alpha

                socketio.emit('video_frame', {
                    'frame': rgba_frame,
                    'width': width,
                    'height': height
                })

                elapsed_time = time() - (start_time + current_time)
                if elapsed_time < frame_duration:
                    sleep(frame_duration - elapsed_time)

    except Exception as e:
        print(f"Error in video thread: {str(e)}")
    finally:
        video.close()

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/process_url', methods=['POST'])
def process_url():
    try:
        youtube_url = request.form['url']
        video_path = download_video(youtube_url)  # Your existing function
        transcript = download_transcript(youtube_url)  # Your existing function
        
        video_state['path'] = video_path
        video_state['transcript'] = transcript
        
        return jsonify({
            'status': 'success',
            'message': 'Video loaded successfully'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        })

@socketio.on('start_video')
def handle_start_video():
    if video_state['path']:
        video_state['playing'] = True
        thread = threading.Thread(target=play_video_thread, args=(video_state['path'],))
        thread.start()

@socketio.on('pause_video')
def handle_pause_video():
    print("Received start_video event")
    video_state['playing'] = False
    # Start Q&A session
    result = handle_qa_session(video_state['transcript'])
    emit('qa_result', {'continue': result})

@socketio.on('resume_video')
def handle_resume_video():
    video_state['playing'] = True

if __name__ == '__main__':
    socketio.run(app, debug=True, port=8000)