# Football Video Analysis

AI-powered football match video analysis using Google Gemini Vision API. Extract frames from videos, analyze them with AI, and view detailed match insights in a dynamic table.

## Features

- Upload up to 6 videos (max 100MB each)
- Automatic video cropping (processes first 10s by default)
- Frame extraction at configurable intervals (default: 1s)
- AI-powered analysis with Gemini 2.5 Flash
- Real-time player detection, ball tracking, and event identification
- Tactical insights and team formation analysis
- Sortable, filterable results table with CSV export

## Tech Stack

**Frontend:**
- React + TypeScript + Vite
- shadcn/ui + Tailwind CSS
- TanStack Table

**Backend:**
- FastAPI (Python)
- OpenCV (video processing)
- Google Gemini Vision API
- `uv` for package management

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- `uv` package manager
- Google Cloud service account key (for Vertex AI) OR Google Gemini API key

### Backend Setup

1. Install `uv`:
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

2. Navigate to backend:
```powershell
cd backend
```

3. Install dependencies:
```powershell
uv sync
```

4. Configure authentication (choose one method):

   **Option A: Vertex AI with Service Account (Recommended)**
   - Service account key is already in `backend/google-cloud-key/`
   - Create `.env` file:
     ```env
     AUTH_METHOD=vertex_ai
     MODEL_NAME=gemini-2.5-flash
     ```
   - Benefits: No rate limits, more reliable, production-ready

   **Option B: API Key Authentication**
   - Create `.env` file:
     ```env
     AUTH_METHOD=api_key
     GEMINI_API_KEY=your_gemini_api_key_here
     MODEL_NAME=gemini-2.5-flash
     ```
   - Benefits: Simpler setup for development

5. Run server:
```powershell
uv run python run.py
```

Server runs on `http://localhost:8000`

### Frontend Setup

1. Navigate to frontend:
```powershell
cd frontend
```

2. Install dependencies:
```powershell
npm install
```

3. Configure API URL (Optional):
   - Default: `http://localhost:8000`
   - To customize, create `.env` file with: `VITE_API_URL=http://localhost:8000`

4. Run dev server:
```powershell
npm run dev
```

App runs on `http://localhost:5173`

## Configuration

### Backend Configuration

**Authentication Method** (set in `backend/.env`):
- `AUTH_METHOD=vertex_ai` (default, recommended): Uses service account key
- `AUTH_METHOD=api_key`: Uses Gemini API key

**Model Selection**:
- `MODEL_NAME=gemini-2.5-flash` (default)
- Other options: `gemini-1.5-pro`, `gemini-1.5-flash`, `gemini-2.0-flash-exp`

**Video Processing**:
- **Frame Interval**: Extract one frame every N seconds (default: 1s)
- **Max Duration**: Process first N seconds of video (default: 10s)
  - Videos longer than this are automatically cropped

## Code Quality

### Backend

Install dev dependencies:
```powershell
cd backend
uv sync --extra dev
```

Format code with Black:
```powershell
uv run black app/
```

Lint code with Ruff:
```powershell
uv run ruff check app/          # Check for issues
uv run ruff check --fix app/    # Auto-fix issues
```

Run both tools:
```powershell
uv run black app/ && uv run ruff check --fix app/
```

## API Endpoints

- `POST /api/analyze` - Upload videos and get analysis results
- `GET /api/health` - Health check

## Project Structure

```
football-analysis/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI routes
│   │   ├── video_processor.py
│   │   ├── gemini_analyzer.py
│   │   ├── models.py
│   │   └── logger.py
│   ├── google-cloud-key/     # Service account key
│   ├── pyproject.toml
│   └── run.py
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── lib/
    │   └── App.tsx
    └── package.json
```

## Notes

- No database: all processing is in-memory
- Videos are processed synchronously
- Results are returned directly (no session polling)
- Automatic cropping for videos longer than max_duration
