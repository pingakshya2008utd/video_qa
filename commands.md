# Regular request
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "Who are you?",
        "timestamp": "2025-04-15T08:48:36-07:00"
      }
    ],
    "model": "gpt-4",
    "temperature": 0.7,
    "max_tokens": 500
  }'

# Streaming request
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