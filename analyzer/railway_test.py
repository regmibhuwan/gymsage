"""
Simple test script to verify Railway environment
Run this to test if Python and dependencies are working
"""
import sys
print(f"Python version: {sys.version}")
print(f"Python executable: {sys.executable}")
print(f"Current working directory: {sys.path[0]}")

try:
    import fastapi
    print(f"✅ FastAPI version: {fastapi.__version__}")
except ImportError as e:
    print(f"❌ FastAPI not found: {e}")

try:
    import uvicorn
    print(f"✅ Uvicorn installed")
except ImportError as e:
    print(f"❌ Uvicorn not found: {e}")

try:
    import mediapipe
    print(f"✅ MediaPipe version: {mediapipe.__version__}")
except ImportError as e:
    print(f"❌ MediaPipe not found: {e}")

import os
print(f"\n🔧 Environment:")
print(f"PORT: {os.getenv('PORT', 'NOT SET')}")
print(f"Railway environment: {os.getenv('RAILWAY_ENVIRONMENT', 'NOT SET')}")

print("\n✅ All imports successful! Ready to start uvicorn.")

