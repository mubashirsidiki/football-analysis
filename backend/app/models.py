from pydantic import BaseModel, Field, field_validator

from app.logger import get_logger

logger = get_logger("models")


# Comprehensive Pydantic models for structured output validation
class Player(BaseModel):
    id: str = Field(description="Player identifier or 'unknown'")
    team: str = Field(description="Team identifier (A, B, or unknown)")
    shirt_number: str | None = Field(
        default="unknown", description="Shirt number if visible, otherwise 'unknown'"
    )
    position: str = Field(description="Player position on field")
    role: str | None = Field(default="unknown", description="Player role/position")
    coordinates: list[float] = Field(description="Player coordinates [x, y]")

    @field_validator("team", mode="before")
    @classmethod
    def normalize_team(cls, v):
        """Normalize team values to 'A', 'B', or 'unknown'."""
        if v is None:
            return "unknown"

        # Convert to string if not already
        if not isinstance(v, str):
            v = str(v)

        v_upper = v.upper().strip()

        # Handle various team representations
        if v_upper in ["A", "TEAM A", "TEAMA", "TEAM_A", "TEAM 1", "TEAM1", "1"]:
            return "A"
        elif v_upper in ["B", "TEAM B", "TEAMB", "TEAM_B", "TEAM 2", "TEAM2", "2"]:
            return "B"
        else:
            # For any other value, return 'unknown' to avoid validation errors
            logger.debug(f"Normalizing unknown team value '{v}' to 'unknown'")
            return "unknown"

    @field_validator("shirt_number", mode="before")
    @classmethod
    def normalize_shirt_number(cls, v):
        """Normalize shirt_number to string, handling None and numeric values."""
        if v is None:
            return "unknown"
        # Convert to string if not already (handles numeric values from Gemini)
        if not isinstance(v, str):
            return str(v)
        return v.strip() if v.strip() else "unknown"


class Ball(BaseModel):
    visible: bool = Field(description="Whether the ball is visible in the frame")
    coordinates: list[float] | None = Field(
        default=None, description="Ball coordinates [x, y] if visible"
    )


class ScanMetrics(BaseModel):
    scan_frequency: str | None = Field(
        default="unknown", description="Head-turns per minute or 'unknown'"
    )
    scan_quality: str | None = Field(default="unknown", description="Quality of scanning behavior")
    pre_reception_scans: str | None = Field(
        default="unknown",
        description="Number of scans 1-3 seconds before receiving ball or 'unknown'",
    )
    head_movement_angle: str | None = Field(
        default="unknown", description="Direction of head movement/scan"
    )

    @field_validator("scan_quality", mode="before")
    @classmethod
    def normalize_scan_quality(cls, v):
        """Normalize scan quality values."""
        if v is None:
            return "unknown"
        if not isinstance(v, str):
            v = str(v)
        v_lower = v.lower().strip()
        if v_lower in ["good", "excellent", "high"]:
            return "good"
        elif v_lower in ["average", "fair", "medium", "moderate"]:
            return "average"
        elif v_lower in ["poor", "bad", "low"]:
            return "poor"
        else:
            return "unknown"

    @field_validator("head_movement_angle", mode="before")
    @classmethod
    def normalize_direction(cls, v):
        """Normalize direction values."""
        if v is None:
            return "unknown"
        if not isinstance(v, str):
            v = str(v)
        v_lower = v.lower().strip()
        if "left" in v_lower or v_lower == "l":
            return "left"
        elif "right" in v_lower or v_lower == "r":
            return "right"
        elif "back" in v_lower or v_lower == "b":
            return "backward"
        elif "forward" in v_lower or "front" in v_lower or v_lower == "f":
            return "forward"
        else:
            return "unknown"


