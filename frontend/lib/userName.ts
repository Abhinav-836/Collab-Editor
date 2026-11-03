const NAME_KEY = 'collab-editor-name';

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* private mode */
  }
}

export const ROOM_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Accept a bare room code or a pasted invite link like https://site/room/abc123 */
export function parseRoomInput(value: string): string {
  const trimmed = value.trim();
  const fromLink = trimmed.match(/\/room\/([^/?#]+)/);
  return fromLink ? decodeURIComponent(fromLink[1]) : trimmed;
}