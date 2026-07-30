"""
Computer Vision Service — MediaPipe Pose estimation + body analysis.
Runs server-side for canonical analysis results.
"""

import asyncio
import math
from pathlib import Path

import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision


# ── MediaPipe Pose Landmarker Setup ──────────────────────────

_landmarker = None
_MODEL_PATH = None


def _get_model_path() -> str:
    """Download or locate the pose landmarker model."""
    global _MODEL_PATH
    if _MODEL_PATH and Path(_MODEL_PATH).exists():
        return _MODEL_PATH

    import urllib.request
    model_dir = Path(__file__).parent.parent.parent / "models"
    model_dir.mkdir(exist_ok=True)
    model_path = model_dir / "pose_landmarker_full.task"

    if not model_path.exists():
        url = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
        urllib.request.urlretrieve(url, str(model_path))

    _MODEL_PATH = str(model_path)
    return _MODEL_PATH


def _get_landmarker():
    """Lazy-init the PoseLandmarker singleton."""
    global _landmarker
    if _landmarker is None:
        base_options = mp_python.BaseOptions(model_asset_path=_get_model_path())
        options = vision.PoseLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.IMAGE,
            num_poses=1,
        )
        _landmarker = vision.PoseLandmarker.create_from_options(options)
    return _landmarker


# ── Landmark Indices ─────────────────────────────────────────

class P:
    """MediaPipe Pose landmark indices."""
    NOSE = 0
    L_EYE_INNER = 1
    L_EYE = 2
    L_EYE_OUTER = 3
    R_EYE_INNER = 4
    R_EYE = 5
    R_EYE_OUTER = 6
    L_EAR = 7
    R_EAR = 8
    L_SHOULDER = 11
    R_SHOULDER = 12
    L_ELBOW = 13
    R_ELBOW = 14
    L_WRIST = 15
    R_WRIST = 16
    L_HIP = 23
    R_HIP = 24
    L_KNEE = 25
    R_KNEE = 26
    L_ANKLE = 27
    R_ANKLE = 28
    L_WAIST = 33
    R_WAIST = 34


SKELETON_CONNECTIONS = [
    (11, 12), (11, 13), (13, 15), (12, 14), (14, 16),
    (11, 33), (33, 23), (12, 34), (34, 24), (23, 24), (33, 34),
    (23, 25), (25, 27), (24, 26), (26, 28),
]


# ── Geometry Helpers ─────────────────────────────────────────

def _dist(a, b) -> float:
    return math.hypot(a.x - b.x, a.y - b.y)


def _midpoint(a, b):
    return type(a)(x=(a.x + b.x) / 2, y=(a.y + b.y) / 2, z=(a.z + b.z) / 2)


def _symmetry_pct(left: float, right: float) -> float:
    avg = (left + right) / 2
    if avg == 0:
        return 100.0
    return round(100 - abs(left - right) / avg * 100, 1)


def _tilt_pct(a, b, ref_dist: float) -> float:
    if ref_dist == 0:
        return 0.0
    return round(abs(a.y - b.y) / ref_dist * 100, 1)


# ── Core Analysis ────────────────────────────────────────────

