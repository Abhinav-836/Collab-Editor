import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionManager } from '../websocket/connectionManager.js';
import { WebSocket } from 'ws';

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  
  beforeEach(() => {
    connectionManager = new ConnectionManager();
  });
  
  it('should add connection to room', () => {
    const mockWs = { send: vi.fn(), readyState: 1 } as unknown as WebSocket;
    connectionManager.addConnection('room1', 'user1', 'Alice', mockWs);
    
    const users = connectionManager.getUsersInRoom('room1');
    expect(users).toHaveLength(1);
    expect(users[0].userName).toBe('Alice');
  });
  
  it('should remove connection from room', () => {
    const mockWs = { send: vi.fn(), readyState: 1 } as unknown as WebSocket;
    connectionManager.addConnection('room1', 'user1', 'Alice', mockWs);
    connectionManager.removeConnection('room1', 'user1');
    
    const users = connectionManager.getUsersInRoom('room1');
    expect(users).toHaveLength(0);
  });
  
  it('should broadcast to room members', () => {
    const mockWs1 = { send: vi.fn(), readyState: 1 } as unknown as WebSocket;
    const mockWs2 = { send: vi.fn(), readyState: 1 } as unknown as WebSocket;
    
    connectionManager.addConnection('room1', 'user1', 'Alice', mockWs1);
    connectionManager.addConnection('room1', 'user2', 'Bob', mockWs2);
    
    connectionManager.broadcastToRoom('room1', { type: 'test', data: 'hello' });
    
    expect(mockWs1.send).toHaveBeenCalled();
    expect(mockWs2.send).toHaveBeenCalled();
  });
  
  it('should exclude sender when broadcasting', () => {
    const mockWs1 = { send: vi.fn(), readyState: 1 } as unknown as WebSocket;
    const mockWs2 = { send: vi.fn(), readyState: 1 } as unknown as WebSocket;
    
    connectionManager.addConnection('room1', 'user1', 'Alice', mockWs1);
    connectionManager.addConnection('room1', 'user2', 'Bob', mockWs2);
    
    connectionManager.broadcastToRoom('room1', { type: 'test' }, 'user1');
    
    expect(mockWs1.send).not.toHaveBeenCalled();
    expect(mockWs2.send).toHaveBeenCalled();
  });
});