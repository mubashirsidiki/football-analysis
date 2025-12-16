import asyncio
import base64
import json
import os
import time
from typing import Any

from dotenv import load_dotenv

from app.logger import get_logger

logger = get_logger("gemini_analyzer")

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
    return f"""You are a football match analysis AI.

Analyze the given video frame and return ONLY valid JSON.

Context:
- This frame is taken from a football match video.
- Timestamp (seconds): {timestamp}

Tasks:
1. Detect all visible players and estimate:
   - Team (Team A or Team B)
   - Approximate on-field position (x,y or zone)
2. Detect the ball location if visible.
3. Identify the current event, if any:
   - pass, shot, dribble, tackle, interception, clearance, duel, goal, none
4. Infer tactical or positional insights if possible:
   - team shape
   - defensive line height
   - pressing or counter-attack indicators

Output JSON schema:
{{
  "timestamp": number,
  "players": [
    {{
      "id": "string_or_unknown",
      "team": "A | B",
      "position": "left/right/center + defensive/midfield/attacking",
      "coordinates": [x, y]
    }}
  ],
  "ball": {{
    "visible": boolean,
    "coordinates": [x, y] | null
  }},
  "event": "pass | shot | dribble | tackle | interception | clearance | duel | goal | none",
  "tactical_notes": "string"
}}

Rules:
- Do not include explanations.
- Do not include markdown.
- Output JSON only."""


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

                # Send image + prompt to Gemini
                try:
                    if USE_NEW_SDK:
                        # New SDK: Use types.Part.from_bytes and Client API
                        image_part = types.Part.from_bytes(data=frame_bytes, mime_type="image/jpeg")
                        config = types.GenerateContentConfig(response_mime_type="application/json")

                        # New SDK uses synchronous calls, wrap in thread
                        response = await asyncio.to_thread(
                            client.models.generate_content,
                            model="gemini-2.5-flash",  # Use 2.5 for better object detection & segmentation
                            contents=[image_part, prompt],  # Image first, then prompt (best practice)
                            config=config,
                        )
                    else:
                        # Legacy SDK: Use generate_content_async with timeout
                        model = genai.GenerativeModel("gemini-2.5-flash")
                        response = await asyncio.wait_for(
                            model.generate_content_async(
                                [{"mime_type": "image/jpeg", "data": frame_bytes}, prompt]
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

                # Get text from response (should be JSON when using response_mime_type)
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

                # Parse JSON (should be clean JSON when using response_mime_type="application/json")
                try:
                    # Try direct JSON parse first
                    result = json.loads(response_text)
                except json.JSONDecodeError:
                    # Fallback: remove markdown code blocks if present
                    if response_text.startswith("```"):
                        lines = response_text.split("\n")
                        if len(lines) > 2:
                            response_text = "\n".join(lines[1:-1])
                            logger.debug("🧹 Removed markdown code blocks from response")
                        result = json.loads(response_text)
                    else:
                        raise

                # Ensure timestamp is set
                result["timestamp"] = timestamp
                logger.info(
                    f"✅ Successfully analyzed frame at {timestamp:.2f}s | Event: {result.get('event', 'none')} | Players: {len(result.get('players', []))}"
                )
                return result

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

                # Check for rate limit errors
                if "429" in error_msg or "quota" in error_msg.lower():
                    if attempt < retries - 1:
                        logger.warning("🚫 Rate limit hit, waiting 60s before retry")
                        await asyncio.sleep(60)
                        continue
                    logger.error("❌ API quota exceeded")
                    return get_default_response(timestamp, "API quota exceeded")

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

    for timestamp, _, task in tasks:
        result = await task
        results.append(result)
        completed += 1

        if completed % 10 == 0 or completed == total:
            logger.info(
                f"📈 Progress: {completed}/{total} frames analyzed ({completed/total*100:.1f}%)"
            )

        if progress_callback:
            progress_callback(completed, total)

    # Sort results by timestamp to maintain order
    results.sort(key=lambda x: x.get("timestamp", 0))
    logger.info(f"✨ Batch analysis complete: {len(results)} frames analyzed")
    return results
