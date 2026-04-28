import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Running migrations...');
    
    const migrationsDir = path.join(__dirname, '../src/db/postgres/migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️ No migrations directory found, creating tables directly...');
      await client.query(`
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
      `);
      console.log('✅ Tables created successfully');
      return;
    }
    
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    
    for (const file of files) {
      console.log(`📝 Running: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      console.log(`✅ Completed: ${file}`);
    }
    
    console.log('🎉 All migrations completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();