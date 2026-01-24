
-- Tabel Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, -- UUID
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Akan disimpan dalam bentuk Hash (Bcrypt)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabel Video Tasks (Hasil Generate)
CREATE TABLE IF NOT EXISTS video_tasks (
    id TEXT PRIMARY KEY, -- UUID
    user_id TEXT NOT NULL,
    type TEXT NOT NULL, -- 'text-to-video' atau 'image-to-video'
    prompt TEXT,
    model TEXT,
    ratio TEXT,
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
    result_url TEXT,
    thumbnail_url TEXT,
    created_at INTEGER, -- Timestamp epoch
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabel Projects (Scene Builder Projects)
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY, -- UUID
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    clips_json TEXT, -- JSON array of task IDs yang di-include dalam project
    created_at INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
