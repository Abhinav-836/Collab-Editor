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

-- Create index for document lookups
CREATE INDEX IF NOT EXISTS idx_documents_room_id ON documents(room_id);
CREATE INDEX IF NOT EXISTS idx_documents_last_modified ON documents(last_modified);

-- Create function to update last_modified
CREATE TRIGGER update_documents_last_modified 
    BEFORE UPDATE ON documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();