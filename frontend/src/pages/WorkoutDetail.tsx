import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Calendar, Dumbbell, Edit, Trash2 } from 'lucide-react';

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
  created_at: string;
}

const WorkoutDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWorkout = async () => {
      if (!id) return;
      try {
        const response = await api.get(`/workouts/${id}`);
        setWorkout(response.data.workout);
      } catch (error) {
        console.error('Error fetching workout:', error);
        toast.error('Failed to load workout');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchWorkout();
  }, [id, navigate]);

  const handleDelete = async () => {
    if (!workout || !window.confirm('Are you sure you want to delete this workout?')) {
      return;
    }

    try {
      await api.delete(`/workouts/${workout.id}`);
      toast.success('Workout deleted successfully');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error deleting workout:', error);
      toast.error('Failed to delete workout');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getTotalVolume = (exercise: Workout['exercises'][0]) => {
    return exercise.sets.reduce((total, set) => total + (set.reps * set.weight_kg), 0);
  };

  const getTotalWorkoutVolume = () => {
    if (!workout) return 0;
    return workout.exercises.reduce((total, exercise) => total + getTotalVolume(exercise), 0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="text-center py-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Workout not found</h2>
        <button
          onClick={() => navigate('/dashboard')}
          className="btn-primary"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Workout Details</h1>
            <p className="text-gray-600">{formatDate(workout.date)}</p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => navigate(`/add-workout?edit=${workout.id}`)}
            className="btn-secondary flex items-center space-x-2"
          >
            <Edit className="h-4 w-4" />
            <span>Edit</span>
          </button>
          <button
            onClick={handleDelete}
            className="btn-danger flex items-center space-x-2"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Workout Summary */}
      <div className="card">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Date</p>
              <p className="text-lg font-semibold text-gray-900">{formatDate(workout.date)}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Dumbbell className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Exercises</p>
              <p className="text-lg font-semibold text-gray-900">{workout.exercises.length}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Dumbbell className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">Total Volume</p>
              <p className="text-lg font-semibold text-gray-900">{getTotalWorkoutVolume().toFixed(0)} kg</p>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {workout.notes && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{workout.notes}</p>
        </div>
      )}

      {/* Exercises */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Exercises</h2>
        
        <div className="space-y-6">
          {workout.exercises.map((exercise, exerciseIndex) => (
            <div key={exerciseIndex} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 capitalize">
                  {exercise.exercise}
                </h3>
                <div className="text-sm text-gray-600">
                  Total Volume: {getTotalVolume(exercise).toFixed(0)} kg
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-sm font-medium text-gray-600">Set</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-600">Reps</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-600">Weight</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-600">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exercise.sets.map((set, setIndex) => (
                      <tr key={setIndex} className="border-b border-gray-100">
                        <td className="py-2 text-sm text-gray-900">{set.set}</td>
                        <td className="py-2 text-sm text-gray-900">{set.reps}</td>
                        <td className="py-2 text-sm text-gray-900">{set.weight_kg} kg</td>
                        <td className="py-2 text-sm text-gray-900">
                          {(set.reps * set.weight_kg).toFixed(0)} kg
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkoutDetail;
