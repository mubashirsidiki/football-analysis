# Football Analysis Platform

AI-powered football match video analysis. Extract frames, detect players, track ball movement, identify events, and analyze team tactics using Gemini Vision API and OpenRouter multimodal models.

---

## What This Does

1. **Upload** football match videos (up to 6 at once, max 100MB each)
2. **Extract frames** at configurable intervals OR send video directly for multimodal analysis
3. **AI analysis** detects:
   - Players (team A/B, shirt numbers, positions, coordinates)
   - Ball (visibility, position)
   - Events (pass, shot, dribble, tackle, etc.)
   - Tactical context (formations, pressing structures, build-up patterns)
   - Cognitive metrics (scanning quality, decision intelligence, technical execution)
4. **View results** in sortable/filterable table with CSV export

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + TanStack Table |
| Backend | FastAPI (Python) + OpenCV + Pydantic |
| AI (frame analysis) | Google Gemini 2.5 Flash via Vertex AI or API key |
| AI (video analysis) | OpenRouter multimodal (GPT-4o, Gemini 3 Pro, Claude) |
| Package Manager (Py) | uv |
| Package Manager (JS) | npm |

---

## Project Structure

```
football-analysis/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI app, routes, CORS, request handlers
│   │   ├── models.py                  # Pydantic models for validation
│   │   ├── gemini_analyzer.py         # Gemini Vision API integration
│   │   ├── openrouter_analyzer.py     # OpenRouter multimodal API
│   │   ├── video_processor.py         # OpenCV frame extraction
│   │   ├── video_timestamp_overlay.py # Timestamp overlay on video
│   │   ├── prompts.py                 # AI analysis prompts
│   │   ├── logger.py                  # Rich-based logging
│   │   └── utils.py                   # Session management utilities
│   ├── google-cloud-key/              # Service account JSON key
│   ├── pyproject.toml                # Python dependencies (uv)
│   ├── run.py                        # Backend entry point
│   ├── .env                          # Environment variables
│   └── .env.example                  # Example configuration
├── frontend/
│   ├── src/
│   │   ├── App.tsx                   # Main app with tab navigation
│   │   ├── main.tsx                  # React entry point
│   │   ├── index.css                 # Tailwind CSS + custom properties
│   │   ├── components/
│   │   │   ├── VideoUploader.tsx     # Video upload with analysis settings
│   │   │   ├── AnalysisTable.tsx     # Sortable/filterable results table
│   │   │   ├── SummaryPanel.tsx      # Statistics summary cards
│   │   │   ├── VideoTimestampOverlay.tsx  # Timestamp overlay feature
│   │   │   ├── ProgressTracker.tsx   # (Not actively used)
│   │   │   └── ui/                   # shadcn/ui components
│   │   │       ├── button.tsx
│   │   │       ├── card.tsx
│   │   │       ├── progress.tsx
│   │   │       └── table.tsx
│   │   └── lib/
│   │       ├── api.ts                # Backend API client
│   │       ├── types.ts             # TypeScript interfaces
│   │       └── utils.ts
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── .env
│   └── .env.example
├── README.md                         # Quick start guide
├── PROJECT.md                        # This file - comprehensive documentation
└── .gitignore
```

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │VideoUploader │  │SummaryPanel │  │  AnalysisTable   │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│         │                                    │              │
│         └────────────────┬──────────────────┘              │
│                          │                                 │
│                    ┌─────▼─────┐                           │
│                    │  api.ts   │                           │
│                    │uploadVideo│                           │
│                    └─────┬─────┘                           │
└──────────────────────────┼──────────────────────────────────┘
                           │ multipart/form-data
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 BACKEND (FastAPI)                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  POST /api/analyze        POST /api/video/timestamp- │   │
│  │                            overlay                    │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                 │
│              ┌───────────▼───────────┐                     │
│              │   process_videos()   │                     │
│              └───────────┬───────────┘                     │
│       ┌─────────────────┴─────────────────┐                │
│       ▼                                   ▼                │
│  ┌─────────┐                         ┌─────────────┐      │
│  │ Frame   │                         │  Multimodal  │      │
│  │  Mode   │                         │    Mode      │      │
│  └────┬────┘                         └──────┬──────┘      │
│       │                                     │              │
│  ┌────▼────┐                         ┌──────▼──────┐       │
│  │cv2 ext  │                         │ OpenRouter   │       │
│  │ frames  │                         │   API        │       │
│  └────┬────┘                         └──────┬──────┘       │
│       │                                     │              │
│  ┌────▼────┐                         ┌──────▼──────┐       │
│  │ Gemini  │                         │  Transform   │       │
│  │ Vision  │                         │   Response   │       │
│  └─────────┘                         └─────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Two Analysis Modes

| Mode | How It Works | Best For |
|------|-------------|----------|
| **Frame** | Extract frames at intervals (1s default), send each to Gemini Vision API | Detailed per-moment analysis, player detection |
| **Multimodal** | Send entire video to OpenRouter | Temporal patterns, whole-match context |

---

## API Endpoints

### `POST /api/analyze`

Upload videos and get AI analysis.

**Content-Type:** `multipart/form-data`

**Fields:**
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `videos` | File[] | required | Up to 6 video files |
| `frame_interval` | float | 1.0 | Seconds between frame extraction |
| `max_duration` | float | 10.0 | Max video length to process (seconds) |
| `analysis_mode` | string | "frame" | "frame" or "multimodal" |

**Response:**
```json
{
  "frames": [
    {
      "timestamp": 0.0,
      "event": "pass",
      "ball_position": "320, 240",
      "players_detected": 22,
      "team_a_shape": "4-3-3",
      "team_b_shape": "4-4-2",
      "tactical_notes": "Risk: medium | Decision time: 1.2s | Pressing: high block"
    }
  ],
  "total_frames": 10,
  "status": "completed"
}
```