def _compute_proportions(lm) -> dict:
    """Compute body proportions from landmarks."""
    shoulder_w = _dist(lm[P.L_SHOULDER], lm[P.R_SHOULDER])
    hip_w = _dist(lm[P.L_HIP], lm[P.R_HIP])

    l_upper_arm = _dist(lm[P.L_SHOULDER], lm[P.L_ELBOW])
    l_forearm = _dist(lm[P.L_ELBOW], lm[P.L_WRIST])
    r_upper_arm = _dist(lm[P.R_SHOULDER], lm[P.R_ELBOW])
    r_forearm = _dist(lm[P.R_ELBOW], lm[P.R_WRIST])

    l_arm = l_upper_arm + l_forearm
    r_arm = r_upper_arm + r_forearm

    l_thigh = _dist(lm[P.L_HIP], lm[P.L_KNEE])
    l_calf = _dist(lm[P.L_KNEE], lm[P.L_ANKLE])
    r_thigh = _dist(lm[P.R_HIP], lm[P.R_KNEE])
    r_calf = _dist(lm[P.R_KNEE], lm[P.R_ANKLE])

    l_leg = l_thigh + l_calf
    r_leg = r_thigh + r_calf

    # Torso length (mid-shoulders to mid-hips)
    torso = _dist(lm[P.L_SHOULDER], lm[P.L_HIP])  # approximate

    # Compute custom waist metrics if landmarks are present
    waist_w = 0.0
    waist_to_shoulder_ratio = 0.0
    if len(lm) > 34:
        waist_w = _dist(lm[P.L_WAIST], lm[P.R_WAIST])
        waist_to_shoulder_ratio = round(waist_w / shoulder_w, 3) if shoulder_w else 0.0

    return {
        "shoulder_to_hip_ratio": round(shoulder_w / hip_w, 3) if hip_w else 0,
        "shoulder_width": round(shoulder_w, 4),
        "hip_width": round(hip_w, 4),
        "waist_width": round(waist_w, 4),
        "waist_to_shoulder_ratio": waist_to_shoulder_ratio,
        "left_arm_length": round(l_arm, 4),
        "right_arm_length": round(r_arm, 4),
        "arm_symmetry": _symmetry_pct(l_arm, r_arm),
        "left_leg_length": round(l_leg, 4),
        "right_leg_length": round(r_leg, 4),
        "leg_symmetry": _symmetry_pct(l_leg, r_leg),
        "left_upper_arm": round(l_upper_arm, 4),
        "left_forearm": round(l_forearm, 4),
        "right_upper_arm": round(r_upper_arm, 4),
        "right_forearm": round(r_forearm, 4),
        "left_thigh": round(l_thigh, 4),
        "left_calf": round(l_calf, 4),
        "right_thigh": round(r_thigh, 4),
        "right_calf": round(r_calf, 4),
        "torso_length": round(torso, 4),
    }


def _compute_posture(lm) -> dict:
    """Analyze posture from landmarks."""
    shoulder_w = _dist(lm[P.L_SHOULDER], lm[P.R_SHOULDER])
    hip_w = _dist(lm[P.L_HIP], lm[P.R_HIP])

    return {
        "shoulder_tilt": _tilt_pct(lm[P.L_SHOULDER], lm[P.R_SHOULDER], shoulder_w),
        "hip_tilt": _tilt_pct(lm[P.L_HIP], lm[P.R_HIP], hip_w),
        "head_alignment": round(
            abs(lm[P.NOSE].x - (lm[P.L_SHOULDER].x + lm[P.R_SHOULDER].x) / 2) / shoulder_w * 100, 1
        ) if shoulder_w else 0,
    }


def _detect_weak_zones(proportions: dict, posture: dict, legs_visible: bool = True) -> list[dict]:
    """Heuristic detection of potentially weak muscle groups."""
    zones = []

    ratio = proportions.get("shoulder_to_hip_ratio", 0)
    if ratio < 1.2:
        zones.append({
            "zone": "shoulders_back",
            "label": "Плечі та спина",
            "description": "Вузькі плечі відносно талії — рекомендовано більше уваги дельтам та широчайшим.",
            "severity": "moderate",
        })
    elif ratio > 1.6 and legs_visible:
        zones.append({
            "zone": "legs_glutes",
            "label": "Ноги та сідниці",
            "description": "Виражена V-подібна фігура — перевірте баланс з нижньою частиною тіла.",
            "severity": "low",
        })

    if proportions.get("arm_symmetry", 100) < 95:
        zones.append({
            "zone": "arms",
            "label": "Симетрія рук",
            "description": "Помітна асиметрія довжини рук — додайте unilateral (однобічні) вправи.",
            "severity": "moderate",
        })

    if legs_visible and proportions.get("leg_symmetry", 100) < 95:
        zones.append({
            "zone": "legs",
            "label": "Симетрія ніг",
            "description": "Помітна асиметрія ніг — зверніть увагу на баланс навантаження.",
            "severity": "moderate",
        })

    if posture.get("shoulder_tilt", 0) > 6:
        zones.append({
            "zone": "posture_shoulders",
            "label": "Постава: плечі",
            "description": "Нерівні плечі — можливий дисбаланс трапецій або бічний нахил.",
            "severity": "high",
        })

    if posture.get("hip_tilt", 0) > 6:
        zones.append({
            "zone": "posture_hips",
            "label": "Постава: таз",
            "description": "Нерівний таз — рекомендована робота над core stability та мобільністю тазу.",
            "severity": "high",
        })

    if posture.get("head_alignment", 0) > 5:
        zones.append({
            "zone": "posture_head",
            "label": "Постава: голова",
            "description": "Голова зміщена відносно центру плечей — можлива forward head posture.",
            "severity": "moderate",
        })

    return zones


