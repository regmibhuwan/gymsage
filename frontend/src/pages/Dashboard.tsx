import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import SummaryModal from '../components/SummaryModal';
import { 
  Plus, 
  Calendar, 
  TrendingUp, 
  Dumbbell,
  Camera,
  MessageCircle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Send,
  X,
  Bot
} from 'lucide-react';
import toast from 'react-hot-toast';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, Legend 
} from 'recharts';

interface Workout {
  id: string;
  date: string;
  exercises: Array<{
    exercise: string;
    sets: Array<{
      set: number;
      reps: number;
      weight_kg: number;
    }>;
  }>;
  notes?: string;
}

const Dashboard: React.FC = () => {
  console.log('Dashboard component rendering... v2');
  
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWorkouts, setExpandedWorkouts] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [workoutsPerPage] = useState(5);
  const [stats, setStats] = useState({
    totalWorkouts: 0,
    thisWeekWorkouts: 0,
    totalExercises: 0,
    avgWorkoutsPerWeek: 0
  });

  // Summary modal state
  const [summaryModal, setSummaryModal] = useState({
    isOpen: false,
    content: '',
    tableData: null as any[] | null,
    stats: null as any,
    type: 'daily' as 'daily' | 'weekly'
  });

  // AI Chat state
  const [showAIChat, setShowAIChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{role: string; content: string}>>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    console.log('Dashboard useEffect running...');
    console.log('AI Chat feature initialized');
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async () => {
    try {
      console.log('Fetching workouts...');
      const response = await api.get('/workouts');
      console.log('API Response:', response);
      console.log('Response data:', response.data);
      
      // More robust data handling
      let workoutsData = [];
      if (response.data && response.data.workouts) {
        workoutsData = Array.isArray(response.data.workouts) ? response.data.workouts : [];
      } else if (Array.isArray(response.data)) {
        workoutsData = response.data;
      }
      
      console.log('Processed workouts data:', workoutsData);
      setWorkouts(workoutsData);
      
      // Calculate stats with additional safety checks
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const thisWeekWorkouts = workoutsData.filter((workout: Workout) => 
        workout && workout.date && new Date(workout.date) >= weekAgo
      ).length;
      
      const totalExercises = workoutsData.reduce((sum: number, workout: Workout) => 
        sum + (workout && workout.exercises && Array.isArray(workout.exercises) ? workout.exercises.length : 0), 0
      );
      
      const weeksSinceStart = Math.max(1, Math.ceil(
        (now.getTime() - new Date(workoutsData[0]?.date || now).getTime()) / (7 * 24 * 60 * 60 * 1000)
      ));
      
      setStats({
        totalWorkouts: workoutsData.length,
        thisWeekWorkouts,
        totalExercises,
        avgWorkoutsPerWeek: Math.round(workoutsData.length / weeksSinceStart * 10) / 10
      });
    } catch (error: any) {
      console.error('Error fetching workouts:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Failed to load workouts');
      // Set empty arrays to prevent undefined errors
      setWorkouts([]);
      setStats({
        totalWorkouts: 0,
        thisWeekWorkouts: 0,
        totalExercises: 0,
        avgWorkoutsPerWeek: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const getTotalVolume = (workout: Workout) => {
    return workout.exercises.reduce((total, exercise) => {
      return total + exercise.sets.reduce((exerciseTotal, set) => {
        return exerciseTotal + (set.reps * set.weight_kg);
      }, 0);
    }, 0);
  };

  const toggleWorkoutExpansion = (workoutId: string) => {
    const newExpanded = new Set(expandedWorkouts);
    if (newExpanded.has(workoutId)) {
      newExpanded.delete(workoutId);
    } else {
      newExpanded.add(workoutId);
    }
    setExpandedWorkouts(newExpanded);
  };

  // Helper function to normalize and compare dates precisely
  const normalizeDate = (dateInput: string | Date): string => {
    if (!dateInput) return '';
    
    // If it's already a date string in YYYY-MM-DD format, return it
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      return dateInput;
    }
    
    // Otherwise parse as date and extract YYYY-MM-DD
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const generateSummary = async (type: 'daily' | 'weekly') => {
    try {
      if (type === 'daily') {
        // Get all workouts for today and aggregate exercises
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = normalizeDate(today);
        
        // Normalize dates for comparison - try multiple methods
        const todayWorkouts = workouts.filter(workout => {
          if (!workout || !workout.date) return false;
          
          // Try direct string comparison first (if date is already YYYY-MM-DD)
          const workoutDateStr = normalizeDate(workout.date);
          
          // Also check if workout.date matches today's date string directly
          if (workout.date === todayStr || workoutDateStr === todayStr) {
            return true;
          }
          
          // Try parsing as date and comparing
          const workoutDate = new Date(workout.date);
          if (!isNaN(workoutDate.getTime())) {
            workoutDate.setHours(0, 0, 0, 0);
            const normalized = normalizeDate(workoutDate);
            return normalized === todayStr;
          }
          
          return false;
        });
        
        console.log('📅 Today\'s date string:', todayStr);
        console.log('📅 Today\'s Date object:', today);
        console.log('📊 All workouts with dates:', workouts.map(w => ({ id: w.id, date: w.date, normalized: normalizeDate(w.date) })));
        console.log('🎯 Today\'s workouts found:', todayWorkouts.length, todayWorkouts.map(w => ({ id: w.id, date: w.date })));
        
        if (todayWorkouts.length === 0) {
          // Show helpful message with all recent workout dates
          const recentWorkouts = workouts.slice(0, 5);
          if (recentWorkouts.length > 0) {
            const datesList = recentWorkouts.map(w => {
              const date = new Date(w.date);
              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }).join(', ');
            toast.error(`No workout found for today (${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}). Recent: ${datesList}`, {
              duration: 6000
            });
          } else {
            toast.error('No workouts found. Add your first workout to see summaries!');
          }
          return;
        }

        // Aggregate all exercises from all today's workouts
        const allExercises = todayWorkouts.reduce((acc: any[], workout) => {
          if (workout.exercises && Array.isArray(workout.exercises)) {
            return [...acc, ...workout.exercises];
          }
          return acc;
        }, [] as any[]);

        if (allExercises.length === 0) {
          toast.error('No exercises found for today');
          return;
        }

        const response = await api.post('/voice/summary/daily', {
          exercises: allExercises,
          date: todayStr
        });
        
        if (response.data.success) {
          setSummaryModal({
            isOpen: true,
            content: response.data.summary,
            tableData: response.data.tableData,
            stats: response.data.stats,
            type: 'daily'
          });
        }
      } else if (type === 'weekly') {
        // Get workouts from the current week (Monday to Sunday)
        const now = new Date();
        const weekStart = new Date(now);
        const dayOfWeek = weekStart.getDay();
        // Adjust to Monday as start of week (0=Sunday, so if Sunday, go back 6 days, otherwise subtract (day-1))
        const daysToMonday = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
        weekStart.setDate(weekStart.getDate() + daysToMonday);
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        const weekStartStr = normalizeDate(weekStart);
        const weekEndStr = normalizeDate(weekEnd);
        
        console.log('📅 Weekly range:', weekStartStr, 'to', weekEndStr);
        console.log('📅 Weekly Date objects:', weekStart.toISOString(), 'to', weekEnd.toISOString());
        console.log('📊 All workouts with dates:', workouts.map(w => ({ id: w.id, date: w.date, normalized: normalizeDate(w.date) })));
        
        const weekWorkouts = workouts.filter(workout => {
          if (!workout || !workout.date) return false;
          
          const workoutDate = new Date(workout.date);
          
          // Check if workout date falls within week range
          if (!isNaN(workoutDate.getTime())) {
            workoutDate.setHours(0, 0, 0, 0);
            // Compare normalized date strings
            const normalized = normalizeDate(workoutDate);
            if (normalized >= weekStartStr && normalized <= weekEndStr) {
              return true;
            }
            // Also check date objects directly
            if (workoutDate >= weekStart && workoutDate <= weekEnd) {
              return true;
            }
          }
          
          // Fallback: direct string comparison if dates are in YYYY-MM-DD format
          if (/^\d{4}-\d{2}-\d{2}$/.test(workout.date)) {
            return workout.date >= weekStartStr && workout.date <= weekEndStr;
          }
          
          return false;
        });
        
        console.log('🎯 Week workouts found:', weekWorkouts.length, weekWorkouts.map(w => ({ id: w.id, date: w.date })));
        
        if (weekWorkouts.length === 0) {
          // Show helpful message with stats and all workout dates
          const totalWorkouts = workouts.length;
          if (totalWorkouts > 0) {
            const allDates = workouts.map(w => normalizeDate(w.date)).filter(d => d);
            const uniqueDates = Array.from(new Set(allDates)).sort();
            const weekDatesList = uniqueDates.slice(0, 10).join(', ');
            toast.error(`No workouts found this week (${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}). You have ${totalWorkouts} total workouts. Dates: ${weekDatesList}${uniqueDates.length > 10 ? '...' : ''}`, {
              duration: 7000
            });
          } else {
            toast.error('No workouts found. Add workouts to see weekly summaries!');
          }
          return;
        }

        const response = await api.post('/voice/summary/weekly', {
          workouts: weekWorkouts,
          weekStart: weekStart.toISOString().split('T')[0],
          weekEnd: weekEnd.toISOString().split('T')[0]
        });
        
        if (response.data.success) {
          setSummaryModal({
            isOpen: true,
            content: response.data.summary,
            tableData: response.data.tableData,
            stats: response.data.stats,
            type: 'weekly'
          });
        }
      }
    } catch (error: any) {
      console.error('Error generating summary:', error);
      toast.error('Failed to generate summary');
    }
  };

  const groupWorkoutsByDate = (workouts: Workout[]) => {
    if (!workouts || !Array.isArray(workouts)) {
      return [];
    }
    
    const grouped = workouts.reduce((groups, workout) => {
      const date = workout.date;
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(workout);
      return groups;
    }, {} as Record<string, Workout[]>);

    return Object.entries(grouped)
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .slice((currentPage - 1) * workoutsPerPage, currentPage * workoutsPerPage);
  };

  const getProgressData = () => {
    const exerciseData: Record<string, Array<{date: string, weight: number, volume: number}>> = {};
    const dateVolumeMap: Record<string, number> = {};
    const exerciseFrequency: Record<string, number> = {};
    
    workouts.forEach(workout => {
      if (workout.exercises && Array.isArray(workout.exercises)) {
        let dayVolume = 0;
        
        workout.exercises.forEach(exercise => {
          const exerciseName = exercise.exercise;
          
          // Exercise frequency
          exerciseFrequency[exerciseName] = (exerciseFrequency[exerciseName] || 0) + 1;
          
          if (!exerciseData[exerciseName]) {
            exerciseData[exerciseName] = [];
          }
          
          if (exercise.sets && Array.isArray(exercise.sets)) {
            const maxWeight = Math.max(...exercise.sets.map(set => set.weight_kg));
            const totalVolume = exercise.sets.reduce((sum, set) => sum + (set.reps * set.weight_kg), 0);
            dayVolume += totalVolume;
            
            exerciseData[exerciseName].push({
              date: workout.date,
              weight: maxWeight,
              volume: totalVolume
            });
          }
        });
        
        // Daily volume tracking
        if (workout.date) {
          dateVolumeMap[workout.date] = (dateVolumeMap[workout.date] || 0) + dayVolume;
        }
      }
    });

    // Convert date volume map to array for charts
    const dailyVolumeData = Object.entries(dateVolumeMap)
      .map(([date, volume]) => ({ date, volume }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-14); // Last 14 days

    // Top exercises for pie chart
    const topExercises = Object.entries(exerciseFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count]) => ({ name, value: count }));

    return { exerciseData, dailyVolumeData, topExercises, exerciseFrequency };
  };

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory]);

  const sendChatMessage = async () => {
    if (!chatMessage.trim() || chatLoading) return;

    const userMessage = chatMessage.trim();
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      // Use comprehensive dashboard chat endpoint
      const response = await api.post('/ai/dashboard-chat', { 
        message: userMessage,
        history: chatHistory.map(msg => ({ role: msg.role, content: msg.content }))
      });
      
      // Extract plain text response
      let aiResponse = '';
      if (response.data && response.data.content && typeof response.data.content === 'string') {
        aiResponse = response.data.content;
      } else if (response.data && response.data.message && typeof response.data.message === 'string') {
        aiResponse = response.data.message;
      } else if (typeof response.data === 'string') {
        aiResponse = response.data;
      } else {
        console.warn('Unexpected response format:', response.data);
        aiResponse = 'I received your message but encountered a formatting issue. Please try again.';
      }
      
      // Clean up markdown formatting
      aiResponse = aiResponse.replace(/\*\*([^*]+)\*\*/g, '$1');
      aiResponse = aiResponse.replace(/__([^_]+)__/g, '$1');
      aiResponse = aiResponse.replace(/\*([^*]+)\*/g, '$1');
      aiResponse = aiResponse.replace(/_([^_]+)_/g, '$1');
      aiResponse = aiResponse.replace(/^#{1,6}\s+/gm, '');
      aiResponse = aiResponse.replace(/\n{3,}/g, '\n\n');
      aiResponse = aiResponse.trim();

      setChatHistory(prev => [...prev, { role: 'assistant', content: aiResponse }]);
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Failed to get AI response');
      setChatHistory(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.' 
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Add error state handling
  if (workouts.length === 0) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Track your fitness progress</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => generateSummary('daily')}
              className="btn-secondary flex items-center space-x-2"
            >
              <BarChart3 className="h-5 w-5" />
              <span>Daily Summary</span>
            </button>
            <button
              onClick={() => generateSummary('weekly')}
              className="btn-secondary flex items-center space-x-2"
            >
              <BarChart3 className="h-5 w-5" />
              <span>Weekly Summary</span>
            </button>
            <Link
              to="/add-workout"
              className="btn-primary flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Add Workout</span>
            </Link>
          </div>
        </div>

        {/* Empty State */}
        <div className="text-center py-12">
          <div className="mx-auto h-24 w-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Dumbbell className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No workouts yet</h3>
          <p className="text-gray-600 mb-6">Start your fitness journey by adding your first workout!</p>
          <Link
            to="/add-workout"
            className="btn-primary flex items-center space-x-2 mx-auto w-fit"
          >
            <Plus className="h-5 w-5" />
            <span>Add Your First Workout</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Track your fitness progress</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => generateSummary('daily')}
            className="btn-secondary flex items-center space-x-2"
          >
            <BarChart3 className="h-5 w-5" />
            <span>Daily Summary</span>
          </button>
          <button
            onClick={() => generateSummary('weekly')}
            className="btn-secondary flex items-center space-x-2"
          >
            <BarChart3 className="h-5 w-5" />
            <span>Weekly Summary</span>
          </button>
          <Link
            to="/add-workout"
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="h-5 w-5" />
            <span>Add Workout</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Dumbbell className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Workouts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalWorkouts}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <Calendar className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">This Week</p>
              <p className="text-2xl font-bold text-gray-900">{stats.thisWeekWorkouts}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Exercises</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalExercises}</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg/Week</p>
              <p className="text-2xl font-bold text-gray-900">{stats.avgWorkoutsPerWeek}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/add-workout"
          className="card hover:shadow-md transition-shadow duration-200 cursor-pointer"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Plus className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Log Workout</h3>
              <p className="text-gray-600">Record your training session</p>
            </div>
          </div>
        </Link>

        <Link
          to="/photos"
          className="card hover:shadow-md transition-shadow duration-200 cursor-pointer"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Camera className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Progress Photos</h3>
              <p className="text-gray-600">Track visual progress</p>
            </div>
          </div>
        </Link>

        <Link
          to="/coach"
          className="card hover:shadow-md transition-shadow duration-200 cursor-pointer"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <MessageCircle className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">AI Coach</h3>
              <p className="text-gray-600">Get personalized advice</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Workouts */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">Recent Workouts</h2>
          <Link
            to="/add-workout"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Add Workout
          </Link>
        </div>

        {workouts.length === 0 ? (
          <div className="text-center py-8">
            <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No workouts yet</h3>
            <p className="text-gray-600 mb-4">Start your fitness journey by logging your first workout</p>
            <Link
              to="/add-workout"
              className="btn-primary"
            >
              Add Your First Workout
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {groupWorkoutsByDate(workouts).map(([date, dateWorkouts]) => (
              <div key={date} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {formatDate(date)}
                  </h3>
                  <span className="text-sm text-gray-500">
                    {dateWorkouts.length} workout{dateWorkouts.length > 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className="space-y-3">
                  {dateWorkouts.map((workout) => (
                    <div key={workout.id} className="border border-gray-100 rounded-lg p-3">
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => toggleWorkoutExpansion(workout.id)}
                      >
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium text-gray-900">
                              {workout.exercises.length} exercises
                            </h4>
                            <span className="text-sm text-gray-500">
                              • {getTotalVolume(workout).toFixed(0)} kg total volume
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            {workout.exercises.map(ex => ex.exercise).join(', ')}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Link
                            to={`/workout/${workout.id}`}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View Details
                          </Link>
                          {expandedWorkouts.has(workout.id) ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                        </div>
                      </div>
                      
                      {expandedWorkouts.has(workout.id) && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="space-y-2">
                            {workout.exercises.map((exercise, index) => (
                              <div key={index} className="text-sm">
                                <span className="font-medium text-gray-900 capitalize">
                                  {exercise.exercise}
                                </span>
                                <span className="text-gray-600 ml-2">
                                  {exercise.sets.length} sets • {exercise.sets.reduce((sum, set) => sum + set.reps, 0)} total reps
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            
            {/* Pagination */}
            {workouts.length > workoutsPerPage && (
              <div className="flex justify-center space-x-2 mt-6">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="px-3 py-2 text-sm text-gray-700">
                  Page {currentPage} of {Math.ceil(workouts.length / workoutsPerPage)}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(workouts.length / workoutsPerPage), prev + 1))}
                  disabled={currentPage >= Math.ceil(workouts.length / workoutsPerPage)}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress Overview - Enhanced */}
      {workouts.length > 0 && (() => {
        const progressData = getProgressData();
        const topExerciseData = Object.entries(progressData.exerciseData)
          .sort(([, a], [, b]) => b.length - a.length)
          .slice(0, 5)
          .map(([exercise, data]) => ({
            exercise: exercise.charAt(0).toUpperCase() + exercise.slice(1),
            count: data.length,
            avgVolume: data.reduce((sum, d) => sum + d.volume, 0) / data.length,
            maxWeight: Math.max(...data.map(d => d.weight))
          }));

        return (
          <div className="space-y-6">
            {/* Progress Overview Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Progress Overview</h2>
                <p className="text-gray-600 mt-1">Track your fitness journey with detailed analytics</p>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Volume Trend - Enhanced */}
              <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Daily Volume Trend</h3>
                    <p className="text-sm text-gray-600">Last 14 days</p>
                  </div>
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={progressData.dailyVolumeData}>
                    <defs>
                      <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      stroke="#6b7280"
                    />
                    <YAxis stroke="#6b7280" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb', 
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      formatter={(value: number) => [`${value.toFixed(0)} kg`, 'Volume']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="volume" 
                      stroke="#3b82f6" 
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorVolume)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Top Exercises - Enhanced */}
              <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Top Exercises</h3>
                    <p className="text-sm text-gray-600">Most performed exercises</p>
                  </div>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Dumbbell className="h-5 w-5 text-green-600" />
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topExerciseData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="exercise" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      stroke="#6b7280"
                    />
                    <YAxis stroke="#6b7280" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '1px solid #e5e7eb', 
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'count') return [`${value} sessions`, 'Times Performed'];
                        if (name === 'avgVolume') return [`${value.toFixed(0)} kg`, 'Avg Volume'];
                        if (name === 'maxWeight') return [`${value.toFixed(1)} kg`, 'Max Weight'];
                        return [value, name];
                      }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="#10b981"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Exercise Distribution - New */}
            {progressData.topExercises.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="card bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-100">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Exercise Distribution</h3>
                      <p className="text-sm text-gray-600">Workout frequency breakdown</p>
                    </div>
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-purple-600" />
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={progressData.topExercises}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {progressData.topExercises.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e5e7eb', 
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        formatter={(value: number) => [`${value} sessions`, 'Times Performed']}
                      />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Exercise Stats Cards */}
                <div className="space-y-4">
                  <div className="card bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Exercise Statistics</h3>
                    <div className="space-y-3">
                      {topExerciseData.slice(0, 5).map((exercise, index) => (
                        <div key={exercise.exercise} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                          <div className="flex items-center space-x-3">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <div>
                              <p className="font-semibold text-gray-900">{exercise.exercise}</p>
                              <p className="text-xs text-gray-600">{exercise.count} sessions</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900">{exercise.maxWeight.toFixed(1)} kg</p>
                            <p className="text-xs text-gray-600">max weight</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}
      
      {/* Summary Modal */}
      <SummaryModal
        isOpen={summaryModal.isOpen}
        onClose={() => setSummaryModal(prev => ({ ...prev, isOpen: false }))}
        summary={summaryModal.content}
        tableData={summaryModal.tableData}
        stats={summaryModal.stats}
        type={summaryModal.type}
      />

      {/* AI Chat Assistant - Beautiful Floating Chat */}
      {showAIChat && (
        <div className="fixed bottom-4 right-4 w-96 h-[600px] bg-white rounded-2xl shadow-2xl border-2 border-purple-200 flex flex-col z-50 overflow-hidden">
          {/* Chat Header */}
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-white bg-opacity-20 rounded-lg">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg">AI Assistant</h3>
                <p className="text-xs text-purple-100">Ask me anything about your fitness journey</p>
              </div>
            </div>
            <button
              onClick={() => setShowAIChat(false)}
              className="p-1 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {chatHistory.length === 0 && (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full mb-4">
                  <Sparkles className="h-8 w-8 text-purple-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-2">Your Personal Fitness AI</h4>
                <p className="text-sm text-gray-600 mb-4">I can help you with:</p>
                <div className="space-y-2 text-left">
                  {[
                    "Your workout history and exercises",
                    "Progress photo analysis",
                    "Training recommendations",
                    "Nutrition advice",
                    "Progress tracking insights"
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-2 text-sm text-gray-700">
                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 space-y-2">
                  {[
                    "What exercises do I do most?",
                    "How's my progress this month?",
                    "Compare my chest photos",
                    "Give me a workout plan"
                  ].map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setChatMessage(question);
                        setTimeout(() => sendChatMessage(), 100);
                      }}
                      className="block w-full text-left px-3 py-2 text-sm bg-white hover:bg-purple-50 rounded-lg border border-gray-200 transition-colors text-gray-700"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user' 
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white' 
                    : 'bg-white text-gray-900 border border-gray-200 shadow-sm'
                }`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center space-x-2 mb-2">
                      <Bot className="h-4 w-4 text-purple-600" />
                      <span className="text-xs font-semibold text-purple-600">AI Assistant</span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <Bot className="h-4 w-4 text-purple-600" />
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="flex items-end space-x-2">
              <textarea
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendChatMessage();
                  }
                }}
                placeholder="Ask me anything about your workouts, photos, or progress..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                rows={2}
                disabled={chatLoading}
              />
              <button
                onClick={sendChatMessage}
                disabled={chatLoading || !chatMessage.trim()}
                className="p-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Chat Toggle Button - Floating */}
      {!showAIChat && (
        <button
          onClick={() => {
            console.log('AI Chat button clicked!');
            setShowAIChat(true);
          }}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-purple-600 via-purple-500 to-blue-600 text-white rounded-full shadow-2xl hover:shadow-purple-500/50 hover:scale-110 transition-all duration-300 flex items-center justify-center z-[9999] group animate-pulse"
          style={{ boxShadow: '0 20px 25px -5px rgba(147, 51, 234, 0.5), 0 10px 10px -5px rgba(147, 51, 234, 0.3)' }}
          title="Ask AI Assistant"
        >
          <Sparkles className="h-7 w-7 group-hover:rotate-12 transition-transform" />
          {chatHistory.length > 0 && (
            <span className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full text-xs flex items-center justify-center font-bold text-white shadow-lg">
              {chatHistory.length}
            </span>
          )}
        </button>
      )}
    </div>
  );
};

export default Dashboard;
