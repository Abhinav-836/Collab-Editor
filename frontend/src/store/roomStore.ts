import { create } from 'zustand';

interface User {
  userId: string;
  userName: string;
  cursorPosition?: { lineNumber: number; column: number };
  color?: string;
}

interface RoomState {
  roomId: string | null;
  users: User[];
  currentUserId: string | null;
  currentUserName: string;
  isConnected: boolean;
  connectionError: string | null;
  
  // Actions
  setRoomId: (roomId: string) => void;
  setUsers: (users: User[]) => void;
  addUser: (user: User) => void;
  removeUser: (userId: string) => void;
  updateUserCursor: (userId: string, position: { lineNumber: number; column: number }) => void;
  setCurrentUser: (userId: string, userName: string) => void;
  setIsConnected: (isConnected: boolean) => void;
  setConnectionError: (error: string | null) => void;
  clearRoom: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  // Initial state
  roomId: null,
  users: [],
  currentUserId: null,
  currentUserName: '',
  isConnected: false,
  connectionError: null,
  
  // Actions
  setRoomId: (roomId) => set({ roomId }),
  
  setUsers: (users) => set({ users }),
  
  addUser: (user) => set((state) => ({
    users: [...state.users, user]
  })),
  
  removeUser: (userId) => set((state) => ({
    users: state.users.filter(u => u.userId !== userId)
  })),
  
  updateUserCursor: (userId, position) => set((state) => ({
    users: state.users.map(u => 
      u.userId === userId ? { ...u, cursorPosition: position } : u
    )
  })),
  
  setCurrentUser: (userId, userName) => set({ 
    currentUserId: userId, 
    currentUserName: userName 
  }),
  
  setIsConnected: (isConnected) => set({ isConnected }),
  
  setConnectionError: (connectionError) => set({ connectionError }),
  
  clearRoom: () => set({
    roomId: null,
    users: [],
    currentUserId: null,
    currentUserName: '',
    isConnected: false,
    connectionError: null
  })
}));