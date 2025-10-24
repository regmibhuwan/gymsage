# GymSage - AI-Powered Fitness Tracker

GymSage is a comprehensive fitness tracking application that combines voice logging, AI-powered photo analysis, and personalized coaching to help users track their fitness journey effectively.

## 🔧 Recent Improvements

### ⚡ Whisper AI Voice Recording (Latest)
- ✅ Replaced browser Speech API with OpenAI Whisper for professional-grade transcription
- ✅ Simplified recording workflow: Record → Stop → Transcribe
- ✅ Smart weight rounding to nearest .0 or .5 (e.g., 60.0, 60.5, 61.0)
- ✅ Automatic unit conversion (lbs ↔ kg) with 1 decimal precision
- ✅ Enhanced GPT system prompt for better fitness term recognition
- ✅ No more "network" errors or missed words!

### 📸 Progress Photo Analysis (Latest)
- ✅ Fully integrated Python MediaPipe analyzer with backend
- ✅ Photo analysis fetches images from Supabase Storage URLs
- ✅ Progress Insights dashboard showing muscle group development over time
- ✅ Automatic trend detection: "✅ Great shoulder development!" or "⚠️ Add more rear delt work"
- ✅ Personalized nutrition recommendations based on your progress
- ✅ AI Coach now references your photo analysis in conversations

### Voice Recording Fixes
- ✅ Fixed CORS configuration for proper frontend-backend communication
- ✅ Added proper API URL configuration using environment variables
- ✅ Enhanced error handling with graceful fallbacks
- ✅ Added timeout handling for OpenAI API calls
- ✅ Improved regex fallback parser for offline mode

### AI Coach Enhancements
- ✅ Added comprehensive error handling with user-friendly messages
- ✅ Implemented timeout protection (15 seconds)
- ✅ Added graceful fallbacks when OpenAI API is unavailable
- ✅ Enhanced response parsing with structured JSON output
- ✅ Improved loading states and user feedback
- ✅ New `/progress-insights` endpoint for targeted muscle analysis

### Workout History Refactoring
- ✅ Implemented date-based grouping for better organization
- ✅ Added expandable workout cards with detailed exercise breakdowns
- ✅ Added pagination for large datasets (5 workouts per page)
- ✅ Created progress charts using Recharts (volume trends, exercise frequency)
- ✅ Enhanced visual hierarchy with clear date → exercises → sets structure

### Photo Analysis Integration
- ✅ Added proper file upload with multipart/form-data support
- ✅ Integrated Supabase Storage for secure photo hosting
- ✅ Connected Python analyzer service for AI-powered body analysis
- ✅ Added measurement tracking and symmetry analysis
- ✅ Implemented progress timeline with visual comparisons
- ✅ Smart insights: tracks shoulders, arms, back, chest development

### Code Quality Improvements
- ✅ Created reusable API helper with centralized error handling
- ✅ Added proper TypeScript types throughout the application
- ✅ Implemented consistent error handling patterns
- ✅ Added comprehensive input validation
- ✅ Removed unnecessary files and cleaned up project structure
- ✅ Added `axios` to backend for Python analyzer communication

## 🚀 Features

### Voice Workout Logging
- **Web Speech API Integration**: Record workouts using voice commands
- **AI-Powered Parsing**: Uses OpenAI API to parse natural language into structured workout data
- **Fallback Regex Parser**: Offline mode with regex-based parsing for reliability
- **Real-time Transcription**: See your voice input converted to text instantly

### Workout Management
- **Comprehensive Dashboard**: View workout statistics and recent activity
- **Detailed Workout Tracking**: Log sets, reps, weights, and notes
- **Progress Visualization**: Charts showing strength progression over time
- **Workout History**: Complete history with search and filtering

### AI Photo Analysis
- **MediaPipe Integration**: Advanced pose detection and body landmark extraction
- **Body Measurements**: Automatic calculation of shoulder width, arm length, leg length, etc.
- **Progress Tracking**: Compare measurements across different time periods
- **Symmetry Analysis**: Detect imbalances and asymmetries in your physique

### AI Fitness Coach
- **Personalized Advice**: Get tailored recommendations based on your workout data
- **Chat Interface**: Natural conversation with your AI coach
- **Program Modifications**: Receive suggestions for workout program improvements
- **Nutrition Tips**: Get dietary advice to complement your training

## 🏗️ Architecture

```
GymSage/
├── frontend/          # React + TypeScript + TailwindCSS
├── backend/           # Node.js + Express + Supabase
├── analyzer/          # Python + FastAPI + MediaPipe
├── database/          # Supabase schema and migrations
└── README.md
```

### Tech Stack

**Frontend:**
- React 18 with TypeScript
- TailwindCSS for styling
- React Router for navigation
- Axios for API calls
- Recharts for data visualization
- Web Speech API for voice recognition

**Backend:**
- Node.js with Express
- Supabase for database and authentication
- OpenAI API for natural language processing
- JWT for authentication
- Multer for file uploads

**Photo Analyzer:**
- Python with FastAPI
- MediaPipe for pose detection
- OpenCV for image processing
- NumPy for calculations

**Database:**
- Supabase (PostgreSQL)
- Row Level Security (RLS)
- Real-time subscriptions
- File storage for photos

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ and npm
- Python 3.8+
- Supabase account
- OpenAI API key

### 1. Clone and Install

```bash
git clone <repository-url>
cd GymSage
npm run install:all
```

### 2. Environment Setup

Copy the environment template:
```bash
cp env.example .env
```

