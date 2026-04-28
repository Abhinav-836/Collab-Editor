import { Request, Response } from 'express';

// In-memory store (shared with createRoom)
const rooms = new Map();

export const deleteRoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!rooms.has(id)) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }
    
    rooms.delete(id);
    
    res.json({
      success: true,
      message: 'Room deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete room' 
    });
  }
};

export const cleanupInactiveRooms = async () => {
  try {
    const now = Date.now();
    const inactiveThreshold = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [id, room] of rooms.entries()) {
      const lastActive = new Date(room.updatedAt).getTime();
      if (now - lastActive > inactiveThreshold && (!room.users || room.users.length === 0)) {
        rooms.delete(id);
        console.log(`🧹 Cleaned up inactive room: ${id}`);
      }
    }
  } catch (error) {
    console.error('Error cleaning up rooms:', error);
  }
};

// Run cleanup every hour
setInterval(cleanupInactiveRooms, 60 * 60 * 1000);