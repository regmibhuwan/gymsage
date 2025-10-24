from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import cv2
import mediapipe as mp
import numpy as np
from PIL import Image
import io
import base64
import json
import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(
    title="GymSage Photo Analyzer",
    description="AI-powered photo analysis for fitness progress tracking",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize MediaPipe
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
pose = mp_pose.Pose(
    static_image_mode=True,
    model_complexity=2,
    enable_segmentation=False,
    min_detection_confidence=0.5
)

class PhotoAnalysisRequest(BaseModel):
    photo_id: str
    view: str  # 'front', 'side', or 'back'
    image_data: Optional[str] = None  # Base64 encoded image
    image_url: Optional[str] = None  # URL to fetch image from

class AnalysisResult(BaseModel):
    photo_id: str
    success: bool
    analysis: Optional[Dict[str, Any]] = None
    error: Optional[str] = None

class MeasurementData(BaseModel):
    measurements: Dict[str, float]
    keypoints: List[Dict[str, float]]
    confidence: float
    view: str

def calculate_distance(point1: tuple, point2: tuple) -> float:
    """Calculate Euclidean distance between two points"""
    return np.sqrt((point1[0] - point2[0])**2 + (point1[1] - point2[1])**2)

def calculate_body_measurements(landmarks, image_width: int, image_height: int) -> Dict[str, float]:
    """
    Calculate body measurements from pose landmarks
    This is a simplified version - in a real app, you'd need calibration
    """
    measurements = {}
    
    if not landmarks:
        return measurements
    
    # Convert landmarks to pixel coordinates
    points = {}
    for idx, landmark in enumerate(landmarks.landmark):
        x = int(landmark.x * image_width)
        y = int(landmark.y * image_height)
        points[idx] = (x, y)
    
    # Define MediaPipe pose landmark indices
    # https://google.github.io/mediapipe/solutions/pose.html
    LEFT_SHOULDER = 11
    RIGHT_SHOULDER = 12
    LEFT_HIP = 23
    RIGHT_HIP = 24
    LEFT_ELBOW = 13
    RIGHT_ELBOW = 14
    LEFT_WRIST = 15
    RIGHT_WRIST = 16
    LEFT_KNEE = 25
    RIGHT_KNEE = 26
    LEFT_ANKLE = 27
    RIGHT_ANKLE = 28
    
    try:
        # Shoulder width
        if LEFT_SHOULDER in points and RIGHT_SHOULDER in points:
            measurements['shoulder_width'] = calculate_distance(
                points[LEFT_SHOULDER], points[RIGHT_SHOULDER]
            )
        
        # Hip width
        if LEFT_HIP in points and RIGHT_HIP in points:
            measurements['hip_width'] = calculate_distance(
                points[LEFT_HIP], points[RIGHT_HIP]
            )
        
        # Arm length (shoulder to wrist)
        if LEFT_SHOULDER in points and LEFT_WRIST in points:
            measurements['left_arm_length'] = calculate_distance(
                points[LEFT_SHOULDER], points[LEFT_WRIST]
            )
        
        if RIGHT_SHOULDER in points and RIGHT_WRIST in points:
            measurements['right_arm_length'] = calculate_distance(
                points[RIGHT_SHOULDER], points[RIGHT_WRIST]
            )
        
        # Leg length (hip to ankle)
        if LEFT_HIP in points and LEFT_ANKLE in points:
            measurements['left_leg_length'] = calculate_distance(
                points[LEFT_HIP], points[LEFT_ANKLE]
            )
        
        if RIGHT_HIP in points and RIGHT_ANKLE in points:
            measurements['right_leg_length'] = calculate_distance(
                points[RIGHT_HIP], points[RIGHT_ANKLE]
            )
        
        # Torso length (shoulder to hip)
        if LEFT_SHOULDER in points and LEFT_HIP in points:
            measurements['torso_length'] = calculate_distance(
                points[LEFT_SHOULDER], points[LEFT_HIP]
            )
        
        # Calculate ratios for symmetry analysis
        if 'left_arm_length' in measurements and 'right_arm_length' in measurements:
            measurements['arm_symmetry_ratio'] = (
                measurements['left_arm_length'] / measurements['right_arm_length']
            )
        
        if 'left_leg_length' in measurements and 'right_leg_length' in measurements:
            measurements['leg_symmetry_ratio'] = (
                measurements['left_leg_length'] / measurements['right_leg_length']
            )
        
    except Exception as e:
        print(f"Error calculating measurements: {e}")
    
    return measurements

def extract_keypoints(landmarks) -> List[Dict[str, float]]:
    """Extract keypoint data from MediaPipe landmarks"""
    keypoints = []
    
    if not landmarks:
        return keypoints
    
    for idx, landmark in enumerate(landmarks.landmark):
        keypoints.append({
            'x': landmark.x,
            'y': landmark.y,
            'z': landmark.z,
            'visibility': landmark.visibility,
            'landmark_id': idx
        })
    
    return keypoints

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "GymSage Photo Analyzer API",
        "status": "healthy",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "service": "photo-analyzer",
        "mediapipe_available": True,
        "opencv_available": True
    }