def _generate_annotated_image(image_path: str, landmarks, output_path: str) -> str:
    """Draw skeleton overlay on the image and save."""
    img = cv2.imread(image_path)
    if img is None:
        raise ValueError(f"Cannot read image: {image_path}")

    h, w = img.shape[:2]

    # Helper to check if landmark is visible and inside frame
    def is_visible(pt) -> bool:
        vis = pt.visibility if hasattr(pt, 'visibility') else 1.0
        return vis > 0.45 and 0.0 <= pt.x <= 1.0 and 0.0 <= pt.y <= 1.0

    # Draw connections
    for a_idx, b_idx in SKELETON_CONNECTIONS:
        a = landmarks[a_idx]
        b = landmarks[b_idx]
        if not (is_visible(a) and is_visible(b)):
            continue
        pt_a = (int(a.x * w), int(a.y * h))
        pt_b = (int(b.x * w), int(b.y * h))
        
        # Black contour line for thickness and contrast
        cv2.line(img, pt_a, pt_b, (0, 0, 0), 5, cv2.LINE_AA)
        # Glowing Neon Purple line
        cv2.line(img, pt_a, pt_b, (240, 20, 240), 2, cv2.LINE_AA)

    # Draw landmarks
    for idx in [P.NOSE, P.L_SHOULDER, P.R_SHOULDER, P.L_ELBOW, P.R_ELBOW,
                P.L_WRIST, P.R_WRIST, P.L_HIP, P.R_HIP,
                P.L_KNEE, P.R_KNEE, P.L_ANKLE, P.R_ANKLE,
                P.L_WAIST, P.R_WAIST]:
        pt = landmarks[idx]
        if not is_visible(pt):
            continue
        center = (int(pt.x * w), int(pt.y * h))
        # Black outer circle with Neon Purple core
        cv2.circle(img, center, 7, (0, 0, 0), -1, cv2.LINE_AA)
        cv2.circle(img, center, 4, (240, 20, 240), -1, cv2.LINE_AA)

    # Create overlay for transparent sci-fi radar/mesh elements
    overlay = img.copy()

    # 1. Torso scanning diagonals
    torso_pairs = [
        (P.L_SHOULDER, P.R_WAIST),
        (P.R_SHOULDER, P.L_WAIST),
        (P.L_WAIST, P.R_HIP),
        (P.R_WAIST, P.L_HIP),
    ]
    for a_idx, b_idx in torso_pairs:
        a = landmarks[a_idx]
        b = landmarks[b_idx]
        if is_visible(a) and is_visible(b):
            pt_a = (int(a.x * w), int(a.y * h))
            pt_b = (int(b.x * w), int(b.y * h))
            cv2.line(overlay, pt_a, pt_b, (240, 20, 240), 1, cv2.LINE_AA)

    # 2. Concentric scanning targets
    # Chest target (between shoulders)
    sh_l = landmarks[P.L_SHOULDER]
    sh_r = landmarks[P.R_SHOULDER]
    if is_visible(sh_l) and is_visible(sh_r):
        chest_center = (int((sh_l.x + sh_r.x) / 2 * w), int((sh_l.y + sh_r.y) / 2 * h))
        cv2.circle(overlay, chest_center, 12, (240, 20, 240), 1, cv2.LINE_AA)
        cv2.circle(overlay, chest_center, 24, (240, 20, 240), 1, cv2.LINE_AA)
        # Target ticks
        cv2.line(overlay, (chest_center[0] - 32, chest_center[1]), (chest_center[0] - 6, chest_center[1]), (240, 20, 240), 1, cv2.LINE_AA)
        cv2.line(overlay, (chest_center[0] + 6, chest_center[1]), (chest_center[0] + 32, chest_center[1]), (240, 20, 240), 1, cv2.LINE_AA)
        cv2.line(overlay, (chest_center[0], chest_center[1] - 32), (chest_center[0], chest_center[1] - 6), (240, 20, 240), 1, cv2.LINE_AA)
        cv2.line(overlay, (chest_center[0], chest_center[1] + 6), (chest_center[0], chest_center[1] + 32), (240, 20, 240), 1, cv2.LINE_AA)

    # Waist target (between waist points)
    w_l = landmarks[P.L_WAIST]
    w_r = landmarks[P.R_WAIST]
    if is_visible(w_l) and is_visible(w_r):
        waist_center = (int((w_l.x + w_r.x) / 2 * w), int((w_l.y + w_r.y) / 2 * h))
        cv2.circle(overlay, waist_center, 10, (240, 20, 240), 1, cv2.LINE_AA)
        cv2.circle(overlay, waist_center, 18, (240, 20, 240), 1, cv2.LINE_AA)
        # Target ticks
        cv2.line(overlay, (waist_center[0] - 24, waist_center[1]), (waist_center[0] - 4, waist_center[1]), (240, 20, 240), 1, cv2.LINE_AA)
        cv2.line(overlay, (waist_center[0] + 4, waist_center[1]), (waist_center[0] + 24, waist_center[1]), (240, 20, 240), 1, cv2.LINE_AA)

    # Blend overlay with transparency
    alpha = 0.40
    cv2.addWeighted(overlay, alpha, img, 1 - alpha, 0, dst=img)

    cv2.imwrite(output_path, img)
    return output_path


