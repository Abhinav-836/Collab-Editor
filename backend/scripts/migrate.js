import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env is one level up (in backend/ root)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in .env');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runMigrations() {
  const client = await pool.connect();
  try {
    console.log('🚀 Running migrations...');

    // Migrations live at backend/src/db/postgres/migrations
    const migrationsDir = path.join(__dirname, '..', 'src', 'db', 'postgres', 'migrations');

    if (!fs.existsSync(migrationsDir)) {
      console.log('⚠️ No migrations dir found. Aborting.');
      process.exitCode = 1;
      return;
    }

    const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
    console.log(`📂 Found ${files.length} migration files`);

    for (const file of files) {
      console.log(`📝 Running: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      console.log(`✅ Completed: ${file}`);
    }

    console.log('🎉 All migrations completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();