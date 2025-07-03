-- ================================================================================
-- MIGRATION: Create v2_daily_activities table with improved date handling
-- ================================================================================

-- Drop table if exists (for development/testing)
-- DROP TABLE IF EXISTS v2_daily_activities CASCADE;

CREATE TABLE v2_daily_activities (
    id SERIAL PRIMARY KEY,
    user_fid BIGINT NOT NULL,
    
    -- 📅 SEPARATION OF CONCERNS: Activity vs Processing dates
    activity_date DATE NOT NULL,        -- Real date when the activity occurred (from wearable)
    processing_date DATE NOT NULL,      -- Date when we processed the webhook data
    
    -- 📊 HEALTH METRICS
    steps INTEGER DEFAULT 0,
    calories INTEGER DEFAULT 0,
    sleep_hours DOUBLE PRECISION DEFAULT 0,
    distance_meters INTEGER DEFAULT 0,
    
    -- 🏷️ DATA SOURCE TRACKING
    data_source VARCHAR(50),             -- garmin, fitbit, whoop, etc. (from webhook metadata)
    rook_user_id VARCHAR(255),          -- For audit trail back to Rook
    
    -- 🕐 AUDIT FIELDS
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- 📝 METADATA (for debugging and audit)
    webhook_metadata JSONB,             -- Store original webhook metadata
    
    -- 🔒 CONSTRAINTS
    CONSTRAINT v2_daily_activities_user_activity_date_unique 
        UNIQUE(user_fid, activity_date),
    
    -- Foreign key to users table  
    CONSTRAINT fk_v2_daily_activities_user_fid 
        FOREIGN KEY (user_fid) REFERENCES whitelist_users(user_fid) ON DELETE CASCADE
);

-- ================================================================================
-- INDEXES for Performance
-- ================================================================================

-- Primary lookup index (user + activity date)
CREATE INDEX idx_v2_daily_activities_user_activity_date 
    ON v2_daily_activities(user_fid, activity_date DESC);

-- Activity date range queries (for dashboards)
CREATE INDEX idx_v2_daily_activities_activity_date 
    ON v2_daily_activities(activity_date DESC);

-- Processing date queries (for monitoring webhook delays)
CREATE INDEX idx_v2_daily_activities_processing_date 
    ON v2_daily_activities(processing_date DESC);

-- Data source analytics
CREATE INDEX idx_v2_daily_activities_data_source 
    ON v2_daily_activities(data_source);

-- Rook user ID lookup (for debugging)
CREATE INDEX idx_v2_daily_activities_rook_user_id 
    ON v2_daily_activities(rook_user_id);

-- ================================================================================
-- TRIGGER for auto-updating updated_at
-- ================================================================================

CREATE OR REPLACE FUNCTION update_v2_daily_activities_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_v2_daily_activities_updated_at
    BEFORE UPDATE ON v2_daily_activities
    FOR EACH ROW
    EXECUTE FUNCTION update_v2_daily_activities_updated_at();

-- ================================================================================
-- COMMENT DOCUMENTATION
-- ================================================================================

COMMENT ON TABLE v2_daily_activities IS 'Enhanced daily activities table with proper activity/processing date separation';
COMMENT ON COLUMN v2_daily_activities.activity_date IS 'Real date when the activity occurred (from wearable device)';
COMMENT ON COLUMN v2_daily_activities.processing_date IS 'Date when the webhook data was processed by our system';
COMMENT ON COLUMN v2_daily_activities.data_source IS 'Source device/app (garmin, fitbit, whoop, etc.)';
COMMENT ON COLUMN v2_daily_activities.webhook_metadata IS 'Original webhook metadata for debugging and audit trails'; 