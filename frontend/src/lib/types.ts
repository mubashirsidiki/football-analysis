export interface FrameAnalysis {
  timestamp: number;
  event: string;
  ball_position: string;
  players_detected: number;
  team_a_shape: string;
  team_b_shape: string;
  tactical_notes: string;
}

export interface AnalysisResponse {
  frames: FrameAnalysis[];
  total_frames: number;
  status: string;
}

