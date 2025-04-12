-- Create tables
CREATE TABLE whitelist_users (
    id SERIAL PRIMARY KEY,
    user_fid BIGINT NOT NULL UNIQUE,
    username VARCHAR NOT NULL,
    display_name VARCHAR,
    eth_address VARCHAR NOT NULL,
    is_whitelisted BOOLEAN DEFAULT true,
    can_use BOOLEAN NOT NULL DEFAULT false,
    can_create BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE badges (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    badge_type VARCHAR NOT NULL,
    category VARCHAR,
    description TEXT,
    image_url TEXT,
    total_supply INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_goals (
    id SERIAL PRIMARY KEY,
    user_fid BIGINT NOT NULL UNIQUE,
    steps_goal INTEGER NOT NULL DEFAULT 7500,
    calories_goal INTEGER NOT NULL DEFAULT 350,
    sleep_hours_goal DOUBLE PRECISION NOT NULL DEFAULT 7.0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_fid) REFERENCES whitelist_users(user_fid)
);

CREATE TABLE user_connections (
    id SERIAL PRIMARY KEY,
    user_fid BIGINT NOT NULL UNIQUE,
    provider VARCHAR NOT NULL DEFAULT 'google',
    google_token TEXT,
    refresh_token TEXT,
    token_expiry TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_fid) REFERENCES whitelist_users(user_fid)
);

CREATE TABLE daily_activities (
    id SERIAL PRIMARY KEY,
    user_fid BIGINT NOT NULL,
    date DATE NOT NULL,
    steps INTEGER DEFAULT 0,
    calories INTEGER DEFAULT 0,
    sleep_hours DOUBLE PRECISION DEFAULT 0,
    steps_completed BOOLEAN DEFAULT false,
    calories_completed BOOLEAN DEFAULT false,
    sleep_completed BOOLEAN DEFAULT false,
    all_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_fid) REFERENCES whitelist_users(user_fid),
    UNIQUE(user_fid, date)
);

CREATE TABLE user_streaks (
    id SERIAL PRIMARY KEY,
    user_fid BIGINT NOT NULL,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_streak_date DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_fid) REFERENCES whitelist_users(user_fid)
);

CREATE TABLE user_attestations (
    id SERIAL PRIMARY KEY,
    user_fid BIGINT NOT NULL,
    type VARCHAR NOT NULL,
    value INTEGER,
    date DATE NOT NULL,
    attestation_uid TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_fid) REFERENCES whitelist_users(user_fid)
);

CREATE TABLE user_badges (
    id SERIAL PRIMARY KEY,
    user_fid BIGINT NOT NULL,
    badge_id INTEGER NOT NULL,
    attestation_uid TEXT,
    earned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_fid) REFERENCES whitelist_users(user_fid),
    FOREIGN KEY (badge_id) REFERENCES badges(id)
);

CREATE TABLE challenges (
    id SERIAL PRIMARY KEY,
    creator_fid BIGINT NOT NULL,
    challenge_type VARCHAR NOT NULL DEFAULT 'public',
    activity_type VARCHAR NOT NULL,
    goal_amount INTEGER NOT NULL,
    entry_cost NUMERIC NOT NULL,
    prize_pool NUMERIC NOT NULL DEFAULT 0,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    completion_deadline TIMESTAMPTZ NOT NULL,
    duration_days INTEGER NOT NULL,
    status VARCHAR DEFAULT 'pending',
    smart_contract_address VARCHAR,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_fid) REFERENCES whitelist_users(user_fid)
);

CREATE TABLE challenge_participants (
    id SERIAL PRIMARY KEY,
    challenge_id INTEGER NOT NULL,
    user_fid BIGINT NOT NULL,
    current_progress INTEGER DEFAULT 0,
    has_completed BOOLEAN DEFAULT false,
    transaction_hash VARCHAR,
    joined_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    FOREIGN KEY (challenge_id) REFERENCES challenges(id),
    FOREIGN KEY (user_fid) REFERENCES whitelist_users(user_fid),
    UNIQUE(challenge_id, user_fid)
);

CREATE TABLE challenge_invitations (
    id SERIAL PRIMARY KEY,
    challenge_id INTEGER NOT NULL,
    inviter_fid BIGINT NOT NULL,
    invitee_fid BIGINT NOT NULL,
    status VARCHAR DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (challenge_id) REFERENCES challenges(id),
    FOREIGN KEY (inviter_fid) REFERENCES whitelist_users(user_fid),
    UNIQUE(challenge_id, invitee_fid)
);

-- Create indices
CREATE INDEX idx_whitelist_users_can_use ON whitelist_users(can_use);
CREATE INDEX idx_daily_activities_user_date ON daily_activities(user_fid, date);
CREATE INDEX idx_daily_activities_date ON daily_activities(date DESC);
CREATE INDEX idx_user_attestations_user ON user_attestations(user_fid);
CREATE INDEX idx_user_badges_user ON user_badges(user_fid);
CREATE INDEX idx_user_connections_token_expiry ON user_connections(token_expiry);
CREATE INDEX idx_challenges_status ON challenges(status);
CREATE INDEX idx_challenges_dates ON challenges(start_date, end_date);
CREATE INDEX idx_challenges_type ON challenges(challenge_type);
CREATE INDEX idx_challenge_participants_progress ON challenge_participants(challenge_id, current_progress);
CREATE INDEX idx_challenge_invitations_status ON challenge_invitations(invitee_fid, status);
CREATE UNIQUE INDEX unique_user_provider ON user_connections(user_fid, provider); 