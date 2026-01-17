"""
Test script to check OpenRouter models that support video.
"""

import asyncio
import os

import httpx
from dotenv import load_dotenv

load_dotenv()

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"


async def test_gemini_video_support():
    """Test if Gemini 3 Pro supports video input."""
    print("\n=== Testing Gemini 3 Pro with video URL ===")

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://football-analysis.app",
        "X-Title": "Test",
    }

    # Test with a video URL (publicly accessible video)
    payload = {
        "model": "google/gemini-3-pro-preview",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Describe this video. Respond with 'VIDEO_SEEN' if you can see it.",
                    },
                    {
                        "type": "image_url",  # Try using image_url for video
                        "image_url": {
                            "url": "https://storage.googleapis.com/generativeai-downloads/images/Logo.jpg"
                        },
                    },
                ],
            }
        ],
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(OPENROUTER_API_URL, json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        try:
            json_response = response.json()
            print(f"Response: {json.dumps(json_response, indent=2)[:500]}")
        except Exception:
            print(f"Response text: {response.text[:500]}")


async def test_gemini_2_5_flash():
    """Test with Gemini 2.5 Flash (might have different capabilities)."""
    print("\n=== Testing Gemini 2.5 Flash ===")

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://football-analysis.app",
        "X-Title": "Test",
    }

    payload = {
        "model": "google/gemini-2.5-flash",
        "messages": [
            {
                "role": "user",
                "content": "Respond with 'FLASH_OK' if you receive this.",
            }
        ],
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(OPENROUTER_API_URL, json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        try:
            json_response = response.json()
            print(f"Response: {json.dumps(json_response, indent=2)[:500]}")
        except Exception:
            print(f"Response text: {response.text[:500]}")


async def test_gemini_pro_vision():
    """Test with Gemini Pro Vision."""
    print("\n=== Testing Gemini Pro Vision ===")

    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://football-analysis.app",
        "X-Title": "Test",
    }

    payload = {
        "model": "google/gemini-pro-vision",
        "messages": [
            {
                "role": "user",
                "content": "Respond with 'VISION_OK' if you receive this.",
            }
        ],
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(OPENROUTER_API_URL, json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        try:
            json_response = response.json()
            print(f"Response: {json.dumps(json_response, indent=2)[:500]}")
        except Exception:
            print(f"Response text: {response.text[:500]}")


async def main():
    if not OPENROUTER_API_KEY:
        print("ERROR: OPENROUTER_API_KEY not found")
        return

    await test_gemini_2_5_flash()
    await test_gemini_pro_vision()
    await test_gemini_video_support()


if __name__ == "__main__":
    import json

    asyncio.run(main())
