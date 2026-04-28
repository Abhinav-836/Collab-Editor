import { useState, useEffect, useCallback } from 'react';

interface User {
  userId: string;
  userName: string;
  cursorPosition?: { lineNumber: number; column: number };
  color?: string;
}

export function usePresence(ws: WebSocket | null, currentUserId: string) {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'user_joined') {
        setUsers(prev => [...prev, { userId: data.userId, userName: data.userName }]);
      } else if (data.type === 'user_left') {
        setUsers(prev => prev.filter(u => u.userId !== data.userId));
      } else if (data.type === 'users_list') {
        setUsers(data.users);
      } else if (data.type === 'cursor_update') {
        setUsers(prev => prev.map(u => 
          u.userId === data.userId 
            ? { ...u, cursorPosition: data.position }
            : u
        ));
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws]);

  const updateCursor = useCallback((position: { lineNumber: number; column: number }) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'cursor',
        userId: currentUserId,
        position
      }));
    }
  }, [ws, currentUserId]);

  return { users, updateCursor };
}