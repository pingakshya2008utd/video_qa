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


openai.api_key = os.getenv("OPENAI_API_KEY")

class SpeechManager:
    def __init__(self):
        self.engine = None
        self.should_stop = False
        
    def initialize_engine(self):
        self.engine = pyttsx3.init()
        self.should_stop = False
        
    def stop_speech(self):
        self.should_stop = True
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
            if text == "i got it":
                return True
        except:
            return False
        
def run_speech_thread(sentences, engine, stop_queue):
    """
    Thread function to handle text-to-speech.
    """
    try:
        for sentence in sentences:
            if not sentence.strip():  # Skip empty sentences
                continue
                
            # Check if stop was requested
            try:
                if stop_queue.get_nowait():
                    print("\nStopping speech...")
                    return
            except queue.Empty:
                pass
            
            # Speak the sentence
            engine.say(sentence)
            engine.runAndWait()
    finally:
        engine.stop()


def run_listener_thread(speech_manager):
    """
    Thread function to listen for stop command.
    """
    
    while not speech_manager.should_stop:
        if listen_for_stop():
            speech_manager.stop_speech()
            break


def speak_text(text):
    """
    Main function to handle text-to-speech with interrupt capability.
    Can be stopped by saying 'ok'.
    """
    # Initialize speech manager
    speech_manager = SpeechManager()
    speech_manager.initialize_engine()
    
    # Start listener thread first
    listener_thread = threading.Thread(
        target=run_listener_thread,
        args=(speech_manager,),
        daemon=True  # Set as daemon thread before starting
    )
    listener_thread.start()
    
    # Split text and speak
    sentences = text.split('.')
    try:
        for sentence in sentences:
            if speech_manager.should_stop:
                break
                
            if sentence.strip():  # Skip empty sentences
                speech_manager.engine.say(sentence)
                speech_manager.engine.runAndWait()
                
                if speech_manager.should_stop:
                    break
    except:
        pass
    finally:
        speech_manager.stop_speech()
        
    return
    
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
        
def handle_qa_session(transcript):
    """
    Handles the question-answer session when video is paused.
    Returns True if user wants to exit Q&A mode, False to quit program.
    """
    print("\nVideo paused. You can ask questions based on the transcript.")
    print("Say 'exit' to return to video, or 'quit' to end program.")
    
    '''
    print("\nListening for your question...")
    question = get_voice_input()
    answer = ask_gpt4(transcript, question)
    print(f"\nAnswer: {answer}")
    speak_text(answer)
    '''


    
    while True:
        print("\nListening for your question...")
        question = get_voice_input()
        
        if question.lower() == 'exit':
            return True
        if question.lower() == 'stop':
            return False
            
        print(f"You asked: {question}")
        print("Processing...")
        answer = ask_gpt4(transcript, question)
        print(f"\nAnswer: {answer}")
        speak_text(answer)
    


def question_answer_loop(is_paused, transcript):
    """
    Handles the question-answer interaction.
    Pauses the video playback and waits for user input until resumed.
    """
    printed_message = False  # Flag to ensure message is printed only once
    print("is_paused.is_set() before", is_paused.is_set())
    while True:
        if is_paused.is_set():  # Video is playing
            printed_message = False
            continue

        

        if not printed_message:
            print("\nVideo paused. You can ask questions based on the transcript.")
            printed_message = True  # Ensure message is printed only once
        
        question = get_voice_input()
        if question.lower() == "exit":
            is_paused.set()  # Resume playback
            continue

        answer = ask_gpt4(transcript, question)
        print(f"\nAnswer: {answer}")
        speak_text(answer)
        

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