def _adjust_symmetric_pair(lm, idx_l, idx_r, gem_l, gem_r, max_y_shift=0.10, min_scale=0.8, max_scale=1.4):
    """
    Adjusts a pair of landmarks (left and right) based on Gemini's width and Y-shift,
    while preserving MediaPipe's horizontal center and relative tilt.
    """
    if not (isinstance(gem_l, list) and len(gem_l) == 2 and isinstance(gem_r, list) and len(gem_r) == 2):
        return
        
    p_l = lm[idx_l]
    p_r = lm[idx_r]
    
    # 1. MediaPipe metrics
    mp_x_mid = (p_l.x + p_r.x) / 2
    mp_y_mid = (p_l.y + p_r.y) / 2
    mp_width = abs(p_r.x - p_l.x)
    
    # 2. Gemini metrics
    gem_x_mid = (gem_l[0] + gem_r[0]) / 2
    gem_y_mid = (gem_l[1] + gem_r[1]) / 2
    gem_width = abs(gem_r[0] - gem_l[0])
    
    # 3. Calculate width scale factor
    sw = gem_width / mp_width if mp_width > 0 else 1.0
    sw = max(min_scale, min(max_scale, sw))
    
    # 4. Calculate vertical shift
    dy = gem_y_mid - mp_y_mid
    dy = max(-max_y_shift, min(max_y_shift, dy))
    
    # 5. Apply changes
    # Scale X relative to the original midpoint
    p_l.x = mp_x_mid + sw * (p_l.x - mp_x_mid)
    p_r.x = mp_x_mid + sw * (p_r.x - mp_x_mid)
    
    # Shift Y
    p_l.y = p_l.y + dy
    p_r.y = p_r.y + dy


# ── Public API ───────────────────────────────────────────────

