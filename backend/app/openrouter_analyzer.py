"""
OpenRouter multimodal video analyzer.
"""

import asyncio
import base64
import json
import os
import time
from typing import Any

import httpx

from app.logger import get_logger
from app.models import GeminiStructuredResponse
from app.prompts import get_multimodal_analysis_prompt

logger = get_logger("openrouter_analyzer")

# Configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "google/gemini-3-pro-preview")
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

# Rate limiting (more conservative than Gemini due to unknown limits)
semaphore = asyncio.Semaphore(3)  # Max 3 concurrent requests
rate_limit_delay = 2.0  # 2 seconds between requests
last_request_time = 0.0


class QuotaExhaustedError(Exception):
    """Raised when API quota is exhausted."""

    pass


class ServiceUnavailableError(Exception):
    """Raised when service is temporarily unavailable (503)."""

    pass


class OpenRouterError(Exception):
    """Base exception for OpenRouter errors."""

    pass


def get_structured_output_schema() -> dict:
    """
    Get JSON Schema for structured output enforcement.

    Returns a schema that enforces an array of analysis objects (one per second),
    each matching the GeminiStructuredResponse format.
    """
    return {
        "name": "football_analysis_array",
        "strict": True,
        "schema": {
            "type": "array",
            "description": "Array of football match analyses at different timestamps (one per second)",
            "minItems": 1,
            "maxItems": 30,
            "items": {
                "type": "object",
                "properties": {
                    "timestamp": {"type": "number", "description": "Frame timestamp in seconds"},
                    "players": {
                        "type": "array",
                        "description": "List of all visible players",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {
                                    "type": "string",
                                    "description": "Player identifier or 'unknown'",
                                },
                                "team": {
                                    "type": "string",
                                    "enum": ["A", "B", "unknown"],
                                    "description": "Team identifier",
                                },
                                "shirt_number": {
                                    "type": "string",
                                    "description": "Shirt number or 'unknown'",
                                },
                                "position": {
                                    "type": "string",
                                    "description": "Player position on field",
                                },
                                "role": {"type": "string", "description": "Player role/position"},
                                "coordinates": {
                                    "type": "array",
                                    "items": {"type": "number"},
                                    "minItems": 2,
                                    "maxItems": 2,
                                    "description": "Player coordinates [x, y]",
                                },
                            },
                            "required": ["id", "team", "position", "coordinates"],
                        },
                    },
                    "ball": {
                        "type": "object",
                        "properties": {
                            "visible": {"type": "boolean"},
                            "coordinates": {
                                "oneOf": [
                                    {"type": "null"},
                                    {
                                        "type": "array",
                                        "items": {"type": "number"},
                                        "minItems": 2,
                                        "maxItems": 2,
                                    },
                                ]
                            },
                        },
                        "required": ["visible"],
                    },
                    "event": {
                        "type": "string",
                        "enum": [
                            "pass",
                            "shot",
                            "dribble",
                            "tackle",
                            "interception",
                            "clearance",
                            "duel",
                            "goal",
                            "set_piece",
                            "transition",
                            "none",
                        ],
                        "description": "Current event type",
                    },
                    "tactical_context": {"type": "string"},
                    "scan_metrics": {
                        "type": "object",
                        "properties": {
                            "scan_frequency": {"type": "string"},
                            "scan_quality": {
                                "type": "string",
                                "enum": ["good", "average", "poor", "unknown"],
                            },
                            "pre_reception_scans": {"type": "string"},
                            "head_movement_angle": {
                                "type": "string",
                                "enum": ["left", "right", "backward", "forward", "unknown"],
                            },
                        },
                    },
                    "decision_intelligence": {
                        "type": "object",
                        "properties": {
                            "best_option": {"type": "string"},
                            "simple_option": {"type": "string"},
                            "risk_level": {
                                "type": "string",
                                "enum": ["low", "medium", "high", "unknown"],
                            },
                            "decision_time": {"type": "string"},
                            "reaction_time": {"type": "string"},
                        },
                    },
                    "technical_execution": {
                        "type": "object",
                        "properties": {
                            "pass_direction": {
                                "type": "string",
                                "enum": ["forward", "diagonal", "lateral", "backward", "unknown"],
                            },
                            "pass_success": {
                                "type": "string",
                                "enum": ["successful", "turnover", "unknown"],
                            },
                            "dribbling_success": {
                                "type": "string",
                                "enum": ["beaten", "failed", "unknown"],
                            },
                            "shot_direction": {
                                "type": "string",
                                "enum": [
                                    "top_corner",
                                    "bottom_corner",
                                    "central",
                                    "wide",
                                    "unknown",
                                ],
                            },
                            "execution_quality": {
                                "type": "string",
                                "enum": ["excellent", "good", "average", "poor", "unknown"],
                            },
                            "ball_loss_classification": {
                                "type": "string",
                                "enum": ["wrong_decision", "poor_execution", "none", "unknown"],
                            },
                        },
                    },
                    "off_ball_intelligence": {
                        "type": "object",
                        "properties": {
                            "availability_index": {
                                "type": "string",
                                "enum": ["high", "medium", "low", "unknown"],
                            },
                            "progressive_opportunity_index": {
                                "type": "string",
                                "enum": ["high", "medium", "low", "unknown"],
                            },
                            "spatial_awareness": {
                                "type": "string",
                                "enum": ["excellent", "good", "average", "poor", "unknown"],
                            },
                            "tsx_cognitive_index": {"type": "string"},
                        },
                    },
                    "tactical_notes": {"type": "string"},
                    "formation_analysis": {
                        "type": "object",
                        "properties": {
                            "team_a_formation": {"type": "string"},
                            "team_b_formation": {"type": "string"},
                            "pressing_structure": {"type": "string"},
                            "build_up_patterns": {"type": "string"},
                        },
                    },
                    "performance_insight": {"type": "string"},
                },
                "required": ["timestamp", "players", "ball", "event"],
                "additionalProperties": False,
            },
        },
    }


