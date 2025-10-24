#!/bin/bash

# GymSage Deployment Helper Script
# This script helps you prepare your app for deployment

echo "🚀 GymSage Deployment Helper"
echo "=============================="
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    git add .
    git commit -m "Initial commit - Ready for deployment"
    echo "✅ Git repository initialized"
    echo ""
    echo "📝 Next steps:"
    echo "1. Create a new repository on GitHub"
    echo "2. Run: git remote add origin YOUR_GITHUB_REPO_URL"
    echo "3. Run: git push -u origin main"
else
    echo "✅ Git repository already initialized"
fi

echo ""
echo "🎯 Deployment Checklist:"
echo ""
echo "Frontend (Vercel):"
echo "  [ ] Push code to GitHub"
echo "  [ ] Connect repo to Vercel"
echo "  [ ] Set REACT_APP_API_URL"
echo "  [ ] Set REACT_APP_ANALYZER_URL"
echo ""
echo "Backend (Render):"
echo "  [ ] Connect repo to Render"
echo "  [ ] Set OPENAI_API_KEY"
echo "  [ ] Set SUPABASE_URL"
echo "  [ ] Set SUPABASE_KEY"
echo "  [ ] Set JWT_SECRET"
echo "  [ ] Set FRONTEND_URL (Vercel URL)"
echo ""
echo "Analyzer (Render):"
echo "  [ ] Connect repo to Render"
echo "  [ ] No env vars needed!"
echo ""
echo "📚 Read DEPLOYMENT.md for detailed instructions"
echo ""

