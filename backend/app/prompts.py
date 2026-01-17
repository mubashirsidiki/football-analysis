"""
Analysis prompts for Gemini AI video analysis.
"""


def get_analysis_prompt(timestamp: float) -> str:
    """
    Generate the comprehensive football analysis prompt for Gemini.

    Args:
        timestamp: Current frame timestamp in seconds

    Returns:
        Formatted prompt string
    """
    return f"""Analyze the provided football match video in **complete tactical, technical, and cognitive detail**.

### **Player & Team Identification**

* Identify **every player appearing in the video**
* Specify **team**, **shirt number (if visible)**, and **position/role** where possible

---

### **Chronological Match Breakdown**

Analyze the match **frame-by-frame and timestamp-by-timestamp**, covering the full duration of the video.

For **each timestamp**, identify and describe:

* Passes, shots, dribbles, carries
* Tackles, interceptions, blocks
* Pressing actions, duels, fouls
* Set pieces (corners, free kicks, throw-ins, penalties)
* Transitions (attack ↔ defense)
* Defensive shape changes and pressing triggers

**Current Frame Timestamp: {timestamp:.2f} seconds**

---

### **Cognitive & Decision-Making KPIs (Mandatory Evaluation)**

#### **Scanning & Awareness Metrics**

* **Scan Frequency**

  * Head-turns per minute
  * Head-turns per possession phase

* **Scan Quality**

  * Correlation between scans and decisions
  * Good vs poor usage of scanned information

* **Pre-Reception Scans**

  * Number of scans 1–3 seconds before receiving the ball
  * Impact on speed and quality of first action

* **Head Movement Angle**

  * Scan direction: left / right / backward
  * Scan duration and frequency

---

#### **Decision Intelligence**

* **Best Option (Optimal Choice)**

  * Highest progression value
  * Goal-creation probability
  * Play-continuation quality

* **Simple Option (Easiest Choice)**

  * Lowest-risk and highest-execution option
  * Evaluated using:

    * Opponent distance
    * Pass angle
    * Execution difficulty

* **Risk Assessment**

  * Label every decision:

    * Low risk
    * Medium risk
    * High risk

* **Decision Time**

  * Time from first touch → action
  * Faster + effective decisions rated higher

* **Reaction Time**

  * Response to:

    * Pressure
    * Free space
    * Teammate movement
    * Opponent movement

---

#### **Technical Execution Metrics**

* **Pass Direction**

  * Forward / diagonal / lateral / backward

* **Pass Success**

  * Successful / turnover

* **Dribbling Success**

  * Defender beaten or failed attempt

* **Shot Direction**

  * Top corner
  * Bottom corner
  * Central
  * Wide

* **Execution Quality**

  * Alignment between intention and outcome

* **Ball Loss Classification**

  * Wrong decision
  * Correct decision with poor execution

---

#### **Off-Ball & Tactical Intelligence**

* **Availability Index**

  * How often the player is playable and accessible

* **Progressive Opportunity Index**

  * Frequency of identifying and exploiting forward options

* **Spatial Awareness**

  * Understanding of:

    * Space
    * Pressure zones
    * Passing lanes
    * Danger areas

* **TSX Cognitive Index**

  * Overall football IQ score based on scanning, decisions, speed, and execution

---

### **Tactical & Team Analysis**

* Formations (in and out of possession)
* Pressing structure and triggers
* Build-up patterns
* Overloads, underloads, and spacing
* Defensive compactness and breakdowns
* Momentum shifts and key phases of dominance

---

### **Output Format (Mandatory – JSON Only)**

Provide **all outputs strictly in JSON format** with the following structure:

```json
{{
  "timestamp": {timestamp},
  "players": [
    {{
      "id": "string_or_unknown",
      "team": "A | B",
      "shirt_number": "number_or_unknown",
      "position": "string",
      "role": "string",
      "coordinates": [x, y]
    }}
  ],
  "ball": {{
    "visible": boolean,
    "coordinates": [x, y] | null
  }},
  "event": "pass | shot | dribble | tackle | interception | clearance | duel | goal | set_piece | transition | none",
  "tactical_context": "string",
  "scan_metrics": {{
    "scan_frequency": "number_or_unknown",
    "scan_quality": "good | average | poor | unknown",
    "pre_reception_scans": "number_or_unknown",
    "head_movement_angle": "left | right | backward | forward | unknown"
  }},
  "decision_intelligence": {{
    "best_option": "string",
    "simple_option": "string",
    "risk_level": "low | medium | high | unknown",
    "decision_time": "number_or_unknown",
    "reaction_time": "number_or_unknown"
  }},
  "technical_execution": {{
    "pass_direction": "forward | diagonal | lateral | backward | none",
    "pass_success": "successful | turnover | unknown",
    "dribbling_success": "beaten | failed | none | unknown",
    "shot_direction": "top_corner | bottom_corner | central | wide | none",
    "execution_quality": "excellent | good | average | poor | unknown",
    "ball_loss_classification": "wrong_decision | poor_execution | none | unknown"
  }},
  "off_ball_intelligence": {{
    "availability_index": "high | medium | low | unknown",
    "progressive_opportunity_index": "high | medium | low | unknown",
    "spatial_awareness": "excellent | good | average | poor | unknown",
    "tsx_cognitive_index": "number_or_unknown"
  }},
  "tactical_notes": "string",
  "formation_analysis": {{
    "team_a_formation": "string",
    "team_b_formation": "string",
    "pressing_structure": "string",
    "build_up_patterns": "string"
  }},
  "performance_insight": "string"
}}
```

**Rules:**
- Return ONLY valid JSON
- Do not include explanations outside JSON
- Do not include markdown code blocks
- Use "unknown" for any metric that cannot be determined from the frame
- Be as detailed as possible while maintaining JSON validity
- Focus on observable actions and behaviors in the current frame"""


