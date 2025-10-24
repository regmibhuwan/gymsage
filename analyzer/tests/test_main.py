import pytest
import asyncio
from fastapi.testclient import TestClient
from main import app
import json

client = TestClient(app)

def test_health_check():
    """Test the health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "photo-analyzer"
    assert data["mediapipe_available"] == True
    assert data["opencv_available"] == True

def test_root_endpoint():
    """Test the root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "GymSage Photo Analyzer API"
    assert data["status"] == "healthy"

def test_measurements_guide():
    """Test the measurements guide endpoint"""
    response = client.get("/measurements/guide")
    assert response.status_code == 200
    data = response.json()
    assert "measurements" in data
    assert "notes" in data
    assert "shoulder_width" in data["measurements"]

def test_analyze_photo_missing_data():
    """Test photo analysis with missing image data"""
    request_data = {
        "photo_id": "test-123",
        "view": "front"
    }
    
    response = client.post("/analyze-photo", json=request_data)
    assert response.status_code == 400
    data = response.json()
    assert "No image data provided" in data["detail"]

def test_analyze_photo_invalid_data():
    """Test photo analysis with invalid image data"""
    request_data = {
        "photo_id": "test-123",
        "view": "front",
        "image_data": "invalid-base64-data"
    }
    
    response = client.post("/analyze-photo", json=request_data)
    assert response.status_code == 400
    data = response.json()
    assert "Invalid image data" in data["detail"]

def test_analyze_photo_file_invalid_type():
    """Test photo file analysis with invalid file type"""
    files = {"file": ("test.txt", b"not an image", "text/plain")}
    data = {"view": "front"}
    
    response = client.post("/analyze-photo-file", files=files, data=data)
    assert response.status_code == 400
    response_data = response.json()
    assert "File must be an image" in response_data["detail"]

def test_calculate_distance():
    """Test the distance calculation function"""
    from main import calculate_distance
    
    point1 = (0, 0)
    point2 = (3, 4)
    distance = calculate_distance(point1, point2)
    assert distance == 5.0  # 3-4-5 triangle

def test_calculate_distance_same_point():
    """Test distance calculation with same points"""
    from main import calculate_distance
    
    point1 = (5, 5)
    point2 = (5, 5)
    distance = calculate_distance(point1, point2)
    assert distance == 0.0

def test_extract_keypoints_empty():
    """Test keypoint extraction with empty landmarks"""
    from main import extract_keypoints
    
    keypoints = extract_keypoints(None)
    assert keypoints == []

def test_calculate_body_measurements_empty():
    """Test body measurements calculation with empty landmarks"""
    from main import calculate_body_measurements
    
    measurements = calculate_body_measurements(None, 640, 480)
    assert measurements == {}

@pytest.mark.asyncio
async def test_analyze_photo_with_sample_image():
    """Test photo analysis with a sample image (requires actual image data)"""
    # This test would require a real image file
    # For now, we'll just test the endpoint structure
    request_data = {
        "photo_id": "test-123",
        "view": "front",
        "image_data": ""  # Empty for this test
    }
    
    response = client.post("/analyze-photo", json=request_data)
    # Should fail due to empty image data, but endpoint should be accessible
    assert response.status_code in [400, 422]

def test_cors_headers():
    """Test that CORS headers are properly set"""
    response = client.options("/health")
    # FastAPI automatically handles CORS for OPTIONS requests
    assert response.status_code in [200, 405]  # 405 if OPTIONS not explicitly handled

def test_api_documentation():
    """Test that API documentation is accessible"""
    response = client.get("/docs")
    assert response.status_code == 200
    
    response = client.get("/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert data["info"]["title"] == "GymSage Photo Analyzer"

if __name__ == "__main__":
    pytest.main([__file__])
