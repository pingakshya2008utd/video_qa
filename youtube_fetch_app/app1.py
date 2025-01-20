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
    'transcript': None
}

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/video/<filename>')
def serve_video(filename):
    video_path = os.path.join(os.path.dirname(video_state['path']), filename)
    return send_file(video_path, mimetype='video/mp4')

@app.route('/process_url', methods=['POST'])
def process_url():
    try:
        youtube_url = request.form['url']
        video_path = download_video(youtube_url)
        transcript = download_transcript(youtube_url)
        
        video_state['path'] = video_path
        video_state['transcript'] = transcript
        
        return jsonify({
            'status': 'success',
            'video_url': f'/video/{os.path.basename(video_path)}'
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        })

@socketio.on('start_qa')
def handle_qa():
    if video_state['transcript']:
        try:
            def qa_thread():
                result = handle_qa_session(video_state['transcript'], socketio)
                socketio.emit('qa_result', {'continue': result})
                
            # Run QA session in background thread
            thread = threading.Thread(target=qa_thread)
            thread.daemon = True
            thread.start()
        except Exception as e:
            socketio.emit('qa_error', {'error': str(e)})
    else:
        socketio.emit('qa_result', {'continue': False, 'error': 'No transcript available'})

@socketio.on('stop_speech')
def stop_speech():
    if hasattr(app, 'speech_manager'):
        app.speech_manager.stop_speech()
        socketio.emit('speech_stopped')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0',debug=True, port=8000)