class DecisionIntelligence(BaseModel):
    best_option: str | None = Field(
        default="unknown", description="Optimal choice description or 'unknown'"
    )
    simple_option: str | None = Field(
        default="unknown", description="Easiest/safest choice or 'unknown'"
    )
    risk_level: str | None = Field(default="unknown", description="Risk level of the decision")
    decision_time: str | None = Field(
        default="unknown", description="Time from first touch to action in seconds or 'unknown'"
    )
    reaction_time: str | None = Field(
        default="unknown", description="Reaction time to pressure/movement in seconds or 'unknown'"
    )

    @field_validator("risk_level", mode="before")
    @classmethod
    def normalize_risk_level(cls, v):
        """Normalize risk level values."""
        if v is None:
            return "unknown"
        if not isinstance(v, str):
            v = str(v)
        v_lower = v.lower().strip()
        if v_lower in ["high", "h"]:
            return "high"
        elif v_lower in ["medium", "med", "m", "moderate"]:
            return "medium"
        elif v_lower in ["low", "l"]:
            return "low"
        else:
            return "unknown"


class TechnicalExecution(BaseModel):
    pass_direction: str | None = Field(
        default="unknown", description="Direction of pass if applicable"
    )
    pass_success: str | None = Field(default="unknown", description="Whether pass was successful")
    dribbling_success: str | None = Field(
        default="unknown", description="Dribbling outcome if applicable"
    )
    shot_direction: str | None = Field(
        default="unknown", description="Shot direction if applicable"
    )
    execution_quality: str | None = Field(
        default="unknown", description="Quality of technical execution"
    )
    ball_loss_classification: str | None = Field(
        default="unknown", description="Classification of ball loss if applicable"
    )

    @field_validator("execution_quality", mode="before")
    @classmethod
    def normalize_execution_quality(cls, v):
        """Normalize execution quality values."""
        if v is None:
            return "unknown"
        if not isinstance(v, str):
            v = str(v)
        v_lower = v.lower().strip()
        if v_lower in ["excellent", "exc", "very good", "perfect"]:
            return "excellent"
        elif v_lower in ["good", "g"]:
            return "good"
        elif v_lower in ["average", "avg", "fair", "ok"]:
            return "average"
        elif v_lower in ["poor", "bad", "weak"]:
            return "poor"
        else:
            return "unknown"


class OffBallIntelligence(BaseModel):
    availability_index: str | None = Field(
        default="unknown", description="How playable and accessible the player is"
    )
    progressive_opportunity_index: str | None = Field(
        default="unknown", description="Frequency of identifying forward options"
    )
    spatial_awareness: str | None = Field(
        default="unknown", description="Understanding of space, pressure zones, passing lanes"
    )
    tsx_cognitive_index: str | None = Field(
        default="unknown", description="Overall football IQ score or 'unknown'"
    )

    @field_validator("availability_index", "progressive_opportunity_index", mode="before")
    @classmethod
    def normalize_level(cls, v):
        """Normalize level values to high/medium/low/unknown."""
        if v is None:
            return "unknown"
        if not isinstance(v, str):
            v = str(v)
        v_lower = v.lower().strip()
        if v_lower in ["high", "h"]:
            return "high"
        elif v_lower in ["medium", "med", "m", "moderate"]:
            return "medium"
        elif v_lower in ["low", "l"]:
            return "low"
        else:
            return "unknown"

    @field_validator("spatial_awareness", mode="before")
    @classmethod
    def normalize_quality(cls, v):
        """Normalize quality values to excellent/good/average/poor/unknown."""
        if v is None:
            return "unknown"
        if not isinstance(v, str):
            v = str(v)
        v_lower = v.lower().strip()
        if v_lower in ["excellent", "exc", "very good"]:
            return "excellent"
        elif v_lower in ["good", "g"]:
            return "good"
        elif v_lower in ["average", "avg", "fair"]:
            return "average"
        elif v_lower in ["poor", "bad", "weak"]:
            return "poor"
        else:
            return "unknown"

    @field_validator("tsx_cognitive_index", mode="before")
    @classmethod
    def normalize_tsx_cognitive_index(cls, v):
        """Normalize tsx_cognitive_index to string, handling numeric values."""
        if v is None:
            return "unknown"
        # Convert to string if not already (handles numeric values from Gemini)
        if not isinstance(v, str):
            return str(v)
        return v.strip() if v.strip() else "unknown"


