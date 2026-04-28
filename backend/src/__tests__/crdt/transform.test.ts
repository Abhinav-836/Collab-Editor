import { describe, it, expect } from 'vitest';
import { transform, apply } from '../../crdt/transform.js';
import { InsertOp, DeleteOp } from '../../crdt/types.js';

describe('CRDT Transform Functions', () => {
  const clientId = 'test-client';
  
  describe('transform', () => {
    it('should transform concurrent inserts correctly', () => {
      const op1: InsertOp = {
        type: 'insert',
        position: 5,
        chars: 'A',
        clientId,
        timestamp: Date.now(),
        version: 0
      };
      
      const op2: InsertOp = {
        type: 'insert',
        position: 3,
        chars: 'B',
        clientId: 'other',
        timestamp: Date.now(),
        version: 0
      };
      
      const transformed = transform(op1, op2);
      expect(transformed.position).toBe(6); // Should shift right by 1
    });
    
    it('should transform insert after delete correctly', () => {
      const deleteOp: DeleteOp = {
        type: 'delete',
        position: 3,
        length: 2,
        clientId: 'other',
        timestamp: Date.now(),
        version: 0
      };
      
      const insertOp: InsertOp = {
        type: 'insert',
        position: 4,
        chars: 'X',
        clientId,
        timestamp: Date.now(),
        version: 0
      };
      
      const transformed = transform(insertOp, deleteOp);
      expect(transformed.position).toBe(2); // Should shift left due to deletion
    });
    
    it('should handle overlapping deletions', () => {
      const op1: DeleteOp = {
        type: 'delete',
        position: 2,
        length: 3,
        clientId,
        timestamp: Date.now(),
        version: 0
      };
      
      const op2: DeleteOp = {
        type: 'delete',
        position: 3,
        length: 2,
        clientId: 'other',
        timestamp: Date.now(),
        version: 0
      };
      
      const transformed = transform(op1, op2);
      expect(transformed.length).toBeLessThanOrEqual(3);
    });
  });
  
  describe('apply', () => {
    it('should apply insert operation correctly', () => {
      const doc = 'Hello World';
      const op: InsertOp = {
        type: 'insert',
        position: 5,
        chars: ' Beautiful',
        clientId,
        timestamp: Date.now(),
        version: 0
      };
      
      const result = apply(doc, op);
      expect(result).toBe('Hello Beautiful World');
    });
    
    it('should apply delete operation correctly', () => {
      const doc = 'Hello Beautiful World';
      const op: DeleteOp = {
        type: 'delete',
        position: 5,
        length: 10,
        clientId,
        timestamp: Date.now(),
        version: 0
      };
      
      const result = apply(doc, op);
      expect(result).toBe('Hello World');
    });
    
    it('should handle insert at beginning', () => {
      const doc = 'World';
      const op: InsertOp = {
        type: 'insert',
        position: 0,
        chars: 'Hello ',
        clientId,
        timestamp: Date.now(),
        version: 0
      };
      
      const result = apply(doc, op);
      expect(result).toBe('Hello World');
    });
    
    it('should handle insert at end', () => {
      const doc = 'Hello';
      const op: InsertOp = {
        type: 'insert',
        position: 5,
        chars: ' World',
        clientId,
        timestamp: Date.now(),
        version: 0
      };
      
      const result = apply(doc, op);
      expect(result).toBe('Hello World');
    });
  });
});