class VideoApp {
    constructor() {
        this.socket = io();
        this.videoPlayer = document.getElementById('videoPlayer');
        this.debugDiv = document.getElementById('debugInfo');
        this.statusDiv = document.getElementById('status');
        this.setupEventListeners();
        this.initializeSocketEvents();
    }

    setupEventListeners() {
        // Load video button
        document.getElementById('loadButton').addEventListener('click', () => this.submitUrl());

        // QA button
        document.getElementById('qaButton').addEventListener('click', () => this.startQA());

        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.key === 'p') this.startQA();
        });
    }

    initializeSocketEvents() {
        // Speech events
        this.socket.on('listening_start', () => {
            this.updateStatus('Listening for your question...');
        });

        this.socket.on('speech_progress', (data) => {
            this.updateStatus(`Speaking: ${data.sentence}`);
        });

        this.socket.on('speech_completed', () => {
            this.updateStatus('Speech completed');
        });

        this.socket.on('speech_stopped', () => {
            this.updateStatus('Speech stopped');
        });

        // QA events
        this.socket.on('qa_result', (data) => {
            this.addDebugMessage(`QA Result: ${JSON.stringify(data)}`);
            if (data.continue) {
                this.videoPlayer.play();
                this.updateStatus('Video resumed');
            }
        });

        this.socket.on('qa_error', (data) => {
            this.updateStatus(`Error: ${data.error}`, 'error');
        });

        this.socket.on('processing_question', (data) => {
            this.updateStatus(`Processing question: ${data.question}`);
        });

        this.socket.on('answer_ready', (data) => {
            this.updateStatus(`Answer: ${data.answer}`);
        });
    }

    async submitUrl() {
        const url = document.getElementById('youtubeUrl').value;
        this.updateStatus('Processing URL...');

        try {
            const response = await fetch('/process_url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `url=${encodeURIComponent(url)}`
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.videoPlayer.src = data.video_url;
                document.getElementById('videoControls').style.display = 'block';
                this.updateStatus('Video loaded successfully');
            } else {
                this.updateStatus(`Error: ${data.message}`, 'error');
            }
        } catch (error) {
            this.updateStatus(`Error: ${error.message}`, 'error');
        }
    }

    startQA() {
        this.videoPlayer.pause();
        this.updateStatus('Starting Q&A session...');
        this.socket.emit('start_qa');
    }

    updateStatus(message, type = 'info') {
        this.statusDiv.textContent = message;
        this.statusDiv.className = `status-box ${type}`;
        this.addDebugMessage(message);
    }

    addDebugMessage(message) {
        const timestamp = new Date().toLocaleTimeString();
        const messageDiv = document.createElement('div');
        messageDiv.textContent = `[${timestamp}] ${message}`;
        this.debugDiv.appendChild(messageDiv);
        this.debugDiv.scrollTop = this.debugDiv.scrollHeight;
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VideoApp();
});