# vidya_ai

vidya_ai is a full-stack application for asking and answering questions about YouTube videos using AI.  
It includes both a Python backend (for API, ML, and YouTube utilities) and a modern React frontend (using Vite and Tailwind CSS).

---

## Directory Structure

Directory Structure
Code
vidya_ai/
├── backend/        # Python backend (API, ML, YouTube helpers)
├── frontend/       # React frontend (JSX, CSS, configs, assets)
├── tailwind.html   # Standalone Tailwind CSS HTML demo/template

## Backend: Python API

**Location:** `vidya_ai/backend`

### Main Files
- `ml_models.py` – AI/ML logic for answering questions
- `youtube_backend.py` – API endpoints and orchestration
- `youtube_utils.py` – Helpers for YouTube data

### How to Run

1. Open a terminal and go to the backend folder:
   ```bash
   cd vidya_ai/backend

2. (Optional) Create a virtual environment:
    ```bash
 python -m venv venv
