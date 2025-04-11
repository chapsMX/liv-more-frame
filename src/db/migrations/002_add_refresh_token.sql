-- Agregar columna refresh_token a user_connections
ALTER TABLE user_connections
ADD COLUMN refresh_token TEXT;

-- Actualizar los registros existentes para que refresh_token sea igual a google_token
UPDATE user_connections
SET refresh_token = google_token
WHERE refresh_token IS NULL; 