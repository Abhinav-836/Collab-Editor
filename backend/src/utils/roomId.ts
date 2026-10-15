const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const generateRoomId = (): string => {
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return result;
};

export const validateRoomId = (roomId: string): boolean => /^[A-Za-z0-9]{8}$/.test(roomId);
export const formatRoomId = (roomId: string): string => roomId.toUpperCase();