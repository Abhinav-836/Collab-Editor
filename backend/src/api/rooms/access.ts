import { Request, Response } from 'express';
import { issueToken, roomAuthStore, verifyPassword } from '../../services/roomAuth.js';

const ROOM_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * POST /api/rooms/:id/join { password? }
 *   open room      → 200 { protected: false, token: null }
 *   right password → 200 { protected: true, token }
 *   no/wrong one   → 401 { protected: true, error }
 */
export const joinRoom = async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!ROOM_ID_RE.test(id)) return res.status(400).json({ success: false, error: 'Invalid room ID' });
  try {
    const hash = await roomAuthStore.getHash(id);
    if (hash === null) return res.json({ success: true, protected: false, token: null });

    const password = req.body?.password;
    if (typeof password !== 'string' || password.length === 0) {
      return res.status(401).json({ success: false, protected: true, error: 'This room needs a password' });
    }
    if (!(await verifyPassword(password, hash))) {
      return res.status(401).json({ success: false, protected: true, error: 'Wrong password' });
    }
    return res.json({ success: true, protected: true, token: issueToken(id) });
  } catch (error) {
    console.error('Room join failed:', (error as Error).message);
    return res.status(503).json({ success: false, error: 'Could not check the password right now. Try again.' });
  }
};