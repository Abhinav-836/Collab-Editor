import { Request, Response } from 'express';
import { roomStore } from '../../store/roomStore.js';

export const getRoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const room = roomStore.getRoom(id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    return res.json({ success: true, room });
  } catch (error) {
    console.error('Error fetching room:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch room' });
  }
};

export const getRoomStats = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const room = roomStore.getRoom(id);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    return res.json({
      success: true,
      stats: {
        id: room.id,
        activeUsers: room.users.length,
        createdAt: room.createdAt,
        lastActive: room.updatedAt
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch room stats' });
  }
};