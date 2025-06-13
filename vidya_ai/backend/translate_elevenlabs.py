import json
import os
import uuid
import time
from dataclasses import asdict, dataclass
from typing import List

from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs
from moviepy import VideoFileClip

# Load environment variables
load_dotenv()

# Setup ElevenLabs client
ELEVENLABS_API_KEY = "sk_225e89c07a6055c9721120dbbe0f7dd17847fb69d1d9e118"


client = ElevenLabs(api_key=ELEVENLABS_API_KEY)

@dataclass
class DubbingProject:
    id: str
    name: str
    dubbing_id: str
    status: str
    source_lang: str
    target_lang: str
    target_languages: List[str]
    
    def to_dict(self):
        return asdict(self)
    
    @staticmethod
    def from_dict(data):
        return DubbingProject(**data)
    
    def save(self, output_dir):
        os.makedirs(output_dir, exist_ok=True)
        with open(f"{output_dir}/meta.json", "w") as w:
            w.write(json.dumps(self.to_dict()))


def process_video(output_dir: str, filename: str):
    """
    Extract audio from given video and create a video version without audio
    """
    print(f"Processing video: {filename}")
    video = VideoFileClip(f"{output_dir}/{filename}.mp4")
    audio = video.audio
    audio.write_audiofile(f"{output_dir}/audio_{filename}.mp3")
    
    video_without_audio = video.without_audio()
    video_without_audio.write_videofile(f"{output_dir}/vidnoaudio_{filename}.mp4")
    
    # Close to release resources
    audio.close()
    video.close()
    video_without_audio.close()
    print(f"Video processing complete: {filename}")


def upload_dubbing(output_dir: str, filepath: str, source_lang: str, target_lang: str) -> str:
    """Upload video for dubbing and return dubbing ID"""
    print(f"Uploading video for dubbing: {filepath}")
    with open(filepath, "rb") as f:
        response = client.dubbing.dub_a_video_or_an_audio_file(
           # mode="automatic",
            #model_id="eleven_turbo_v2.5",
            target_lang=target_lang,
            source_lang=source_lang if source_lang != "detect" else None,
            file=(os.path.basename(filepath), f.read(), "video/mp4"),
            watermark= True,
            #dubbing_studio=False
        )
    
    print(f"Dubbing initiated with ID: {response.dubbing_id}")
    return response.dubbing_id


def get_metadata(dubbing_id: str):
    """Get dubbing project metadata"""
    print(f"Getting metadata for dubbing ID: {dubbing_id}")
    response = client.dubbing.get_dubbing_project_metadata(dubbing_id)
    return {
        "dubbing_id": response.dubbing_id,
        "status": response.status,
        "target_languages": response.target_languages,
    }


def download_dub(output_dir: str, dubbing_id: str, language_code: str):
    """Download dubbed video"""
    print(f"Downloading dubbed video for language: {language_code}")
    output_path = f"{output_dir}/{language_code}.mp4"
    with open(output_path, "wb") as w:
        for chunk in client.dubbing.get_dubbed_file(dubbing_id, language_code):
            w.write(chunk)
    print(f"Dubbed video saved: {output_path}")
    return output_path


def check_dubbing_status(project: DubbingProject, output_dir: str):
    """Check dubbing status and download result if complete"""
    while True:
        try:
            new_meta = get_metadata(project.dubbing_id)
            print(f"Current status: {new_meta['status']}")
            
            if new_meta["status"] != project.status:
                project.status = new_meta["status"]
                project.target_languages = new_meta["target_languages"]
                project.save(output_dir)
                print(f"Updated project status: {project.status}")
                print(f"meta status: {new_meta["status"]}")   
                
                if project.status == "dubbed":
                    print("")
                    print("Dubbing completed successfully!")
                    
                    # Process original video
                    process_video(output_dir, "raw")
                    
                    # Download and process dubbed versions
                    for target_lang in project.target_languages:
                        output_path = download_dub(output_dir, project.dubbing_id, target_lang)
                        process_video(output_dir, target_lang)
                    
                    return output_path
                
   
                elif project.status == "failed":
                    print("Dubbing failed")
                    return None
            
            if project.status == "completed" or project.status == "failed":
                break
                
            time.sleep(10)  # Check every 10 seconds
            
        except Exception as e:
            print(f"Error checking status: {e}")
            time.sleep(30)  # Wait longer if there's an error


def dub_video(input_video_path, output_dir, source_lang='en', target_lang='es'):
    """
    Translate and dub a video from source language to target language using ElevenLabs API
    
    Args:
        input_video_path: Path to input video file
        output_dir: Directory to save output files
        source_lang: Source language code (default: 'en' for English)
        target_lang: Target language code (default: 'es' for Spanish)
    """
    # Create project ID and output directory
    project_id = uuid.uuid4().__str__()
    project_dir = f"{output_dir}/{project_id}"
    os.makedirs(project_dir, exist_ok=True)
    
    print(f"Starting dubbing process: {input_video_path} => {project_dir}")
    print(f"Translating from {source_lang} to {target_lang}")
    
    # Copy input video to project directory
    raw_video_path = f"{project_dir}/raw.mp4"
    with open(input_video_path, "rb") as src, open(raw_video_path, "wb") as dst:
        dst.write(src.read())
    
    # Upload for dubbing
    dubbing_id = upload_dubbing(project_dir, raw_video_path, source_lang, target_lang)
    
    # Create project metadata
    project = DubbingProject(
        id=project_id,
        name=os.path.basename(input_video_path),
        dubbing_id=dubbing_id,
        status="dubbing",
        source_lang=source_lang,
        target_lang=target_lang,
        target_languages=[target_lang],
    )
    
    # Save metadata
    project.save(project_dir)
    
    # Check status and download result when ready
    output_path = check_dubbing_status(project, project_dir)
    
    if output_path:
        print(f"Dubbing completed. Output saved to: {output_path}")
        # Copy the final file to the output directory with a descriptive name
        final_output = f"{output_dir}/video5_{target_lang}.mp4"
        with open(output_path, "rb") as src, open(final_output, "wb") as dst:
            dst.write(src.read())
        print(f"Final dubbed video: {final_output}")
        return final_output
    else:
        print("Dubbing failed or was cancelled")
        return None


def main():
    input_video = "intro2.mp4"  # Path to the input video file
    output_dir = "output"
    source_language = "en"  # English
    target_language = "hi"  # Spanish
    
    result = dub_video(input_video, output_dir, source_language, target_language)
    if result:
        print(f"Successfully translated video from {source_language} to {target_language}")
        print(f"Output file: {result}")


if __name__ == "__main__":
    main()