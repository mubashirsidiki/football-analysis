import asyncio
import base64
import json
import os
import time
from typing import Any

from dotenv import load_dotenv

from app.logger import get_logger
from app.models import GeminiStructuredResponse
from app.prompts import get_analysis_prompt

logger = get_logger("gemini_analyzer")


class QuotaExhaustedError(Exception):
    """Raised when API quota is exhausted (daily limit reached)"""

    pass


class ServiceUnavailableError(Exception):
    """Raised when service is temporarily unavailable (503)"""

    pass


# Try new SDK first, fallback to old SDK
try:
    from google import genai
    from google.genai import types

    USE_NEW_SDK = True
except ImportError:
    # Fallback to old SDK
    from google import generativeai as genai

    USE_NEW_SDK = False
    logger.warning("⚠️  Using legacy google-generativeai SDK. Consider upgrading to google-genai")

load_dotenv()

# Initialize Gemini API
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    logger.error("❌ GEMINI_API_KEY not found in environment variables")
    raise ValueError("GEMINI_API_KEY not found in environment variables")

if USE_NEW_SDK:
    # Use new Client API (recommended)
    client = genai.Client(api_key=api_key)
    logger.info("✅ Gemini API configured with new Client API (google-genai)")
else:
    # Use old SDK
    genai.configure(api_key=api_key)
    logger.info("✅ Gemini API configured with legacy SDK (google-generativeai)")

# Rate limiting
semaphore = asyncio.Semaphore(10)  # Max 10 concurrent requests
rate_limit_delay = 4.0  # 15 requests per minute = 4 seconds between requests
last_request_time = 0.0


def get_gemini_prompt(timestamp: float) -> str:
    """Generate the prompt for Gemini analysis."""
    return get_analysis_prompt(timestamp)