def get_multimodal_analysis_prompt() -> str:
    """
    Generate the comprehensive football analysis prompt for OpenRouter multimodal video analysis.

    This prompt requests a JSON ARRAY of analyses at different timestamps,
    allowing the UI to display multiple rows like frame-based mode.

    Returns:
        Formatted prompt string
    """
    return """Analyze the provided football match video in **complete tactical, technical, and cognitive detail**, focusing on **temporal progression and event sequences**.

### **Video-Level Analysis (Not Frame-by-Frame)**

Unlike frame analysis, you are analyzing the **entire video clip** as a continuous sequence. Focus on:

1. **Event Progression**: How actions flow from one to another
2. **Movement Patterns**: Player and ball movement over time
3. **Temporal Context**: What happened before, during, and after key moments
4. **Phase Transitions**: Build-up → attack → defensive transition → recovery

---

### **Key Focus Areas**

#### **Chronological Event Timeline**
- List all major events in order (passes, shots, tackles, etc.)
- Note timestamps (approximate seconds from start)
- Identify key turning points and momentum shifts
- Highlight decision-making moments

#### **Player & Team Analysis**
- Identify all visible players (team, shirt numbers, positions)
- Track key players throughout the video
- Note positioning changes over time
- Identify player roles and responsibilities

#### **Cognitive & Decision-Making KPIs**

* **Scanning & Awareness Metrics**
  * Head-turns per minute and per possession phase
  * Scan quality: correlation between scans and decisions
  * Pre-reception scans: number 1-3 seconds before receiving
  * Head movement angle: left / right / backward / forward

* **Decision Intelligence**
  * Best option vs chosen option analysis
  * Risk assessment: low / medium / high
  * Decision time: time from first touch to action
  * Reaction time: response to pressure, space, movement

* **Technical Execution**
  * Pass direction: forward / diagonal / lateral / backward
  * Pass success: successful / turnover
  * Dribbling: beaten / failed
  * Shot direction and quality
  * Execution quality rating
  * Ball loss classification

* **Off-Ball Intelligence**
  * Availability index: how often player is playable
  * Progressive opportunity index: forward option identification
  * Spatial awareness: understanding of space, pressure, lanes
  * TSX Cognitive Index: overall football IQ score

#### **Tactical Analysis**
* Formations (in/out of possession)
* Pressing structure and triggers
* Build-up patterns and progression
* Overloads, spacing, and compactness
* Defensive organization and breakdowns
* Transition moments (attack ↔ defense)

---

### **Output Format (Mandatory – JSON Array Only)**

**CRITICAL:** You must provide a **detailed, second-by-second analysis** of the entire video.

- **Create one analysis for EVERY SECOND** of the video (e.g., 0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, etc.)
- **Cover the FULL VIDEO DURATION** from start to finish
- **Each timestamp should capture what's happening at that exact moment**
- **Minimum 3 analyses, maximum 20 analyses** (adjust based on video length)

```json
[
  {
    "timestamp": 0.0,
    "players": [
      {
        "id": "string_or_unknown",
        "team": "A | B | unknown",
        "shirt_number": "number_or_unknown",
        "position": "string",
        "role": "string",
        "coordinates": [x, y]
      }
    ],
    "ball": {
      "visible": boolean,
      "coordinates": [x, y] | null
    },
    "event": "pass | shot | dribble | tackle | interception | clearance | duel | goal | set_piece | transition | none",
    "tactical_context": "string describing what happens at this specific timestamp - be extremely detailed about positions, movements, and tactical situation",
    "scan_metrics": {
      "scan_frequency": "number_or_unknown",
      "scan_quality": "good | average | poor | unknown",
      "pre_reception_scans": "number_or_unknown",
      "head_movement_angle": "left | right | backward | forward | unknown"
    },
    "decision_intelligence": {
      "best_option": "string",
      "simple_option": "string",
      "risk_level": "low | medium | high | unknown",
      "decision_time": "number_or_unknown",
      "reaction_time": "number_or_unknown"
    },
    "technical_execution": {
      "pass_direction": "forward | diagonal | lateral | backward | unknown",
      "pass_success": "successful | turnover | unknown",
      "dribbling_success": "beaten | failed | unknown",
      "shot_direction": "top_corner | bottom_corner | central | wide | unknown",
      "execution_quality": "excellent | good | average | poor | unknown",
      "ball_loss_classification": "wrong_decision | poor_execution | none | unknown"
    },
    "off_ball_intelligence": {
      "availability_index": "high | medium | low | unknown",
      "progressive_opportunity_index": "high | medium | low | unknown",
      "spatial_awareness": "excellent | good | average | poor | unknown",
      "tsx_cognitive_index": "number_or_unknown"
    },
    "tactical_notes": "extremely detailed analysis of this exact moment - describe player positions, ball movement, tactical setup, pressing triggers, spatial relationships, and what's developing",
    "formation_analysis": {
      "team_a_formation": "string",
      "team_b_formation": "string",
      "pressing_structure": "string",
      "build_up_patterns": "string"
    },
    "performance_insight": "specific observations for this moment"
  },
  {
    "timestamp": 1.0,
    ... (continue for every second of the video)
  },
  {
    "timestamp": 2.0,
    ...
  }
]
```

**Rules:**
- Return ONLY a valid JSON **ARRAY** (not a single object)
- **Create one analysis per SECOND** of video duration
- **Cover the ENTIRE video** from timestamp 0.0 to the final frame
- Each timestamp should be a **SEPARATE, DISTINCT MOMENT** - don't skip seconds
- **Be extremely detailed** in tactical_notes - describe exact positions, movements, decisions
- Include micro-details: body orientation, first touch, scanning, pressure received
- Track how the situation EVOLVES second by second
- Do not include explanations outside the JSON array
- Do not include markdown code blocks (unless wrapping the entire array)
- Use "unknown" for any metric that cannot be determined at that timestamp
- **MORE IS BETTER** - provide comprehensive, granular analysis
- Focus on **CONTINUOUS TEMPORAL TRACKING** of the action
"""
