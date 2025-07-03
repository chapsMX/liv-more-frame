-- ================================================================================
-- ADD COMPLETION FIELDS to v2_daily_activities
-- ================================================================================

-- Add completion tracking fields
ALTER TABLE v2_daily_activities 
ADD COLUMN steps_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN calories_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN sleep_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN all_completed BOOLEAN DEFAULT FALSE;

-- Add comments for documentation
COMMENT ON COLUMN v2_daily_activities.steps_completed IS 'Whether the user achieved their daily steps goal';
COMMENT ON COLUMN v2_daily_activities.calories_completed IS 'Whether the user achieved their daily calories goal';
COMMENT ON COLUMN v2_daily_activities.sleep_completed IS 'Whether the user achieved their daily sleep goal';
COMMENT ON COLUMN v2_daily_activities.all_completed IS 'Whether the user achieved ALL daily goals (steps, calories, and sleep)';

-- Create index for completion queries (useful for dashboard filtering)
CREATE INDEX idx_v2_daily_activities_completion 
    ON v2_daily_activities(user_fid, all_completed, activity_date DESC);

-- Create index for goal achievement analytics
CREATE INDEX idx_v2_daily_activities_goals_achieved 
    ON v2_daily_activities(activity_date, steps_completed, calories_completed, sleep_completed);

-- ================================================================================
-- TRIGGER FUNCTION to auto-calculate completion status
-- ================================================================================

CREATE OR REPLACE FUNCTION calculate_v2_daily_activities_completion()
RETURNS TRIGGER AS $$
DECLARE
    user_goals RECORD;
BEGIN
    -- Get user's goals
    SELECT steps_goal, calories_goal, sleep_hours_goal 
    INTO user_goals
    FROM user_goals 
    WHERE user_fid = NEW.user_fid;
    
    -- If no goals found, default to false for all completions
    IF user_goals IS NULL THEN
        NEW.steps_completed := FALSE;
        NEW.calories_completed := FALSE;
        NEW.sleep_completed := FALSE;
        NEW.all_completed := FALSE;
        RETURN NEW;
    END IF;
    
    -- Calculate individual completions
    NEW.steps_completed := (NEW.steps >= user_goals.steps_goal);
    NEW.calories_completed := (NEW.calories >= user_goals.calories_goal);
    NEW.sleep_completed := (NEW.sleep_hours >= user_goals.sleep_hours_goal);
    
    -- Calculate all_completed (all three goals must be met)
    NEW.all_completed := (
        NEW.steps_completed AND 
        NEW.calories_completed AND 
        NEW.sleep_completed
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate completion on INSERT and UPDATE
CREATE TRIGGER trigger_v2_daily_activities_completion
    BEFORE INSERT OR UPDATE ON v2_daily_activities
    FOR EACH ROW
    EXECUTE FUNCTION calculate_v2_daily_activities_completion();

-- ================================================================================
-- UPDATE EXISTING RECORDS (if any)
-- ================================================================================

-- Update any existing records to calculate their completion status
UPDATE v2_daily_activities 
SET updated_at = CURRENT_TIMESTAMP
WHERE id > 0;  -- This will trigger the completion calculation for existing records

PRINT 'v2_daily_activities table updated with completion fields and triggers'; 