import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import SummaryModal from '../components/SummaryModal';
import { 
  Mic, 
  MicOff, 
  Save, 
  X, 
  Plus,
  Trash2,
  Volume2,
  Upload,
  BarChart3,
  Clock,
  Activity
} from 'lucide-react';

interface Exercise {
  exercise: string;
  sets: Array<{
    set: number;
    reps: number;
    weight_kg: number;
    weight_lbs?: number;
    weight_unit?: string;
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
  const [currentSets, setCurrentSets] = useState('');
  const [currentReps, setCurrentReps] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  
  // Session context for incremental logging
  const [sessionContext, setSessionContext] = useState({
    lastExercise: '',
    lastSetNumber: 0,
    isVoiceContinuation: false,
    isEditing: false,
    editingSetIndex: -1,
    editingExerciseIndex: -1
  });

  // Summary modal state
  const [summaryModal, setSummaryModal] = useState({
    isOpen: false,
    content: '',
    tableData: null as any[] | null,
    stats: null as any,
    type: 'daily' as 'daily' | 'weekly'
  });

  // Save or continue modal state
  const [saveContinueModal, setSaveContinueModal] = useState({
    isOpen: false,
    exerciseName: ''
  });

  // Exercise editing state
  const [editingExercise, setEditingExercise] = useState<number | null>(null);
  const [editingExerciseName, setEditingExerciseName] = useState('');

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

      const response = await api.post('/voice/transcribe', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      toast.dismiss(loadingToast);

      if (response.data.success && response.data.data) {
        const parsedData = response.data.data;
        
        // Use incremental parsing with session context
        const incrementalResponse = await api.post('/voice/parse-incremental', {
          transcript: response.data.transcript,
          sessionContext: sessionContext
        });

        if (incrementalResponse.data.success) {
          const incrementalData = incrementalResponse.data.data;
          
          // Update session context
          setSessionContext(prev => ({
            ...prev,
            lastExercise: incrementalData.exercise,
            lastSetNumber: incrementalData.setNumber,
            isVoiceContinuation: false
          }));

          // Handle the parsed data based on whether it's a new exercise or continuation
          if (incrementalData.isNewExercise) {
            // Add as new exercise
            setExercises(prev => [...prev, incrementalData]);
            toast.success(`✅ Added ${incrementalData.exercise} with ${incrementalData.sets.length} sets!`);
            
            // Show save or continue modal for new exercises
            setSaveContinueModal({
              isOpen: true,
              exerciseName: incrementalData.exercise
            });
          } else {
            // Check if we're editing a set
            if (sessionContext.isEditing && sessionContext.editingSetIndex >= 0) {
              // Update existing set with new voice data
              setExercises(prev => prev.map((exercise, exIndex) => {
                if (exIndex === exercises.findIndex(e => e.exercise === incrementalData.exercise)) {
                  return {
                    ...exercise,
                    sets: exercise.sets.map((set, sIndex) => {
                      if (sIndex === sessionContext.editingSetIndex) {
                        // Update this specific set
                        return {
                          ...set,
                          reps: incrementalData.sets[0]?.reps || set.reps,
                          weight_kg: incrementalData.sets[0]?.weight_kg || set.weight_kg,
                          weight_lbs: incrementalData.sets[0]?.weight_lbs || set.weight_lbs,
                          weight_unit: incrementalData.sets[0]?.weight_unit || set.weight_unit
                        };
                      }
                      return set;
                    })
                  };
                }
                return exercise;
              }));
              
              toast.success(`✅ Updated Set ${sessionContext.editingSetIndex + 1}!`);
              
              // Reset editing context
              setSessionContext(prev => ({
                ...prev,
                isEditing: false,
                editingSetIndex: -1
              }));
            } else {
              // Add sets to existing exercise
              setExercises(prev => {
                const updatedExercises = [...prev];
                const lastExerciseIndex = updatedExercises.length - 1;
                
                if (lastExerciseIndex >= 0 && 
                    updatedExercises[lastExerciseIndex].exercise === incrementalData.exercise) {
                  // Add all sets from the incremental data
                  updatedExercises[lastExerciseIndex].sets.push(...incrementalData.sets);
                  return updatedExercises;
                } else {
                  // Fallback: add as new exercise
                  return [...prev, incrementalData];
                }
              });
              toast.success(`✅ Added ${incrementalData.sets.length} sets to ${incrementalData.exercise}!`);
            }
          }
        } else {
          // Fallback to original parsing
          setExercises(prev => [...prev, parsedData]);
          toast.success(`✅ Added ${parsedData.exercise} with ${parsedData.sets.length} sets!`);
        }
        
        setAudioBlob(null);
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

    const setsValue = parseInt(currentSets) || 1;
    const repsValue = parseInt(currentReps) || 0;
    const weightValue = parseFloat(currentWeight) || 0;

    if (setsValue < 1) {
      toast.error('Please enter at least 1 set');
      return;
    }

    if (repsValue < 1) {
      toast.error('Please enter the number of reps');
      return;
    }

    const sets = [];
    for (let i = 1; i <= setsValue; i++) {
      sets.push({
        set: i,
        reps: repsValue,
        weight_kg: weightValue
      });
    }

    const newExercise: Exercise = {
      exercise: currentExercise.trim(),
      sets
    };

    setExercises(prev => [...prev, newExercise]);
    setCurrentExercise('');
    setCurrentSets('');
    setCurrentReps('');
    setCurrentWeight('');
    toast.success('Exercise added');
  };

  const removeExercise = (index: number) => {
    setExercises(prev => {
      const newExercises = prev.filter((_, i) => i !== index);
      
      // Clean session context if the removed exercise was the last one
      if (newExercises.length === 0) {
        setSessionContext({
          lastExercise: '',
          lastSetNumber: 0,
          isVoiceContinuation: false,
          isEditing: false,
          editingSetIndex: -1,
          editingExerciseIndex: -1
        });
      } else if (index === prev.length - 1) {
        // If we removed the last exercise, update context to the new last exercise
        const lastExercise = newExercises[newExercises.length - 1];
        setSessionContext({
          lastExercise: lastExercise.exercise,
          lastSetNumber: lastExercise.sets.length,
          isVoiceContinuation: false,
          isEditing: false,
          editingSetIndex: -1,
          editingExerciseIndex: -1
        });
      }
      
      return newExercises;
    });
  };

  const startEditingExercise = (index: number) => {
    setEditingExercise(index);
    setEditingExerciseName(exercises[index].exercise);
  };

  const saveExerciseName = (index: number) => {
    if (editingExerciseName.trim()) {
      setExercises(prev => prev.map((exercise, i) => 
        i === index ? { ...exercise, exercise: editingExerciseName.trim() } : exercise
      ));
      
      // Update session context if this was the last exercise
      if (index === exercises.length - 1) {
        setSessionContext(prev => ({
          ...prev,
          lastExercise: editingExerciseName.trim()
        }));
      }
      
      toast.success('Exercise name updated');
    }
    setEditingExercise(null);
    setEditingExerciseName('');
  };

  const cancelEditingExercise = () => {
    setEditingExercise(null);
    setEditingExerciseName('');
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

  const addSetWithVoice = async (exerciseIndex: number) => {
    const exercise = exercises[exerciseIndex];
    if (!exercise) return;

    // Update session context to the current exercise and mark as voice continuation
    setSessionContext({
      lastExercise: exercise.exercise,
      lastSetNumber: exercise.sets.length,
      isVoiceContinuation: true, // Special flag for voice-added sets
      isEditing: false,
      editingSetIndex: -1,
      editingExerciseIndex: -1
    });

    // Start recording
    if (!isRecording) {
      startRecording();
      toast.success(`Recording for ${exercise.exercise} - Set ${exercise.sets.length + 1}. Say "next set" or the reps and weight.`);
    } else {
      toast.success('Already recording. Stop recording first.');
    }
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

  const editSetWithVoice = async (exerciseIndex: number, setIndex: number) => {
    const exercise = exercises[exerciseIndex];
    const set = exercise.sets[setIndex];
    
    setCurrentExercise(exercise.exercise);
    setCurrentSets('1');
    setCurrentReps(set.reps.toString());
    setCurrentWeight(set.weight_kg.toString());

    toast(`Editing Set ${set.set} of ${exercise.exercise}. Say the new reps and weight.`, { icon: '📝' });

    if (!isRecording) {
      await startRecording();
      
      // Set editing context for the backend
      setSessionContext({
        lastExercise: exercise.exercise,
        lastSetNumber: set.set,
        isVoiceContinuation: false,
        isEditing: true,
        editingSetIndex: setIndex,
        editingExerciseIndex: exerciseIndex
      });
    }
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

  // Helper function to normalize and compare dates precisely (same as Dashboard)
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
        // Get all workouts for today - use same logic as Dashboard
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = normalizeDate(today);
        
        try {
          const workoutsResponse = await api.get('/workouts');
          const allWorkouts = workoutsResponse.data.workouts || [];
          
          // Normalize dates for comparison - use same method as Dashboard
          const todayWorkouts = allWorkouts.filter((workout: any) => {
            if (!workout || !workout.date) return false;
            
            // Try direct string comparison first
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
          console.log('🎯 Today\'s workouts found:', todayWorkouts.length, todayWorkouts.map((w: any) => ({ id: w.id, date: w.date })));
          
          if (todayWorkouts.length === 0) {
            // Show helpful message with recent workout dates
            const recentWorkouts = allWorkouts.slice(0, 5);
            if (recentWorkouts.length > 0) {
              const datesList = recentWorkouts.map((w: any) => {
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
          const allExercises = todayWorkouts.reduce((acc: any[], workout: any) => {
            if (workout.exercises && Array.isArray(workout.exercises)) {
              return [...acc, ...workout.exercises];
            }
            return acc;
          }, []);

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
        } catch (error) {
          console.error('Error fetching today\'s workout:', error);
          toast.error('Failed to fetch today\'s workout');
        }
      } else if (type === 'weekly') {
        // Get workouts from the current week (Monday to Sunday) - same as Dashboard
        const now = new Date();
        const weekStart = new Date(now);
        const dayOfWeek = weekStart.getDay();
        // Adjust to Monday as start of week
        const daysToMonday = dayOfWeek === 0 ? -6 : -(dayOfWeek - 1);
        weekStart.setDate(weekStart.getDate() + daysToMonday);
        weekStart.setHours(0, 0, 0, 0);
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        
        const weekStartStr = normalizeDate(weekStart);
        const weekEndStr = normalizeDate(weekEnd);
        
        try {
          const workoutsResponse = await api.get('/workouts');
          const allWorkouts = workoutsResponse.data.workouts || [];
          
          // Filter workouts from this week - use same method as Dashboard
          const weekWorkouts = allWorkouts.filter((workout: any) => {
            if (!workout || !workout.date) return false;
            
            // Normalize workout date
            const workoutDateStr = normalizeDate(workout.date);
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
          
          console.log('📅 Weekly range:', weekStartStr, 'to', weekEndStr);
          console.log('🎯 Week workouts found:', weekWorkouts.length);
          
          if (weekWorkouts.length === 0) {
            const totalWorkouts = allWorkouts.length;
            if (totalWorkouts > 0) {
              const allDates = allWorkouts.map((w: any) => normalizeDate(w.date)).filter((d: string) => d);
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
        } catch (error) {
          console.error('Error fetching weekly workouts:', error);
          toast.error('Failed to fetch weekly workouts');
        }
      }
    } catch (error: any) {
      console.error('Error generating summary:', error);
      toast.error('Failed to generate summary');
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
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
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
                onChange={(e) => setCurrentSets(e.target.value)}
                className="input-field"
                placeholder="Enter sets"
              />
            </div>
            <div>
              <label className="label">Reps</label>
              <input
                type="number"
                min="1"
                value={currentReps}
                onChange={(e) => setCurrentReps(e.target.value)}
                className="input-field"
                placeholder="Enter reps"
              />
            </div>
            <div>
              <label className="label">Weight (kg)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)}
                className="input-field"
                placeholder="Enter weight"
              />
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <button
                type="button"
                onClick={addManualExercise}
                className="btn-primary w-full flex items-center justify-center space-x-2"
              >
                <Plus className="h-5 w-5" />
                <span className="text-base">Add Exercise</span>
              </button>
            </div>
          </div>
        </div>

        {/* Session Context Display */}
        {(sessionContext.lastExercise || exercises.length > 0) && (
          <div className="card bg-blue-50 border-blue-200">
            <div className="flex items-center space-x-3 mb-3">
              <Activity className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-blue-900">Session Context</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-blue-800">
                  <strong>Last Exercise:</strong> {sessionContext.lastExercise || 'None'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-blue-800">
                  <strong>Last Set:</strong> {sessionContext.lastSetNumber || 0}
                </span>
              </div>
            </div>
            <div className="mt-3 text-xs text-blue-700">
              💡 Say "next set" to continue the same exercise, or mention a new exercise name to start fresh.
            </div>
          </div>
        )}

        {/* Exercises List */}
        {exercises.length > 0 && (
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Exercises</h2>
            
            <div className="space-y-6">
              {exercises.map((exercise, exerciseIndex) => (
                <div key={exerciseIndex} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      {editingExercise === exerciseIndex ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editingExerciseName}
                            onChange={(e) => setEditingExerciseName(e.target.value)}
                            className="text-lg font-medium text-gray-900 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                saveExerciseName(exerciseIndex);
                              } else if (e.key === 'Escape') {
                                cancelEditingExercise();
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => saveExerciseName(exerciseIndex)}
                            className="text-green-600 hover:text-green-700"
                            title="Save"
                          >
                            <Save className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditingExercise}
                            className="text-red-600 hover:text-red-700"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-medium text-gray-900 capitalize">
                            {exercise.exercise}
                          </h3>
                          <button
                            type="button"
                            onClick={() => startEditingExercise(exerciseIndex)}
                            className="text-blue-600 hover:text-blue-700"
                            title="Edit exercise name"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                      )}
                      {exercise.sets.length > 1 && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          {exercise.sets.length} sets
                        </span>
                      )}
                    </div>
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
                        
                        <button
                          type="button"
                          onClick={() => editSetWithVoice(exerciseIndex, setIndex)}
                          className="text-blue-600 hover:text-blue-700"
                          title="Edit this set with voice"
                        >
                          <Mic className="h-4 w-4" />
                        </button>
                        
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
                    
                    <div className="flex items-center space-x-3 mt-3">
                      <button
                        type="button"
                        onClick={() => addSet(exerciseIndex)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Add Set</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => addSetWithVoice(exerciseIndex)}
                        className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center space-x-1"
                      >
                        <Mic className="h-4 w-4" />
                        <span>Add Set with Voice</span>
                      </button>
                    </div>
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
            type="button"
            onClick={() => generateSummary('daily')}
            className="btn-secondary flex items-center space-x-2"
          >
            <BarChart3 className="h-5 w-5" />
            <span>Daily Summary</span>
          </button>
          <button
            type="button"
            onClick={() => generateSummary('weekly')}
            className="btn-secondary flex items-center space-x-2"
          >
            <BarChart3 className="h-5 w-5" />
            <span>Weekly Summary</span>
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
      
      {/* Summary Modal */}
      <SummaryModal
        isOpen={summaryModal.isOpen}
        onClose={() => setSummaryModal(prev => ({ ...prev, isOpen: false }))}
        summary={summaryModal.content}
        tableData={summaryModal.tableData}
        stats={summaryModal.stats}
        type={summaryModal.type}
      />
      
      {/* Save or Continue Modal */}
      {saveContinueModal.isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity"
              onClick={() => setSaveContinueModal({ isOpen: false, exerciseName: '' })}
            />
            
            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
              {/* Header */}
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  Exercise Added: {saveContinueModal.exerciseName}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  What would you like to do next?
                </p>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setSaveContinueModal({ isOpen: false, exerciseName: '' });
                      // Continue adding exercises
                    }}
                    className="w-full btn-secondary flex items-center justify-center space-x-2"
                  >
                    <Plus className="h-5 w-5" />
                    <span>Add More Exercises</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setSaveContinueModal({ isOpen: false, exerciseName: '' });
                      // Save the workout
                      handleSubmit(new Event('submit') as any);
                    }}
                    className="w-full btn-primary flex items-center justify-center space-x-2"
                  >
                    <Save className="h-5 w-5" />
                    <span>Save Workout</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddWorkout;
