import React, { useState, useEffect, useRef } from 'react';
import { Camera, Upload, TrendingUp, X, Loader2, CheckCircle2, Sparkles } from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

interface Photo {
  id: number;
  url: string;
  view: 'front' | 'side' | 'back';
  created_at: string;
  analysis_data?: any;
}

const Photos: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedView, setSelectedView] = useState<'front' | 'side' | 'back'>('front');
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const response = await api.get('/photos');
      setPhotos(response.data.photos || []);
    } catch (error: any) {
      console.error('Error fetching photos:', error);
      toast.error('Failed to load photos');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    await uploadPhoto(file);
  };

  const uploadPhoto = async (file: File) => {
    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('view', selectedView);

      const response = await api.post('/photos/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Photo uploaded successfully!');
      setUploadModalOpen(false);
      fetchPhotos();

      // Auto-trigger analysis
      if (response.data.photo) {
        analyzePhoto(response.data.photo.id);
      }
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast.error('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const analyzePhoto = async (photoId: number) => {
    try {
      setAnalyzing(true);
      toast.loading('Analyzing photo with AI...', { id: 'analyzing' });

      await api.post(`/photos/${photoId}/analyze`);

      toast.success('AI analysis complete!', { id: 'analyzing' });
      fetchPhotos(); // Refresh to get updated photo with analysis
    } catch (error: any) {
      console.error('Error analyzing photo:', error);
      toast.error('Failed to analyze photo', { id: 'analyzing' });
    } finally {
      setAnalyzing(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Progress Photos</h1>
          <p className="text-gray-600">Track your fitness journey with AI-powered analysis</p>
        </div>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          <Upload className="h-5 w-5" />
          <span>Upload Photo</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-600 rounded-lg">
              <Camera className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Photos</p>
              <p className="text-2xl font-bold text-gray-900">{photos.length}</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-r from-green-50 to-green-100">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-600 rounded-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Analyzed</p>
              <p className="text-2xl font-bold text-gray-900">
                {photos.filter(p => p.analysis_data).length}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-r from-purple-50 to-purple-100">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-purple-600 rounded-lg">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">This Week</p>
              <p className="text-2xl font-bold text-gray-900">
                {photos.filter(p => {
                  const photoDate = new Date(p.created_at);
                  const weekAgo = new Date();
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  return photoDate >= weekAgo;
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Photo Gallery */}
      {photos.length === 0 ? (
        <div className="card bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200">
          <div className="text-center py-12">
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-blue-100 rounded-full">
                <Camera className="h-12 w-12 text-blue-600" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              📸 No Photos Yet
            </h2>
            
            <p className="text-gray-700 mb-6 max-w-2xl mx-auto">
              Start tracking your progress! Upload photos and get AI-powered insights about your muscle growth.
            </p>

            <button
              onClick={() => setUploadModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Upload Your First Photo
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="card overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
              onClick={() => setSelectedPhoto(photo)}
            >
              <div className="relative aspect-[3/4] bg-gray-200">
                <img
                  src={photo.url}
                  alt={`${photo.view} view`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm capitalize">
                  {photo.view}
                </div>
                {photo.analysis_data && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-sm font-semibold">
                    {formatDate(photo.created_at)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Upload Progress Photo</h2>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select View
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['front', 'side', 'back'] as const).map((view) => (
                    <button
                      key={view}
                      onClick={() => setSelectedView(view)}
                      className={`py-3 px-4 rounded-lg font-semibold capitalize transition-colors ${
                        selectedView === view
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {view}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Select Photo
                </label>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-12 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-600 transition-colors flex flex-col items-center justify-center space-y-2"
                >
                  <Camera className="h-12 w-12 text-gray-400" />
                  <span className="text-gray-600 font-semibold">Choose a file</span>
                  <span className="text-sm text-gray-500">or drag and drop</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <button
                disabled={uploading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5" />
                    <span>Upload & Analyze</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Detail Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 capitalize">
                    {selectedPhoto.view} View
                  </h2>
                  <p className="text-gray-600">{formatDate(selectedPhoto.created_at)}</p>
                </div>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <img
                    src={selectedPhoto.url}
                    alt={`${selectedPhoto.view} view`}
                    className="w-full h-auto rounded-lg"
                  />
                </div>

                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">AI Analysis</h3>
                  {selectedPhoto.analysis_data ? (
                    <div className="space-y-4">
                      {/* Show full analysis text */}
                      {selectedPhoto.analysis_data.analysis && (
                        <div className="p-4 bg-blue-50 border-l-4 border-blue-600 rounded-lg">
                          <p className="text-gray-900 whitespace-pre-wrap font-medium">
                            {selectedPhoto.analysis_data.analysis}
                          </p>
                        </div>
                      )}

                      {/* Show summary if available */}
                      {selectedPhoto.analysis_data.summary && (
                        <>
                          {selectedPhoto.analysis_data.summary.muscleDevelopment && (
                            <div className="p-4 bg-purple-50 rounded-lg border-l-4 border-purple-600">
                              <p className="font-semibold text-gray-700 mb-2">💪 Muscle Development</p>
                              <p className="text-gray-900">{selectedPhoto.analysis_data.summary.muscleDevelopment}</p>
                            </div>
                          )}

                          {selectedPhoto.analysis_data.summary.overallAssessment && (
                            <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-600">
                              <p className="font-semibold text-gray-700 mb-2">📊 Body Composition</p>
                              <p className="text-gray-900">{selectedPhoto.analysis_data.summary.overallAssessment}</p>
                            </div>
                          )}

                          {selectedPhoto.analysis_data.summary.postureNotes && (
                            <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-600">
                              <p className="font-semibold text-gray-700 mb-2">🧘 Posture & Form</p>
                              <p className="text-gray-900">{selectedPhoto.analysis_data.summary.postureNotes}</p>
                            </div>
                          )}

                          {selectedPhoto.analysis_data.summary.keyPoints && selectedPhoto.analysis_data.summary.keyPoints.length > 0 && (
                            <div className="p-4 bg-indigo-50 rounded-lg">
                              <p className="font-semibold text-gray-700 mb-2">🎯 Key Observations</p>
                              <ul className="list-disc list-inside space-y-1">
                                {selectedPhoto.analysis_data.summary.keyPoints.map((point: string, idx: number) => (
                                  <li key={idx} className="text-gray-900">{point}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {selectedPhoto.analysis_data.summary.recommendations && selectedPhoto.analysis_data.summary.recommendations.length > 0 && (
                            <div className="p-4 bg-yellow-50 rounded-lg border-l-4 border-yellow-600">
                              <p className="font-semibold text-gray-700 mb-2">🏋️ Training Recommendations</p>
                              <ul className="list-disc list-inside space-y-1">
                                {selectedPhoto.analysis_data.summary.recommendations.map((rec: string, idx: number) => (
                                  <li key={idx} className="text-gray-900">{rec}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="p-6 text-center">
                      <Sparkles className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600 mb-4">No analysis available yet</p>
                      <button
                        onClick={() => analyzePhoto(selectedPhoto.id)}
                        disabled={analyzing}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center space-x-2 mx-auto"
                      >
                        {analyzing ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Analyzing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-5 w-5" />
                            <span>Run AI Analysis</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Photos;