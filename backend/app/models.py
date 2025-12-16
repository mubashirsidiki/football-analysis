from pydantic import BaseModel

from app.logger import get_logger

logger = get_logger("models")


class Player(BaseModel):
    id: str
    team: str  # "A" or "B"
    position: str
    coordinates: list[float]


class Ball(BaseModel):
    visible: bool
    coordinates: list[float] | None = None


class GeminiResponse(BaseModel):
    timestamp: float
    players: list[Player]
    ball: Ball
    event: str
    tactical_notes: str


class FrameAnalysis(BaseModel):
    timestamp: float
    event: str
    ball_position: str  # "x,y" or "Not visible"
    players_detected: int
    team_a_shape: str
    team_b_shape: str
    tactical_notes: str


class AnalysisResponse(BaseModel):
    frames: list[FrameAnalysis]
    total_frames: int
    status: str


class AnalysisConfig(BaseModel):
    frame_interval: float = 1.0  # Extract frame every N seconds
    max_duration: float = 10.0  # Maximum video duration in seconds


def infer_formation(players: list[Player]) -> str:
    """Infer team formation from player positions."""
    if not players:
        return "Unknown"

    # Simple heuristic: count players in defensive, midfield, attacking zones
    # This is a simplified version - can be enhanced with actual position analysis
    defensive = sum(1 for p in players if "defensive" in p.position.lower())
    midfield = sum(1 for p in players if "midfield" in p.position.lower())
    attacking = sum(1 for p in players if "attacking" in p.position.lower())

    if defensive > 0 and midfield > 0 and attacking > 0:
        return f"{defensive}-{midfield}-{attacking}"
    elif defensive > 0 and midfield > 0:
        return f"{defensive}-{midfield}"
    elif len(players) >= 3:
        return f"{len(players)}-player formation"
    else:
        return "Unknown"


def transform_gemini_response(gemini_json: dict) -> FrameAnalysis:
    """Transform Gemini API response to FrameAnalysis model."""
    timestamp = gemini_json.get("timestamp", 0.0)
    logger.debug(f"🔄 Transforming Gemini response for timestamp {timestamp:.2f}s")

    try:
        # Parse the response
        players_data = gemini_json.get("players", [])
        team_a_players = [p for p in players_data if p.get("team") == "A"]
        team_b_players = [p for p in players_data if p.get("team") == "B"]

        logger.debug(
            f"👥 Players detected: {len(players_data)} total (Team A: {len(team_a_players)}, Team B: {len(team_b_players)})"
        )

        # Infer formations
        team_a_shape = infer_formation([Player(**p) for p in team_a_players])
        team_b_shape = infer_formation([Player(**p) for p in team_b_players])

        logger.debug(f"📐 Formations: Team A: {team_a_shape}, Team B: {team_b_shape}")

        # Handle ball position
        ball_data = gemini_json.get("ball", {})
        ball_pos = "Not visible"
        if ball_data.get("visible") and ball_data.get("coordinates"):
            coords = ball_data["coordinates"]
            ball_pos = f"{coords[0]}, {coords[1]}"
            logger.debug(f"⚽ Ball visible at: {ball_pos}")
        else:
            logger.debug("⚽ Ball not visible")

        event = gemini_json.get("event", "none")
        logger.debug(f"🎯 Event detected: {event}")

        result = FrameAnalysis(
            timestamp=timestamp,
            event=event,
            ball_position=ball_pos,
            players_detected=len(players_data),
            team_a_shape=team_a_shape,
            team_b_shape=team_b_shape,
            tactical_notes=gemini_json.get("tactical_notes", ""),
        )

        logger.debug(f"✅ Successfully transformed response for timestamp {timestamp:.2f}s")
        return result
    except Exception as e:
        logger.error(
            f"❌ Error transforming Gemini response for timestamp {timestamp:.2f}s: {str(e)}",
            exc_info=True,
        )
        # Return default structure on error
        return FrameAnalysis(
            timestamp=timestamp,
            event="unknown",
            ball_position="Not visible",
            players_detected=0,
            team_a_shape="Unknown",
            team_b_shape="Unknown",
            tactical_notes=f"Error parsing response: {str(e)}",
        )
