import { Request, Response } from 'express';
import { roomStore } from '../../store/roomStore.js';

export const createRoom = async (req: Request, res: Response) => {
  try {
    const room = roomStore.createRoom(req.body?.settings);
    return res.status(201).json({ success: true, roomId: room.id, room });
  } catch (error) {
    console.error('Error creating room:', error);
    return res.status(500).json({ success: false, error: 'Failed to create room' });
  }
};

export const getRooms = async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, rooms: roomStore.getAllRooms() });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch rooms' });
  }
};