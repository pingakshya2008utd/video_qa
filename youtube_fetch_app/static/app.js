class VideoApp {
    constructor() {
        this.socket = io();
        this.videoPlayer = document.getElementById('videoPlayer');
        this.debugDiv = document.getElementById('debugInfo');
        this.statusDiv = document.getElementById('status');
        this.audioPlayer = new Audio();
        this.isPlaying = false;
        this.audioQueue = [];  // Queue to store pending audio chu
        this.setupSocketListeners();
        this.setupEventListeners();
        this.initializeSocketEvents();
        this.setupSpeechRecognition();
        this.recognition = null;
        this.isListening = false;
    }

    setupSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window)) {
            console.error('Speech recognition not supported');
            return;
        }
    
        this.recognition = new webkitSpeechRecognition();
        this.recognition.continuous = false;  // Changed to false
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;
    
        this.recognition.onstart = () => {
            console.log('Speech recognition started');
            this.updateStatus('Listening for your question...');
        };
    
        this.recognition.onresult = (event) => {
            const text = event.results[0][0].transcript.toLowerCase();
            console.log('Recognized:', text);
    
            // Check for the stop command
            if (text.includes('you are awesome')) {
                this.stopAudio();
                this.audioQueue = [];
                this.updateStatus('Speech interrupted by voice command');
            } else {
                this.socket.emit('submit_question', { question: text });
                this.updateStatus(`Question asked: ${text}`);
                this.isListening = false;  // Stop listening after question is asked
            }
        };
    
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error !== 'no-speech') {
                this.updateStatus('Please try speaking again...');
            }
            // Don't automatically restart on error
            setTimeout(() => {
                if (this.isListening) {
                    this.startRecognition();
                }
            }, 1000);  // Wait 1 second before retrying
        };
    
        this.recognition.onend = () => {
            console.log('Speech recognition ended');
            if (this.isListening) {
                setTimeout(() => {
                    this.startRecognition();
                }, 500);  // Small delay before restarting
            }
        };
    }

    startRecognition() {
        try {
            this.recognition.start();
            console.log('Started new recognition session');
        } catch (error) {
            console.error('Error starting recognition:', error);
        }
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

    
    startQA() {
        if (this.videoPlayer) {
            console.log("Pausing video...");
            this.videoPlayer.pause();
        }

        if (!this.recognition) {
            this.setupSpeechRecognition();
        }

        this.recognition.stop();
        // Update UI and console
        const message = "Please ask your question";
        console.log(message);
        this.updateStatus(message);
        
        // Start listening
        this.isListening = true;
        setTimeout(() => {
            this.startRecognition();
        }, 500);
        
        // Notify server
        this.socket.emit('start_qa');

         // Double check video pause
        setTimeout(() => {
            if (!this.videoPlayer.paused) {
                console.log("Forcing video pause");
                this.videoPlayer.pause();
            }
        }, 100);
    }


    setupSocketListeners() {
        this.socket.on('play_speech', data => {
            // Add the new audio to queue
            this.audioQueue.push({
                audio: data.audio,
                sentence: data.sentence
            });
            
            // If not currently playing, start playing
            if (!this.isPlaying) {
                this.playNextInQueue();
            }
        });

        this.socket.on('speech_interrupted', () => {
            this.stopAudio();
            this.audioQueue = [];  // Clear the queue
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

        this.socket.on('connect', () => {
            console.log('Connected to server with ID:', this.socket.id);
        });
    
        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });

        this.socket.on('qa_mode_active', () => {
            this.updateStatus('Q&A mode active. Please ask your question.');
            document.getElementById('qaButton').disabled = true;
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
        this.socket.on('answer_ready', (data) => {
            this.updateStatus(`Answer: ${data.answer}`);
            // Convert answer to speech if needed
            const utterance = new SpeechSynthesisUtterance(data.answer);
            window.speechSynthesis.speak(utterance);
        });

        this.socket.on('qa_timeout', () => {
            this.isListening = false;
            this.updateStatus('No question received. Press P to try again.');
        });

        this.socket.on('qa_exit', () => {
            this.isListening = false;
            this.videoPlayer.play();
            this.updateStatus('Exiting Q&A mode');
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


    updateStatus(message, type = 'info') {
        this.statusDiv.textContent = message;
        this.statusDiv.className = `status-box ${type}`;
        this.addDebugMessage(message);
        console.log(`Status: ${message}`);
    }

    addDebugMessage(message) {
        const timestamp = new Date().toLocaleTimeString();
        const messageDiv = document.createElement('div');
        messageDiv.textContent = `[${timestamp}] ${message}`;
        this.debugDiv.appendChild(messageDiv);
        this.debugDiv.scrollTop = this.debugDiv.scrollHeight;
    }

    async playNextInQueue() {
        if (this.audioQueue.length === 0) {
            this.isPlaying = false;
            return;
        }

        this.isPlaying = true;
        const { audio: base64Audio, sentence } = this.audioQueue.shift();

        try {
            // Convert base64 to blob
            const audioData = atob(base64Audio);
            const arrayBuffer = new ArrayBuffer(audioData.length);
            const uint8Array = new Uint8Array(arrayBuffer);
            
            for (let i = 0; i < audioData.length; i++) {
                uint8Array[i] = audioData.charCodeAt(i);
            }
            
            const audioBlob = new Blob([uint8Array], { type: 'audio/mp3' });
            const audioUrl = URL.createObjectURL(audioBlob);

            // Clean up previous audio if any
            if (this.audioPlayer.src) {
                URL.revokeObjectURL(this.audioPlayer.src);
            }

            this.audioPlayer.src = audioUrl;

            // Wait for audio to finish playing before moving to next
            await new Promise((resolve, reject) => {
                this.audioPlayer.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    resolve();
                };
                
                this.audioPlayer.onerror = (error) => {
                    console.error('Audio playback error:', error);
                    reject(error);
                };
                
                // Update UI with current sentence
                document.getElementById('currentSentence').textContent = sentence;
                
                // Play the audio
                this.audioPlayer.play();
            });

            // Play next in queue
            await this.playNextInQueue();

        } catch (error) {
            console.error('Error playing audio:', error);
            this.isPlaying = false;
            this.socket.emit('audio_error', { error: 'Playback error' });
        }
    }

    playAudioData(base64Audio, sentence) {
        // Convert base64 to blob
        const audioData = atob(base64Audio);
        const arrayBuffer = new ArrayBuffer(audioData.length);
        const uint8Array = new Uint8Array(arrayBuffer);
        
        for (let i = 0; i < audioData.length; i++) {
            uint8Array[i] = audioData.charCodeAt(i);
        }
        
        const audioBlob = new Blob([uint8Array], { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Clean up previous audio if any
        if (this.audioPlayer.src) {
            URL.revokeObjectURL(this.audioPlayer.src);
        }
        
        this.audioPlayer.src = audioUrl;
        this.audioPlayer.onended = () => {
            URL.revokeObjectURL(audioUrl);
            this.isPlaying = false;
            this.socket.emit('audio_finished');
        };
        
        this.audioPlayer.onerror = (error) => {
            console.error('Audio playback error:', error);
            this.socket.emit('audio_error', { error: 'Playback error' });
        };
        
        this.isPlaying = true;
        this.audioPlayer.play();
        
        // Update UI with current sentence
        document.getElementById('currentSentence').textContent = sentence;
    }

    stopAudio() {
        if (this.isPlaying) {
            this.audioPlayer.pause();
            this.audioPlayer.currentTime = 0;
            this.isPlaying = false;
            if (this.audioPlayer.src) {
                URL.revokeObjectURL(this.audioPlayer.src);
                this.audioPlayer.src = '';
            }
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VideoApp();
});