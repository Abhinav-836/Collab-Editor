import { create } from 'zustand';

interface Cursor {
  userId: string;
  userName: string;
  position: { lineNumber: number; column: number };
  color: string;
}

interface CursorState {
  cursors: Map<string, Cursor>;
  
  // Actions
  updateCursor: (userId: string, userName: string, position: { lineNumber: number; column: number }) => void;
  removeCursor: (userId: string) => void;
  clearCursors: () => void;
}

// Helper function to generate consistent colors from userId
function getColorFromUserId(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 60%)`;
}

export const useCursorStore = create<CursorState>((set, get) => ({
  cursors: new Map(),
  
  updateCursor: (userId, userName, position) => {
    const cursors = new Map(get().cursors);
    cursors.set(userId, {
      userId,
      userName,
      position,
      color: getColorFromUserId(userId)
    });
    set({ cursors });
  },
  
  removeCursor: (userId) => {
    const cursors = new Map(get().cursors);
    cursors.delete(userId);
    set({ cursors });
  },
  
  clearCursors: () => {
    set({ cursors: new Map() });
  }
}));