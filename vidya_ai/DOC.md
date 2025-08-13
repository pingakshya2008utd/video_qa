Here’s a concise walkthrough of how `vidya_ai` works.

### What it is
- **Vidya AI** lets you chat with YouTube videos:
  - Ask general questions using transcript context.
  - Ask about the exact frame at the current timestamp (vision).
  - Translate/dub a YouTube video into another language.

### Architecture
- **Backend**: FastAPI (`backend/`), OpenAI for text/vision, ElevenLabs for dubbing, `yt-dlp` for downloads, OpenCV for frames, YouTube Transcript API.
- **Frontend**: React + Vite + Tailwind (`frontend/`), YouTube IFrame player, Axios for API calls.
- CORS enabled for `http://localhost:5173`.

### Backend: main responsibilities
- Download video + fetch transcript.
- Extract a frame at timestamp.
- Route text vs vision queries to OpenAI.
- Launch and poll translation jobs with ElevenLabs; serve outputs.

Key endpoints (FastAPI):
- POST `/api/youtube/info`: validates URL, downloads the video, fetches transcript, returns `video_id`, `title`, `embed_url`.
- POST `/api/query/video`: handles Q&A.
  - is_image_query=false → uses transcript context with GPT-3.5.
  - is_image_query=true → extracts frame, sends to GPT-4o.
- POST `/api/query/translate`: starts ElevenLabs dubbing as a background job; returns `job_id`.
- GET `/api/query/translate/{job_id}`: returns job status and (when done) `output_url`.
- GET `/api/translated_videos/{job_id}/{file_name}`: serves final MP4.

Example flow (Q&A core):
```94:151:video_qa/vidya_ai/backend/youtube_backend.py
@app.post("/api/query/video")
async def process_query(query_request: VideoQuery):
    # ...
    video_path = "video.mp4"
    vision_client = OpenAIVisionClient()
    if not os.path.exists(video_path):
        url = f"https://www.youtube.com/watch?v={video_id}"
        video_path = download_video(url)

    transcript = download_transcript(video_id)

    if is_image_query:
        outputfile,frame=grab_youtube_frame(video_path, timestamp)
        frame_path = f"frames/{video_id}_{int(timestamp)}.jpg"
        os.makedirs("frames", exist_ok=True)
        cv2.imwrite(frame_path, frame)
        response = vision_client.ask_with_image(query, frame_path)
    else:
        context = transcript if transcript else f"No transcript available for video {video_id}"
        response = vision_client.ask_text_only(query, context)

    return {"response": response, ...}
```

OpenAI client usage:
```20:34:video_qa/vidya_ai/backend/ml_models.py
def ask_text_only(self, prompt, context=""):
    messages = [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": f"Context: {context}\n\nQuestion: {prompt}"}]
    response = self.client.chat.completions.create(
      model="gpt-3.5-turbo", messages=messages, max_tokens=500, temperature=0
    )
    return response.choices[0].message.content
```

### Frontend: main screens
- `ImprovedYouTubePlayer.jsx`
  - Accepts YouTube URL → POST `/api/youtube/info` → sets up YouTube IFrame player.
  - Chat panel: radio to switch “Ask about video” vs “Ask about current frame”.
  - On submit → POST `/api/query/video` with `video_id`, `query`, `timestamp`, `is_image_query`.
  - Minimal “Translate” button here (see “mismatches” below).
- `TranslatePage.jsx`
  - YouTube URL + target language → POST `/api/query/translate`.
  - Polls GET `/api/query/translate/{job_id}` until done; then plays/serves the dubbed MP4 and offers a download.

Frontend query call:
```295:303:video_qa/vidya_ai/frontend/src/components/ImprovedYouTubePlayer.jsx
const response = await axios.post('http://localhost:8000/api/query/video', {
  video_id: currentVideo.videoId,
  query: userMessage.text,
  timestamp: queryType === 'frame' ? exactCurrentTime : null,
  is_image_query: queryType === 'frame'
});
```

### Data flow (end-to-end)
- Load video
  - Frontend → `/api/youtube/info` with URL.
  - Backend extracts `video_id`, downloads MP4 (to `backend/videos`), fetches transcript, returns info to embed IFrame.
- Ask about video (text)
  - Frontend sends text query → Backend gets transcript → GPT-3.5 answers → Frontend displays chat.
- Ask about current frame (vision)
  - Frontend sends query with `timestamp` → Backend uses OpenCV to grab frame → GPT-4o vision answer → Frontend displays chat.
- Translate video
  - Frontend sends URL + language → Backend downloads video → ElevenLabs dubbing job → poll status → serve dubbed MP4 from `backend/output/{job}/{lang}.mp4`.

### Notable gaps/mismatches to fix
- In `ImprovedYouTubePlayer.jsx`, translation calls `POST /api/translate` (doesn’t exist). Should call `/api/query/translate` or route user to `TranslatePage`.
- In `ImprovedYouTubePlayer.jsx`, it reads `response.data.video_title`, but backend returns `title`. Use `response.data.title`.
- Language values:
  - `TranslatePage` uses ISO codes (`es`, `hi`, `bn`, `as`) correctly.
  - `ImprovedYouTubePlayer` uses names (`spanish`, `assamese`, …). Use codes if you keep this entrypoint.
- ElevenLabs API key:
  - `translate_elevenlabs.py` currently hardcodes `ELEVENLABS_API_KEY = "add your api key"`. Prefer reading from `.env` consistently.

### Requirements and config
- Environment:
  - `OPENAI_API_KEY` required by backend.
  - `ELEVENLABS_API_KEY` required for translation (ensure it’s loaded from `.env`).
- Folders auto-created/used: `backend/videos`, `backend/frames`, `backend/output/{job_id}/...`.

### Run
- Backend: `python backend/youtube_backend.py` → `http://localhost:8000`
- Frontend: `cd frontend && npm run dev` → `http://localhost:5173`

- Minor inefficiency: backend may re-download the video in `/api/query/video` because it checks against a fixed `video.mp4` path. Using the path returned by `/api/youtube/info` or a per-video cache would avoid redundant downloads.

- For robustness: handle transcript unavailability, large video durations, and timeouts when grabbing frames.

- If you want, I can apply the quick fixes (endpoint mismatch, field names, language codes, and ElevenLabs key usage).