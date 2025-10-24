# 🚀 GymSage Deployment Guide

Deploy your GymSage app **100% FREE** using modern cloud platforms!

## 🎯 Deployment Architecture

- **Frontend**: Vercel (Free)
- **Backend**: Render (Free)
- **Python Analyzer**: Render (Free)
- **Database**: Supabase (Already configured - Free)
- **Storage**: Supabase Storage (Already configured - Free)

---

## 📋 Prerequisites

1. GitHub account
2. Vercel account (sign up with GitHub)
3. Render account (sign up with GitHub)
4. Your Supabase project (already set up)
5. OpenAI API key (you already have this)

---

## 🎨 Step 1: Deploy Frontend to Vercel

### A. Push to GitHub
```bash
# Initialize git if not already done
git init
git add .
git commit -m "Initial commit"

# Create GitHub repo and push
git remote add origin https://github.com/YOUR_USERNAME/gymsage.git
git branch -M main
git push -u origin main
```

### B. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your **GymSage** GitHub repository
4. Configure:
   - **Framework Preset**: Create React App
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`

5. Add **Environment Variables**:
   ```
   REACT_APP_API_URL=https://YOUR_BACKEND.onrender.com/api
   REACT_APP_ANALYZER_URL=https://YOUR_ANALYZER.onrender.com
   ```
   *(You'll update these URLs after deploying backend)*

6. Click **"Deploy"**

Your frontend will be live at: `https://gymsage-XXXXX.vercel.app`

---

## 🔧 Step 2: Deploy Backend to Render

### A. Create `render.yaml` (Backend)

Already done! The file is in the root directory.

### B. Deploy on Render

