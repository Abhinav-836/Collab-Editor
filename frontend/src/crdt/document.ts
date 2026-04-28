import { InsertOp, DeleteOp, DocumentState, Operation } from './types.js';
import { apply, transform } from './transform.js';

export class Document {
  private state: DocumentState;
  private pendingOperations: Operation[] = [];
  
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
  
  // Transform a remote operation against local pending operations
  transformRemoteOperation(op: Operation, localOps: Operation[]): Operation {
    let transformedOp = { ...op };
    for (const localOp of localOps) {
      transformedOp = transform(transformedOp, localOp);
    }
    return transformedOp;
  }
  
  // Queue a pending operation
  queueOperation(op: Operation): void {
    this.pendingOperations.push(op);
  }
  
  // Clear pending operations
  clearPendingOperations(): void {
    this.pendingOperations = [];
  }
  
  // Get pending operations
  getPendingOperations(): Operation[] {
    return [...this.pendingOperations];
  }
}

// Helper function to create an insert operation
export function createInsertOp(
  position: number,
  chars: string,
  clientId: string,
  version: number = 0
): InsertOp {
  return {
    type: 'insert',
    position,
    chars,
    clientId,
    timestamp: Date.now(),
    version
  };
}

// Helper function to create a delete operation
export function createDeleteOp(
  position: number,
  length: number,
  clientId: string,
  version: number = 0
): DeleteOp {
  return {
    type: 'delete',
    position,
    length,
    clientId,
    timestamp: Date.now(),
    version
  };
}