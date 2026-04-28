import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

// In-memory store (replace with database in production)
const rooms = new Map();

export const createRoom = async (req: Request, res: Response) => {
  try {
    const roomId = uuidv4().slice(0, 8);
    const room = {
      id: roomId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      users: [],
      documentContent: '// Welcome to collaborative coding!\n// Share this room with friends!\n\n',
      settings: {
        language: 'javascript',
        theme: 'vs-dark'
      }
    };
    
    rooms.set(roomId, room);
    
    res.status(201).json({
      success: true,
      roomId: roomId,
      room: room
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create room' 
    });
  }
};

export const getRooms = async (req: Request, res: Response) => {
  try {
    const allRooms = Array.from(rooms.values());
    res.json({
      success: true,
      rooms: allRooms
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch rooms' 
    });
  }
};