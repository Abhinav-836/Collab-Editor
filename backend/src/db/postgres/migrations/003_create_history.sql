CREATE TABLE IF NOT EXISTS operations_history (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(50) REFERENCES rooms(id) ON DELETE CASCADE,
    operation_type VARCHAR(20) NOT NULL,
    operation_data JSONB,
    user_id VARCHAR(50),
    user_name VARCHAR(100),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    version_before INTEGER,
    version_after INTEGER
);

CREATE INDEX IF NOT EXISTS idx_operations_room_id ON operations_history(room_id);
CREATE INDEX IF NOT EXISTS idx_operations_timestamp ON operations_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_operations_user_id ON operations_history(user_id);

CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    user_name VARCHAR(100),
    room_id VARCHAR(50) REFERENCES rooms(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_room_id ON user_sessions(room_id);