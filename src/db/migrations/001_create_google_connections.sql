-- Crear la tabla google_connections
CREATE TABLE IF NOT EXISTS google_connections (
    user_fid BIGINT PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    token_expiry TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Crear un índice en user_fid para búsquedas más rápidas
CREATE INDEX IF NOT EXISTS idx_google_connections_user_fid ON google_connections(user_fid); 