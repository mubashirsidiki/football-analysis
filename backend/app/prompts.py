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