def get_default_response(timestamp: float, error_message: str = "") -> dict[str, Any]:
    """Return a default response structure when analysis fails."""
    return {
        "timestamp": timestamp,
        "players": [],
        "ball": {"visible": False, "coordinates": None},
        "event": "unknown",
        "tactical_notes": error_message if error_message else "Analysis unavailable",
    }


async def analyze_video_multimodal(video_bytes: bytes, retries: int = 3) -> list[dict[str, Any]]:
    """
    Analyze entire video using OpenRouter multimodal API.

    Returns a list of analyses at different timestamps (3-5 key moments).

    Args:
        video_bytes: Raw video file bytes
        retries: Number of retry attempts

    Returns:
        List of validated analysis responses (same format as Gemini)

    Raises:
        QuotaExhaustedError: If API quota is exhausted
        ServiceUnavailableError: If service is unavailable
        OpenRouterError: For other API errors
    """
    global last_request_time

    logger.info("🎬 Starting multimodal video analysis with OpenRouter")

    # Validate API key
    if not OPENROUTER_API_KEY:
        logger.error("❌ OPENROUTER_API_KEY not found in environment variables")
        raise ValueError("OPENROUTER_API_KEY is required for multimodal analysis")

    logger.info(f"🤖 Using model: {OPENROUTER_MODEL}")

    # Rate limiting
    async with semaphore:
        current_time = time.time()
        time_since_last = current_time - last_request_time
        if time_since_last < rate_limit_delay:
            wait_time = rate_limit_delay - time_since_last
            logger.debug(f"⏳ Rate limiting: waiting {wait_time:.2f}s")
            await asyncio.sleep(wait_time)
        last_request_time = time.time()

    # Encode video to base64
    try:
        video_base64 = base64.b64encode(video_bytes).decode("utf-8")
        video_size_mb = len(video_bytes) / 1024 / 1024
        base64_size_mb = len(video_base64) / 1024 / 1024
        logger.info(f"📦 Video encoded: {video_size_mb:.2f} MB → {base64_size_mb:.2f} MB base64")
    except Exception as e:
        logger.error(f"❌ Failed to encode video: {str(e)}")
        raise ValueError(f"Video encoding failed: {str(e)}")

    # Prepare request
    prompt = get_multimodal_analysis_prompt()

    payload = {
        "model": OPENROUTER_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "video_url",
                        "video_url": {"url": f"data:video/mp4;base64,{video_base64}"},
                    },
                ],
            }
        ],
    }

    # Only add response_format for models that support structured outputs
    # Google AI Studio models don't support it, but Vertex AI and OpenAI models do
    if "gemini" not in OPENROUTER_MODEL.lower() or "vertex" in OPENROUTER_MODEL.lower():
        payload["response_format"] = {
            "type": "json_schema",
            "json_schema": get_structured_output_schema(),
        }
        logger.info("📋 Using structured output schema enforcement")
    else:
        logger.info(
            "📋 Structured outputs not supported by this model, using prompt-based JSON enforcement"
        )

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://football-analysis.app",  # OpenRouter requirement
        "X-Title": "Football Video Analysis",
    }

    # Send request with retries
    for attempt in range(retries):
        try:
            logger.info(f"🔄 Sending request to OpenRouter (attempt {attempt + 1}/{retries})")

            async with httpx.AsyncClient(timeout=300.0) as client:  # 5-minute timeout for videos
                response = await client.post(OPENROUTER_API_URL, json=payload, headers=headers)

                # Handle errors
                if response.status_code == 429:
                    error_text = response.text
                    error_detail = (
                        response.json().get("error", {}).get("message", error_text)
                        if response.headers.get("content-type", "").startswith("application/json")
                        else error_text
                    )

                    if "quota" in error_detail.lower() or "limit" in error_detail.lower():
                        logger.error("❌ OpenRouter quota exceeded")
                        raise QuotaExhaustedError("OpenRouter quota exceeded")
                    else:
                        # Rate limit - retry after delay
                        retry_delay = 60
                        logger.warning(f"🚫 Rate limit hit, waiting {retry_delay}s")
                        await asyncio.sleep(retry_delay)
                        continue

                elif response.status_code == 503:
                    logger.warning("⚠️ OpenRouter service unavailable (503)")
                    raise ServiceUnavailableError("OpenRouter service unavailable")

                elif response.status_code >= 500:
                    error_msg = response.text
                    logger.error(
                        f"❌ OpenRouter server error: {response.status_code} - {error_msg}"
                    )
                    raise OpenRouterError(f"OpenRouter server error: {response.status_code}")

                elif response.status_code >= 400:
                    try:
                        error_data = response.json()
                        error_detail = error_data.get("error", {}).get("message", "Unknown error")
                    except Exception:
                        error_detail = response.text
                    logger.error(
                        f"❌ OpenRouter client error: {response.status_code} - {error_detail}"
                    )
                    raise OpenRouterError(f"OpenRouter client error: {error_detail}")

                # Parse response
                try:
                    response_text = response.text
                    logger.debug(
                        f"📥 Raw response (first 1000 chars): {response_text[:1000] if response_text else '(empty)'}"
                    )

                    if not response_text or not response_text.strip():
                        logger.error(
                            f"❌ Empty response from OpenRouter (status {response.status_code})"
                        )
                        logger.error(f"Response headers: {dict(response.headers)}")
                        raise OpenRouterError("Empty response from OpenRouter API")

                    response_data = response.json()
                except Exception as e:
                    logger.error(f"❌ Failed to parse JSON response: {str(e)}")
                    logger.debug(
                        f"Response text: {response.text[:500] if response.text else '(empty)'}"
                    )
                    raise OpenRouterError(f"Invalid JSON response: {str(e)}")

                # Log full response structure for debugging
                logger.debug(f"📋 Response structure keys: {list(response_data.keys())}")
                logger.debug(f"📋 Full response data: {json.dumps(response_data, indent=2)[:1000]}")

                # Extract content
                try:
                    content = response_data["choices"][0]["message"]["content"]
                except (KeyError, IndexError) as e:
                    logger.error(f"❌ Unexpected response structure: {str(e)}")
                    logger.error(f"📋 Response data: {json.dumps(response_data, indent=2)}")
                    raise OpenRouterError(f"Invalid response format: {str(e)}")

                # Parse JSON from content
                try:
                    # Remove markdown code blocks if present
                    if content.startswith("```json"):
                        content = content.removeprefix("```json").strip()
                    if content.startswith("```"):
                        content = content.removeprefix("```").strip()
                    if content.endswith("```"):
                        content = content.removesuffix("```").strip()

                    json_data = json.loads(content)
                except json.JSONDecodeError as e:
                    logger.error(f"❌ Failed to parse JSON from content: {str(e)}")
                    logger.debug(f"Response content: {content[:500]}...")
                    raise OpenRouterError(f"Invalid JSON in response: {str(e)}")

                # Check if response is an array or single object
                if isinstance(json_data, list):
                    logger.info(f"📊 Received JSON array with {len(json_data)} analyses")
                    json_responses = json_data
                elif isinstance(json_data, dict):
                    logger.info("📊 Received single JSON object, wrapping in array")
                    json_responses = [json_data]
                else:
                    logger.error(f"❌ Unexpected JSON type: {type(json_data)}")
                    raise OpenRouterError(f"Expected JSON array or object, got {type(json_data)}")

                # Validate and normalize each response
                validated_responses = []
                for idx, json_response in enumerate(json_responses):
                    # Normalize to GeminiStructuredResponse format
                    normalized_response = normalize_openrouter_response(json_response)

                    # Validate with Pydantic
                    try:
                        validated = GeminiStructuredResponse.model_validate(normalized_response)
                        validated_responses.append(validated.model_dump())
                        logger.debug(
                            f"✅ Validated analysis {idx + 1}/{len(json_responses)} at timestamp {validated.timestamp}"
                        )
                    except Exception as e:
                        logger.error(
                            f"❌ Pydantic validation error for analysis {idx + 1}: {str(e)}"
                        )
                        logger.debug(
                            f"Normalized data: {json.dumps(normalized_response, indent=2)[:500]}"
                        )
                        raise OpenRouterError(
                            f"Response validation failed for analysis {idx + 1}: {str(e)}"
                        )

                logger.info(
                    f"✅ Multimodal analysis successful: {len(validated_responses)} analyses"
                )
                return validated_responses

        except QuotaExhaustedError:
            logger.error("❌ Quota exhausted")
            raise
        except ServiceUnavailableError:
            if attempt < retries - 1:
                backoff = 30 * (2**attempt)  # Exponential backoff: 30s, 60s, 120s
                logger.warning(f"🔄 Service unavailable, retrying in {backoff}s")
                await asyncio.sleep(backoff)
                continue
            logger.error("❌ Service unavailable after retries")
            raise
        except OpenRouterError:
            if attempt < retries - 1:
                backoff = 2**attempt  # Exponential backoff: 1s, 2s, 4s
                logger.debug(f"⏳ Retrying in {backoff}s")
                await asyncio.sleep(backoff)
                continue
            raise
        except Exception as e:
            logger.error(f"❌ Unexpected error: {str(e)}", exc_info=True)
            raise OpenRouterError(f"Analysis failed: {str(e)}")

    # Should not reach here
    logger.error("❌ Max retries exceeded")
    raise OpenRouterError("Max retries exceeded")


