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
- Google Gemini API key

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

4. Create `.env` file:
```
GEMINI_API_KEY=your_api_key_here
```

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

3. Create `.env` file:
```
VITE_API_URL=http://localhost:8000
```

4. Run dev server:
```powershell
npm run dev
```

App runs on `http://localhost:5173`

## Configuration

- **Frame Interval**: Extract one frame every N seconds (default: 1s)
- **Max Duration**: Process first N seconds of video (default: 10s)
  - Videos longer than this are automatically cropped

## Code Quality

Install dev dependencies:
```powershell
uv sync --extra dev
```

Format code:
```powershell
uv run black app/
```

Lint code:
```powershell
uv run ruff check app/
uv run ruff check --fix app/
```

## API Endpoints

- `POST /api/analyze` - Upload videos and get analysis results
- `GET /api/health` - Health check

## Project Structure

```
frame/
├── backend/
│   ├── app/
│   │   ├── main.py           # FastAPI routes
│   │   ├── video_processor.py
│   │   ├── gemini_analyzer.py
│   │   ├── models.py
│   │   └── logger.py
│   ├── pyproject.toml
│   └── .env
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── lib/
    │   └── App.tsx
    └── .env
```

## Notes

- No database: all processing is in-memory
- Videos are processed synchronously
- Results are returned directly (no session polling)
- Automatic cropping for videos longer than max_duration
