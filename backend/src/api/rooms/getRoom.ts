import { Request, Response } from 'express';

// In-memory store (shared with createRoom)
const rooms = new Map();

export const getRoom = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const room = rooms.get(id);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }
    
    res.json({
      success: true,
      room: room
    });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch room' 
    });
  }
};

export const getRoomStats = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const room = rooms.get(id);
    
    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }
    
    res.json({
      success: true,
      stats: {
        id: room.id,
        activeUsers: room.users?.length || 0,
        createdAt: room.createdAt,
        lastActive: room.updatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch room stats' 
    });
  }
};