import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, Upload, X, Loader2, CheckCircle2, Sparkles, Target, Zap, Trash2, MessageCircle, Send 
} from 'lucide-react';
import api from '../utils/api';
import toast from 'react-hot-toast';

// Muscle group constants
const MUSCLE_GROUPS = [
  { value: 'chest', label: 'Chest', emoji: '💪' },
  { value: 'back', label: 'Back', emoji: '🏋️' },
  { value: 'shoulders', label: 'Shoulders', emoji: '🎯' },
  { value: 'biceps', label: 'Biceps', emoji: '💪' },
  { value: 'triceps', label: 'Triceps', emoji: '🔥' },
  { value: 'forearms', label: 'Forearms', emoji: '✊' },
  { value: 'abs', label: 'Abs', emoji: '⭐' },
  { value: 'obliques', label: 'Obliques', emoji: '⚡' },
  { value: 'quads', label: 'Quads', emoji: '🦵' },
  { value: 'hamstrings', label: 'Hamstrings', emoji: '🦵' },
  { value: 'calves', label: 'Calves', emoji: '🏃' },
  { value: 'glutes', label: 'Glutes', emoji: '🍑' },
  { value: 'full_body', label: 'Full Body', emoji: '🧍' },
];

interface Photo {
  id: number;
  url: string;
  muscle_group: string;
  notes?: string;
  weight_lbs?: number;
  body_fat_percentage?: number;
  measurements?: any;
  created_at: string;
  analysis_data?: any;
  comparison_data?: any;
  progress_score?: number;
}

interface Insight {
  id: number;
  muscle_group: string;
  insight_type: string;
  insight_text: string;
  confidence_score: number;
  created_at: string;
}

// Format comparison text to be readable
const formatComparisonText = (comparison: any) => {
  if (!comparison) return '';
  
  let text = comparison.text || '';
  
  // If it's already formatted nicely from AI, just show it
  if (comparison.text && typeof comparison.text === 'string') {
    return text;
  }
  
  // Otherwise, format the summary
  if (comparison.summary) {
    const parts = [];
    if (comparison.summary.growth_percentage) {
      parts.push(`Growth: ${comparison.summary.growth_percentage > 0 ? '+' : ''}${comparison.summary.growth_percentage}%`);
    }
    if (comparison.summary.definition_improvement) {
      parts.push('Muscle definition improved');
    }
    if (comparison.summary.recommendations) {
      parts.push(`\nRecommendations: ${comparison.summary.recommendations}`);
    }
    return parts.join('\n');
  }
  
  return text;
};

