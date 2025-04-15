import asyncio
import aiohttp
import json
from datetime import datetime

async def test_chat_stream():
    url = 'http://localhost:8000/chat'
    
    # Test message
    payload = {
        "messages": [
            {
                "role": "user",
                "content": "Write a short story about a robot learning to paint",
                "timestamp": datetime.now().isoformat()
            }
        ],
        "model": "gpt-4",
        "temperature": 0.7,
        "max_tokens": 500,
        "stream": True
    }
    
    print(f"Connecting to {url}...")
    try:
        async with aiohttp.ClientSession() as session:
            print("Sending request...")
            async with session.post(url, json=payload) as response:
                print(f"Response status: {response.status}")
                if response.status != 200:
                    error_text = await response.text()
                    print(f"Error response: {error_text}")
                    return
                
                print("Connected to stream. Receiving tokens:\n")
                async for line in response.content:
                    if line:
                        try:
                            text = line.decode('utf-8')
                            if text.startswith('Error:'):
                                print(text, end='')
                            else:
                                print(text, end='', flush=True)
                        except Exception as e:
                            print(f"\nError processing response: {e}")
                print("\n\nStream completed.")
    except aiohttp.ClientError as e:
        print(f"Connection error: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")
