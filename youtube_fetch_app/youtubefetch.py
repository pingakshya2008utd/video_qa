import os
import threading
import pygame
from youtube_transcript_api import YouTubeTranscriptApi
import openai
import pyttsx3
import speech_recognition as sr
import keyboard
import cv2
from youtube_player import download_video, extract_audio, play_audio_video
import moviepy as mp
from time import time, sleep
import queue
from gtts import gTTS
import base64
import timeout_decorator
from flask import Flask, render_template, request, jsonify, send_file
from flask_socketio import SocketIO, emit

app = Flask(__name__)
socketio = SocketIO(app)



openai.api_key = os.getenv("OPENAI_API_KEY")

class SpeechManager:
    def __init__(self, socketio=None):
        self.engine = None
        self.should_stop = threading.Event()
        self.socketio = socketio
        
    def initialize_engine(self):
        self.engine = pyttsx3.init()
        self.should_stop.clear()
        
    def stop_speech(self):
        self.should_stop.set()
        if self.engine:
            self.engine.stop()

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
        return transcript_text
    except Exception as e:
        print(f"Error fetching transcript: {e}")
        return None

def ask_gpt4(context, question):
    try:
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": f"Context: {context}\n\nQuestion: {question}"}
        ]

        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=500,
            temperature=0
        )
        return response['choices'][0]['message']['content'].strip()
        
    except Exception as e:
        print(f"Error querying GPT-4: {e}")
        return None


def listen_for_stop():
    """
    Listen for the 'ok' command in background.
    Returns True if 'ok' is heard, False if there's an error.
    """
    recognizer = sr.Recognizer()
    with sr.Microphone() as source:
        try:
            print("Listening for 'ok' to stop...")
            audio = recognizer.listen(source, timeout=None, phrase_time_limit=2)
            text = recognizer.recognize_google(audio).lower()
            print(f"-----text-------: {text}")
            if text == "you are awesome":
                return True
            return False
        except:
            return False


def run_listener_thread(speech_manager, socketio):
    """
    Thread function to listen for stop command.
    """
    
    while not speech_manager.should_stop.is_set():
        stop_requested = listen_for_stop()
        if stop_requested:
            print("Stop command received...")
            speech_manager.should_stop .set() # Set the flag to True
            speech_manager.stop_speech()
            socketio.emit('speech_stopped')
            break
        # Small sleep to prevent CPU overuse
        sleep(0.1)


def speak_text(text, socketio):
    """
    Main function to handle text-to-speech with interrupt capability.
    Can be stopped by saying 'ok'.
    """
    # Initialize speech manager
    print("speaking text")
    speech_manager = SpeechManager(socketio)
    speech_manager.initialize_engine()
    
    # Start listener thread first
    listener_thread = threading.Thread(
        target=run_listener_thread,
        args=(speech_manager,socketio),
        daemon=True  # Set as daemon thread before starting
    )
    listener_thread.start()
    
    # Split text and speak
    print("text: ", text)
    #sentences = text.split('.')
    try:
        sentences = text.split('.')
        print("sentences length: ", len(sentences))
        for sentence in sentences:
            sentence = sentence.strip()  # Remove whitespace
            if not sentence:  # Skip empty sentences
                continue
            print("current sentence: ", sentence)
            print("speech manager: ", speech_manager.should_stop.is_set())
            
            if speech_manager.should_stop.is_set():
                print("Speech interrupted")
                socketio.emit('speech_interrupted')
                break

            try:
                tts = gTTS(text=sentence, lang='en')
                tts.save("speech.mp3")
               # os.system("afplay speech.mp3")


            
                with open("speech.mp3", "rb") as mp3_file:
                    mp3_data = base64.b64encode(mp3_file.read()).decode('utf-8')
                
                # Send MP3 data to client
                '''
                socketio.emit('play_speech', {
                    'audio': mp3_data,
                    'sentence': sentence
                })
                '''
                
                #speech_manager.engine.say(sentence)
                #speech_manager.engine.runAndWait()
                socketio.emit('speech_progress', {'sentence': sentence})
                sleep(0.3)  # Small pause between sentences
            except Exception as e:
                print(f"Error speaking sentence: {e}")
                socketio.emit('speech_error', {'error': str(e), 'sentence': sentence})
                continue
            
               
                          
    except Exception as e:
        print(f"Exception in speak_text: {e}")
        socketio.emit('speech_error', {'error': str(e)})
    finally:
        print("exiting speak_text function") 
        speech_manager.stop_speech()
        listener_thread.join(timeout=1)
        socketio.emit('speech_completed')
        
    return

