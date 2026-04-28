import { customAlphabet } from 'nanoid';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const nanoid = customAlphabet(alphabet, 8);

export const generateRoomId = (): string => {
  return nanoid();
};

export const validateRoomId = (roomId: string): boolean => {
  // Room ID should be alphanumeric and 8 characters
  return /^[A-Za-z0-9]{8}$/.test(roomId);
};

export const formatRoomId = (roomId: string): string => {
  return roomId.toUpperCase();
};