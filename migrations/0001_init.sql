CREATE TABLE questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  body TEXT NOT NULL,
  asker_name TEXT,
  asker_email TEXT,
  is_anonymous INTEGER NOT NULL DEFAULT 1,
  answer TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  answered_at INTEGER,
  country TEXT
);

CREATE INDEX idx_wall ON questions (answered_at DESC)
  WHERE is_public = 1 AND answer IS NOT NULL;

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
