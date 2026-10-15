-- Ensure the function exists (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create documents table
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    room_id VARCHAR(50) REFERENCES rooms(id) ON DELETE CASCADE,
    content TEXT,
    version INTEGER DEFAULT 0,
    language VARCHAR(20) DEFAULT 'javascript',
    last_modified TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_id)
);

CREATE INDEX IF NOT EXISTS idx_documents_room_id ON documents(room_id);
CREATE INDEX IF NOT EXISTS idx_documents_last_modified ON documents(last_modified);

-- ✅ Drop first so re-running is safe
DROP TRIGGER IF EXISTS update_documents_last_modified ON documents;
CREATE TRIGGER update_documents_last_modified
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();