const ProgressPhotos: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosByMuscle, setPhotosByMuscle] = useState<Record<string, Photo[]>>({});
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState<string>('chest');
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Upload form fields
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadWeight, setUploadWeight] = useState('');
  const [uploadBodyFat, setUploadBodyFat] = useState('');
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD format
  
  // AI Chat
  const [showAIChat, setShowAIChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{role: string; content: string}>>([]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const response = await api.get('/photos/enhanced');
      setPhotos(response.data.photos || []);
      setPhotosByMuscle(response.data.photosByMuscle || {});
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

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

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
      formData.append('muscle_group', selectedMuscle);
      formData.append('photo_date', uploadDate); // Send custom date
      if (uploadNotes) formData.append('notes', uploadNotes);
      if (uploadWeight) formData.append('weight_lbs', uploadWeight);
      if (uploadBodyFat) formData.append('body_fat_percentage', uploadBodyFat);

      await api.post('/photos/enhanced/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Photo uploaded and analyzing...');
      setUploadModalOpen(false);
      setUploadNotes('');
      setUploadWeight('');
      setUploadBodyFat('');
      fetchPhotos();
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to upload photo';
      toast.error(errorMessage);
    } finally {
      setUploading(false);
    }
  };


  const deletePhoto = async (photoId: number) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Are you sure you want to delete this photo? This cannot be undone.')) {
      return;
    }

    try {
      await api.delete(`/photos/enhanced/${photoId}`);
      toast.success('Photo deleted successfully');
      setSelectedPhoto(null);
      fetchPhotos();
    } catch (error: any) {
      console.error('Error deleting photo:', error);
      toast.error('Failed to delete photo');
    }
  };

  const sendChatMessage = async () => {
    if (!chatMessage.trim()) return;

    const userMessage = chatMessage.trim();
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      // Use the new AI chat endpoint with context from recent photos
      const response = await api.post('/ai/chat', { 
        message: userMessage,
        history: chatHistory.map(msg => ({ role: msg.role, content: msg.content }))
      });
      
      // Extract plain text response - handle both new and legacy formats
      // IMPORTANT: Only extract the text content, never show JSON structure
      let aiResponse = '';
      
      // New AI endpoint format: { content: "..." }
      if (response.data && response.data.content && typeof response.data.content === 'string') {
        aiResponse = response.data.content;
      } 
      // Legacy coach endpoint format: { message: "...", suggestions: [], ... }
      else if (response.data && response.data.message && typeof response.data.message === 'string') {
        aiResponse = response.data.message;
      } 
      // Direct string response
      else if (typeof response.data === 'string') {
        aiResponse = response.data;
      } 
      // Other response formats
      else if (response.data && response.data.response && typeof response.data.response === 'string') {
        aiResponse = response.data.response;
      } 
      // Fallback - extract any text content, avoid JSON stringification
      else {
        // Try to extract meaningful text from the response
        const data = response.data || {};
        if (typeof data.text === 'string') {
          aiResponse = data.text;
        } else if (typeof data.summary === 'string') {
          aiResponse = data.summary;
        } else {
          // Last resort - if we somehow got JSON, extract just the message
          console.warn('Unexpected response format:', response.data);
          aiResponse = 'I received your message but encountered a formatting issue. Please try again.';
        }
      }
      
      // Clean up response - remove markdown formatting and preserve line breaks
      // Remove markdown bold/italic (**text**, *text*, __text__, _text_)
      aiResponse = aiResponse.replace(/\*\*([^*]+)\*\*/g, '$1');
      aiResponse = aiResponse.replace(/__([^_]+)__/g, '$1');
      aiResponse = aiResponse.replace(/\*([^*]+)\*/g, '$1');
      aiResponse = aiResponse.replace(/_([^_]+)_/g, '$1');
      // Remove markdown headers
      aiResponse = aiResponse.replace(/^#{1,6}\s+/gm, '');
      // Normalize line breaks (preserve intentional double breaks, remove excessive ones)
      aiResponse = aiResponse.replace(/\n{3,}/g, '\n\n');
      // Trim and clean up
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


  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Visual Progress Tracker</h1>
          <p className="text-sm sm:text-base text-gray-600">Track muscle-specific progress with AI-powered analysis</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:space-x-3 sm:gap-0 w-full sm:w-auto">
          <button
            onClick={() => setShowAIChat(!showAIChat)}
            className="btn-primary flex items-center justify-center space-x-2"
          >
            <MessageCircle className="h-5 w-5" />
            <span>Ask AI</span>
          </button>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="btn-primary flex items-center justify-center space-x-2"
          >
            <Upload className="h-5 w-5" />
            <span>Upload Photo</span>
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center space-x-3">
            <Camera className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total Photos</p>
              <p className="text-2xl font-bold text-gray-900">{photos.length}</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-r from-green-50 to-green-100">
          <div className="flex items-center space-x-3">
            <Target className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Muscle Groups</p>
              <p className="text-2xl font-bold text-gray-900">{Object.keys(photosByMuscle).length}</p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-r from-purple-50 to-purple-100">
          <div className="flex items-center space-x-3">
            <Sparkles className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">Analyzed</p>
              <p className="text-2xl font-bold text-gray-900">
                {photos.filter(p => p.analysis_data).length}
              </p>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-r from-orange-50 to-orange-100">
          <div className="flex items-center space-x-3">
            <Zap className="h-8 w-8 text-orange-600" />
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

      {/* AI Chat Panel */}
      {showAIChat && (
        <div className="card bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <MessageCircle className="h-6 w-6 text-purple-600" />
              <h3 className="text-lg font-bold text-gray-900">Ask AI About Your Progress</h3>
            </div>
            <button onClick={() => setShowAIChat(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Suggested Questions */}
            {chatHistory.length === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  "What percentage of change do you see in my chest from March to August?",
                  "Is my upper chest growing more than my lower chest?",
                  "Which muscle group has shown the most improvement?",
                  "Compare my back progress from last month to now"
                ].map((question) => (
                  <button
                    key={question}
                    onClick={() => {
                      setChatMessage(question);
                      setTimeout(() => sendChatMessage(), 100);
                    }}
                    className="text-left p-3 bg-white rounded-lg hover:bg-purple-50 text-sm text-gray-700 hover:text-purple-700 transition-colors border border-gray-200"
                  >
                    {question}
                  </button>
                ))}
              </div>
            )}

            {/* Chat History */}
            {chatHistory.length > 0 && (
              <div className="bg-white rounded-lg p-4 max-h-96 overflow-y-auto space-y-3">
                {chatHistory.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-lg ${
                      msg.role === 'user' 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 p-3 rounded-lg">
                      <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Input */}
            <div className="flex space-x-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Ask about your progress photos..."
                className="flex-1 input-field"
                style={{ fontSize: '16px' }}
                disabled={chatLoading}
              />
              <button
                onClick={sendChatMessage}
                disabled={chatLoading || !chatMessage.trim()}
                className="btn-primary min-w-[48px] min-h-[48px] flex items-center justify-center"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content - Grid View */}
      <div className="space-y-6">
          {Object.entries(photosByMuscle).length === 0 ? (
            <div className="card bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 text-center py-12">
              <Camera className="h-16 w-16 text-blue-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">No Photos Yet</h2>
              <p className="text-gray-700 mb-6">Start tracking your progress by uploading your first photo!</p>
              <button
                onClick={() => setUploadModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors"
              >
                Upload First Photo
              </button>
            </div>
          ) : (
            Object.entries(photosByMuscle).map(([muscle, musclePhotos]) => {
              const muscleInfo = MUSCLE_GROUPS.find(m => m.value === muscle);
              const latestPhoto = musclePhotos[0];

              return (
                <div key={muscle} className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <span className="text-3xl">{muscleInfo?.emoji || '💪'}</span>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 capitalize">{muscle}</h3>
                        <p className="text-sm text-gray-600">{musclePhotos.length} photos tracked</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {musclePhotos.slice(0, 4).map((photo) => (
                      <div
                        key={photo.id}
                        onClick={() => setSelectedPhoto(photo)}
                        className="relative aspect-[3/4] bg-gray-200 rounded-lg overflow-hidden cursor-pointer group hover:ring-2 ring-blue-500 transition-all"
                      >
                        <img
                          src={photo.url}
                          alt={`${muscle} progress`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                          <p className="text-white text-xs font-semibold">{formatDate(photo.created_at)}</p>
                        </div>
                        {photo.comparison_data?.growth_percentage !== null && photo.comparison_data?.growth_percentage !== undefined && (
                          <div className={`absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded ${
                            photo.comparison_data.growth_percentage > 0 
                              ? 'bg-green-600 text-white' 
                              : photo.comparison_data.growth_percentage < 0
                              ? 'bg-red-600 text-white'
                              : 'bg-gray-600 text-white'
                          }`}>
                            {photo.comparison_data.growth_percentage > 0 ? '+' : ''}
                            {photo.comparison_data.growth_percentage.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {latestPhoto.comparison_data && (
                    <div className="mt-4 p-4 bg-green-50 border-l-4 border-green-600 rounded-lg">
                      <p className="text-sm font-semibold text-green-900">Latest Progress:</p>
                      {latestPhoto.comparison_data.growth_percentage !== null && latestPhoto.comparison_data.growth_percentage !== undefined ? (
                        <p className="text-sm text-green-800">
                          {latestPhoto.comparison_data.growth_percentage > 0 ? 'Growth: +' : 'Change: '}
                          {latestPhoto.comparison_data.growth_percentage.toFixed(1)}% vs previous photo
                        </p>
                      ) : (
                        <p className="text-sm text-green-800">
                          {latestPhoto.comparison_data.note || 'This is your first photo for this muscle group. Upload more photos to see progress comparisons.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

      {/* Upload Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Upload Progress Photo</h2>
              <button onClick={() => setUploadModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Muscle Group *</label>
                <select
                  value={selectedMuscle}
                  onChange={(e) => setSelectedMuscle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {MUSCLE_GROUPS.map((muscle) => (
                    <option key={muscle.value} value={muscle.value}>
                      {muscle.emoji} {muscle.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Photo Date *</label>
                <input
                  type="date"
                  value={uploadDate}
                  onChange={(e) => setUploadDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">Select when this photo was actually taken</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Photo *</label>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-12 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-600 transition-colors flex flex-col items-center justify-center space-y-2"
                >
                  <Camera className="h-12 w-12 text-gray-400" />
                  <span className="text-gray-600 font-semibold">Choose a file</span>
                  <span className="text-sm text-gray-500">PNG, JPG up to 10MB</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <div>
                <label className="label">Notes (Optional)</label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="e.g., After 3 months of training..."
                  className="input-field"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Weight (lbs)</label>
                  <input
                    type="number"
                    value={uploadWeight}
                    onChange={(e) => setUploadWeight(e.target.value)}
                    placeholder="180"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="label">Body Fat %</label>
                  <input
                    type="number"
                    step="0.1"
                    value={uploadBodyFat}
                    onChange={(e) => setUploadBodyFat(e.target.value)}
                    placeholder="15.5"
                    className="input-field"
                  />
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Tip:</strong> Take photos in the same lighting and angle for better comparison results!
                </p>
              </div>
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
                  <h2 className="text-2xl font-bold text-gray-900 capitalize">{selectedPhoto?.muscle_group}</h2>
                  <p className="text-gray-600">{formatDate(selectedPhoto?.created_at || '')}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => selectedPhoto && deletePhoto(selectedPhoto.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                    title="Delete photo"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                  <button onClick={() => setSelectedPhoto(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <img
                    src={selectedPhoto?.url}
                    alt={`${selectedPhoto?.muscle_group} progress`}
                    className="w-full h-auto rounded-lg"
                  />
                  {selectedPhoto?.notes && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm font-semibold text-gray-700 mb-1">Notes:</p>
                      <p className="text-sm text-gray-900">{selectedPhoto.notes}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-gray-900">Analysis & Progress</h3>

                  {selectedPhoto?.comparison_data && (
                    <div className="p-4 bg-green-50 border-l-4 border-green-600 rounded-lg">
                      <p className="text-sm font-semibold text-green-900 mb-2">Progress vs Previous Photo</p>
                      {selectedPhoto.comparison_data.growth_percentage !== null && selectedPhoto.comparison_data.growth_percentage !== undefined ? (
                        <>
                          <p className="text-lg font-bold text-green-600 mb-2">
                            {selectedPhoto.comparison_data.growth_percentage > 0 ? 'Growth: +' : 'Change: '}
                            {selectedPhoto.comparison_data.growth_percentage.toFixed(1)}%
                          </p>
                          {selectedPhoto.comparison_data.note && (
                            <p className="text-sm text-green-800">{selectedPhoto.comparison_data.note}</p>
                          )}
                        </>
                      ) : (
                        <p className="text-sm text-green-800">
                          {selectedPhoto.comparison_data.note || 'This is your first photo for this muscle group. Upload more photos to see progress comparisons.'}
                        </p>
                      )}
                    </div>
                  )}

                  {selectedPhoto?.analysis_data?.summary && (
                    <div className="space-y-3">
                      {selectedPhoto.analysis_data.summary.key_observations?.length > 0 && (
                        <div className="p-4 bg-purple-50 rounded-lg">
                          <p className="text-sm font-semibold text-gray-700 mb-2">Key Observations:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {selectedPhoto.analysis_data.summary.key_observations.map((obs: string, idx: number) => (
                              <li key={idx} className="text-sm text-gray-900">{obs}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedPhoto.analysis_data.summary.recommendations?.length > 0 && (
                        <div className="p-4 bg-yellow-50 rounded-lg">
                          <p className="text-sm font-semibold text-gray-700 mb-2">Recommendations:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {selectedPhoto.analysis_data.summary.recommendations.map((rec: string, idx: number) => (
                              <li key={idx} className="text-sm text-gray-900">{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}
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

export default ProgressPhotos;

