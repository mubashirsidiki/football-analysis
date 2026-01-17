# Football Video Analysis - AI Agent Instructions

## Architecture Overview

This is a **full-stack football match analysis tool** with a React/TypeScript frontend and FastAPI Python backend. The system extracts video frames at configurable intervals, analyzes them using Google Gemini Vision API (via Vertex AI or API key), and presents tactical insights in a sortable table.

**Key Components:**
- **Backend** ([backend/app/](backend/app/)): FastAPI server handling video processing and AI analysis
- **Frontend** ([frontend/src/](frontend/src/)): React + TypeScript + Vite + shadcn/ui + TanStack Table
- **Video Processing**: OpenCV-based frame extraction with timestamp overlays
- **AI Analysis**: Gemini 2.5 Flash for frame-by-frame tactical analysis

**Data Flow:**
1. User uploads videos (max 6, 100MB each) → Frontend FormData
2. Backend extracts frames at configurable intervals (default: 1s, max: 10s)
3. Frames batched and sent to Gemini for structured analysis
4. Results transformed to `FrameAnalysis` models and returned to frontend
5. Frontend displays sortable/filterable table with tactical insights

## Critical Patterns & Conventions

### Backend Architecture

**Authentication**: Dual authentication system in [gemini_analyzer.py](backend/app/gemini_analyzer.py)
```python
# Environment-driven auth method (default: vertex_ai)
AUTH_METHOD = os.getenv("AUTH_METHOD", "vertex_ai")  # or "api_key"
```
- **vertex_ai**: Service account credentials from `backend/google-cloud-key/*.json` (production-ready, no rate limits)
- **api_key**: Simple API key auth via `GEMINI_API_KEY` env var (dev/testing, 20 RPM limit)

**SDK Flexibility**: Code supports both old (`google-generativeai`) and new (`google-genai`) SDKs
```python
try:
    from google import genai  # New SDK
    USE_NEW_SDK = True
except ImportError:
    from google import generativeai as genai  # Old SDK fallback
```

**Structured Output Validation**: Uses Pydantic models ([models.py](backend/app/models.py)) with strict validation
- Gemini returns structured JSON matching `GeminiStructuredResponse` schema
- Custom validators normalize team names, scan quality, risk levels, etc.
- Example: `team` field normalizes "TEAM A", "Team 1", "1" → "A"

**Error Handling**: Three-tier error strategy
1. `QuotaExhaustedError`: API quota exceeded → return partial results with warning
2. `ServiceUnavailableError`: 503 errors → fail fast with clear message
3. Validation errors: Default fallback values (e.g., "unknown" for missing data)

### Video Processing

**Frame Extraction** ([video_processor.py](backend/app/video_processor.py)):
- Extracts frames at configurable intervals (default: 1s)
- Auto-crops videos exceeding `max_duration` (default: 10s)
- Returns `list[tuple[float, str]]`: `(timestamp, base64_encoded_frame)`

**Timestamp Overlay** ([video_timestamp_overlay.py](backend/app/video_timestamp_overlay.py)):
- Adds HH:MM:SS.mmm overlay to video frames
- Re-encodes video using OpenCV's VideoWriter (H264 codec)
- Separate feature from analysis (accessed via `/api/add-timestamp` endpoint)

### Frontend Architecture

**Component Structure**:
- [App.tsx](frontend/src/App.tsx): Tab-based navigation (Analysis / Timestamp Overlay)
- [VideoUploader.tsx](frontend/src/components/VideoUploader.tsx): Multi-file upload with config
- [AnalysisTable.tsx](frontend/src/components/AnalysisTable.tsx): TanStack Table with sorting/filtering
- [SummaryPanel.tsx](frontend/src/components/SummaryPanel.tsx): Aggregate stats from analysis

**API Communication** ([lib/api.ts](frontend/src/lib/api.ts)):
```typescript
// Environment-driven API URL (defaults work locally)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
```
- `uploadVideos()`: POST to `/api/analyze` with FormData
- `addTimestampOverlay()`: POST to `/api/add-timestamp` with FormData
- Comprehensive error handling with specific messages per status code

**Type Safety**: [types.ts](frontend/src/lib/types.ts) mirrors backend Pydantic models
```typescript
interface FrameAnalysis {
  timestamp: number;
  event: string;
  ball_position: string;
  players_detected: number;
  team_a_shape: string;
  team_b_shape: string;
  tactical_notes: string;
}
```

## Developer Workflows

### Running the Project

**Backend** (from `backend/`):
```powershell
uv run python run.py  # Starts FastAPI on :8000
```

**Frontend** (from `frontend/`):
```powershell
npm run dev  # Starts Vite dev server on :5173
```

**Backend with Auto-reload**:
```powershell
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

### Code Quality

**Backend** (uses Black + Ruff, configured in [pyproject.toml](backend/pyproject.toml)):
```powershell
cd backend
uv run black app/                    # Format
uv run ruff check --fix app/         # Lint + auto-fix
```
- Line length: 100
- Target: Python 3.11+

**Frontend** (ESLint + TypeScript):
```powershell
cd frontend
npm run lint        # ESLint check
npm run build       # Type-check + build
```

### Dependency Management

**Backend**: Uses `uv` (modern Python package manager)
```powershell
uv sync              # Install dependencies from pyproject.toml
uv sync --extra dev  # Install dev dependencies
uv add <package>     # Add new dependency
```

**Frontend**: Standard npm
```powershell
npm install          # Install dependencies
npm install <pkg>    # Add new dependency
```

## Key Configuration Files

- [backend/.env](backend/.env): `AUTH_METHOD`, `MODEL_NAME`, `GEMINI_API_KEY` (not committed)
- [backend/pyproject.toml](backend/pyproject.toml): Python dependencies, Black/Ruff config
- [frontend/.env](frontend/.env): `VITE_API_URL` (optional, defaults to localhost:8000)
- [backend/google-cloud-key/](backend/google-cloud-key/): Service account JSON for Vertex AI

## Critical Implementation Details

### Prompts System

[prompts.py](backend/app/prompts.py) contains comprehensive analysis instructions:
- 245+ line prompt covering player ID, events, scanning metrics, decision intelligence
- Timestamp-specific analysis per frame
- Structured output enforced via Pydantic schema passed to Gemini

### Batch Processing

[gemini_analyzer.py](backend/app/gemini_analyzer.py) batches frames for efficiency:
- Collects all frames from multiple videos
- Single API call per frame (Gemini 2.5 Flash processes images individually)
- Exponential backoff on rate limit errors (429)

### Quota Handling

When Gemini quota exhausted:
1. Returns partial results (successfully analyzed frames)
2. Backend sets `status: "partial"` in response
3. Frontend shows amber warning banner with upgrade guidance

## Common Pitfalls

1. **Service account path**: Must be in `backend/google-cloud-key/` relative to `backend/` directory
2. **Video duration**: Videos auto-cropped to `max_duration` (default: 10s) - NOT an error
3. **Rate limits**: API key auth has 20 RPM limit; use Vertex AI for production
4. **Normalization**: Gemini responses auto-normalized (e.g., "Team A" → "A") - check validators in models.py
5. **Frontend API URL**: Defaults to localhost:8000 - no `.env` file needed for local development

## Testing

No formal test suite currently. When adding tests:
- Backend: Use pytest (add to `pyproject.toml` dev dependencies)
- Frontend: Add React Testing Library + Vitest
- Focus on: Pydantic validators, video processing edge cases, API error handling