@app.post("/analyze-photo", response_model=AnalysisResult)
async def analyze_photo(request: PhotoAnalysisRequest):
    """
    Analyze a progress photo and extract body measurements
    """
    try:
        # Load image from URL or base64
        if request.image_url:
            try:
                response = requests.get(request.image_url, timeout=10)
                response.raise_for_status()
                image = Image.open(io.BytesIO(response.content))
                image_rgb = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Failed to fetch image from URL: {str(e)}")
        elif request.image_data:
            # Decode base64 image
            try:
                image_data = base64.b64decode(request.image_data)
                image = Image.open(io.BytesIO(image_data))
                image_rgb = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid image data: {str(e)}")
        else:
            raise HTTPException(status_code=400, detail="No image data or URL provided")
        
        # Process image with MediaPipe
        image_rgb = cv2.cvtColor(image_rgb, cv2.COLOR_BGR2RGB)
        results = pose.process(image_rgb)
        
        if not results.pose_landmarks:
            return AnalysisResult(
                photo_id=request.photo_id,
                success=False,
                error="No pose detected in image. Please ensure the person is clearly visible."
            )
        
        # Extract measurements and keypoints
        image_height, image_width, _ = image_rgb.shape
        measurements = calculate_body_measurements(
            results.pose_landmarks, image_width, image_height
        )
        keypoints = extract_keypoints(results.pose_landmarks)
        
        # Calculate overall confidence
        confidence = np.mean([kp['visibility'] for kp in keypoints])
        
        analysis_data = {
            'measurements': measurements,
            'keypoints': keypoints,
            'confidence': float(confidence),
            'view': request.view,
            'image_dimensions': {
                'width': image_width,
                'height': image_height
            },
            'landmarks_detected': len(keypoints)
        }
        
        return AnalysisResult(
            photo_id=request.photo_id,
            success=True,
            analysis=analysis_data
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error analyzing photo: {e}")
        return AnalysisResult(
            photo_id=request.photo_id,
            success=False,
            error=f"Analysis failed: {str(e)}"
        )

@app.post("/analyze-photo-file")
async def analyze_photo_file(file: UploadFile = File(...), view: str = "front"):
    """
    Analyze a photo uploaded as a file
    """
    try:
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        # Read image data
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))
        image_rgb = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        # Process with MediaPipe
        image_rgb = cv2.cvtColor(image_rgb, cv2.COLOR_BGR2RGB)
        results = pose.process(image_rgb)
        
        if not results.pose_landmarks:
            return {
                "success": False,
                "error": "No pose detected in image"
            }
        
        # Extract data
        image_height, image_width, _ = image_rgb.shape
        measurements = calculate_body_measurements(
            results.pose_landmarks, image_width, image_height
        )
        keypoints = extract_keypoints(results.pose_landmarks)
        confidence = np.mean([kp['visibility'] for kp in keypoints])
        
        return {
            "success": True,
            "analysis": {
                "measurements": measurements,
                "keypoints": keypoints,
                "confidence": float(confidence),
                "view": view,
                "image_dimensions": {
                    "width": image_width,
                    "height": image_height
                }
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error analyzing uploaded photo: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

@app.get("/measurements/guide")
async def get_measurements_guide():
    """
    Get information about available measurements and their meanings
    """
    return {
        "measurements": {
            "shoulder_width": "Distance between left and right shoulders",
            "hip_width": "Distance between left and right hips",
            "left_arm_length": "Distance from left shoulder to left wrist",
            "right_arm_length": "Distance from right shoulder to right wrist",
            "left_leg_length": "Distance from left hip to left ankle",
            "right_leg_length": "Distance from right hip to right ankle",
            "torso_length": "Distance from shoulder to hip",
            "arm_symmetry_ratio": "Ratio of left to right arm length (1.0 = perfect symmetry)",
            "leg_symmetry_ratio": "Ratio of left to right leg length (1.0 = perfect symmetry)"
        },
        "notes": [
            "All measurements are in pixels and relative to image dimensions",
            "For accurate real-world measurements, camera calibration is required",
            "Symmetry ratios close to 1.0 indicate good bilateral symmetry",
            "Measurements are most accurate with front-facing photos"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