class FormationAnalysis(BaseModel):
    team_a_formation: str | None = Field(default="unknown", description="Team A formation")
    team_b_formation: str | None = Field(default="unknown", description="Team B formation")
    pressing_structure: str | None = Field(
        default="unknown", description="Pressing structure and triggers"
    )
    build_up_patterns: str | None = Field(
        default="unknown", description="Build-up patterns observed"
    )


class GeminiStructuredResponse(BaseModel):
    """Comprehensive structured response model for Gemini analysis with Pydantic validation."""

    timestamp: float = Field(description="Frame timestamp in seconds")
    players: list[Player] = Field(default_factory=list, description="List of all visible players")
    ball: Ball = Field(description="Ball visibility and position")
    event: str = Field(description="Current event type")

    @field_validator("event", mode="before")
    @classmethod
    def normalize_event(cls, v):
        """Normalize event values to allowed event types."""
        if v is None:
            return "unknown"

        # Convert to string and lowercase
        if not isinstance(v, str):
            v = str(v)

        v_lower = v.lower().strip()

        # Map common variations to standard event types
        event_mapping = {
            "pass": "pass",
            "shot": "shot",
            "dribble": "dribble",
            "tackle": "tackle",
            "interception": "interception",
            "clearance": "clearance",
            "duel": "duel",
            "goal": "goal",
            "set_piece": "set_piece",
            "set piece": "set_piece",
            "transition": "transition",
            "none": "none",
            "unknown": "unknown",
            "no event": "none",
            "no action": "none",
        }

        # Check exact match first
        if v_lower in event_mapping:
            return event_mapping[v_lower]

        # Check if it contains any event keyword
        for key, value in event_mapping.items():
            if key in v_lower:
                return value

        # Default to 'unknown' if no match
        logger.debug(f"Normalizing unknown event value '{v}' to 'unknown'")
        return "unknown"

    tactical_context: str | None = Field(default="", description="Tactical context of the frame")
    scan_metrics: ScanMetrics | None = Field(
        default_factory=ScanMetrics, description="Scanning and awareness metrics"
    )
    decision_intelligence: DecisionIntelligence | None = Field(
        default_factory=DecisionIntelligence, description="Decision-making intelligence metrics"
    )
    technical_execution: TechnicalExecution | None = Field(
        default_factory=TechnicalExecution, description="Technical execution metrics"
    )
    off_ball_intelligence: OffBallIntelligence | None = Field(
        default_factory=OffBallIntelligence, description="Off-ball and tactical intelligence"
    )
    tactical_notes: str | None = Field(
        default="", description="General tactical notes and observations"
    )
    formation_analysis: FormationAnalysis | None = Field(
        default_factory=FormationAnalysis, description="Formation and tactical team analysis"
    )
    performance_insight: str | None = Field(
        default="", description="Performance insight for the frame"
    )


# Legacy models for backward compatibility
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


