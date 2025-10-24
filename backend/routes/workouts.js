const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const supabase = require('../config/supabase');

const router = express.Router();

/**
 * Get all workouts for authenticated user
 * GET /api/workouts
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data: workouts, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('user_id', req.user.id)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching workouts:', error);
      return res.status(500).json({ error: 'Failed to fetch workouts' });
    }

    res.json({ workouts });
  } catch (error) {
    console.error('Workouts fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get a specific workout by ID
 * GET /api/workouts/:id
 */
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: workout, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error) {
      console.error('Error fetching workout:', error);
      return res.status(404).json({ error: 'Workout not found' });
    }

    res.json({ workout });
  } catch (error) {
    console.error('Workout fetch error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create a new workout
 * POST /api/workouts
 */
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { date, exercises, notes } = req.body;

    // Validate input
    if (!date || !exercises || !Array.isArray(exercises)) {
      return res.status(400).json({ error: 'Date and exercises are required' });
    }

    const { data: workout, error } = await supabase
      .from('workouts')
      .insert([
        {
          user_id: req.user.id,
          date,
          exercises,
          notes: notes || '',
          created_at: new Date().toISOString()
        }
      ])
      .select('*')
      .single();

    if (error) {
      console.error('Error creating workout:', error);
      return res.status(500).json({ error: 'Failed to create workout' });
    }

    res.status(201).json({ workout });
  } catch (error) {
    console.error('Workout creation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update an existing workout
 * PUT /api/workouts/:id
 */
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, exercises, notes } = req.body;

    // Validate input
    if (!date || !exercises || !Array.isArray(exercises)) {
      return res.status(400).json({ error: 'Date and exercises are required' });
    }

    const { data: workout, error } = await supabase
      .from('workouts')
      .update({
        date,
        exercises,
        notes: notes || '',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating workout:', error);
      return res.status(500).json({ error: 'Failed to update workout' });
    }

    res.json({ workout });
  } catch (error) {
    console.error('Workout update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete a workout
 * DELETE /api/workouts/:id
 */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('workouts')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (error) {
      console.error('Error deleting workout:', error);
      return res.status(500).json({ error: 'Failed to delete workout' });
    }

    res.json({ message: 'Workout deleted successfully' });
  } catch (error) {
    console.error('Workout deletion error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get workout statistics for charts
 * GET /api/workouts/stats/:exercise
 */
router.get('/stats/:exercise', authenticateToken, async (req, res) => {
  try {
    const { exercise } = req.params;

    const { data: workouts, error } = await supabase
      .from('workouts')
      .select('date, exercises')
      .eq('user_id', req.user.id)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching workout stats:', error);
      return res.status(500).json({ error: 'Failed to fetch workout statistics' });
    }

    // Filter and process data for the specific exercise
    const exerciseData = [];
    
    workouts.forEach(workout => {
      const exerciseSets = workout.exercises.find(ex => 
        ex.exercise.toLowerCase() === exercise.toLowerCase()
      );
      
      if (exerciseSets) {
        const totalVolume = exerciseSets.sets.reduce((sum, set) => 
          sum + (set.reps * set.weight_kg), 0
        );
        const maxWeight = Math.max(...exerciseSets.sets.map(set => set.weight_kg));
        
        exerciseData.push({
          date: workout.date,
          totalVolume,
          maxWeight,
          sets: exerciseSets.sets.length
        });
      }
    });

    res.json({ exerciseData });
  } catch (error) {
    console.error('Workout stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
