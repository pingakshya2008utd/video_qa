from fastapi import APIRouter, HTTPException, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, AsyncGenerator
from openai import OpenAI
from datetime import datetime
import json
import asyncio
from config import settings

# Initialize OpenAI client
client = OpenAI(api_key=settings.openai_api_key)

router = APIRouter(
    prefix="/chat",
    tags=["chat"],
    responses={404: {"description": "Not found"}},
)

# Data models
class Message(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: Optional[datetime] = Field(default_factory=datetime.now)

class ChatRequest(BaseModel):
    messages: List[Message]
    model: str = "gpt-4"
    temperature: float = 0.7
    max_tokens: int = 500
    stream: bool = True

class ChatResponse(BaseModel):
    response: Message
    usage: Optional[dict] = None

async def stream_chat_response(messages: List[dict], model: str, temperature: float, max_tokens: int) -> AsyncGenerator[str, None]:
    print(f"Starting stream with model {model}")
    try:
        print("Creating chat completion stream...")
        stream = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True
        )
        print("Stream created, starting iteration...")

        # Convert the stream iterator to async generator
        for chunk in stream:
            if hasattr(chunk.choices[0].delta, 'content') and chunk.choices[0].delta.content:
                response = chunk.choices[0].delta.content
                #print(f"Yielding: {response.strip()}")
                yield response
                await asyncio.sleep(0)  # Allow other tasks to run

        print("Stream completed successfully")

    except Exception as e:
        print(f"Error in stream: {str(e)}")
        error_response = f"Error: {str(e)}\n"
        print(f"Yielding error: {error_response.strip()}")
        yield error_response

@router.post("/")
async def generate_chat_response(request: ChatRequest = Body(...)):
    try:
        # Format messages for OpenAI API
        formatted_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in request.messages
        ]

        if request.stream:
            # Return streaming response
            return StreamingResponse(
                stream_chat_response(
                    messages=formatted_messages,
                    model=request.model,
                    temperature=request.temperature,
                    max_tokens=request.max_tokens
                ),
                media_type="text/event-stream"
            )
        
        # Non-streaming response
        response = client.chat.completions.create(
            model=request.model,
            messages=formatted_messages,
            temperature=request.temperature,
            max_tokens=request.max_tokens,
        )
        
        # Extract the response
        assistant_message = response.choices[0].message.content
        
        # Create a new Message object for the response
        response_message = Message(
            role="assistant",
            content=assistant_message,
            timestamp=datetime.now()
        )
        
        return ChatResponse(
            response=response_message,
            usage={
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
