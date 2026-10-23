import { getClient, query } from '../client.js';

export interface StoredDocument {
  content: string;
  language: string;
}

export const documentQueries = {
  async load(roomId: string): Promise<StoredDocument | null> {
    const result = await query(
      `SELECT content, language FROM documents WHERE room_id = $1`,
      [roomId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return { content: row.content ?? '', language: row.language || 'javascript' };
  },

  /** Insert or update a room's document (creates the parent room row if needed). */
  async save(roomId: string, content: string, language: string): Promise<void> {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO rooms (id) VALUES ($1)
         ON CONFLICT (id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP, is_active = true`,
        [roomId]
      );
      await client.query(
        `INSERT INTO documents (room_id, content, language, version, last_modified)
         VALUES ($1, $2, $3, 1, CURRENT_TIMESTAMP)
         ON CONFLICT (room_id) DO UPDATE
           SET content = EXCLUDED.content,
               language = EXCLUDED.language,
               version = documents.version + 1,
               last_modified = CURRENT_TIMESTAMP`,
        [roomId, content, language]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }
};