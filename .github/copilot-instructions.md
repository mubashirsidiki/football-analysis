# Football Video Analysis - AI Coding Guidelines

## Architecture Overview
This is a **decoupled web application** for AI-powered football video analysis with a React/TypeScript frontend and FastAPI/Python backend.

**Data Flow**: Videos (100MB max) → Frame Extraction (OpenCV) → Batch AI Analysis (Google Gemini 2.5 Flash) → Structured JSON Response → Interactive Table

**No database**: All processing is in-memory with synchronous request/response cycles.

## Key Structural Patterns

### Backend Architecture (`backend/app/`)
- **Monolithic API**: Single `/api/analyze` endpoint handles full video → analysis pipeline
- **Processing Pipeline**: `main.py` orchestrates → `video_processor.py` → `gemini_analyzer.py` → response transformation
- **Pydantic Models**: Comprehensive structured output validation in `models.py` with team normalization (`A`, `B`, `unknown`)
- **Error Categories**: `QuotaExhaustedError` (daily limits), `ServiceUnavailableError` (503s), validation errors (malformed videos)

### Frontend Architecture (`frontend/src/`)
- **Single Page App**: All state managed in `App.tsx` with component composition
- **TanStack Table**: Advanced sorting/filtering in `AnalysisTable.tsx` with CSV export
- **shadcn/ui Components**: Consistent design system with custom Card/Button patterns
- **Error Boundaries**: Comprehensive error handling with user-friendly messages

## Critical Development Workflows

### Environment Setup
```powershell
# Backend (uses uv package manager)
cd backend && uv sync && uv run python run.py  # Port 8000

# Frontend  
cd frontend && npm install && npm run dev     # Port 5173
```

**Python 3.12+ Compatibility**: Uses `numpy>=1.26.0,<2.0.0` and `opencv-python>=4.9.0` to avoid distutils dependency issues and NumPy 2.x compatibility problems

### Environment Variables
- Backend: `GEMINI_API_KEY` in `.env`
- Frontend: `VITE_API_URL=http://localhost:8000` in `.env`
- Google Cloud: Service account key in `google-cloud-key/` directory

### Code Quality Tools
- **Backend**: `uv run black app/` (formatting), `uv run ruff check --fix app/` (linting)
- **Frontend**: `npm run lint` (ESLint), `npm run build` (TypeScript checking)

## Project-Specific Conventions

### Backend Patterns
- **Rich Logging**: Use structured emojis (`🚀`, `📹`, `❌`) for log categorization
- **Input Validation**: Comprehensive validation in video processing (file size, duration limits, format checks)
- **SDK Flexibility**: Dual SDK support pattern - try new `google-genai`, fallback to legacy `google-generativeai`
- **Configuration Objects**: `AnalysisConfig` class for frame_interval/max_duration settings

### Frontend Patterns
- **Compound Components**: VideoUploader + AnalysisTable + SummaryPanel composition
- **State Lifting**: All analysis state lives in App.tsx, props drilled to components
- **TypeScript Strict**: All API responses typed with `FrameAnalysis` and `AnalysisResponse` interfaces
- **Progressive Enhancement**: Upload → Progress → Results → Export workflow

## Integration Points

### Google Gemini API
- **Batch Processing**: Process all frames in single API call for efficiency
- **Structured Output**: Force JSON schema validation using Pydantic models
- **Prompt Engineering**: Frame-by-frame analysis with tactical/cognitive metrics in `prompts.py`
- **Rate Limiting**: Handle quota exhaustion gracefully with user messaging

### Video Processing
- **OpenCV Pipeline**: Automatic cropping to `max_duration`, frame extraction at `fps_interval`
- **Base64 Encoding**: All frames converted to base64 for Gemini Vision API compatibility
- **Memory Management**: Process videos sequentially to prevent memory issues
- **Timestamp Overlay**: Optional timestamp watermarking for frame correlation

### File Upload & Processing
- **MultiPart Forms**: FastAPI file upload with additional config parameters
- **Client Validation**: File size/type validation before upload + server-side re-validation
- **Progress Tracking**: Real-time upload progress with percentage indicators

## Key Files to Reference
- [`backend/app/main.py`](backend/app/main.py): Main processing pipeline and endpoint definition
- [`backend/app/models.py`](backend/app/models.py): Pydantic schemas with normalization logic
- [`backend/app/gemini_analyzer.py`](backend/app/gemini_analyzer.py): AI analysis orchestration and error handling
- [`frontend/src/App.tsx`](frontend/src/App.tsx): State management and component orchestration
- [`frontend/src/lib/api.ts`](frontend/src/lib/api.ts): Type-safe API client with error handling

## Testing & Debugging
- **Backend Logs**: Rich console output with emoji categorization for easy scanning
- **API Testing**: Use `/api/health` endpoint for connectivity verification
- **Video Debugging**: Check OpenCV video reading success before processing
- **Frontend DevTools**: React DevTools for state inspection, Network tab for API debugging