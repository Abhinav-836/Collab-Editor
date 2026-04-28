import { redisClient } from './client.js';

const DOCUMENT_PREFIX = 'doc:';
const TTL_SECONDS = 86400; // 24 hours

export interface StoredDocument {
  content: string;
  version: number;
  lastModified: number;
  language: string;
}

export const documentStore = {
  async saveDocument(roomId: string, document: StoredDocument): Promise<void> {
    const key = `${DOCUMENT_PREFIX}${roomId}`;
    const data = JSON.stringify(document);
    await redisClient.setEx(key, TTL_SECONDS, data);
    console.log(`📄 Document saved for room ${roomId}`);
  },
  
  async getDocument(roomId: string): Promise<StoredDocument | null> {
    const key = `${DOCUMENT_PREFIX}${roomId}`;
    const data = await redisClient.get(key);
    if (data) {
      return JSON.parse(data);
    }
    return null;
  },
  
  async deleteDocument(roomId: string): Promise<void> {
    const key = `${DOCUMENT_PREFIX}${roomId}`;
    await redisClient.del(key);
    console.log(`🗑️ Document deleted for room ${roomId}`);
  },
  
  async updateDocumentContent(roomId: string, content: string, version: number): Promise<void> {
    const doc = await this.getDocument(roomId);
    if (doc) {
      doc.content = content;
      doc.version = version;
      doc.lastModified = Date.now();
      await this.saveDocument(roomId, doc);
    }
  },
  
  async incrementVersion(roomId: string): Promise<number> {
    const key = `${DOCUMENT_PREFIX}${roomId}`;
    const doc = await this.getDocument(roomId);
    if (doc) {
      doc.version++;
      await this.saveDocument(roomId, doc);
      return doc.version;
    }
    return 0;
  }
};