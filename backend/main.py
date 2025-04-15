from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import chat
from config import settings

# Initialize FastAPI app
app = FastAPI(
    title="Chatbot API",
    description="API for chatbot interactions using OpenAI",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(chat.router)

# Endpoint to check API status
@app.get("/")
async def read_root():
    return {"status": "online", "message": "Chatbot API is running"}