import { InsertOp, DeleteOp, DocumentState } from './types.js';
import { apply } from './transform.js';

export class Document {
  private state: DocumentState;
  
  constructor(initialContent: string = '') {
    this.state = {
      content: initialContent,
      version: 0,
      lastModified: Date.now()
    };
  }
  
  getContent(): string {
    return this.state.content;
  }
  
  getVersion(): number {
    return this.state.version;
  }
  
  applyOperation(op: InsertOp | DeleteOp): void {
    this.state.content = apply(this.state.content, op);
    this.state.version++;
    this.state.lastModified = Date.now();
  }
  
  getState(): DocumentState {
    return { ...this.state };
  }
  
  setContent(content: string): void {
    this.state.content = content;
    this.state.version++;
    this.state.lastModified = Date.now();
  }
}