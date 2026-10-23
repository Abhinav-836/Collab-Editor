import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tests must never touch the real database from .env.
    // (dotenv does not override variables that are already set, even to '')
    env: {
      DATABASE_URL: '',
      REDIS_URL: 'redis://127.0.0.1:1',
      ROOM_TOKEN_SECRET: 'test-secret'
    }
  }
});