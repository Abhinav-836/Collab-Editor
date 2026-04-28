import { describe, it, expect, beforeEach } from 'vitest';
import { Document } from '../../crdt/document.js';
import { InsertOp, DeleteOp } from '../../crdt/types.js';

describe('Collaboration Integration', () => {
  let document: Document;
  
  beforeEach(() => {
    document = new Document('Initial content');
  });
  
  it('should handle multiple users editing simultaneously', () => {
    const userAOp: InsertOp = {
      type: 'insert',
      position: 7,
      chars: ' from User A',
      clientId: 'userA',
      timestamp: Date.now(),
      version: 0
    };
    
    const userBOp: InsertOp = {
      type: 'insert',
      position: 0,
      chars: 'User B says: ',
      clientId: 'userB',
      timestamp: Date.now(),
      version: 0
    };
    
    document.applyOperation(userAOp);
    document.applyOperation(userBOp);
    
    const content = document.getContent();
    expect(content).toContain('User B says:');
    expect(content).toContain('from User A');
  });
  
  it('should preserve document version ordering', () => {
    const op1: InsertOp = {
      type: 'insert',
      position: 0,
      chars: 'A',
      clientId: 'user1',
      timestamp: Date.now(),
      version: 0
    };
    
    const op2: InsertOp = {
      type: 'insert',
      position: 1,
      chars: 'B',
      clientId: 'user2',
      timestamp: Date.now(),
      version: 0
    };
    
    document.applyOperation(op1);
    document.applyOperation(op2);
    
    expect(document.getVersion()).toBe(2);
    expect(document.getContent()).toBe('AB');
  });
  
  it('should handle delete after concurrent inserts', () => {
    const insertOp: InsertOp = {
      type: 'insert',
      position: 7,
      chars: ' Inserted',
      clientId: 'user1',
      timestamp: Date.now(),
      version: 0
    };
    
    const deleteOp: DeleteOp = {
      type: 'delete',
      position: 0,
      length: 7,
      clientId: 'user2',
      timestamp: Date.now(),
      version: 0
    };
    
    document.applyOperation(insertOp);
    document.applyOperation(deleteOp);
    
    const content = document.getContent();
    expect(content).toBe('Inserted');
  });
});