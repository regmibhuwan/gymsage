#!/bin/bash
set -e

echo "🔍 Current directory: $(pwd)"
echo "📁 Directory contents:"
ls -la

echo "🐍 Python version: $(python --version)"
echo "📦 Pip version: $(pip --version)"

echo "✅ Starting FastAPI application..."
exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001}