@timeout_decorator.timeout(5, use_signals=False)
def get_voice_input_with_timeout():
    return get_voice_input()
    
def get_voice_input():
    recognizer = sr.Recognizer()
    with sr.Microphone() as source:
        print("Listening for your question...")
        try:
            audio = recognizer.listen(source)
            print("Processing...")
            question = recognizer.recognize_google(audio)
            print(f"You asked: {question}")
            return question
        except sr.UnknownValueError:
            print("Sorry, I didn't catch that. Please try again.")
            return None
        except sr.RequestError as e:
            print(f"Could not request results from the speech recognition service; {e}")
            return None



qa_session_state = {
    'active': False,
    'transcript': None
}

client_states = {}

@socketio.on('connect')
def handle_connect():
    client_id = request.sid  # Get unique session ID for this client
    client_states[client_id] = {
        'qa_active': False,
        'transcript': None
    }
    print(f"Client {client_id} connected")

@socketio.on('disconnect')
def handle_disconnect():
    client_id = request.sid
    if client_id in client_states:
        del client_states[client_id]
    print(f"Client {client_id} disconnected")

@socketio.on('submit_question')
def handle_submit_question(data):
    """
    Global handler for submitted questions
    """
    if not qa_session_state['active']:
        return
        
    print("Received question data:", data)
    question = data.get('question', '').lower()
    print(f"Processing question: {question}")
    
    try:
        if question == 'exit':
            qa_session_state['active'] = False
            socketio.emit('qa_exit')
            return
            
        if question == 'stop':
            qa_session_state['active'] = False
            socketio.emit('qa_stop')
            return
            
        socketio.emit('processing_question', {'question': question})
        answer = ask_gpt4(qa_session_state['transcript'], question)
        if answer:
            socketio.emit('answer_ready', {
                'answer': answer,
                'question': question
            })
            speak_text(answer, socketio)
        else:
            socketio.emit('qa_error', {
                'error': 'Could not generate answer'
            })
    except Exception as e:
        print(f"Error processing question: {e}")
        socketio.emit('qa_error', {
            'error': str(e)
        })

def handle_qa_session(transcript, socketio):
    """
    Handles Q&A session initialization
    """
    qa_session_state['active'] = True
    qa_session_state['transcript'] = transcript
    
    @socketio.on('qa_start')
    def on_qa_start():
        qa_session_state['active'] = True
        print("Q&A session started")
        socketio.emit('qa_mode_active')

    @socketio.on('qa_end')
    def on_qa_end():
        qa_session_state['active'] = False
        print("Q&A session ended")
        socketio.emit('qa_mode_inactive')

    return True





def handle_qa_session111(transcript, socketio):
    """
    Handles the question-answer session when video is paused.
    Returns True if user wants to exit Q&A mode, False to quit program.
    """
    print("\nVideo paused. You can ask questions based on the transcript.")
    print("Say 'exit' to return to video, or 'quit' to end program.")
     
    while True:
        print("\nListening for your question...")
        '''
        try:
            question = get_voice_input_with_timeout()
        except timeout_decorator.TimeoutError:
            print("No question received within 5 seconds")
            socketio.emit('qa_timeout')
            return True
        '''
        
        question = get_voice_input()
        
        if question is None:
            print("No question received within 5 seconds")
            socketio.emit('qa_timeout')
            return True
        
        if question.lower() == 'exit':
            socketio.emit('qa_exit')
            return True
        if question.lower() == 'stop':
            socketio.emit('qa_stop')
            return False
            
        print(f"You asked: {question}")
        print("Processing...")
        socketio.emit('processing_question', {'question': question})
        answer = ask_gpt4(transcript, question)
        socketio.emit('answer_ready', {'answer': answer})
        speak_text(answer, socketio)
        print("inside handle_qa_session end")



