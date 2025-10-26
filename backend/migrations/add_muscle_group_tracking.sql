-- Migration: Add muscle group tracking to photos table
-- This enhances the photos table to support muscle-specific progress tracking

-- Add new columns to photos table
ALTER TABLE photos
ADD COLUMN IF NOT EXISTS muscle_group VARCHAR(50),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS weight_lbs DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS body_fat_percentage DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS measurements JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS comparison_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS progress_score INTEGER DEFAULT 0;

-- Create index for faster muscle group queries
CREATE INDEX IF NOT EXISTS idx_photos_muscle_group ON photos(user_id, muscle_group, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(user_id, created_at DESC);

-- Create muscle_progress_insights table for AI-generated insights
CREATE TABLE IF NOT EXISTS muscle_progress_insights (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    muscle_group VARCHAR(50) NOT NULL,
    insight_type VARCHAR(50) NOT NULL, -- 'growth', 'loss', 'symmetry', 'recommendation'
    insight_text TEXT NOT NULL,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    comparison_period VARCHAR(50), -- 'week', 'month', 'quarter', 'year'
    photo_ids INTEGER[], -- Array of photo IDs used in comparison
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_user_muscle ON muscle_progress_insights(user_id, muscle_group, created_at DESC);

-- Create photo_comparisons table for tracking side-by-side analyses
CREATE TABLE IF NOT EXISTS photo_comparisons (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    muscle_group VARCHAR(50) NOT NULL,
    photo_id_old INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    photo_id_new INTEGER NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    comparison_analysis JSONB NOT NULL,
    growth_percentage DECIMAL(5,2),
    symmetry_score DECIMAL(3,2),
    definition_score DECIMAL(3,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comparisons_user_muscle ON photo_comparisons(user_id, muscle_group, created_at DESC);

-- Update existing photos to have default muscle_group if view exists
UPDATE photos
SET muscle_group = CASE
    WHEN view = 'front' THEN 'chest'
    WHEN view = 'side' THEN 'arms'
    WHEN view = 'back' THEN 'back'
    ELSE 'full_body'
END
WHERE muscle_group IS NULL;

-- Add comment to document muscle groups
COMMENT ON COLUMN photos.muscle_group IS 'Muscle group: chest, arms, shoulders, back, abs, legs, full_body, biceps, triceps, quads, hamstrings, calves, glutes';
COMMENT ON COLUMN photos.measurements IS 'JSON object with measurements like: {"chest_cm": 100, "arm_cm": 40, "waist_cm": 80}';
COMMENT ON COLUMN photos.comparison_data IS 'JSON object with comparison results from previous photos';
COMMENT ON COLUMN photos.progress_score IS 'AI-calculated score (0-100) indicating progress for this muscle group';

