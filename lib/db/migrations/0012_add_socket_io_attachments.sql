-- Shared Socket.IO PostgreSQL adapter storage.
-- Most events use LISTEN/NOTIFY directly; payloads over PostgreSQL's 8 KB
-- notification limit are stored here temporarily by the official adapter.
CREATE TABLE IF NOT EXISTS socket_io_attachments (
  id BIGSERIAL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload BYTEA
);