Fill in your environment variables:
```env
# OpenAI API Key for voice parsing and AI coach
OPENAI_API_KEY=your_openai_api_key_here

# Supabase Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here

# JWT Secret for authentication
JWT_SECRET=your_jwt_secret_here

# Backend Configuration
PORT=3001
NODE_ENV=development

# Python Analyzer Configuration
ANALYZER_PORT=8001
```

### 3. Database Setup

1. Create a new Supabase project
2. Run the SQL schema from `database/schema.sql` in your Supabase SQL editor
3. Enable Row Level Security (RLS) policies
4. Create a storage bucket named `progress-photos`

### 4. Start All Services

```bash
# Start all services concurrently
npm run start:frontend    # Frontend on http://localhost:3000
npm run start:backend     # Backend on http://localhost:3001
npm run start:analyzer    # Analyzer on http://localhost:8001
```

Or start individually:

```bash
# Frontend
cd frontend && npm start

# Backend
cd backend && npm run dev

# Analyzer
cd analyzer && uvicorn main:app --reload --port 8001
```

## 📱 Usage

### 1. Registration and Login
- Create an account with email and password
- Login to access your personalized dashboard

### 2. Voice Workout Logging
- Navigate to "Add Workout"
- Click "Start Recording" and speak your workout
- Example: "Bench press 3 sets of 10 reps at 60 kilograms"
- The AI will parse and structure your workout data

### 3. Manual Workout Entry
- Add exercises manually with sets, reps, and weights
- Include notes for each workout
- Save and view in your workout history

### 4. Progress Photos
- Upload photos from front, side, and back views using drag-and-drop or file picker
- Photos are automatically uploaded to Supabase Storage
- AI analyzes body landmarks and measurements using MediaPipe
- Track progress over time with visual comparisons and measurement trends
- View analysis results including symmetry ratios and body measurements

### 5. AI Coach
- Chat with your personalized fitness coach
- Get recommendations based on your workout patterns
- Receive program modifications and nutrition tips

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
```

### Analyzer Tests
```bash
cd analyzer
python -m pytest tests/
```

### Frontend Tests
```bash
cd frontend
npm test
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get user profile

### Workouts
- `GET /api/workouts` - Get user workouts
- `POST /api/workouts` - Create new workout
- `GET /api/workouts/:id` - Get specific workout
- `PUT /api/workouts/:id` - Update workout
- `DELETE /api/workouts/:id` - Delete workout
- `GET /api/workouts/stats/:exercise` - Get exercise statistics

### Photos
- `GET /api/photos` - Get user photos
- `POST /api/photos/upload` - Upload new photo file (multipart/form-data)
- `POST /api/photos` - Upload new photo (legacy endpoint)
- `PUT /api/photos/:id/analysis` - Update photo analysis
- `GET /api/photos/trends` - Get photo analysis trends
- `DELETE /api/photos/:id` - Delete photo

### Voice Processing
- `POST /api/voice/parse` - Parse voice transcript to workout data

### AI Coach
- `POST /api/coach/chat` - Chat with AI coach
- `GET /api/coach/recommendations` - Get personalized recommendations

### Photo Analyzer (Python Service)
- `GET /health` - Health check
- `POST /analyze-photo` - Analyze photo with base64 data
- `POST /analyze-photo-file` - Analyze uploaded photo file
- `GET /measurements/guide` - Get measurements guide

## 🗄️ Database Schema

### Users Table
```sql
- id (UUID, Primary Key)
- email (VARCHAR, Unique)
- password (VARCHAR, Hashed)
- name (VARCHAR)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Workouts Table
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key)
- date (DATE)
- exercises (JSONB)
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Photos Table
```sql
- id (UUID, Primary Key)
- user_id (UUID, Foreign Key)
- url (TEXT)
- view (VARCHAR: 'front', 'side', 'back')
- analysis_data (JSONB)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

## 🚀 Deployment

### Frontend (Vercel)
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Backend (Render)
1. Connect GitHub repository to Render
2. Set environment variables
3. Deploy as a web service

### Analyzer (Railway/Replit)
1. Upload Python code to Railway or Replit
2. Install dependencies from requirements.txt
3. Set environment variables
4. Deploy the FastAPI service

### Database (Supabase)
- Use Supabase's hosted PostgreSQL
- Configure RLS policies for security
- Set up storage buckets for photos

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Row Level Security**: Database-level access control
- **Input Validation**: Server-side validation for all inputs
- **CORS Configuration**: Proper cross-origin resource sharing
- **Rate Limiting**: API rate limiting to prevent abuse
- **Password Hashing**: bcrypt for secure password storage

## 🐛 Troubleshooting

### Common Issues

**Voice Recognition Not Working**
- Ensure you're using HTTPS (required for Web Speech API)
- Check browser compatibility (Chrome, Edge, Safari)
- Grant microphone permissions

**Photo Analysis Failing**
- Verify MediaPipe installation
- Check image format (JPG, PNG supported)
- Ensure person is clearly visible in photo

**Database Connection Issues**
- Verify Supabase credentials
- Check RLS policies
- Ensure database schema is properly set up

**OpenAI API Errors**
- Verify API key is valid
- Check API usage limits
- Ensure fallback regex parser is working

### Debug Mode

Enable debug logging:
```bash
NODE_ENV=development npm run dev
```

### Logs

- Backend logs: Console output
- Analyzer logs: Console output
- Frontend logs: Browser console

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- MediaPipe team for pose detection capabilities
- OpenAI for natural language processing
- Supabase for backend-as-a-service
- React and FastAPI communities

## 📞 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the troubleshooting section
- Review the API documentation

---

**GymSage** - Track your fitness journey with AI-powered insights! 💪
