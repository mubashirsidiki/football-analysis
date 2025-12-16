
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app.gemini_analyzer import analyze_frames_batch, QuotaExhaustedError, ServiceUnavailableError
from app.logger import get_logger
from app.models import (
    AnalysisConfig,
    AnalysisResponse,
    FrameAnalysis,
    transform_gemini_response,
)
from app.video_processor import extract_frames

load_dotenv()

logger = get_logger("main")

app = FastAPI(title="Football Video Analysis API")

logger.info("🚀 Starting Football Video Analysis API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    logger.info("📡 Root endpoint accessed")
    return {"message": "Football Video Analysis API"}


@app.get("/api/health")
async def health():
    logger.debug("💚 Health check endpoint accessed")
    return {"status": "healthy"}


async def process_videos(video_data: list[tuple], config: AnalysisConfig) -> tuple[list[FrameAnalysis], bool]:
    """Process videos and analyze frames. Returns list of FrameAnalysis."""
    logger.info(
        f"⚙️  Configuration: frame_interval={config.frame_interval}s, max_duration={config.max_duration}s"
    )
    logger.info(f"📹 Processing {len(video_data)} video(s)")

    all_frames_data = []
    total_frames = 0
    quota_exhausted = False

    try:
        logger.info("📥 Step 1: Extracting frames from videos...")

        # Step 1: Extract frames from all videos
        for video_idx, (filename, video_bytes) in enumerate(video_data):
            try:
                logger.info(f"📹 Processing video {video_idx + 1}/{len(video_data)}: {filename}")
                logger.debug(
                    f"📊 Video {video_idx + 1} size: {len(video_bytes) / 1024 / 1024:.2f} MB"
                )

                # Extract frames with configured interval
                frames = extract_frames(
                    video_bytes,
                    fps_interval=config.frame_interval,
                    max_duration=config.max_duration,
                )
                all_frames_data.extend(frames)
                total_frames += len(frames)

                logger.info(f"✅ Video {video_idx + 1}: Extracted {len(frames)} frames")
            except ValueError as e:
                # Video validation error (e.g., too long)
                logger.error(f"❌ Video {video_idx + 1} validation error: {str(e)}")
                continue
            except Exception as e:
                logger.error(
                    f"❌ Error extracting frames from video {video_idx + 1}: {str(e)}",
                    exc_info=True,
                )
                continue

        if total_frames == 0:
            logger.error("❌ No frames extracted from any video")
            raise ValueError("No frames extracted from videos")

        logger.info(f"📊 Total frames extracted: {total_frames}")
        logger.info("🤖 Step 2: Analyzing frames with Gemini AI...")

        # Step 2: Analyze frames with Gemini
        try:
            gemini_results = await analyze_frames_batch(all_frames_data, None)
        except ServiceUnavailableError as e:
            logger.error(f"❌ {str(e)}")
            raise RuntimeError(str(e))
        # Note: QuotaExhaustedError is now handled by returning partial results

        # Check if quota was exhausted (indicated by default responses with quota error messages)
        quota_exhausted = any(
            "quota" in result.get("tactical_notes", "").lower() 
            and "exhausted" in result.get("tactical_notes", "").lower()
            for result in gemini_results
        )
        
        if quota_exhausted:
            successful_frames = sum(
                1 for result in gemini_results 
                if "quota" not in result.get("tactical_notes", "").lower()
            )
            logger.warning(
                f"⚠️  Quota exhausted: {successful_frames}/{len(gemini_results)} frames successfully analyzed"
            )

        logger.info(f"✅ Step 2 complete: Analyzed {len(gemini_results)} frames")
        logger.info("🔄 Step 3: Transforming results...")

        # Step 3: Transform results to FrameAnalysis
        frame_analyses = []
        for gemini_result in gemini_results:
            frame_analysis = transform_gemini_response(gemini_result)
            frame_analyses.append(frame_analysis)

        logger.info(f"✅ Step 3 complete: Transformed {len(frame_analyses)} frame analyses")
        logger.info(f"✨ Analysis complete: {len(frame_analyses)} frames analyzed")

        return frame_analyses, quota_exhausted

    except Exception as e:
        logger.error(f"❌ Analysis failed: {str(e)}", exc_info=True)
        raise


@app.post("/api/analyze")
async def analyze_videos(
    videos: list[UploadFile] = File(...),
    frame_interval: float = Form(1.0),
    max_duration: float = Form(10.0),
):
    """Analyze uploaded videos. Max 6 videos, each up to max_duration seconds."""
    try:
        logger.info(f"📥 Received analysis request: {len(videos)} video(s)")
        logger.info(
            f"⚙️  Request config: frame_interval={frame_interval}s, max_duration={max_duration}s"
        )

        if len(videos) > 6:
            logger.warning(f"❌ Too many videos: {len(videos)} (max 6)")
            raise HTTPException(status_code=400, detail="Maximum 6 videos allowed")

        if len(videos) == 0:
            logger.warning("❌ No videos provided")
            raise HTTPException(status_code=400, detail="At least one video is required")

        # Validate configuration
        if not isinstance(frame_interval, (int, float)) or frame_interval <= 0:
            logger.warning(f"❌ Invalid frame_interval: {frame_interval}")
            raise HTTPException(
                status_code=400,
                detail=f"frame_interval must be a positive number, got {frame_interval}",
            )

        if frame_interval > 10:
            logger.warning(f"❌ Frame interval too large: {frame_interval}")
            raise HTTPException(status_code=400, detail="frame_interval cannot exceed 10 seconds")

        if not isinstance(max_duration, (int, float)) or max_duration <= 0:
            logger.warning(f"❌ Invalid max_duration: {max_duration}")
            raise HTTPException(
                status_code=400,
                detail=f"max_duration must be a positive number, got {max_duration}",
            )

        if max_duration > 60:
            logger.warning(f"❌ Max duration too large: {max_duration}")
            raise HTTPException(status_code=400, detail="max_duration cannot exceed 60 seconds")

        config = AnalysisConfig(frame_interval=frame_interval, max_duration=max_duration)

        # Read all video files into memory before starting background task
        video_data = []
        for idx, video in enumerate(videos):
            try:
                if not video.filename:
                    logger.warning(f"⚠️  Video {idx + 1} has no filename")
                    video.filename = f"video_{idx + 1}.mp4"

                # Read the file content into memory
                try:
                    content = await video.read()
                except Exception as e:
                    logger.error(f"❌ Failed to read video {video.filename}: {str(e)}")
                    raise HTTPException(
                        status_code=400, detail=f"Failed to read video {video.filename}: {str(e)}"
                    )

                if not content or len(content) == 0:
                    logger.warning(f"❌ Video {video.filename} is empty")
                    raise HTTPException(status_code=400, detail=f"Video {video.filename} is empty")

                file_size_mb = len(content) / 1024 / 1024
                logger.debug(f"📊 Video {video.filename}: {file_size_mb:.2f} MB")

                if len(content) > 100 * 1024 * 1024:  # 100MB limit
                    logger.warning(
                        f"❌ Video {video.filename} too large: {file_size_mb:.2f} MB (max 100MB)"
                    )
                    raise HTTPException(
                        status_code=413,
                        detail=f"Video {video.filename} is too large ({file_size_mb:.1f}MB). Maximum size is 100MB",
                    )

                # Store filename and bytes
                video_data.append((video.filename, content))
                logger.debug(f"✅ Loaded video {video.filename} into memory")

            except HTTPException:
                raise  # Re-raise HTTP exceptions
            except Exception as e:
                logger.error(f"❌ Error processing video {video.filename}: {str(e)}", exc_info=True)
                raise HTTPException(
                    status_code=400, detail=f"Error processing video {video.filename}: {str(e)}"
                )

        if len(video_data) == 0:
            logger.error("❌ No valid videos to process")
            raise HTTPException(status_code=400, detail="No valid videos to process")

        # Process videos and return results directly
        try:
            logger.info("🚀 Starting video analysis...")
            frame_analyses, quota_exhausted = await process_videos(video_data, config)
            logger.info(f"✅ Analysis complete: {len(frame_analyses)} frames analyzed")

            status = "partial" if quota_exhausted else "completed"
            if quota_exhausted:
                logger.warning("⚠️  Returning partial results due to quota exhaustion")

            return AnalysisResponse(
                frames=frame_analyses,
                total_frames=len(frame_analyses),
                status=status,
            )
        except ValueError as e:
            error_msg = str(e)
            logger.error(f"❌ Validation error: {error_msg}")
            # Check if it's a quota error
            if "quota" in error_msg.lower() or "daily limit" in error_msg.lower():
                raise HTTPException(
                    status_code=429,
                    detail=error_msg
                )
            raise HTTPException(status_code=400, detail=error_msg)
        except RuntimeError as e:
            error_msg = str(e)
            logger.error(f"❌ Service error: {error_msg}")
            # Check if it's a service unavailable error
            if "unavailable" in error_msg.lower() or "overloaded" in error_msg.lower():
                raise HTTPException(
                    status_code=503,
                    detail=error_msg
                )
            raise HTTPException(status_code=500, detail=error_msg)
        except Exception as e:
            logger.error(f"❌ Analysis failed: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        logger.error(f"❌ Unexpected error in analyze_videos: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


