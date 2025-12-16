import uuid
from datetime import datetime, timedelta
from typing import Any

from app.logger import get_logger

logger = get_logger("utils")

# In-memory storage for analysis sessions
analysis_store: dict[str, dict[str, Any]] = {}


def generate_session_id() -> str:
    """Generate a unique session ID."""
    session_id = f"session_{uuid.uuid4().hex[:12]}"
    logger.debug(f"🆔 Generated session ID: {session_id}")
    return session_id


def cleanup_old_sessions():
    """Remove sessions older than 1 hour."""
    current_time = datetime.now()
    sessions_to_remove = []

    for session_id, session_data in analysis_store.items():
        created_at = session_data.get("created_at", current_time)
        age = current_time - created_at
        if age > timedelta(hours=1):
            sessions_to_remove.append(session_id)

    if sessions_to_remove:
        logger.info(f"🧹 Cleaning up {len(sessions_to_remove)} old session(s)")
        for session_id in sessions_to_remove:
            del analysis_store[session_id]
            logger.debug(f"🗑️  Removed old session: {session_id}")


def get_session(session_id: str) -> dict[str, Any] | None:
    """Get session data by ID."""
    cleanup_old_sessions()
    session = analysis_store.get(session_id)
    if session:
        logger.debug(f"📥 Retrieved session: {session_id} (status: {session.get('status')})")
    else:
        logger.debug(f"❌ Session not found: {session_id}")
    return session


def create_session() -> str:
    """Create a new analysis session."""
    session_id = generate_session_id()
    analysis_store[session_id] = {
        "frames": [],
        "created_at": datetime.now(),
        "status": "processing",
        "total_frames": 0,
        "processed_frames": 0,
    }
    logger.info(f"✨ Created new session: {session_id}")
    logger.debug(f"📊 Active sessions: {len(analysis_store)}")
    return session_id


def update_session(session_id: str, **kwargs):
    """Update session data."""
    if session_id in analysis_store:
        old_status = analysis_store[session_id].get("status")
        analysis_store[session_id].update(kwargs)
        new_status = kwargs.get("status", old_status)

        if new_status != old_status:
            logger.info(f"🔄 Session {session_id} status changed: {old_status} → {new_status}")

        if "processed_frames" in kwargs or "total_frames" in kwargs:
            processed = analysis_store[session_id].get("processed_frames", 0)
            total = analysis_store[session_id].get("total_frames", 0)
            logger.debug(f"📈 Session {session_id} progress: {processed}/{total}")
    else:
        logger.warning(f"⚠️  Attempted to update non-existent session: {session_id}")
