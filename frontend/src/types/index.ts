/**
 * Shared TypeScript types for the AI Body Analyzer frontend.
 */

// ── Auth ────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

// ── User ────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
}

export interface UserUpdateRequest {
  name?: string;
  avatar_url?: string;
}

// ── Image ───────────────────────────────────────────────────

export interface ImageData {
  id: string;
  file_path: string;
  thumbnail_path: string | null;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
}

// ── Analysis ────────────────────────────────────────────────

export interface Proportions {
  shoulder_to_hip_ratio: number;
  shoulder_width: number;
  hip_width: number;
  waist_width?: number;
  waist_to_shoulder_ratio?: number;
  left_arm_length: number;
  right_arm_length: number;
  arm_symmetry: number;
  left_leg_length: number;
  right_leg_length: number;
  leg_symmetry: number;
  left_upper_arm: number;
  left_forearm: number;
  right_upper_arm: number;
  right_forearm: number;
  left_thigh: number;
  left_calf: number;
  right_thigh: number;
  right_calf: number;
  torso_length: number;
}

export interface Posture {
  shoulder_tilt: number;
  hip_tilt: number;
  head_alignment: number;
}

export interface WeakZone {
  zone: string;
  label: string;
  description: string;
  severity: "low" | "moderate" | "high";
}

export interface Recommendation {
  id: string;
  muscle_group: string;
  exercise: string;
  description: string;
  priority: number;
}

export interface MuscleGroupInfo {
  score: number;
  description: string;
}

export interface GeminiAnalysis {
  body_type: string;
  photo_type?: "full_body" | "torso_only";
  waist_shoulder_ratio: number;
  body_fat_pct: number;
  dryness_score?: number;
  muscle_mass_score?: number;
  overall_rating?: number;
  muscle_groups?: {
    shoulders: MuscleGroupInfo;
    chest: MuscleGroupInfo;
    back: MuscleGroupInfo;
    arms: MuscleGroupInfo;
    core: MuscleGroupInfo;
    legs: MuscleGroupInfo;
  };
  torso_leg_ratio: number;
  arm_length_ratio: number;
  overall_assessment: string;
}

export interface Analysis {
  id: string;
  image_id: string;
  keypoints: Record<string, { x: number; y: number; z: number; visibility: number }>;
  proportions: Proportions;
  posture: Posture;
  weak_zones: WeakZone[];
  gemini_analysis?: GeminiAnalysis | null;
  annotated_image_path: string | null;
  recommendations: Recommendation[];
  created_at: string;
  image_path?: string | null;
  height?: number | null;
  weight?: number | null;
  estimated_height?: number | null;
  estimated_weight?: number | null;
}

export interface AnalysisSummary {
  id: string;
  image_id: string;
  proportions: Proportions;
  weak_zones: WeakZone[];
  gemini_analysis?: GeminiAnalysis | null;
  created_at: string;
}

// ── Chat ────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface ChatRequest {
  message: string;
  analysis_id?: string;
}

export interface ChatResponse {
  reply: string;
  message_id: string;
}
