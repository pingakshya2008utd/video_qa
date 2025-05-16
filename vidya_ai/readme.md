vidya_ai
vidya_ai is a full-stack application for asking and answering questions about YouTube videos using AI.
It includes both a Python backend (for API, ML, and YouTube utilities) and a modern React frontend (using Vite and Tailwind CSS).

Directory Structure
Code
vidya_ai/
├── backend/        # Python backend (API, ML, YouTube helpers)
├── frontend/       # React frontend (JSX, CSS, configs, assets)
├── tailwind.html   # Standalone Tailwind CSS HTML demo/template
Backend: Python API
Location: vidya_ai/backend

Main Files
ml_models.py – AI/ML logic for answering questions
youtube_backend.py – API endpoints and orchestration
youtube_utils.py – Helpers for YouTube data
How to Run
Open a terminal and go to the backend folder:

bash
cd vidya_ai/backend
(Optional) Create a virtual environment:

bash
python -m venv venv
Windows: venv\Scripts\activate
Mac/Linux: source venv/bin/activate
Install Python packages:

bash
pip install -r requirements.txt
Start the server:

bash
python youtube_backend.py
or (for FastAPI apps):

bash
uvicorn youtube_backend:app --reload
The API will be running at http://localhost:5000 or http://127.0.0.1:8000.

Frontend: React App
Location: vidya_ai/frontend

Main Files & Folders
index.html – Entry HTML file
src/ – Main app source (JSX, CSS)
public/ – Static assets (images, icons)
package.json – Node.js dependencies
vite.config.js, tailwind.config.js – Build and styling configs
How to Run
Open a terminal and go to the frontend folder:

bash
cd vidya_ai/frontend
Install Node.js dependencies:

bash
npm install
Start the development server:

bash
npm run dev
Open your browser at the address shown in your terminal (usually http://localhost:5173).

Example requirements.txt (Backend)
If missing, create vidya_ai/backend/requirements.txt with:

Code
fastapi
uvicorn
requests
openai
(Or adjust for Flask or other frameworks as needed!)

Useful Tips
Make sure your backend is running before using the frontend for full functionality.
If you see a "module not found" error, double-check your installations.
Ports can be changed in config files if needed.
If the frontend can't connect to the backend, ensure both are running and check network settings.
License
See the main repository for license information.

Questions or issues?
Open an issue in the main repository or ask the maintainer for help!

You can now copy and paste this into a new README.md file in your vidya_ai directory.
