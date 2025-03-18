CREATE TABLE whitelist_users (
    id SERIAL PRIMARY KEY,
    user_fid BIGINT NOT NULL,
    username VARCHAR(255) NOT NULL,
    eth_address VARCHAR(42) NOT NULL,
    display_name VARCHAR(255),
    is_whitelisted BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_fid)
);