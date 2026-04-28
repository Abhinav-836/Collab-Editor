export interface InsertOp {
    type: 'insert';
    position: number;
    chars: string;
    clientId: string;
    timestamp: number;
    version: number;
  }
  
  export interface DeleteOp {
    type: 'delete';
    position: number;
    length: number;
    clientId: string;
    timestamp: number;
    version: number;
  }
  
  export interface CursorOp {
    type: 'cursor';
    position: number;
    clientId: string;
    userId: string;
    userName: string;
  }
  
  export type Operation = InsertOp | DeleteOp | CursorOp;
  
  export interface User {
    id: string;
    name: string;
    color: string;
  }
  
  export interface DocumentState {
    content: string;
    version: number;
    lastModified: number;
  }