def normalize_openrouter_response(raw_response: dict) -> dict:
    """
    Normalize OpenRouter response to match GeminiStructuredResponse schema.

    Handles:
    - Field name differences
    - Missing optional fields
    - Type conversions

    Args:
        raw_response: Raw JSON response from OpenRouter

    Returns:
        Normalized response dict matching GeminiStructuredResponse schema
    """
    logger.debug("🔄 Normalizing OpenRouter response")

    # Extract base fields with fallbacks
    normalized = {
        "timestamp": raw_response.get("timestamp", 0.0),
        "players": raw_response.get("players", []),
        "ball": raw_response.get("ball", {"visible": False, "coordinates": None}),
        "event": raw_response.get("event", "unknown"),
    }

    # Optional nested objects (add defaults if missing)
    optional_fields = {
        "tactical_context": "",
        "scan_metrics": {
            "scan_frequency": "unknown",
            "scan_quality": "unknown",
            "pre_reception_scans": "unknown",
            "head_movement_angle": "unknown",
        },
        "decision_intelligence": {
            "best_option": "unknown",
            "simple_option": "unknown",
            "risk_level": "unknown",
            "decision_time": "unknown",
            "reaction_time": "unknown",
        },
        "technical_execution": {
            "pass_direction": "unknown",
            "pass_success": "unknown",
            "dribbling_success": "unknown",
            "shot_direction": "unknown",
            "execution_quality": "unknown",
            "ball_loss_classification": "unknown",
        },
        "off_ball_intelligence": {
            "availability_index": "unknown",
            "progressive_opportunity_index": "unknown",
            "spatial_awareness": "unknown",
            "tsx_cognitive_index": "unknown",
        },
        "formation_analysis": {
            "team_a_formation": "unknown",
            "team_b_formation": "unknown",
            "pressing_structure": "unknown",
            "build_up_patterns": "unknown",
        },
        "tactical_notes": raw_response.get("tactical_notes", ""),
        "performance_insight": raw_response.get("performance_insight", ""),
    }

    # Merge optional fields (use response values if present, else defaults)
    for field, default_value in optional_fields.items():
        if field in raw_response and raw_response[field] is not None:
            normalized[field] = raw_response[field]
        else:
            normalized[field] = default_value

    logger.debug("✅ Normalization complete")
    return normalized
