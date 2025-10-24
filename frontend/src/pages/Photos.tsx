import React from 'react';
import { Camera, TrendingUp, Clock } from 'lucide-react';

const Photos: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Progress Photos</h1>
          <p className="text-gray-600">AI-powered body analysis coming soon!</p>
        </div>
      </div>

      {/* Coming Soon Card */}
      <div className="card bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
        <div className="text-center py-12">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-100 rounded-full">
              <Camera className="h-12 w-12 text-blue-600" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            📸 Progress Photo Analysis
          </h2>
          
          <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
            Upload progress photos and get AI-powered insights about your muscle growth, 
            body measurements, and personalized recommendations from your AI coach.
          </p>

          <div className="flex items-center justify-center space-x-2 text-blue-600 mb-8">
            <Clock className="h-5 w-5" />
            <span className="font-semibold">Coming Soon!</span>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <TrendingUp className="h-8 w-8 text-green-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Track Growth</h3>
              <p className="text-sm text-gray-600">
                AI analyzes your photos to track muscle development over time
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <Camera className="h-8 w-8 text-blue-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Smart Analysis</h3>
              <p className="text-sm text-gray-600">
                MediaPipe Pose detection for accurate body measurements
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <TrendingUp className="h-8 w-8 text-purple-600 mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">AI Insights</h3>
              <p className="text-sm text-gray-600">
                Get personalized recommendations from your AI fitness coach
              </p>
            </div>
          </div>

          <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> This feature is currently in development. 
              For now, focus on logging your workouts and chatting with your AI coach!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Photos;