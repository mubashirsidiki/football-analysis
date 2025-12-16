#!/usr/bin/env python3
"""
Simple script to run the FastAPI backend server.

Run with: uv run python run.py
Or directly: uv run uvicorn app.main:app --reload --port 8000
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

