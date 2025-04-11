-- 1. Tabla de usuarios existente
CREATE TABLE whitelist_users (
  id SERIAL PRIMARY KEY,
    user_fid BIGINT NOT NULL,
  username VARCHAR(255) NOT NULL,
    eth_address VARCHAR(42) NOT NULL,
    display_name VARCHAR(255),
    is_whitelisted BOOLEAN DEFAULT true,
    can_use boolean NOT NULL DEFAULT false;
    can_create BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_fid)
);

-- 2. Tabla de objetivos del usuario
CREATE TABLE user_goals (
    id SERIAL PRIMARY KEY,
    user_fid BIGINT NOT NULL,
    steps_goal INTEGER NOT NULL DEFAULT 7500,
    calories_goal INTEGER NOT NULL DEFAULT 350,
    sleep_hours_goal FLOAT NOT NULL DEFAULT 7.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_fid) REFERENCES whitelist_users(user_fid)
);

-- 3. Tabla para tokens de Google
CREATE TABLE user_connections (
    id SERIAL PRIMARY KEY,
    user_fid BIGINT NOT NULL,
    google_token TEXT NOT NULL,
    token_expiry TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_fid) REFERENCES whitelist_users(user_fid)
);

-- 4. Tabla para registro diario de actividades
CREATE TABLE daily_activities (
    id SERIAL PRIMARY KEY,
    user_fid BIGINT NOT NULL,
    date DATE NOT NULL,
    steps INTEGER DEFAULT 0,
    calories INTEGER DEFAULT 0,
    sleep_hours FLOAT DEFAULT 0,
    steps_completed BOOLEAN DEFAULT FALSE,
    calories_completed BOOLEAN DEFAULT FALSE,
    sleep_completed BOOLEAN DEFAULT FALSE,
    all_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_fid) REFERENCES whitelist_users(user_fid),
    UNIQUE(user_fid, date)
);

-- 5. Tabla para atestaciones
CREATE TABLE user_attestations (
    id SERIAL PRIMARY KEY,
    user_fid BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'steps', 'calories', 'sleep', 'super_streak'
    date DATE NOT NULL,
    attestation_uid TEXT NOT NULL, -- EAS attestation UID
    value INTEGER, -- el valor logrado
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_fid) REFERENCES whitelist_users(user_fid)
);

-- 6. Tabla para rachas
CREATE TABLE user_streaks (
    id SERIAL PRIMARY KEY,
    user_fid BIGINT NOT NULL,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_streak_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_fid) REFERENCES whitelist_users(user_fid)
);

-- 7. Tabla de badges
CREATE TABLE badges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image_url TEXT,
    badge_type VARCHAR(50) NOT NULL, -- limited, premium, challenge, platinum, sponsored
    category VARCHAR(50),
    metadata JSONB,
    total_supply INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Tabla de badges de usuarios
CREATE TABLE user_badges (
    id SERIAL PRIMARY KEY,
    user_fid BIGINT NOT NULL,
    badge_id INTEGER NOT NULL,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    attestation_uid TEXT,
    FOREIGN KEY (user_fid) REFERENCES whitelist_users(user_fid),
    FOREIGN KEY (badge_id) REFERENCES badges(id)
);

-- 9. Tabla de retos
CREATE TABLE challenges (
    id SERIAL PRIMARY KEY,
    creator_fid BIGINT NOT NULL,
    activity_type VARCHAR(50) NOT NULL, -- 'steps', 'calories', 'sleep'
    goal_amount INTEGER NOT NULL,
    entry_cost NUMERIC(20,8) NOT NULL, -- En ETH
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_days INTEGER NOT NULL,
    completion_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    challenge_type VARCHAR(20) NOT NULL DEFAULT 'public', -- public, private, sponsored
    smart_contract_address VARCHAR(42),
    prize_pool NUMERIC(20,8) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending', -- pending, active, completed, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_fid) REFERENCES whitelist_users(user_fid),
    CONSTRAINT challenge_type_check CHECK (challenge_type IN ('public', 'private', 'sponsored'))
);

-- 10. Tabla de participantes en retos
CREATE TABLE challenge_participants (
    id SERIAL PRIMARY KEY,
    challenge_id INTEGER NOT NULL,
    user_fid BIGINT NOT NULL,
    current_progress INTEGER DEFAULT 0,
    has_completed BOOLEAN DEFAULT false,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    transaction_hash VARCHAR(66),
    FOREIGN KEY (challenge_id) REFERENCES challenges(id),
    FOREIGN KEY (user_fid) REFERENCES whitelist_users(user_fid),
    UNIQUE(challenge_id, user_fid)
);

-- 11. Tabla para invitaciones a retos
CREATE TABLE challenge_invitations (
    id SERIAL PRIMARY KEY,
    challenge_id INTEGER NOT NULL,
    inviter_fid BIGINT NOT NULL,
    invitee_fid BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (challenge_id) REFERENCES challenges(id),
    FOREIGN KEY (inviter_fid) REFERENCES whitelist_users(user_fid),
    UNIQUE(challenge_id, invitee_fid)
);

-- Índices importantes
CREATE INDEX idx_daily_activities_user_date ON daily_activities(user_fid, date);
CREATE INDEX idx_user_attestations_user ON user_attestations(user_fid);
CREATE INDEX idx_challenges_status ON challenges(status);
CREATE INDEX idx_challenges_dates ON challenges(start_date, end_date);
CREATE INDEX idx_challenges_type ON challenges(challenge_type);
CREATE INDEX idx_challenge_participants_progress ON challenge_participants(challenge_id, current_progress);
CREATE INDEX idx_user_badges_user ON user_badges(user_fid);
CREATE INDEX idx_challenge_invitations_status ON challenge_invitations(invitee_fid, status);