1. Go to [render.com](https://render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `gymsage-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: **Free**

5. Add **Environment Variables**:
   ```
   OPENAI_API_KEY=sk-proj-tll6zxmFr41YXR5NxwXu...
   SUPABASE_URL=https://huvuhuadutudukyplsji.supabase.co
   SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   JWT_SECRET=AHQWgAlIkwK+jyjNTpFoIeKl8X1xa8Wkxox3WGaUpeaDW6PEEqv8It39zlSmKn...
   PORT=3001
   NODE_ENV=production
   FRONTEND_URL=https://gymsage-XXXXX.vercel.app
   ANALYZER_URL=https://gymsage-analyzer.onrender.com
   ```

6. Click **"Create Web Service"**

Your backend will be live at: `https://gymsage-backend.onrender.com`

⚠️ **Important**: Free tier sleeps after 15 min of inactivity. First request takes 30-50 seconds to wake up.

---

## 🐍 Step 3: Deploy Python Analyzer to Render

### A. Create `requirements.txt` (Already done)

The analyzer already has `requirements.txt`.

### B. Deploy on Render

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `gymsage-analyzer`
   - **Root Directory**: `analyzer`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: **Free**

4. No environment variables needed for analyzer!

5. Click **"Create Web Service"**

Your analyzer will be live at: `https://gymsage-analyzer.onrender.com`

---

## 🔄 Step 4: Update Environment Variables

### A. Update Vercel (Frontend)

1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Update:
   ```
   REACT_APP_API_URL=https://gymsage-backend.onrender.com/api
   REACT_APP_ANALYZER_URL=https://gymsage-analyzer.onrender.com
   ```
3. **Redeploy** from Vercel dashboard

### B. Update Render (Backend)

1. Go to your backend service → **Environment**
2. Update:
   ```
   FRONTEND_URL=https://gymsage-XXXXX.vercel.app
   ANALYZER_URL=https://gymsage-analyzer.onrender.com
   ```
3. Service will auto-redeploy

---

## ✅ Step 5: Test Your Deployment

1. Open your Vercel URL: `https://gymsage-XXXXX.vercel.app`
2. Register a new account
3. Try voice recording (wait 30-50 seconds first time)
4. Upload a progress photo
5. Chat with AI Coach

---

## 📊 Free Tier Limits

| Service | Free Tier Limits |
|---------|-----------------|
| **Vercel** | 100GB bandwidth/month, Unlimited deployments |
| **Render** | 750 hours/month (enough for 1 service 24/7), Sleeps after 15 min |
| **Supabase** | 500MB database, 1GB file storage, 50MB bandwidth/month |
| **OpenAI** | Pay-as-you-go (Whisper: $0.006/min, GPT-3.5: $0.002/1K tokens) |

---

## 🎯 Alternative: Deploy to Railway (Backend + Analyzer)

Railway offers $5 free credit/month (enough for both services):

1. Go to [railway.app](https://railway.app)
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repo
4. Railway auto-detects Node.js and Python
5. Add environment variables
6. Deploy!

Railway advantages:
- ✅ Doesn't sleep (stays awake 24/7)
- ✅ Faster cold starts
- ✅ Better for production

---

## 🔥 Pro Tips

### 1. Keep Services Awake (Render)
Create a cron job to ping your backend every 10 minutes:
- Use [cron-job.org](https://cron-job.org) (free)
- Ping: `https://gymsage-backend.onrender.com/api/health`
- Interval: Every 10 minutes

### 2. Optimize Images (Supabase)
- Resize progress photos before upload (max 1024x1024)
- Use WebP format for smaller file sizes
- This saves storage and bandwidth

### 3. Monitor Usage
- Vercel Dashboard: Check bandwidth usage
- Render Dashboard: Check build minutes
- Supabase Dashboard: Check storage and database size
- OpenAI Dashboard: Check API costs

### 4. Production Optimizations
```bash
# Frontend - Add to package.json
"build": "GENERATE_SOURCEMAP=false react-scripts build"

# Backend - Use compression
npm install compression
# Add to server.js:
const compression = require('compression');
app.use(compression());
```

---

## 🐛 Troubleshooting

### Frontend can't reach backend
- Check CORS settings in `backend/server.js`
- Add your Vercel URL to `origin` array
- Check `REACT_APP_API_URL` in Vercel env vars

### Backend timeout on first request
- Normal for Render free tier (cold start)
- Wait 30-50 seconds for first request
- Consider using cron job to keep awake

### Photo analysis fails
- Check analyzer is deployed and running
- Verify `ANALYZER_URL` in backend env vars
- Check analyzer logs in Render dashboard

### Supabase connection issues
- Verify `SUPABASE_URL` and `SUPABASE_KEY`
- Check RLS policies are disabled or properly configured
- Test connection in Supabase SQL editor

---

## 💰 Cost Estimate (Monthly)

- **Vercel**: $0 (within free tier)
- **Render Backend**: $0 (within free tier)
- **Render Analyzer**: $0 (within free tier)
- **Supabase**: $0 (within free tier)
- **OpenAI API**: ~$1-5 (depending on usage)
  - Whisper: ~$0.10 per 100 voice recordings (1 min each)
  - GPT-3.5: ~$0.50 per 10,000 AI coach messages

**Total: ~$1-5/month** (only OpenAI costs)

---

## 🚀 Quick Deploy Commands

```bash
# 1. Setup Git
git init
git add .
git commit -m "Ready for deployment"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main

# 2. Deploy Frontend (Vercel CLI - Optional)
npm i -g vercel
cd frontend
vercel --prod

# 3. Deploy Backend (Render auto-deploys from GitHub)
# Just push to main branch!

# 4. Done! 🎉
```

---

## 📝 Post-Deployment Checklist

- [ ] Frontend deployed on Vercel
- [ ] Backend deployed on Render
- [ ] Analyzer deployed on Render
- [ ] Environment variables configured
- [ ] CORS settings updated
- [ ] Test user registration
- [ ] Test voice recording
- [ ] Test photo upload
- [ ] Test AI coach
- [ ] Set up monitoring (optional)
- [ ] Set up cron job to keep services awake (optional)

---

## 🎉 You're Live!

Your GymSage app is now deployed and accessible worldwide!

Share your app:
- **App URL**: `https://gymsage-XXXXX.vercel.app`
- **API Health**: `https://gymsage-backend.onrender.com/api/health`
- **Analyzer Health**: `https://gymsage-analyzer.onrender.com/health`

---

## 📚 Additional Resources

- [Vercel Docs](https://vercel.com/docs)
- [Render Docs](https://render.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [OpenAI Pricing](https://openai.com/pricing)

---

**Need help?** Check the issues or create a new one on GitHub!

