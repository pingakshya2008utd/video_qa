# video_qa
This repository is for asking question and answer to youtube video

## Setup


Create a virtual environment and install dependencies:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

mv .env.example .env

# Update .env with your OpenAI API key
```

Run the FastAPI application:


```bash
./run
```

Testing it:

Two ways to test it 

1) Use curl : 

```bash

curl -X POST http://localhost:8000/chat/ \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  --no-buffer \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Write a short story about a robot learning to paint",
        "timestamp": "2025-04-15T10:07:23-07:00"
      }
    ],
    "model": "gpt-4",
    "temperature": 0.7,
    "max_tokens": 500,
    "stream": true
  }'
```

2) Use test.py

```bash
python test.py
```

3) Use browser : 

```bash
http://localhost:8000/chat
```