def play_video_with_questions(video_path, transcript):
    """
    Plays the video and manages the pause/resume interaction for questions.
    """
    pygame.init()
    pygame.display.set_caption('Video Player with Q&A')
    video = mp.VideoFileClip(video_path)
    audio=video.audio

    screen_size = video.size
    screen = pygame.display.set_mode(screen_size)
    

    # Get video properties
    fps = video.fps
    frame_duration = 1.0 / fps
    total_duration = video.duration
    
    # Initialize playback variables
    start_time = time()
    current_time = 0
    paused = False

    while current_time < total_duration:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                video.close()
                pygame.quit()
                return
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_p:  # Pause/Play
                    paused = not paused
                    if paused:
                        pause_time = time() - start_time
                        pygame.mixer.music.pause()
                        # Enter Q&A mode
                        should_continue = handle_qa_session(transcript)
                        if not should_continue:
                            video.close()
                            pygame.quit()
                            return
                        # Resume video
                        pygame.mixer.music.unpause()
                        paused = False
                        start_time = time() - pause_time
                elif event.key == pygame.K_q:  # Quit
                    video.close()
                    pygame.quit()
                    return
        
        if not paused:
            current_time = time() - start_time
            
            if current_time < total_duration:
                # Get the current frame
                frame = video.get_frame(current_time)
                
                # Convert frame to Pygame surface and display it
                surface = pygame.surfarray.make_surface(frame.swapaxes(0, 1))
                screen.blit(surface, (0, 0))
                pygame.display.flip()
                
                # Control frame rate
                elapsed_time = time() - (start_time + current_time)
                if elapsed_time < frame_duration:
                    sleep(frame_duration - elapsed_time)
        
        pygame.time.wait(10)  # Small delay to prevent excessive CPU usage
    
    # Cleanup
    video.close()
    pygame.quit()



    




def main():
    video_url = "https://www.youtube.com/watch?v=F8AbOfQwl1c"
    print("Downloading transcript...")
    transcript = download_transcript(video_url)
    
    print("Downloading video...")
    video_path = download_video(video_url)
    audio_path = "audio.mp3"  # Temporary file to store audio
    print("Extracting audio from video...")
    extract_audio(video_path, audio_path)
    
    pygame.mixer.init()
    pygame.mixer.music.load(audio_path)
    pygame.mixer.music.play()

    print("Starting audio and video playback...")
    play_video_with_questions(video_path, transcript)


if __name__ == "__main__":
    main()





'''
if __name__ == "__main__":
    video_url = "https://www.youtube.com/watch?v=F8AbOfQwl1c"
    print("Downloading transcript...")
    transcript = download_transcript(video_url)
    
    print("Downloading video...")
    video_path = download_video(video_url)
    audio_path = "audio.mp3"  # Temporary file to store audio
    print("Extracting audio from video...")
    extract_audio(video_path, audio_path)
    
    print("Starting audio and video playback...")
    play_audio_video(video_path, audio_path)



    if transcript:
        print("Transcript downloaded.")
        print("Ready to answer questions based on the transcript.")
        while True:
            print("Press 'p' to pause the video and ask a question (or type 'exit' to quit): ")
            keyboard.wait('p')  # Wait for 'p' key press to pause the video
            question = get_voice_input()
            if question.lower() == "exit":
                break

            answer = ask_gpt4(transcript, question)
            if answer:
                print("\nAnswer:")
                print(answer)
                print("\nReading the answer out loud...")
                speak_text(answer)
    else:
        print("Could not fetch the transcript.")

'''