async def run_pose_analysis(image_path: str, corrected_keypoints: dict | None = None, legs_visible: bool | None = None) -> dict:
    """
    Main entry point: run MediaPipe pose estimation and compute all metrics.
    Returns dict with keypoints, proportions, posture, weak_zones, annotated_image_path.
    """
    def _sync_analysis():
        landmarker = _get_landmarker()
        mp_image = mp.Image.create_from_file(image_path)
        result = landmarker.detect(mp_image)

        if not result.pose_landmarks or len(result.pose_landmarks) == 0:
            raise ValueError("No body detected in the image. Please use a full-body frontal photo.")

        lm = result.pose_landmarks[0]

        # Convert to standard Python mutable list so we can append custom landmarks
        class CustomLandmark:
            def __init__(self, x, y, z=0.0, visibility=1.0):
                self.x = x
                self.y = y
                self.z = z
                self.visibility = visibility

        landmarks_list = [
            CustomLandmark(pt.x, pt.y, pt.z, pt.visibility if hasattr(pt, 'visibility') else 1.0)
            for pt in lm
        ]

        # Initialize waist points as midpoints between shoulders and hips
        l_shoulder = landmarks_list[P.L_SHOULDER]
        r_shoulder = landmarks_list[P.R_SHOULDER]
        l_hip = landmarks_list[P.L_HIP]
        r_hip = landmarks_list[P.R_HIP]

        left_waist = CustomLandmark(
            x=l_shoulder.x + 0.6 * (l_hip.x - l_shoulder.x),
            y=l_shoulder.y + 0.6 * (l_hip.y - l_shoulder.y),
            z=l_shoulder.z + 0.6 * (l_hip.z - l_shoulder.z)
        )
        right_waist = CustomLandmark(
            x=r_shoulder.x + 0.6 * (r_hip.x - r_shoulder.x),
            y=r_shoulder.y + 0.6 * (r_hip.y - r_shoulder.y),
            z=r_shoulder.z + 0.6 * (r_hip.z - r_shoulder.z)
        )
        landmarks_list.append(left_waist)  # Index 33 (P.L_WAIST)
        landmarks_list.append(right_waist) # Index 34 (P.R_WAIST)

        # Determine if legs are visible for weak zone detection
        legs_visible_actual = legs_visible if legs_visible is not None else True

        # If corrected_keypoints are provided by Gemini, adjust landmarks.
        # We use a mathematically stabilized method: shift the height (Y) and scale the width (X)
        # of left/right landmark pairs to match Gemini's visual landmarks, while preserving
        # MediaPipe's horizontal centering and precise local relative tilt.
        if corrected_keypoints:
            # Save original Y coordinates of the lower body & waist in case of validation failure
            orig_y = {
                P.L_WAIST: landmarks_list[P.L_WAIST].y,
                P.R_WAIST: landmarks_list[P.R_WAIST].y,
                P.L_KNEE: landmarks_list[P.L_KNEE].y,
                P.R_KNEE: landmarks_list[P.R_KNEE].y,
                P.L_ANKLE: landmarks_list[P.L_ANKLE].y,
                P.R_ANKLE: landmarks_list[P.R_ANKLE].y,
            }

            # 1. Adjust shoulders
            if "left_shoulder" in corrected_keypoints and "right_shoulder" in corrected_keypoints:
                _adjust_symmetric_pair(landmarks_list, P.L_SHOULDER, P.R_SHOULDER, corrected_keypoints["left_shoulder"], corrected_keypoints["right_shoulder"])

            # 2. Adjust hips
            if "left_hip" in corrected_keypoints and "right_hip" in corrected_keypoints:
                _adjust_symmetric_pair(landmarks_list, P.L_HIP, P.R_HIP, corrected_keypoints["left_hip"], corrected_keypoints["right_hip"])

            # 3. Adjust waist
            if "left_waist" in corrected_keypoints and "right_waist" in corrected_keypoints:
                _adjust_symmetric_pair(landmarks_list, P.L_WAIST, P.R_WAIST, corrected_keypoints["left_waist"], corrected_keypoints["right_waist"])

            # 4. Adjust knees
            if legs_visible_actual and "left_knee" in corrected_keypoints and "right_knee" in corrected_keypoints:
                _adjust_symmetric_pair(landmarks_list, P.L_KNEE, P.R_KNEE, corrected_keypoints["left_knee"], corrected_keypoints["right_knee"])

            # 5. Adjust ankles
            if legs_visible_actual and "left_ankle" in corrected_keypoints and "right_ankle" in corrected_keypoints:
                _adjust_symmetric_pair(landmarks_list, P.L_ANKLE, P.R_ANKLE, corrected_keypoints["left_ankle"], corrected_keypoints["right_ankle"])

            # Anatomical validation: 
            # - Hip Y < Knee Y < Ankle Y <= 1.0
            # - Shoulder Y < Waist Y < Hip Y
            if legs_visible_actual:
                left_leg_valid = landmarks_list[P.L_HIP].y < landmarks_list[P.L_KNEE].y < landmarks_list[P.L_ANKLE].y and landmarks_list[P.L_ANKLE].y <= 1.0
                right_leg_valid = landmarks_list[P.R_HIP].y < landmarks_list[P.R_KNEE].y < landmarks_list[P.R_ANKLE].y and landmarks_list[P.R_ANKLE].y <= 1.0
            else:
                left_leg_valid = True
                right_leg_valid = True
            
            left_waist_valid = landmarks_list[P.L_SHOULDER].y < landmarks_list[P.L_WAIST].y < landmarks_list[P.L_HIP].y
            right_waist_valid = landmarks_list[P.R_SHOULDER].y < landmarks_list[P.R_WAIST].y < landmarks_list[P.R_HIP].y

            if not left_leg_valid:
                landmarks_list[P.L_KNEE].y = orig_y[P.L_KNEE]
                landmarks_list[P.L_ANKLE].y = orig_y[P.L_ANKLE]
            if not right_leg_valid:
                landmarks_list[P.R_KNEE].y = orig_y[P.R_KNEE]
                landmarks_list[P.R_ANKLE].y = orig_y[P.R_ANKLE]

            if not left_waist_valid:
                landmarks_list[P.L_WAIST].y = orig_y[P.L_WAIST]
            if not right_waist_valid:
                landmarks_list[P.R_WAIST].y = orig_y[P.R_WAIST]

        # Compute metrics
        proportions = _compute_proportions(landmarks_list)
        posture = _compute_posture(landmarks_list)

        # Zero out leg metrics when legs are not visible/assessable
        if not legs_visible_actual:
            proportions["leg_symmetry"] = 0.0
            proportions["left_leg_length"] = 0.0
            proportions["right_leg_length"] = 0.0
            proportions["left_thigh"] = 0.0
            proportions["left_calf"] = 0.0
            proportions["right_thigh"] = 0.0
            proportions["right_calf"] = 0.0

        weak_zones = _detect_weak_zones(proportions, posture, legs_visible=legs_visible_actual)

        # Serialize keypoints
        keypoints = {}
        landmark_names = [
            "nose", "left_eye_inner", "left_eye", "left_eye_outer",
            "right_eye_inner", "right_eye", "right_eye_outer",
            "left_ear", "right_ear", "mouth_left", "mouth_right",
            "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
            "left_wrist", "right_wrist", "left_pinky", "right_pinky",
            "left_index", "right_index", "left_thumb", "right_thumb",
            "left_hip", "right_hip", "left_knee", "right_knee",
            "left_ankle", "right_ankle", "left_heel", "right_heel",
            "left_foot_index", "right_foot_index",
            "left_waist", "right_waist"
        ]
        for i, name in enumerate(landmark_names):
            if i < len(landmarks_list):
                keypoints[name] = {
                    "x": round(landmarks_list[i].x, 5),
                    "y": round(landmarks_list[i].y, 5),
                    "z": round(landmarks_list[i].z, 5),
                    "visibility": round(landmarks_list[i].visibility, 3),
                }

        # Generate annotated image
        annotated_path = image_path.rsplit(".", 1)[0] + "_annotated.jpg"
        try:
            _generate_annotated_image(image_path, landmarks_list, annotated_path)
        except Exception:
            annotated_path = None

        return {
            "keypoints": keypoints,
            "proportions": proportions,
            "posture": posture,
            "weak_zones": weak_zones,
            "annotated_image_path": annotated_path,
        }

    # Run CPU-bound CV work in a thread pool
    return await asyncio.to_thread(_sync_analysis)
