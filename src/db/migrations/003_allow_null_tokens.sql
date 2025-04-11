-- Modificar las columnas para permitir NULL
ALTER TABLE user_connections
ALTER COLUMN google_token DROP NOT NULL,
ALTER COLUMN refresh_token DROP NOT NULL; 