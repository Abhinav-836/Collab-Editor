'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError, createRoom, joinRoom, NETWORK_ERROR } from '@/lib/api';
import { setRoomToken } from '@/lib/roomTokens';
import { parseRoomInput, ROOM_ID_RE } from '@/lib/userName';
import { track } from '@/lib/track';

type Mode = 'create' | 'join';

export default function StartPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const invitedRoom = params.get('room') || '';
  const locked = params.get('locked') === '1';

  const [mode, setMode] = useState<Mode>(invitedRoom ? 'join' : 'create');
  const [name, setName] = useState('');
  const [roomInput, setRoomInput] = useState(invitedRoom);
  const [newPassword, setNewPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [joinPassword, setJoinPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(locked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(locked ? 'This room is locked. Enter its password to join.' : '');

  const goToRoom = (id: string) => {
    const clean = name.trim().slice(0, 40);
    router.push(`/room/${encodeURIComponent(id)}?userName=${encodeURIComponent(clean)}`);
  };

  const onCreate = async () => {
    if (!name.trim()) return setError('Add your name so others know who is typing.');
    const password = usePassword ? newPassword : '';
    if (password && password.length < 4) return setError('Use at least 4 characters for the password, or turn the lock off.');
    setBusy(true);
    setError('');
    try {
      const { roomId, token } = await createRoom(password || undefined);
      if (token) setRoomToken(roomId, token);
      track('room_created', { locked: Boolean(password) });
      goToRoom(roomId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : NETWORK_ERROR);
      setBusy(false);
    }
  };

  const onJoin = async () => {
    if (!name.trim()) return setError('Add your name so others know who is typing.');
    const id = parseRoomInput(roomInput);
    if (!id) return setError('Paste an invite link or type the room code.');
    if (!ROOM_ID_RE.test(id)) return setError('Room codes only use letters, numbers, - and _.');
    setBusy(true);
    setError('');
    try {
      const { token } = await joinRoom(id, joinPassword || undefined);
      setRoomToken(id, token);
      track('room_joined', { locked: Boolean(joinPassword) });
      goToRoom(id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setNeedsPassword(true);
        setError(joinPassword ? 'That password is wrong. Check with whoever shared the room.' : 'This room is locked. Enter its password to join.');
      } else {
        setError(err instanceof ApiError ? err.message : NETWORK_ERROR);
      }
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    void (mode === 'create' ? onCreate() : onJoin());
  };

  return (
    <form onSubmit={submit} className="rounded-xl border border-line bg-panel p-5 sm:p-6" noValidate>
      <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
        Your name
      </label>
      <input
        id="name"
        className="field"
        value={name}
        maxLength={40}
        autoComplete="off"
        placeholder="Enter your name"
        onChange={(e) => setName(e.target.value)}
      />

      <div role="tablist" aria-label="Start or join" className="mt-6 grid grid-cols-2 border-b border-line text-sm">
        {(['create', 'join'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError('');
            }}
            className={`-mb-px border-b-2 pb-2.5 text-left transition-colors ${
              mode === m ? 'border-amber font-medium text-text' : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {m === 'create' ? 'New room' : 'Join a room'}
          </button>
        ))}
      </div>

      <div className="mt-5 min-h-[6.25rem]">
        {mode === 'create' ? (
          <>
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={usePassword}
                onChange={(e) => setUsePassword(e.target.checked)}
                className="h-4 w-4 accent-[var(--amber)]"
              />
              Lock the room with a password
            </label>
            {usePassword ? (
              <input
                type="password"
                aria-label="Room password"
                className="field mt-3"
                value={newPassword}
                maxLength={100}
                autoComplete="new-password"
                placeholder="At least 4 characters"
                onChange={(e) => setNewPassword(e.target.value)}
              />
            ) : (
              <p className="mt-3 text-sm text-muted">Anyone with the link can join and edit.</p>
            )}
          </>
        ) : (
          <>
            <label htmlFor="room" className="mb-1.5 block text-sm font-medium">
              Invite link or room code
            </label>
            <input
              id="room"
              className="field font-mono text-sm"
              value={roomInput}
              autoComplete="off"
              spellCheck={false}
              placeholder="k3x9q2ab"
              onChange={(e) => setRoomInput(e.target.value)}
            />
            {needsPassword && (
              <input
                type="password"
                aria-label="Room password"
                className="field mt-3"
                value={joinPassword}
                autoFocus
                autoComplete="current-password"
                placeholder="Room password"
                onChange={(e) => setJoinPassword(e.target.value)}
              />
            )}
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-amber px-4 py-3 font-semibold text-amber-ink transition-opacity hover:opacity-90 disabled:cursor-progress disabled:opacity-70"
      >
        {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />}
        {mode === 'create' ? (busy ? 'Creating room…' : 'Create room') : busy ? 'Joining…' : needsPassword ? 'Unlock and join' : 'Join room'}
      </button>
    </form>
  );
}