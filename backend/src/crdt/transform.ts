import { Operation, InsertOp, DeleteOp } from './types.js';

export function transform(op1: Operation, op2: Operation): Operation {
  // Insert vs Insert
  if (op1.type === 'insert' && op2.type === 'insert') {
    if (op1.position <= op2.position) {
      return { ...op1, position: op1.position };
    } else {
      return { ...op1, position: op1.position + op2.chars.length };
    }
  }
  
  // Insert vs Delete
  if (op1.type === 'insert' && op2.type === 'delete') {
    if (op1.position <= op2.position) {
      return { ...op1, position: op1.position };
    } else if (op1.position > op2.position + op2.length) {
      return { ...op1, position: op1.position - op2.length };
    } else {
      return { ...op1, position: op2.position };
    }
  }
  
  // Delete vs Insert
  if (op1.type === 'delete' && op2.type === 'insert') {
    if (op1.position <= op2.position) {
      return { ...op1, position: op1.position };
    } else {
      return { ...op1, position: op1.position + op2.chars.length };
    }
  }
  
  // Delete vs Delete
  if (op1.type === 'delete' && op2.type === 'delete') {
    if (op1.position >= op2.position + op2.length) {
      return { ...op1, position: op1.position - op2.length };
    } else if (op1.position + op1.length <= op2.position) {
      return { ...op1 };
    } else {
      const overlapStart = Math.max(op1.position, op2.position);
      const overlapEnd = Math.min(op1.position + op1.length, op2.position + op2.length);
      const newLength = op1.length - (overlapEnd - overlapStart);
      const newPosition = Math.min(op1.position, op2.position);
      return { ...op1, position: newPosition, length: Math.max(0, newLength) };
    }
  }
  
  return op1;
}

export function apply(document: string, op: InsertOp | DeleteOp): string {
  if (op.type === 'insert') {
    return document.slice(0, op.position) + op.chars + document.slice(op.position);
  } else {
    return document.slice(0, op.position) + document.slice(op.position + op.length);
  }
}