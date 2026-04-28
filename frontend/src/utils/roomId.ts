export function generateRoomId(): string {
    return Math.random().toString(36).substring(2, 10);
  }
  
  export function validateRoomId(roomId: string): boolean {
    return /^[a-zA-Z0-9]{8}$/.test(roomId);
  }
  
  export function formatRoomId(roomId: string): string {
    return roomId.toUpperCase();
  }