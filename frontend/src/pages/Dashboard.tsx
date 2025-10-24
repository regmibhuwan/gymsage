import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Plus, 
  Calendar, 
  TrendingUp, 
  Dumbbell,
  Camera,
  MessageCircle,
  BarChart3,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

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

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async () => {
    try {
      const response = await axios.get('/workouts');
      const workoutsData = response.data.workouts;
      setWorkouts(workoutsData);
      
      // Calculate stats
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const thisWeekWorkouts = workoutsData.filter((workout: Workout) => 
        new Date(workout.date) >= weekAgo
      ).length;
      
      const totalExercises = workoutsData.reduce((sum: number, workout: Workout) => 
        sum + workout.exercises.length, 0
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
    } catch (error) {
      console.error('Error fetching workouts:', error);
      toast.error('Failed to load workouts');
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

  const groupWorkoutsByDate = (workouts: Workout[]) => {
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
    
    workouts.forEach(workout => {
      workout.exercises.forEach(exercise => {
        const exerciseName = exercise.exercise;
        if (!exerciseData[exerciseName]) {
          exerciseData[exerciseName] = [];
        }
        
        const maxWeight = Math.max(...exercise.sets.map(set => set.weight_kg));
        const totalVolume = exercise.sets.reduce((sum, set) => sum + (set.reps * set.weight_kg), 0);
        
        exerciseData[exerciseName].push({
          date: workout.date,
          weight: maxWeight,
          volume: totalVolume
        });
      });
    });

    return exerciseData;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
        <Link
          to="/add-workout"
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="h-5 w-5" />
          <span>Add Workout</span>
        </Link>
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

      {/* Progress Charts */}
      {workouts.length > 0 && (
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Progress Overview</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Exercise Volume Trends</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={Object.values(getProgressData())[0]?.slice(-10) || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="volume" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Top Exercises</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={Object.entries(getProgressData()).map(([exercise, data]) => ({
                  exercise: exercise.charAt(0).toUpperCase() + exercise.slice(1),
                  count: data.length
                })).slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="exercise" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
