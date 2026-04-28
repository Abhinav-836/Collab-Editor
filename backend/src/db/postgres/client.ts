import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/collab',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('✅ PostgreSQL connected successfully');
});

pool.on('error', (err) => {
  console.error('Unexpected error on PostgreSQL client:', err);
  process.exit(-1);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text, duration, rows: res.rowCount });
  return res;
};

export const getClient = async () => {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;
  
  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
    console.error(`Last query executed by this client: ${(client as any).lastQuery}`);
  }, 5000);
  
  // Monkey patch the query method to keep track of the last query executed
  (client as any).query = (...args: any[]) => {
    (client as any).lastQuery = args;
    return query.apply(client, args as any);
  };
  
  client.release = () => {
    clearTimeout(timeout);
    client.release = release;
    return release.apply(client);
  };
  
  return client;
};

export const initDatabase = async () => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(50) PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        settings JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true
      );
      
      CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(50) REFERENCES rooms(id) ON DELETE CASCADE,
        content TEXT,
        version INTEGER DEFAULT 0,
        language VARCHAR(20) DEFAULT 'javascript',
        last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(room_id)
      );
      
      CREATE TABLE IF NOT EXISTS operations (
        id SERIAL PRIMARY KEY,
        room_id VARCHAR(50) REFERENCES rooms(id) ON DELETE CASCADE,
        operation_type VARCHAR(10),
        operation_data JSONB,
        user_id VARCHAR(50),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        version INTEGER
      );
      
      CREATE INDEX idx_operations_room ON operations(room_id);
      CREATE INDEX idx_operations_timestamp ON operations(timestamp);
    `);
    console.log('✅ Database tables initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};

export default pool;