async def analyze_frame(frame_base64: str, timestamp: float, retries: int = 3) -> dict[str, Any]:
    """
    Analyze a single frame using Gemini Vision API.

    Args:
        frame_base64: Base64-encoded JPEG image
        timestamp: Frame timestamp in seconds
        retries: Number of retry attempts on failure

    Returns:
        Parsed JSON response from Gemini
    """
    global last_request_time

    logger.debug(f"🔍 Analyzing frame at timestamp {timestamp:.2f}s")

    async with semaphore:
        # Rate limiting: ensure at least 4 seconds between requests
        current_time = time.time()
        time_since_last = current_time - last_request_time
        if time_since_last < rate_limit_delay:
            wait_time = rate_limit_delay - time_since_last
            logger.debug(f"⏳ Rate limiting: waiting {wait_time:.2f}s before next request")
            await asyncio.sleep(wait_time)
        last_request_time = time.time()

        prompt = get_gemini_prompt(timestamp)

        # Decode base64 to bytes for Gemini
        try:
            if not frame_base64 or len(frame_base64) == 0:
                raise ValueError("Empty base64 string provided")
            frame_bytes = base64.b64decode(frame_base64)
            if len(frame_bytes) == 0:
                raise ValueError("Decoded frame bytes are empty")
            logger.debug(f"📤 Sending frame to Gemini API (size: {len(frame_bytes) / 1024:.2f} KB)")
        except Exception as e:
            logger.error(f"❌ Failed to decode base64 frame: {str(e)}")
            return get_default_response(timestamp, f"Frame decoding error: {str(e)}")

        for attempt in range(retries):
            try:
                logger.debug(
                    f"🔄 Gemini API request attempt {attempt + 1}/{retries} for timestamp {timestamp:.2f}s"
                )

                # Validate frame bytes before sending
                if len(frame_bytes) > 20 * 1024 * 1024:  # 20MB limit for Gemini
                    logger.warning(
                        f"⚠️  Frame size ({len(frame_bytes) / 1024 / 1024:.2f} MB) exceeds recommended limit"
                    )

                # Send image + prompt to Gemini with structured output
                try:
                    if USE_NEW_SDK:
                        # New SDK: Use types.Part.from_bytes and Client API
                        # Note: The new SDK's GenerateContentConfig doesn't accept response_json_schema
                        # We'll use JSON mode and validate with Pydantic after receiving the response
                        image_part = types.Part.from_bytes(data=frame_bytes, mime_type="image/jpeg")

                        config = types.GenerateContentConfig(
                            response_mime_type="application/json",
                        )

                        # New SDK uses synchronous calls, wrap in thread
                        response = await asyncio.to_thread(
                            client.models.generate_content,
                            model="gemini-2.5-flash",  # Use 2.5 for better object detection & segmentation
                            contents=[
                                image_part,
                                prompt,
                            ],  # Image first, then prompt (best practice)
                            config=config,
                        )
                    else:
                        # Legacy SDK: Use generate_content_async with structured output
                        model = genai.GenerativeModel("gemini-2.5-flash")

                        # Get JSON schema from Pydantic model
                        json_schema = GeminiStructuredResponse.model_json_schema()

                        # Legacy SDK uses generation_config parameter
                        generation_config = {
                            "response_mime_type": "application/json",
                            "response_json_schema": json_schema,
                        }

                        response = await asyncio.wait_for(
                            model.generate_content_async(
                                [{"mime_type": "image/jpeg", "data": frame_bytes}, prompt],
                                generation_config=generation_config,
                            ),
                            timeout=30.0,
                        )
                except TimeoutError:
                    raise
                except Exception as e:
                    error_msg = str(e)
                    if (
                        "429" in error_msg
                        or "quota" in error_msg.lower()
                        or "rate limit" in error_msg.lower()
                    ):
                        raise  # Re-raise rate limit errors to be handled separately
                    logger.error(f"❌ Gemini API request failed: {error_msg}")
                    raise RuntimeError(f"API request failed: {error_msg}")

                # Extract JSON from response
                if not response:
                    raise ValueError("Invalid response from Gemini API: empty response")

                # Get text from response (should be valid JSON when using structured output)
                try:
                    response_text = response.text.strip()
                except AttributeError:
                    # Fallback if response structure is different
                    response_text = str(response).strip()

                if not response_text:
                    raise ValueError("Empty response from Gemini API")

                logger.debug(
                    f"📥 Received response from Gemini (length: {len(response_text)} chars)"
                )

                # Parse and validate JSON using Pydantic
                try:
                    # Parse JSON first
                    json_data = json.loads(response_text)

                    # Ensure timestamp is set (in case schema doesn't enforce it)
                    json_data["timestamp"] = timestamp

                    # Validate using Pydantic model - this ensures type safety and schema compliance
                    validated_response = GeminiStructuredResponse.model_validate(json_data)

                    logger.info(
                        f"✅ Successfully analyzed and validated frame at {timestamp:.2f}s | "
                        f"Event: {validated_response.event} | Players: {len(validated_response.players)}"
                    )

                    # Return as dict for compatibility with existing code
                    return validated_response.model_dump()

                except json.JSONDecodeError as e:
                    logger.error(f"❌ Invalid JSON in response: {str(e)}")
                    raise ValueError(f"Invalid JSON response from Gemini: {str(e)}")
                except Exception as e:
                    # Pydantic validation error
                    logger.error(f"❌ Pydantic validation error: {str(e)}")
                    logger.debug(
                        f"Response text: {response_text[:500]}..."
                    )  # Log first 500 chars for debugging
                    raise ValueError(f"Response validation failed: {str(e)}")

            except TimeoutError:
                logger.warning(f"⏱️  Request timeout on attempt {attempt + 1}")
                if attempt < retries - 1:
                    backoff_time = 2**attempt
                    logger.debug(f"⏳ Retrying after {backoff_time}s")
                    await asyncio.sleep(backoff_time)
                    continue
                logger.error(f"❌ Request timeout after {retries} attempts")
                return get_default_response(timestamp, "Request timeout")

            except Exception as e:
                error_msg = str(e)
                logger.warning(f"⚠️  API error on attempt {attempt + 1}: {error_msg}")

                # Check for 503 Service Unavailable (overloaded)
                if (
                    "503" in error_msg
                    or "UNAVAILABLE" in error_msg
                    or "overloaded" in error_msg.lower()
                ):
                    if attempt < retries - 1:
                        # Longer backoff for 503 errors (exponential with longer base)
                        backoff_time = min(30, 5 * (2**attempt))  # Max 30 seconds
                        logger.warning(
                            f"🔄 Service overloaded (503), retrying after {backoff_time}s..."
                        )
                        await asyncio.sleep(backoff_time)
                        continue
                    logger.error("❌ Service unavailable after retries")
                    raise ServiceUnavailableError(
                        "Gemini API is currently overloaded. Please try again later."
                    )

                # Check for quota exhaustion (429 with quota exceeded message)
                is_quota_exhausted = (
                    "429" in error_msg
                    and (
                        "quota" in error_msg.lower()
                        or "free_tier" in error_msg.lower()
                        or "RESOURCE_EXHAUSTED" in error_msg
                    )
                    and ("exceeded" in error_msg.lower() or "limit" in error_msg.lower())
                )

                if is_quota_exhausted:
                    logger.error("❌ API quota exhausted (daily limit reached)")
                    logger.error(
                        "💡 Free tier limit: 20 requests per day. Please upgrade or wait until tomorrow."
                    )
                    raise QuotaExhaustedError(
                        "Gemini API daily quota exhausted. Free tier allows 20 requests per day. "
                        "Please upgrade your plan or try again tomorrow."
                    )

                # Check for rate limit (429 but not quota exhausted - temporary)
                if "429" in error_msg and not is_quota_exhausted:
                    if attempt < retries - 1:
                        # Extract retry delay from error if available
                        retry_delay = 60
                        if "retry" in error_msg.lower() and "s" in error_msg:
                            try:
                                # Try to extract retry delay from message
                                import re

                                delay_match = re.search(r"(\d+(?:\.\d+)?)\s*s", error_msg)
                                if delay_match:
                                    retry_delay = min(
                                        120, int(float(delay_match.group(1)) + 5)
                                    )  # Add 5s buffer, max 120s
                            except (ValueError, AttributeError, IndexError):
                                pass
                        logger.warning(f"🚫 Rate limit hit, waiting {retry_delay}s before retry")
                        await asyncio.sleep(retry_delay)
                        continue
                    logger.error("❌ Rate limit exceeded after retries")
                    return get_default_response(
                        timestamp, "Rate limit exceeded. Please try again later."
                    )

                # Other errors - exponential backoff
                if attempt < retries - 1:
                    backoff_time = 2**attempt
                    logger.debug(f"⏳ Retrying after {backoff_time}s")
                    await asyncio.sleep(backoff_time)
                    continue
                logger.error(f"❌ API error after {retries} attempts: {error_msg}")
                return get_default_response(timestamp, f"API error: {error_msg}")

        # Should not reach here, but return default if it does
        logger.error("❌ Max retries exceeded")
        return get_default_response(timestamp, "Max retries exceeded")


