CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  admin_path TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  session_secret TEXT NOT NULL
);
