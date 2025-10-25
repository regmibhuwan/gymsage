import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { 
  Mic, 
  MicOff, 
  Play, 
  Save, 
  X, 
  Plus,
  Trash2,
  Volume2,
  Upload
} from 'lucide-react';

interface Exercise {
  exercise: string;
  sets: Array<{
    set: number;
    reps: number;
    weight_kg: number;
  }>;
}

const AddWorkout: React.FC = () => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentExercise, setCurrentExercise] = useState('');
  const [currentSets, setCurrentSets] = useState(1);
  const [currentReps, setCurrentReps] = useState(10);
  const [currentWeight, setCurrentWeight] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const navigate = useNavigate();

  // Timer effect for recording duration
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      setRecordingTime(0);
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
        toast.success(`✅ Recording complete! (${recordingTime}s)`);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.success('🎤 Recording... Speak now!');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Could not access microphone. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAndParse = async () => {
    if (!audioBlob) {
      toast.error('No audio recorded');
      return;
    }

    setIsProcessing(true);
    const loadingToast = toast.loading('🎯 Transcribing with Whisper AI...');

    try {
      // Send audio to backend for Whisper transcription
      const formData = new FormData();
      formData.append('audio', audioBlob, 'workout.webm');

      console.log('API base URL:', api.defaults.baseURL);
      console.log('Making request to:', '/voice/transcribe');
      console.log('Full URL will be:', api.defaults.baseURL + '/voice/transcribe');

      const response = await api.post('/voice/transcribe', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.dismiss(loadingToast);

      if (response.data.success && response.data.data) {
        setExercises(prev => [...prev, response.data.data]);
        setAudioBlob(null);
        toast.success(`✅ Added ${response.data.data.exercise} with ${response.data.data.sets.length} sets!`);
      } else {
        toast.error('Could not parse workout from audio');
      }
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error('Error transcribing audio:', error);
      toast.error(error.response?.data?.error || 'Failed to process audio');
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelRecording = () => {
    setAudioBlob(null);
    toast('Recording discarded');
  };

  const addManualExercise = () => {
    if (!currentExercise.trim()) {
      toast.error('Please enter an exercise name');
      return;
    }

    const sets = [];
    for (let i = 1; i <= currentSets; i++) {
      sets.push({
        set: i,
        reps: currentReps,
        weight_kg: currentWeight
      });
    }

    const newExercise: Exercise = {
      exercise: currentExercise.trim(),
      sets
    };

    setExercises(prev => [...prev, newExercise]);
    setCurrentExercise('');
    setCurrentSets(1);
    setCurrentReps(10);
    setCurrentWeight(0);
    toast.success('Exercise added');
  };

  const removeExercise = (index: number) => {
    setExercises(prev => prev.filter((_, i) => i !== index));
  };

  const updateSet = (exerciseIndex: number, setIndex: number, field: 'reps' | 'weight_kg', value: number) => {
    setExercises(prev => prev.map((exercise, exIndex) => {
      if (exIndex === exerciseIndex) {
        return {
          ...exercise,
          sets: exercise.sets.map((set, sIndex) => {
            if (sIndex === setIndex) {
              return { ...set, [field]: value };
            }
            return set;
          })
        };
      }
      return exercise;
    }));
  };

  const addSet = (exerciseIndex: number) => {
    setExercises(prev => prev.map((exercise, index) => {
      if (index === exerciseIndex) {
        const lastSet = exercise.sets[exercise.sets.length - 1];
        return {
          ...exercise,
          sets: [...exercise.sets, {
            set: exercise.sets.length + 1,
            reps: lastSet.reps,
            weight_kg: lastSet.weight_kg
          }]
        };
      }
      return exercise;
    }));
  };

  const removeSet = (exerciseIndex: number, setIndex: number) => {
    setExercises(prev => prev.map((exercise, index) => {
      if (index === exerciseIndex) {
        const newSets = exercise.sets.filter((_, sIndex) => sIndex !== setIndex);
        return {
          ...exercise,
          sets: newSets.map((set, sIndex) => ({ ...set, set: sIndex + 1 }))
        };
      }
      return exercise;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (exercises.length === 0) {
      toast.error('Please add at least one exercise');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/workouts', {
        date,
        exercises,
        notes
      });

      toast.success('Workout saved successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Error saving workout:', error);
      toast.error(error.response?.data?.error || 'Failed to save workout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add Workout</h1>
          <p className="text-gray-600">Log your training session</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date and Notes */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="label">Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="input-field"
                rows={3}
                placeholder="Add any notes about your workout..."
              />
            </div>
          </div>
        </div>

        {/* Voice Recording - Whisper AI */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <Mic className="h-6 w-6 text-blue-600" />
            <span>Voice Recording (Powered by Whisper AI)</span>
          </h2>
          
          <div className="space-y-4">
            {/* Simple Instructions */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900 mb-1">
                🎯 <strong>Just speak naturally!</strong> Use kg or lbs - it auto-converts!
              </p>
              <p className="text-xs text-blue-700">
                Examples: "Bench press 3 sets of 10 reps at 60 kg" or "135 pounds bench press 3 sets of 10"
              </p>
            </div>

            {/* Recording Button */}
            {!audioBlob ? (
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing}
                  className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                    isRecording 
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="h-5 w-5" />
                      <span>Stop Recording</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-5 w-5" />
                      <span>Start Recording</span>
                    </>
                  )}
                </button>

                {isRecording && (
                  <div className="flex items-center space-x-2">
                    <Volume2 className="h-5 w-5 animate-pulse text-red-600" />
                    <span className="font-semibold text-red-600 text-lg">
                      {recordingTime}s
                    </span>
                    <span className="text-gray-600">- Speak now, take your time!</span>
                  </div>
                )}
              </div>
            ) : (
              /* Audio recorded - show transcribe button */
              <div className="space-y-3">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-medium">
                    ✅ Audio recorded ({recordingTime}s)! Click "Transcribe & Add" to process.
                  </p>
                </div>
                
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={transcribeAndParse}
                    disabled={isProcessing}
                    className="btn-primary flex items-center space-x-2"
                  >
                    <Upload className="h-4 w-4" />
                    <span>{isProcessing ? 'Processing...' : 'Transcribe & Add Exercise'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={cancelRecording}
                    disabled={isProcessing}
                    className="btn-secondary flex items-center space-x-2"
                  >
                    <X className="h-4 w-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Manual Exercise Entry */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Add Exercise Manually</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="label">Exercise</label>
              <input
                type="text"
                value={currentExercise}
                onChange={(e) => setCurrentExercise(e.target.value)}
                className="input-field"
                placeholder="e.g., Bench Press"
              />
            </div>
            <div>
              <label className="label">Sets</label>
              <input
                type="number"
                min="1"
                value={currentSets}
                onChange={(e) => setCurrentSets(parseInt(e.target.value) || 1)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Reps</label>
              <input
                type="number"
                min="1"
                value={currentReps}
                onChange={(e) => setCurrentReps(parseInt(e.target.value) || 1)}
                className="input-field"
              />
            </div>
            <div>
              <label className="label">Weight (kg)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={currentWeight}
                onChange={(e) => setCurrentWeight(parseFloat(e.target.value) || 0)}
                className="input-field"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={addManualExercise}
                className="btn-primary w-full flex items-center justify-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>

        {/* Exercises List */}
        {exercises.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Exercises</h2>
            
            <div className="space-y-6">
              {exercises.map((exercise, exerciseIndex) => (
                <div key={exerciseIndex} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900 capitalize">
                      {exercise.exercise}
                    </h3>
                    <button
                      type="button"
                      onClick={() => removeExercise(exerciseIndex)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {exercise.sets.map((set, setIndex) => (
                      <div key={setIndex} className="flex items-center space-x-4">
                        <span className="w-8 text-sm font-medium text-gray-600">
                          Set {set.set}
                        </span>
                        <input
                          type="number"
                          min="1"
                          value={set.reps}
                          onChange={(e) => updateSet(exerciseIndex, setIndex, 'reps', parseInt(e.target.value) || 1)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Reps"
                        />
                        <span className="text-sm text-gray-600">reps</span>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={set.weight_kg}
                          onChange={(e) => updateSet(exerciseIndex, setIndex, 'weight_kg', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="Weight"
                        />
                        <span className="text-sm text-gray-600">kg</span>
                        
                        {exercise.sets.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSet(exerciseIndex, setIndex)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    
                    <button
                      type="button"
                      onClick={() => addSet(exerciseIndex)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Set</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || exercises.length === 0}
            className="btn-primary flex items-center space-x-2"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <Save className="h-5 w-5" />
                <span>Save Workout</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddWorkout;
