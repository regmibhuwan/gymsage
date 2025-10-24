import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api, { uploadPhoto, analyzePhoto } from '../utils/api';
import { 
  Upload, 
  Camera, 
  Image as ImageIcon, 
  Trash2, 
  Eye,
  TrendingUp,
  Calendar,
  Loader2
} from 'lucide-react';

interface Photo {
  id: string;
  url: string;
  view: 'front' | 'side' | 'back';
  analysis_data?: {
    measurements: Record<string, number>;
    keypoints: Array<{ x: number; y: number; confidence: number }>;
  };
  created_at: string;
}

interface ProgressInsights {
  insights: string[];
  muscle_progress: Record<string, string>;
  recommendations: string[];
  total_photos?: number;
  date_range?: {
    first: string;
    latest: string;
  };
}

const Photos: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedView, setSelectedView] = useState<'front' | 'side' | 'back'>('front');
  const [dragActive, setDragActive] = useState(false);
  const [progressInsights, setProgressInsights] = useState<ProgressInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    fetchPhotos();
    fetchProgressInsights();
  }, []);

  const fetchPhotos = async () => {
    try {
      const response = await api.get('/photos');
      setPhotos(response.data.photos);
    } catch (error) {
      console.error('Error fetching photos:', error);
      toast.error('Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  const fetchProgressInsights = async () => {
    setInsightsLoading(true);
    try {
      const response = await api.get('/coach/progress-insights');
      setProgressInsights(response.data);
    } catch (error) {
      console.error('Error fetching progress insights:', error);
    } finally {
      setInsightsLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setUploading(true);

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('view', selectedView);

      // Upload photo using the API helper
      const response = await uploadPhoto(formData);
      
      setPhotos(prev => [response.photo, ...prev]);
      toast.success('Photo uploaded successfully!');
      
      // Trigger analysis
      setTimeout(async () => {
        try {
          const analysisResult = await analyzePhoto(response.photo.id);
          
          // Update photo with analysis data
          setPhotos(prev => prev.map(photo => 
            photo.id === response.photo.id 
              ? { ...photo, analysis_data: analysisResult.analysis }
              : photo
          ));

          toast.success('✅ Photo analysis completed!');
          // Refresh progress insights
          fetchProgressInsights();
        } catch (error) {
          console.error('Analysis error:', error);
          // Error toast is already handled by API helper
        }
      }, 2000);

    } catch (error) {
      console.error('Error uploading photo:', error);
      // Error is already handled by the API helper
    } finally {
      setUploading(false);
    }
  };


  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const deletePhoto = async (photoId: string) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      await api.delete(`/photos/${photoId}`);
      setPhotos(prev => prev.filter(photo => photo.id !== photoId));
      toast.success('Photo deleted successfully');
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error('Failed to delete photo');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getPhotosByView = (view: 'front' | 'side' | 'back') => {
    return photos.filter(photo => photo.view === view);
  };

  const getViewIcon = (view: string) => {
    switch (view) {
      case 'front':
        return '👤';
      case 'side':
        return '↔️';
      case 'back':
        return '🔙';
      default:
        return '📷';
    }
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
          <h1 className="text-3xl font-bold text-gray-900">Progress Photos</h1>
          <p className="text-gray-600">Track your visual progress with AI analysis</p>
        </div>
      </div>

      {/* Progress Insights Section */}
      {progressInsights && progressInsights.total_photos && progressInsights.total_photos > 1 && (
        <div className="card bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
              <TrendingUp className="h-6 w-6 text-blue-600" />
              <span>📊 Your Progress Insights</span>
            </h2>
            {insightsLoading && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            )}
          </div>

          {/* Insights */}
          {progressInsights.insights.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold text-gray-800 mb-2">💪 Muscle Development:</h3>
              <div className="space-y-2">
                {progressInsights.insights.map((insight, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg ${
                      insight.includes('✅')
                        ? 'bg-green-100 border border-green-300'
                        : insight.includes('⚠️')
                        ? 'bg-yellow-100 border border-yellow-300'
                        : 'bg-blue-100 border border-blue-300'
                    }`}
                  >
                    <p className="text-sm text-gray-800">{insight}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          {progressInsights.recommendations.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 mb-2">🎯 Recommendations:</h3>
              <ul className="space-y-2">
                {progressInsights.recommendations.map((rec, index) => (
                  <li
                    key={index}
                    className="flex items-start space-x-2 text-sm text-gray-700 bg-white p-2 rounded"
                  >
                    <span className="text-blue-600 font-bold">→</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {progressInsights.date_range && (
            <div className="mt-4 pt-4 border-t border-blue-200">
              <p className="text-xs text-gray-600">
                Tracking from{' '}
                {new Date(progressInsights.date_range.first).toLocaleDateString()} to{' '}
                {new Date(progressInsights.date_range.latest).toLocaleDateString()} •{' '}
                {progressInsights.total_photos} photos analyzed
              </p>
            </div>
          )}
        </div>
      )}

      {/* Upload Section */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload New Photo</h2>
        
        <div className="space-y-4">
          {/* View Selection */}
          <div>
            <label className="label">Photo View</label>
            <div className="flex space-x-4">
              {(['front', 'side', 'back'] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setSelectedView(view)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors duration-200 ${
                    selectedView === view
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <span className="text-lg">{getViewIcon(view)}</span>
                  <span className="capitalize">{view}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="mx-auto h-12 w-12 text-gray-400">
                <Camera className="h-full w-full" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">
                  Drop your photo here or click to browse
                </p>
                <p className="text-sm text-gray-600">
                  Supports JPG, PNG, and other image formats
                </p>
              </div>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="hidden"
                  id="photo-upload"
                  disabled={uploading}
                />
                <label
                  htmlFor="photo-upload"
                  className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                    uploading
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                  }`}
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Choose File</span>
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Photos Grid */}
      <div className="space-y-6">
        {(['front', 'side', 'back'] as const).map((view) => {
          const viewPhotos = getPhotosByView(view);
          
          return (
            <div key={view} className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 capitalize flex items-center space-x-2">
                  <span className="text-2xl">{getViewIcon(view)}</span>
                  <span>{view} View</span>
                  <span className="text-sm font-normal text-gray-500">
                    ({viewPhotos.length} photos)
                  </span>
                </h2>
              </div>

              {viewPhotos.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ImageIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No {view} photos yet</p>
                  <p className="text-sm">Upload your first {view} photo to start tracking progress</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {viewPhotos.map((photo) => (
                    <div key={photo.id} className="relative group">
                      <div className="aspect-w-3 aspect-h-4 bg-gray-200 rounded-lg overflow-hidden">
                        <img
                          src={photo.url}
                          alt={`${photo.view} view`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-200 rounded-lg">
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <button
                            onClick={() => deletePhoto(photo.id)}
                            className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors duration-200"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(photo.created_at)}
                          </p>
                          {photo.analysis_data && (
                            <div className="flex items-center space-x-1 text-green-600">
                              <TrendingUp className="h-4 w-4" />
                              <span className="text-xs">Analyzed</span>
                            </div>
                          )}
                        </div>
                        
                        {photo.analysis_data && (
                          <div className="mt-1 text-xs text-gray-600">
                            <p>Measurements available</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Photos;
