-- Primero eliminamos las constraints UNIQUE y foreign keys
ALTER TABLE user_goals
DROP CONSTRAINT IF EXISTS user_goals_user_fid_key,
DROP CONSTRAINT IF EXISTS user_goals_user_fid_fkey;

ALTER TABLE user_connections
DROP CONSTRAINT IF EXISTS user_connections_user_fid_key,
DROP CONSTRAINT IF EXISTS user_connections_user_fid_fkey,
DROP CONSTRAINT IF EXISTS unique_user_provider;

-- Eliminamos el índice que no está asociado a una constraint
DROP INDEX IF EXISTS idx_user_connections_token_expiry;

-- Limpiamos los datos de las tablas
TRUNCATE TABLE user_goals;
TRUNCATE TABLE user_connections;

-- Recreamos las foreign keys y constraints UNIQUE
ALTER TABLE user_goals
ADD CONSTRAINT user_goals_user_fid_key UNIQUE (user_fid),
ADD CONSTRAINT user_goals_user_fid_fkey FOREIGN KEY (user_fid) REFERENCES whitelist_users(user_fid);

ALTER TABLE user_connections
ADD CONSTRAINT user_connections_user_fid_key UNIQUE (user_fid),
ADD CONSTRAINT user_connections_user_fid_fkey FOREIGN KEY (user_fid) REFERENCES whitelist_users(user_fid),
ADD CONSTRAINT unique_user_provider UNIQUE (user_fid, provider);

-- Recreamos el índice adicional
CREATE INDEX idx_user_connections_token_expiry ON user_connections(token_expiry); 