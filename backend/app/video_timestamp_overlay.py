import os
import tempfile

import cv2
import numpy as np

from app.logger import get_logger

logger = get_logger("video_timestamp_overlay")


def format_timestamp(seconds: float) -> str:
    """
    Format timestamp as HH:MM:SS.mmm

    Args:
        seconds: Timestamp in seconds

    Returns:
        Formatted timestamp string (e.g., "00:00:01.234")
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    milliseconds = int((seconds % 1) * 1000)

    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{milliseconds:03d}"


def add_timestamp_overlay(video_bytes: bytes, max_duration: float | None = None) -> bytes:
    """
    Add timestamp overlay to video frames and re-encode.

    Args:
        video_bytes: Video file as bytes
        max_duration: Maximum video duration in seconds (None = process full video)

    Returns:
        Processed video as bytes

    Raises:
        ValueError: If input validation fails
        RuntimeError: If video processing fails
    """
    # Input validation
    if not video_bytes or len(video_bytes) == 0:
        logger.error("❌ Empty video bytes provided")
        raise ValueError("Video bytes cannot be empty")

    if len(video_bytes) > 100 * 1024 * 1024:  # 100MB
        logger.error(f"❌ Video too large: {len(video_bytes) / 1024 / 1024:.2f} MB")
        raise ValueError(
            f"Video file too large: {len(video_bytes) / 1024 / 1024:.2f} MB (max 100MB)"
        )

    logger.info("🎬 Starting timestamp overlay processing")
    if max_duration:
        logger.info(f"⏱️  Max duration: {max_duration}s")
    logger.debug(f"Video size: {len(video_bytes) / 1024 / 1024:.2f} MB")

    tmp_input_path = None
    tmp_output_path = None

    try:
        # Create temporary input file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp_file:
            tmp_file.write(video_bytes)
            tmp_input_path = tmp_file.name

        logger.debug(f"📁 Created temporary input file: {tmp_input_path}")

        if not os.path.exists(tmp_input_path):
            raise RuntimeError("Failed to create temporary video file")

        # Open video
        video = cv2.VideoCapture(tmp_input_path)

        if not video.isOpened():
            logger.error("❌ Failed to open video file")
            raise ValueError(
                "Could not open video file. The file may be corrupted or in an unsupported format."
            )

        # Get video properties
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

        # Determine actual processing duration
        if max_duration and max_duration > 0:
            actual_duration = min(duration, max_duration)
            max_frame_number = int(actual_duration * fps) if fps > 0 else total_frames
        else:
            actual_duration = duration
            max_frame_number = total_frames

        if max_duration and duration > max_duration:
            logger.warning(
                f"⚠️  Video duration ({duration:.2f}s) exceeds max_duration ({max_duration}s). "
                f"Processing only first {max_duration}s (frames 0-{max_frame_number})"
            )
        else:
            logger.info(f"📹 Processing full video duration: {duration:.2f}s")

        # Create temporary output file
        # Try different codecs for better compatibility with OpenCV VideoCapture
        # XVID is more reliable for reading with OpenCV, so use .avi extension
        with tempfile.NamedTemporaryFile(delete=False, suffix=".avi") as tmp_output_file:
            tmp_output_path = tmp_output_file.name

        logger.debug(f"📁 Created temporary output file: {tmp_output_path}")

        # Setup video writer with codec selection
        # Try codecs in order of preference for OpenCV compatibility
        codecs_to_try = [
            ("XVID", cv2.VideoWriter_fourcc(*"XVID")),  # Most compatible with OpenCV
            ("MJPG", cv2.VideoWriter_fourcc(*"MJPG")),  # Motion JPEG, good compatibility
            ("mp4v", cv2.VideoWriter_fourcc(*"mp4v")),  # Fallback
        ]

        out = None
        used_codec = None

        for codec_name, fourcc in codecs_to_try:
            try:
                out = cv2.VideoWriter(tmp_output_path, fourcc, fps, (width, height))
                if out.isOpened():
                    # Test by writing a dummy frame to verify codec works
                    test_frame = np.zeros((height, width, 3), dtype=np.uint8)
                    out.write(test_frame)
                    out.release()

                    # Reopen for actual writing
                    out = cv2.VideoWriter(tmp_output_path, fourcc, fps, (width, height))
                    if out.isOpened():
                        used_codec = codec_name
                        logger.info(f"✅ Using codec: {codec_name}")
                        break
            except Exception as e:
                logger.debug(f"⚠️  Codec {codec_name} failed: {str(e)}")
                if out:
                    try:
                        out.release()
                    except Exception:
                        pass
                out = None
                continue

        if not out or not out.isOpened():
            logger.error("❌ Failed to initialize video writer with any codec")
            raise RuntimeError("Failed to initialize video writer: no compatible codec found")

        # Calculate font properties based on video resolution
        # Base font scale on video height (assume 1080p as reference)
        base_height = 1080
        font_scale = max(0.6, (height / base_height) * 0.8)
        font_thickness = max(1, int(font_scale * 2))
        font = cv2.FONT_HERSHEY_DUPLEX

        # Text properties
        text_color = (255, 255, 255)  # White
        outline_color = (0, 0, 0)  # Black
        outline_thickness = max(2, int(font_thickness * 1.5))

        # Calculate text position (bottom-right with padding)
        # Get text size to position correctly
        sample_text = "00:00:00.000"
        (text_width, text_height), baseline = cv2.getTextSize(
            sample_text, font, font_scale, font_thickness
        )
        padding = int(text_height * 0.3)
        text_x = width - text_width - padding
        text_y = height - padding

        logger.info(
            f"📝 Timestamp overlay: font_scale={font_scale:.2f}, position=({text_x}, {text_y})"
        )

        # Process frames
        current_frame = 0
        processed_frames = 0

        try:
            while current_frame < max_frame_number:
                ret, frame = video.read()
                if not ret:
                    logger.debug(f"📹 Reached end of video at frame {current_frame}")
                    break

                # Validate frame
                if frame is None or frame.size == 0:
                    logger.warning(f"⚠️  Skipping invalid frame at {current_frame}")
                    current_frame += 1
                    continue

                # Calculate timestamp
                timestamp_seconds = current_frame / fps if fps > 0 else 0.0

                # Stop if we've exceeded max_duration
                if max_duration and timestamp_seconds >= max_duration:
                    logger.debug(
                        f"⏹️  Reached max_duration ({max_duration}s) at frame {current_frame}"
                    )
                    break

                # Format timestamp
                timestamp_text = format_timestamp(timestamp_seconds)

                # Draw text with outline for better visibility
                # Draw outline (black)
                for dx in range(-outline_thickness, outline_thickness + 1):
                    for dy in range(-outline_thickness, outline_thickness + 1):
                        if dx != 0 or dy != 0:
                            cv2.putText(
                                frame,
                                timestamp_text,
                                (text_x + dx, text_y + dy),
                                font,
                                font_scale,
                                outline_color,
                                outline_thickness,
                                cv2.LINE_AA,
                            )

                # Draw main text (white)
                cv2.putText(
                    frame,
                    timestamp_text,
                    (text_x, text_y),
                    font,
                    font_scale,
                    text_color,
                    font_thickness,
                    cv2.LINE_AA,
                )

                # Write frame
                out.write(frame)
                processed_frames += 1

                if processed_frames % 30 == 0:
                    logger.debug(f"✅ Processed {processed_frames} frames so far...")

                current_frame += 1

            if processed_frames == 0:
                logger.error("❌ No frames processed")
                raise RuntimeError("No frames could be processed from the video")

            logger.info(
                f"✨ Timestamp overlay complete: {processed_frames} frames processed from {actual_duration:.2f}s of video"
            )

        except Exception as e:
            logger.error(f"❌ Error during frame processing: {str(e)}", exc_info=True)
            raise RuntimeError(f"Frame processing failed: {str(e)}")

        finally:
            # Release video writer and reader
            if out is not None:
                try:
                    out.release()
                except Exception as e:
                    logger.warning(f"⚠️  Error releasing video writer: {str(e)}")

            if video is not None:
                try:
                    video.release()
                except Exception as e:
                    logger.warning(f"⚠️  Error releasing video capture: {str(e)}")

        # Verify the output video can be read by OpenCV (important for analysis compatibility)
        try:
            test_capture = cv2.VideoCapture(tmp_output_path)
            if not test_capture.isOpened():
                logger.warning("⚠️  Output video cannot be opened by OpenCV, but continuing...")
            else:
                test_fps = test_capture.get(cv2.CAP_PROP_FPS)
                test_frames = int(test_capture.get(cv2.CAP_PROP_FRAME_COUNT))
                test_capture.release()
                if test_fps > 0 and test_frames > 0:
                    logger.debug(
                        f"✅ Verified output video: {test_frames} frames @ {test_fps:.2f} FPS"
                    )
                else:
                    logger.warning("⚠️  Output video has invalid properties")
        except Exception as e:
            logger.warning(f"⚠️  Could not verify output video: {str(e)}")

        # Read processed video file
        if not os.path.exists(tmp_output_path):
            raise RuntimeError("Processed video file was not created")

        try:
            with open(tmp_output_path, "rb") as f:
                processed_video_bytes = f.read()

            if len(processed_video_bytes) == 0:
                raise RuntimeError("Processed video file is empty")

            logger.info(
                f"✅ Processed video size: {len(processed_video_bytes) / 1024 / 1024:.2f} MB (codec: {used_codec})"
            )

            return processed_video_bytes

        except Exception as e:
            logger.error(f"❌ Failed to read processed video: {str(e)}", exc_info=True)
            raise RuntimeError(f"Failed to read processed video: {str(e)}")

    except (ValueError, RuntimeError):
        # Re-raise validation and runtime errors
        raise
    except Exception as e:
        logger.error(f"❌ Unexpected error in timestamp overlay: {str(e)}", exc_info=True)
        raise RuntimeError(f"Unexpected error during timestamp overlay: {str(e)}")

    finally:
        # Clean up temporary files
        for tmp_path in [tmp_input_path, tmp_output_path]:
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                    logger.debug(f"🧹 Cleaned up temporary file: {tmp_path}")
                except Exception as e:
                    logger.warning(f"⚠️  Failed to delete temporary file {tmp_path}: {str(e)}")
