import { Request, Response } from 'express';
import { roomStore } from '../../store/roomStore.js';
import { hashPassword, issueToken, roomAuthStore, validatePassword } from '../../services/roomAuth.js';

export const createRoom = async (req: Request, res: Response) => {
  try {
    const password = req.body?.password;
    const hasPassword = typeof password === 'string' && password.length > 0;
    if (hasPassword) {
      const problem = validatePassword(password);
      if (problem) return res.status(400).json({ success: false, error: problem });
    }

    const room = roomStore.createRoom(req.body?.settings);

    let token: string | null = null;
    if (hasPassword) {
      await roomAuthStore.setHash(room.id, await hashPassword(password));
      token = issueToken(room.id); // the creator doesn't have to type it again
    }

    return res.status(201).json({ success: true, roomId: room.id, protected: hasPassword, token });
  } catch (error) {
    console.error('Error creating room:', error);
    return res.status(500).json({ success: false, error: 'Failed to create room' });
  }
};

/**
 * Previously returned every room (ids included), which let anyone enumerate
 * and join other people's rooms. Now only reports a count.
 */
export const getRooms = async (_req: Request, res: Response) => {
  try {
    return res.json({ success: true, count: roomStore.getAllRooms().length });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch rooms' });
  }
};