def get_default_response(timestamp: float, error_message: str = "") -> dict[str, Any]:
    """Return a default response structure when analysis fails."""
    return {
        "timestamp": timestamp,
        "players": [],
        "ball": {"visible": False, "coordinates": None},
        "event": "unknown",
        "tactical_notes": error_message if error_message else "Analysis unavailable",
    }


async def analyze_frames_batch(frames: list, progress_callback=None) -> list:
    """
    Analyze multiple frames in parallel with rate limiting.

    Args:
        frames: List of (timestamp, base64_frame) tuples
        progress_callback: Optional callback function(current, total)

    Returns:
        List of analysis results

    Raises:
        QuotaExhaustedError: If API quota is exhausted
        ServiceUnavailableError: If service is unavailable
    """
    total = len(frames)
    logger.info(f"🚀 Starting batch analysis of {total} frames")
    logger.info(f"📊 Rate limit: {semaphore._value} concurrent requests, {rate_limit_delay}s delay")

    tasks = [
        (timestamp, frame_base64, analyze_frame(frame_base64, timestamp))
        for timestamp, frame_base64 in frames
    ]

    results = []
    completed = 0
    quota_exhausted = False

    for timestamp, _, task in tasks:
        try:
            result = await task
            results.append(result)
            completed += 1

            if completed % 10 == 0 or completed == total:
                logger.info(
                    f"📈 Progress: {completed}/{total} frames analyzed ({completed/total*100:.1f}%)"
                )

            if progress_callback:
                progress_callback(completed, total)
        except QuotaExhaustedError as e:
            logger.error(f"🛑 Quota exhausted after processing {completed}/{total} frames")
            quota_exhausted = True
            # Add default responses for remaining frames
            remaining = total - completed
            logger.warning(f"⚠️  Adding default responses for {remaining} remaining frames")
            for i in range(remaining):
                remaining_timestamp = tasks[completed + i][0]
                results.append(get_default_response(remaining_timestamp, str(e)))
            break  # Stop processing immediately
        except ServiceUnavailableError as e:
            logger.error(f"🛑 Service unavailable after processing {completed}/{total} frames")
            # Add default responses for remaining frames
            remaining = total - completed
            logger.warning(f"⚠️  Adding default responses for {remaining} remaining frames")
            for i in range(remaining):
                remaining_timestamp = tasks[completed + i][0]
                results.append(get_default_response(remaining_timestamp, str(e)))
            # Re-raise to be handled at higher level
            raise

    # Sort results by timestamp to maintain order
    results.sort(key=lambda x: x.get("timestamp", 0))

    if quota_exhausted:
        logger.warning(
            f"⚠️  Batch analysis stopped early due to quota exhaustion: {len(results)}/{total} frames processed"
        )
        logger.warning(
            f"📊 Returning partial results: {completed} successfully analyzed, {total - completed} with default responses"
        )
        # Don't raise exception - return partial results instead
        # The results already contain default responses for failed frames

    logger.info(f"✨ Batch analysis complete: {len(results)} frames analyzed")
    return results