def transform_gemini_response(gemini_response: GeminiStructuredResponse) -> FrameAnalysis:
    """Transform validated Gemini structured response to FrameAnalysis model."""
    timestamp = gemini_response.timestamp
    logger.debug(f"🔄 Transforming Gemini response for timestamp {timestamp:.2f}s")

    try:
        # Parse the validated response
        players_data = gemini_response.players
        team_a_players = [p for p in players_data if p.team == "A"]
        team_b_players = [p for p in players_data if p.team == "B"]
        unknown_team_players = [p for p in players_data if p.team not in ["A", "B"]]

        if unknown_team_players:
            logger.debug(
                f"⚠️  Found {len(unknown_team_players)} players with unknown team assignment"
            )

        logger.debug(
            f"👥 Players detected: {len(players_data)} total (Team A: {len(team_a_players)}, Team B: {len(team_b_players)})"
        )

        # Get formations from formation_analysis or infer
        formation_analysis = gemini_response.formation_analysis
        team_a_shape = (
            formation_analysis.team_a_formation
            if formation_analysis and formation_analysis.team_a_formation != "unknown"
            else infer_formation(team_a_players)
        )
        team_b_shape = (
            formation_analysis.team_b_formation
            if formation_analysis and formation_analysis.team_b_formation != "unknown"
            else infer_formation(team_b_players)
        )

        logger.debug(f"📐 Formations: Team A: {team_a_shape}, Team B: {team_b_shape}")

        # Handle ball position
        ball = gemini_response.ball
        ball_pos = "Not visible"
        if ball.visible and ball.coordinates:
            coords = ball.coordinates
            ball_pos = f"{coords[0]}, {coords[1]}"
            logger.debug(f"⚽ Ball visible at: {ball_pos}")
        else:
            logger.debug("⚽ Ball not visible")

        event = gemini_response.event
        logger.debug(f"🎯 Event detected: {event}")

        # Build comprehensive tactical notes from all available data
        tactical_notes_parts = []

        # Base tactical notes
        if gemini_response.tactical_notes:
            tactical_notes_parts.append(gemini_response.tactical_notes)

        # Tactical context
        if gemini_response.tactical_context:
            tactical_notes_parts.append(f"Context: {gemini_response.tactical_context}")

        # Formation analysis
        if formation_analysis:
            if (
                formation_analysis.pressing_structure
                and formation_analysis.pressing_structure != "unknown"
            ):
                tactical_notes_parts.append(f"Pressing: {formation_analysis.pressing_structure}")
            if (
                formation_analysis.build_up_patterns
                and formation_analysis.build_up_patterns != "unknown"
            ):
                tactical_notes_parts.append(f"Build-up: {formation_analysis.build_up_patterns}")

        # Decision intelligence
        decision_intel = gemini_response.decision_intelligence
        if decision_intel:
            if decision_intel.risk_level and decision_intel.risk_level != "unknown":
                tactical_notes_parts.append(f"Risk: {decision_intel.risk_level}")
            if decision_intel.decision_time and decision_intel.decision_time != "unknown":
                tactical_notes_parts.append(f"Decision time: {decision_intel.decision_time}s")
            if decision_intel.reaction_time and decision_intel.reaction_time != "unknown":
                tactical_notes_parts.append(f"Reaction time: {decision_intel.reaction_time}s")

        # Technical execution
        tech_exec = gemini_response.technical_execution
        if tech_exec:
            if tech_exec.execution_quality and tech_exec.execution_quality != "unknown":
                tactical_notes_parts.append(f"Execution: {tech_exec.execution_quality}")
            if tech_exec.pass_success and tech_exec.pass_success != "unknown":
                tactical_notes_parts.append(f"Pass: {tech_exec.pass_success}")

        # Performance insight
        if gemini_response.performance_insight:
            tactical_notes_parts.append(f"Insight: {gemini_response.performance_insight}")

        # Scan metrics
        scan_metrics = gemini_response.scan_metrics
        if scan_metrics:
            if scan_metrics.scan_quality and scan_metrics.scan_quality != "unknown":
                tactical_notes_parts.append(f"Scan quality: {scan_metrics.scan_quality}")

        # Off-ball intelligence
        off_ball = gemini_response.off_ball_intelligence
        if off_ball:
            if off_ball.tsx_cognitive_index and off_ball.tsx_cognitive_index != "unknown":
                tactical_notes_parts.append(f"TSX Index: {off_ball.tsx_cognitive_index}")
            if off_ball.spatial_awareness and off_ball.spatial_awareness != "unknown":
                tactical_notes_parts.append(f"Spatial awareness: {off_ball.spatial_awareness}")

        # Combine all notes
        tactical_notes = (
            " | ".join(tactical_notes_parts)
            if tactical_notes_parts
            else "No tactical notes available"
        )

        result = FrameAnalysis(
            timestamp=timestamp,
            event=event,
            ball_position=ball_pos,
            players_detected=len(players_data),
            team_a_shape=team_a_shape,
            team_b_shape=team_b_shape,
            tactical_notes=tactical_notes,
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
