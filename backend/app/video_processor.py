import base64
import os
import tempfile
from io import BytesIO

import cv2
import numpy as np
from PIL import Image

from app.logger import get_logger

logger = get_logger("video_processor")


def extract_frames(
    video_bytes: bytes, fps_interval: float = 1.0, max_duration: float = 10.0
) -> list[tuple[float, str]]:
    """
    Extract frames from video at specified intervals.

    Args:
        video_bytes: Video file as bytes
        fps_interval: Extract one frame every N seconds (default: 2.0)
        max_duration: Maximum video duration in seconds (default: 15.0)

    Returns:
        List of tuples: (timestamp, base64_encoded_frame)

    Raises:
        ValueError: If input validation fails
        RuntimeError: If video processing fails
    """
    # Input validation
    if not video_bytes or len(video_bytes) == 0:
        logger.error("❌ Empty video bytes provided")
        raise ValueError("Video bytes cannot be empty")

    if fps_interval <= 0:
        logger.error(f"❌ Invalid fps_interval: {fps_interval}")
        raise ValueError(f"fps_interval must be greater than 0, got {fps_interval}")

    if max_duration <= 0:
        logger.error(f"❌ Invalid max_duration: {max_duration}")
        raise ValueError(f"max_duration must be greater than 0, got {max_duration}")

    if len(video_bytes) > 100 * 1024 * 1024:  # 100MB
        logger.error(f"❌ Video too large: {len(video_bytes) / 1024 / 1024:.2f} MB")
        raise ValueError(
            f"Video file too large: {len(video_bytes) / 1024 / 1024:.2f} MB (max 100MB)"
        )

    logger.info(
        f"🎬 Starting frame extraction | Interval: {fps_interval}s | Max duration: {max_duration}s"
    )
    logger.debug(f"Video size: {len(video_bytes) / 1024 / 1024:.2f} MB")

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp_file:
            tmp_file.write(video_bytes)
            tmp_path = tmp_file.name

        logger.debug(f"📁 Created temporary video file: {tmp_path}")

        if not os.path.exists(tmp_path):
            raise RuntimeError("Failed to create temporary video file")

    except Exception as e:
        logger.error(f"❌ Failed to create temporary file: {str(e)}", exc_info=True)
        raise RuntimeError(f"Failed to create temporary video file: {str(e)}")

    video = None
    try:
        video = cv2.VideoCapture(tmp_path)

        if not video.isOpened():
            logger.error("❌ Failed to open video file")
            raise ValueError(
                "Could not open video file. The file may be corrupted or in an unsupported format."
            )

        # Get video properties with error handling
        try:
            fps = video.get(cv2.CAP_PROP_FPS)
            total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
            width = int(video.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(video.get(cv2.CAP_PROP_FRAME_HEIGHT))

            if fps <= 0 or total_frames <= 0:
                raise ValueError("Invalid video properties: FPS or frame count is zero")

            duration = total_frames / fps

            logger.info(
                f"📊 Video properties: {width}x{height} @ {fps:.2f} FPS | Duration: {duration:.2f}s | Total frames: {total_frames}"
            )

        except Exception as e:
            logger.error(f"❌ Failed to read video properties: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to read video properties: {str(e)}")

        if duration <= 0:
            logger.error(f"❌ Invalid video duration: {duration}")
            raise ValueError(f"Invalid video duration: {duration}s")

        # Determine actual processing duration (crop if video is longer than max_duration)
        actual_duration = min(duration, max_duration)
        max_frame_number = int(actual_duration * fps) if fps > 0 else total_frames

        if duration > max_duration:
            logger.warning(
                f"⚠️  Video duration ({duration:.2f}s) exceeds max_duration ({max_duration}s). "
                f"Processing only first {max_duration}s (frames 0-{max_frame_number})"
            )
        else:
            logger.info(f"📹 Processing full video duration: {duration:.2f}s")

        frames = []
        frame_interval = max(1, int(fps * fps_interval)) if fps > 0 else 1

        logger.info(f"🔄 Frame extraction interval: {frame_interval} frames ({fps_interval}s)")

        current_frame = 0
        timestamp = 0.0
        extracted_count = 0
        max_frames = (
            int(actual_duration / fps_interval) + 1
        )  # Safety limit based on actual duration

        try:
            while current_frame < max_frame_number and extracted_count < max_frames:
                ret, frame = video.read()
                if not ret:
                    logger.debug(f"📹 Reached end of video at frame {current_frame}")
                    break

                # Validate frame
                if frame is None or frame.size == 0:
                    logger.warning(f"⚠️  Skipping invalid frame at {current_frame}")
                    current_frame += 1
                    continue

                # Calculate current timestamp
                timestamp = current_frame / fps if fps > 0 else current_frame * fps_interval

                # Stop if we've exceeded max_duration
                if timestamp >= max_duration:
                    logger.debug(
                        f"⏹️  Reached max_duration ({max_duration}s) at frame {current_frame}"
                    )
                    break

                # Extract frame at specified intervals
                if current_frame % frame_interval == 0:
                    try:
                        # Resize frame to max 720p for faster processing
                        original_height, original_width = frame.shape[:2]
                        if original_height > 720:
                            scale = 720 / original_height
                            new_width = int(original_width * scale)
                            frame = cv2.resize(
                                frame, (new_width, 720), interpolation=cv2.INTER_AREA
                            )
                            logger.debug(
                                f"📐 Resized frame {extracted_count + 1}: {original_width}x{original_height} → {new_width}x720"
                            )

                        # Convert frame to JPEG and encode as base64
                        frame_base64 = frame_to_base64(frame)
                        frames.append((timestamp, frame_base64))
                        extracted_count += 1

                        if extracted_count % 5 == 0:
                            logger.debug(f"✅ Extracted {extracted_count} frames so far...")

                    except Exception as e:
                        logger.warning(f"⚠️  Failed to process frame at {timestamp:.2f}s: {str(e)}")
                        # Continue with next frame instead of failing completely
                        continue

                current_frame += 1

            if extracted_count == 0:
                logger.error("❌ No frames extracted from video")
                raise RuntimeError("No frames could be extracted from the video")

            logger.info(
                f"✨ Frame extraction complete: {extracted_count} frames extracted from {actual_duration:.2f}s of video "
                f"(original duration: {duration:.2f}s)"
            )
            return frames

        except Exception as e:
            logger.error(f"❌ Error during frame extraction: {str(e)}", exc_info=True)
            raise RuntimeError(f"Frame extraction failed: {str(e)}")

        finally:
            if video is not None:
                try:
                    video.release()
                except Exception as e:
                    logger.warning(f"⚠️  Error releasing video capture: {str(e)}")

    except (ValueError, RuntimeError):
        # Re-raise validation and runtime errors
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error in frame extraction: {str(e)}", exc_info=True)
        raise RuntimeError(f"Unexpected error during frame extraction: {str(e)}")

    finally:
        # Clean up temporary file
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
                logger.debug(f"🧹 Cleaned up temporary file: {tmp_path}")
            except Exception as e:
                logger.warning(f"⚠️  Failed to delete temporary file {tmp_path}: {str(e)}")


def frame_to_base64(frame: np.ndarray, quality: int = 85) -> str:
    """
    Convert OpenCV frame to base64-encoded JPEG.

    Args:
        frame: OpenCV BGR frame
        quality: JPEG quality (1-100, default: 85)

    Returns:
        Base64-encoded JPEG string

    Raises:
        ValueError: If frame is invalid
        RuntimeError: If encoding fails
    """
    try:
        # Validate input
        if frame is None:
            raise ValueError("Frame cannot be None")

        if frame.size == 0:
            raise ValueError("Frame cannot be empty")

        if len(frame.shape) != 3 or frame.shape[2] != 3:
            raise ValueError(
                f"Invalid frame shape: expected 3D array with 3 channels, got {frame.shape}"
            )

        # Validate quality
        quality = max(1, min(100, int(quality)))

        # Convert BGR to RGB
        try:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        except Exception as e:
            logger.error(f"❌ Failed to convert BGR to RGB: {str(e)}")
            raise RuntimeError(f"Color conversion failed: {str(e)}")

        # Convert to PIL Image
        try:
            pil_image = Image.fromarray(frame_rgb)
        except Exception as e:
            logger.error(f"❌ Failed to create PIL image: {str(e)}")
            raise RuntimeError(f"PIL image creation failed: {str(e)}")

        # Save to bytes buffer as JPEG
        try:
            buffer = BytesIO()
            pil_image.save(buffer, format="JPEG", quality=quality)
            img_bytes = buffer.getvalue()

            if len(img_bytes) == 0:
                raise RuntimeError("Encoded image is empty")

        except Exception as e:
            logger.error(f"❌ Failed to encode JPEG: {str(e)}")
            raise RuntimeError(f"JPEG encoding failed: {str(e)}")

        # Encode to base64
        try:
            base64_str = base64.b64encode(img_bytes).decode("utf-8")

            if not base64_str:
                raise RuntimeError("Base64 encoding resulted in empty string")

        except Exception as e:
            logger.error(f"❌ Failed to encode base64: {str(e)}")
            raise RuntimeError(f"Base64 encoding failed: {str(e)}")

        logger.debug(
            f"🖼️  Encoded frame: {len(img_bytes) / 1024:.2f} KB → {len(base64_str) / 1024:.2f} KB base64"
        )

        return base64_str

    except (ValueError, RuntimeError):
        # Re-raise known errors
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error in frame encoding: {str(e)}", exc_info=True)
        raise RuntimeError(f"Unexpected error during frame encoding: {str(e)}")
