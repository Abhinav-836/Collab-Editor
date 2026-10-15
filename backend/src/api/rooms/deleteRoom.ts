import { Request, Response } from 'express';
import { roomStore } from '../../store/roomStore.js';

export const deleteRoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!roomStore.getRoom(id)) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }
    roomStore.deleteRoom(id);
    return res.json({ success: true, message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete room' });
  }
};

export const cleanupInactiveRooms = async () => {
  try {
    roomStore.cleanupInactive();
  } catch (error) {
    console.error('Error cleaning up rooms:', error);
  }
};

setInterval(cleanupInactiveRooms, 60 * 60 * 1000);