/**
 * Access tokens for password-protected rooms, kept in localStorage so the
 * password is asked once per browser (tokens expire after 30 days server-side).
 */
const key = (roomId: string) => `collab-room-token:${roomId}`;

export function getRoomToken(roomId: string): string | null {
  try {
    return localStorage.getItem(key(roomId));
  } catch {
    return null;
  }
}

export function setRoomToken(roomId: string, token: string | null): void {
  try {
    if (token) localStorage.setItem(key(roomId), token);
    else localStorage.removeItem(key(roomId));
  } catch {
    /* private mode — the user will be asked again */
  }
}