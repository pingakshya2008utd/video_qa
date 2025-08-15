#!/bin/bash
# essential_setup.sh - Everything needed to run FastAPI app

echo "🚀 Setting up YouTube FastAPI App..."

# Update system and install essentials
apt update && apt upgrade -y
apt install -y python3 python3-pip python3-venv ffmpeg

# Create app directory
mkdir -p /opt/youtube-app
cd /opt/youtube-app

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python packages
pip install fastapi uvicorn yt-dlp opencv-python youtube-transcript-api requests httpx openai python-multipart

# Create directories
mkdir -p videos frames output

# Create environment file
cat > .env << 'EOF'
OPENAI_API_KEY=''
RAPIDAPI_KEY=''
EOF

# Create start script
cat > start.sh << 'EOF'
#!/bin/bash
cd /opt/youtube-app
source venv/bin/activate
uvicorn youtube_backend:app --host 0.0.0.0 --port 8000
EOF

chmod +x start.sh

echo "✅ Setup complete!"
echo "📝 Next steps:"
echo "1. Upload your Python files (youtube_backend.py, youtube_utils.py, ml_models.py)"
echo "2. Edit .env file: nano .env (add your OpenAI API key)"
echo "3. Start app: ./start.sh"
