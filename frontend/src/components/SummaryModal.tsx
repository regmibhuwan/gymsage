import React from 'react';
import { X, BarChart3, Calendar, Dumbbell, TrendingUp, Activity } from 'lucide-react';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: string;
  tableData?: any[] | null;
  stats?: any | null;
  type: 'daily' | 'weekly';
}

const SummaryModal: React.FC<SummaryModalProps> = ({ 
  isOpen, 
  onClose, 
  summary, 
  tableData, 
  stats, 
  type 
}) => {
  if (!isOpen) return null;

  const renderDailyTable = () => {
    if (!tableData || tableData.length === 0) return null;

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Dumbbell className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-blue-600">Total Exercises</p>
                <p className="text-2xl font-bold text-blue-900">{stats?.totalExercises || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-green-600">Total Sets</p>
                <p className="text-2xl font-bold text-green-900">{stats?.totalSets || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Exercise Tables */}
        {tableData.map((exercise, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 capitalize">
                {exercise.exercise}
              </h3>
              <p className="text-sm text-gray-600">{exercise.sets.length} sets</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Set</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reps</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight (kg)</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Weight (lbs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {exercise.sets.map((set: any, setIndex: number) => (
                    <tr key={setIndex} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{set.set}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{set.reps}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{set.weight_kg}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{set.weight_lbs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderWeeklyTable = () => {
    if (!tableData || tableData.length === 0) return null;

    return (
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-blue-600">Workouts</p>
                <p className="text-xl font-bold text-blue-900">{stats?.totalWorkouts || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-green-600">Total Sets</p>
                <p className="text-xl font-bold text-green-900">{stats?.totalSets || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <Dumbbell className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-purple-600">Exercises</p>
                <p className="text-xl font-bold text-purple-900">{stats?.uniqueExercises || 0}</p>
              </div>
            </div>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm text-orange-600">Week Range</p>
                <p className="text-sm font-bold text-orange-900">{stats?.weekRange || ''}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Exercise Progress Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Exercise Progress</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exercise</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Sets</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Reps</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Weight (lbs)</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Workouts</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Sets/Workout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {tableData.map((exercise: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">{exercise.exercise}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{exercise.totalSets}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{exercise.totalReps}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{exercise.maxWeightLbs}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{exercise.workoutsCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{exercise.avgSetsPerWorkout}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                {type === 'daily' ? (
                  <Calendar className="h-5 w-5 text-blue-600" />
                ) : (
                  <BarChart3 className="h-5 w-5 text-blue-600" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {type === 'daily' ? 'Daily Workout Summary' : 'Weekly Workout Summary'}
                </h3>
                <p className="text-sm text-gray-500">
                  {type === 'daily' ? 'Your workout breakdown for today' : 'Your progress this week'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
          
          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[70vh]">
            {tableData && tableData.length > 0 ? (
              type === 'daily' ? renderDailyTable() : renderWeeklyTable()
            ) : (
              <div className="bg-gray-50 rounded-lg p-4">
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed">
                  {summary}
                </pre>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="btn-primary"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SummaryModal;
