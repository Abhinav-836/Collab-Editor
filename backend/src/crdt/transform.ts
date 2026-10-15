import { Operation, InsertOp, DeleteOp } from './types.js';

export function transform(op1: Operation, op2: Operation): Operation {
  if (op1.type === 'cursor') return op1;

  if (op1.type === 'insert' && op2.type === 'insert') {
    return op1.position <= op2.position ? { ...op1 } : { ...op1, position: op1.position + op2.chars.length };
  }

  if (op1.type === 'insert' && op2.type === 'delete') {
    if (op1.position <= op2.position) return { ...op1 };
    if (op1.position > op2.position + op2.length) return { ...op1, position: op1.position - op2.length };
    return { ...op1, position: op2.position };
  }

  if (op1.type === 'delete' && op2.type === 'insert') {
    if (op1.position < op2.position) return { ...op1 };
    return { ...op1, position: op1.position + op2.chars.length };
  }

  if (op1.type === 'delete' && op2.type === 'delete') {
    if (op1.position >= op2.position + op2.length) return { ...op1, position: op1.position - op2.length };
    if (op1.position + op1.length <= op2.position) return { ...op1 };
    const overlapStart = Math.max(op1.position, op2.position);
    const overlapEnd = Math.min(op1.position + op1.length, op2.position + op2.length);
    const newLength = op1.length - (overlapEnd - overlapStart);
    const newPosition = Math.min(op1.position, op2.position);
    return { ...op1, position: newPosition, length: Math.max(0, newLength) };
  }

  return op1;
}

export function apply(document: string, op: InsertOp | DeleteOp): string {
  if (op.position < 0 || op.position > document.length) {
    console.warn(`⚠️ Invalid op position ${op.position} for doc len ${document.length}`);
    return document;
  }
  if (op.type === 'insert') {
    return document.slice(0, op.position) + op.chars + document.slice(op.position);
  }
  const end = Math.min(op.position + op.length, document.length);
  return document.slice(0, op.position) + document.slice(end);
}