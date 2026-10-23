import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionManager } from '../websocket/connectionManager.js';
import { WebSocket } from 'ws';

const mockSocket = () =>
  ({ send: vi.fn(), close: vi.fn(), readyState: WebSocket.OPEN }) as unknown as WebSocket & {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
  });

  it('should add connection to room', () => {
    const ws = mockSocket();
    connectionManager.addConnection('room1', 'user1', 'Alice', ws);

    const users = connectionManager.getUsersInRoom('room1');
    expect(users).toHaveLength(1);
    expect(users[0].userName).toBe('Alice');
  });

  it('should remove connection from room', () => {
    const ws = mockSocket();
    connectionManager.addConnection('room1', 'user1', 'Alice', ws);
    connectionManager.removeConnection('room1', 'user1', ws);

    expect(connectionManager.getUsersInRoom('room1')).toHaveLength(0);
  });

  it('should broadcast to room members', () => {
    const ws1 = mockSocket();
    const ws2 = mockSocket();
    connectionManager.addConnection('room1', 'user1', 'Alice', ws1);
    connectionManager.addConnection('room1', 'user2', 'Bob', ws2);
    ws1.send.mockClear();
    ws2.send.mockClear();

    connectionManager.broadcastToRoom('room1', { type: 'test', data: 'hello' });

    expect(ws1.send).toHaveBeenCalledTimes(1);
    expect(ws2.send).toHaveBeenCalledTimes(1);
  });

  it('should exclude sender when broadcasting', () => {
    const ws1 = mockSocket();
    const ws2 = mockSocket();
    connectionManager.addConnection('room1', 'user1', 'Alice', ws1);
    connectionManager.addConnection('room1', 'user2', 'Bob', ws2);
    // join notifications are expected — reset before the real assertion
    ws1.send.mockClear();
    ws2.send.mockClear();

    connectionManager.broadcastToRoom('room1', { type: 'test' }, 'user1');

    expect(ws1.send).not.toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalledTimes(1);
  });

  it('should ignore a stale socket closing after the user reconnected', () => {
    const oldWs = mockSocket();
    const newWs = mockSocket();
    connectionManager.addConnection('room1', 'user1', 'Alice', oldWs);
    connectionManager.addConnection('room1', 'user1', 'Alice', newWs);

    expect(oldWs.close).toHaveBeenCalled();
    // old socket's close event fires afterwards
    expect(connectionManager.removeConnection('room1', 'user1', oldWs)).toBe(false);
    expect(connectionManager.getConnection('room1', 'user1')).toBe(newWs);
    expect(connectionManager.getUsersInRoom('room1')).toHaveLength(1);
  });
});