### `POST /api/video/timestamp-overlay`

Add timestamp overlay to video.

**Content-Type:** `multipart/form-data`

**Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `video` | File | Video file |
| `timestamps` | string | JSON array of timestamps |

**Response:** Video file with timestamp overlay

### `GET /api/health`

Health check endpoint.

---

## Data Models

### Backend (Pydantic)

```python
class Player(BaseModel):
    id: str
    team: str  # "A", "B", or "unknown"
    shirt_number: str | None
    position: str
    role: str | None
    coordinates: list[float]

class Ball(BaseModel):
    visible: bool
    coordinates: list[float] | None

class ScanMetrics(BaseModel):
    scan_frequency: str
    scan_quality: str  # "good", "average", "poor", "unknown"
    pre_reception_scans: str
    head_movement_angle: str

class DecisionIntelligence(BaseModel):
    best_option: str
    simple_option: str
    risk_level: str  # "low", "medium", "high"
    decision_time: str
    reaction_time: str

class TechnicalExecution(BaseModel):
    pass_direction: str
    pass_success: str
    dribbling_success: str
    shot_direction: str
    execution_quality: str
    ball_loss_classification: str

class OffBallIntelligence(BaseModel):
    availability_index: str  # "high", "medium", "low"
    progressive_opportunity_index: str
    spatial_awareness: str
    tsx_cognitive_index: str

class FormationAnalysis(BaseModel):
    team_a_formation: str
    team_b_formation: str
    pressing_structure: str
    build_up_patterns: str

class GeminiStructuredResponse(BaseModel):
    timestamp: float
    players: list[Player]
    ball: Ball
    event: str
    tactical_context: str
    scan_metrics: ScanMetrics
    decision_intelligence: DecisionIntelligence
    technical_execution: TechnicalExecution
    off_ball_intelligence: OffBallIntelligence
    tactical_notes: str
    formation_analysis: FormationAnalysis
    performance_insight: str

class FrameAnalysis(BaseModel):
    timestamp: float
    event: str
    ball_position: str
    players_detected: int
    team_a_shape: str
    team_b_shape: str
    tactical_notes: str
```

---

## Configuration

### Backend Environment Variables (`backend/.env`)

```env
# Authentication
AUTH_METHOD=vertex_ai              # or "api_key"
MODEL_NAME=gemini-2.5-flash

# API Key Auth (if AUTH_METHOD=api_key)
GEMINI_API_KEY=your_key_here

# OpenRouter (for multimodal mode)
OPENROUTER_MODEL=google/gemini-3-pro-preview
OPENROUTER_API_KEY=your_openrouter_key_here
```

### Frontend Environment Variables (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000
```

### Authentication Options

| Method | Setup | Benefits |
|--------|-------|----------|
| **Vertex AI** (default) | Service account key in `backend/google-cloud-key/`, `AUTH_METHOD=vertex_ai` | No rate limits, production-ready |
| **API Key** | Set `AUTH_METHOD=api_key` and `GEMINI_API_KEY` | Simpler setup for development |

---

## Running Locally

### Backend

```bash
cd backend
uv sync
uv run python run.py
# Server: http://localhost:8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# App: http://localhost:5173
```

---

## Key Dependencies

### Backend (`backend/pyproject.toml`)

- fastapi>=0.104.0
- uvicorn[standard]
- opencv-python
- pydantic>=2.5.0
- google-generativeai
- httpx
- python-multipart
- rich (logging)
- ruff, black (dev)

### Frontend (`frontend/package.json`)

- react, react-dom
- typescript
- vite
- tailwindcss
- @radix-ui components (shadcn/ui)
- @tanstack/react-table
- lucide-react

---

## Code Quality

### Backend

```bash
cd backend
uv sync --extra dev

# Format
uv run black app/

# Lint
uv run ruff check app/
uv run ruff check --fix app/

# Both
uv run black app/ && uv run ruff check --fix app/
```

---

## Notes

- **No database** - all processing in-memory
- **No sessions** - results returned directly
- **Video limits** - 6 videos max, 100MB per video (frame mode), 50MB (multimodal)
- **Auto-crop** - videos longer than `max_duration` are cropped
- **Sync processing** - videos processed synchronously

---

## File Inventory

| File | Purpose |
|------|---------|
| `backend/app/main.py` | FastAPI app, route handlers, CORS, video processing orchestration |
| `backend/app/gemini_analyzer.py` | Gemini Vision API integration with rate limiting, retry logic |
| `backend/app/openrouter_analyzer.py` | OpenRouter multimodal API for full video analysis |
| `backend/app/video_processor.py` | OpenCV frame extraction, base64 encoding, video validation |
| `backend/app/video_timestamp_overlay.py` | Add timestamp overlay to video using OpenCV |
| `backend/app/prompts.py` | Detailed AI prompts for football analysis |
| `backend/app/models.py` | Pydantic models for validation and transformation |
| `backend/app/logger.py` | Rich-based structured logging |
| `backend/app/utils.py` | Session management utilities |
| `frontend/src/components/VideoUploader.tsx` | Video upload UI with analysis mode selection |
| `frontend/src/components/AnalysisTable.tsx` | Results table with sorting, filtering, CSV export |
| `frontend/src/components/SummaryPanel.tsx` | Summary statistics cards |
| `frontend/src/components/VideoTimestampOverlay.tsx` | Timestamp overlay UI |
| `frontend/src/lib/api.ts` | Backend API client functions |
| `frontend/src/lib/types.ts` | TypeScript interfaces |
| `frontend/src/lib/utils.ts` | Utility functions |