'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import CollabEditor, { EditorHandle } from './CollabEditor';
import AssistantPanel from './AssistantPanel';
import RunPanel from './RunPanel';
import { Mark } from './Wordmark';
import { CLOSE_PASSWORD_REQUIRED, CollabSocket, ConnectionStatus, getWsBase } from '@/lib/websocketService';
import { getLanguage, SUPPORTED_LANGUAGES } from '@/lib/languages';
import { getRoomToken, setRoomToken } from '@/lib/roomTokens';
import { getUserColor } from '@/lib/userColor';
import { track } from '@/lib/track';

type User = { userId: string; userName: string };

/**
 * One id per page load. Reused across automatic reconnects (so the server
 * replaces the stale socket instead of showing a ghost user), but never shared
 * between tabs — two tabs with the same id would keep kicking each other off.
 */
const newUserId = () => `${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

const STATUS: Record<ConnectionStatus, { label: string; dot: string }> = {
  connecting: { label: 'Connecting', dot: 'bg-amber' },
  open: { label: 'Live', dot: 'bg-ok' },
  reconnecting: { label: 'Reconnecting', dot: 'bg-amber' },
  closed: { label: 'Offline', dot: 'bg-danger' }
};

const toolbarBtn = 'rounded-md px-2 py-1.5 sm:px-2.5 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40';

export default function RoomView({ roomId, userName }: { roomId: string; userName: string }) {
  const router = useRouter();
  const [socket, setSocket] = useState<CollabSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [users, setUsers] = useState<User[]>([]);
  const [language, setLanguage] = useState('javascript');
  const [copied, setCopied] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [runRequest, setRunRequest] = useState(0);
  const [showAssistant, setShowAssistant] = useState(false);
  const leaveDialog = useRef<HTMLDialogElement>(null);

  const userIdRef = useRef(newUserId());
  const editorRef = useRef<EditorHandle>(null);

  useEffect(() => {
    if (!userName) {
      // Opened a shared link without a name → ask for one, keep the room code
      router.replace(`/?room=${encodeURIComponent(roomId)}`);
      return;
    }
    const params = new URLSearchParams({ roomId, userId: userIdRef.current, userName });
    const token = getRoomToken(roomId);
    if (token) params.set('token', token);
    const s = new CollabSocket(`${getWsBase()}/ws?${params.toString()}`);

    const offs = [
      s.onStatus((next) => {
        setStatus(next);
        if (next === 'closed' && s.lastCloseCode === CLOSE_PASSWORD_REQUIRED) {
          setRoomToken(roomId, null);
          router.replace(`/?room=${encodeURIComponent(roomId)}&locked=1`);
        }
      }),
      s.on('users_list', (d) => Array.isArray(d.users) && setUsers(d.users)),
      s.on('user_joined', (d) => Array.isArray(d.users) && setUsers(d.users)),
      s.on('user_left', (d) => Array.isArray(d.users) && setUsers(d.users)),
      s.on('document_sync', (d) => typeof d.language === 'string' && setLanguage(d.language)),
      s.on('language_changed', (d) => typeof d.language === 'string' && setLanguage(d.language))
    ];
    setStatus(s.status);
    setSocket(s);

    return () => {
      offs.forEach((off) => off());
      s.close();
      setSocket(null);
      setUsers([]);
    };
  }, [roomId, userName, router]);

  const lang = getLanguage(language);
  const getCode = useCallback(() => editorRef.current?.getValue() ?? '', []);
  const insertCode = useCallback((code: string) => editorRef.current?.insertText(code) ?? false, []);

  const copyInvite = async () => {
    const link = `${window.location.origin}/room/${encodeURIComponent(roomId)}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt('Copy this invite link:', link);
    }
    track('invite_copied');
  };

  const changeLanguage = (next: string) => {
    setLanguage(next);
    socket?.send('change_language', { language: next });
  };

  const run = () => {
    setShowRun(true);
    setRunRequest((n) => n + 1);
  };

  const download = () => {
    const code = getCode();
    // Java needs the file named after its public class (Main.java)
    const javaClass = lang.id === 'java' ? code.match(/public\s+(?:final\s+)?class\s+(\w+)/)?.[1] : undefined;
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${javaClass ?? roomId}.${lang.extension}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    track('code_downloaded', { language: lang.id });
  };

  const leave = () => {
    socket?.close();
    router.push('/');
  };

  const st = STATUS[status];

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-panel px-3 py-2">
        <a href="/" aria-label="Collab Editor home" className="shrink-0">
          <Mark />
        </a>

        <div className="flex items-center gap-1 rounded-md border border-line bg-editor pl-2.5">
          <span className="sr-only">Room code</span>
          <code className="font-mono text-[13px] text-text">{roomId}</code>
          <button type="button" onClick={copyInvite} className={`${toolbarBtn} text-amber hover:text-text`}>
            {copied ? 'Copied' : <><span className="sm:hidden">Invite</span><span className="hidden sm:inline">Copy invite</span></>}
          </button>
        </div>

        <span className="flex items-center gap-1.5 text-xs text-muted" role="status">
          <span className={`h-2 w-2 rounded-full ${st.dot}`} aria-hidden="true" />
          {st.label}
        </span>

        <ul className="flex -space-x-1.5" aria-label={`${users.length} people in the room`}>
          {users.slice(0, 6).map((u) => (
            <li
              key={u.userId}
              title={u.userId === userIdRef.current ? `${u.userName} (you)` : u.userName}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-panel text-xs font-semibold text-bg"
              style={{ background: getUserColor(u.userId) }}
            >
              {(u.userName || '?').charAt(0).toUpperCase()}
            </li>
          ))}
          {users.length > 6 && (
            <li className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-panel bg-raised text-[11px] text-muted">
              +{users.length - 6}
            </li>
          )}
        </ul>

        <div className="flex items-center gap-1 sm:ml-auto sm:gap-1.5">
          <label htmlFor="language" className="sr-only">
            Language
          </label>
          <select id="language" className="select" value={language} onChange={(e) => changeLanguage(e.target.value)}>
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.id} value={l.monacoId}>
                {l.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={run}
            disabled={!lang.runnable}
            title={lang.runnable ? 'Run the code. Output is only shown to you.' : `${lang.name} can't be run`}
            className={`${toolbarBtn} bg-amber font-semibold text-amber-ink hover:opacity-90`}
          >
            Run
          </button>
          <button type="button" onClick={download} className={`${toolbarBtn} text-text hover:bg-raised`} title={`Download as .${lang.extension}`}>
            Download
          </button>
          <button
            type="button"
            aria-pressed={showAssistant}
            onClick={() => setShowAssistant((v) => !v)}
            className={`${toolbarBtn} ${showAssistant ? 'bg-raised text-text' : 'text-text hover:bg-raised'}`}
          >
            <span className="sm:hidden">AI</span>
            <span className="hidden sm:inline">Assistant</span>
          </button>
          <button type="button" onClick={() => leaveDialog.current?.showModal()} className={`${toolbarBtn} text-danger hover:bg-danger/10`}>
            Leave
          </button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 bg-editor">
            {socket && <CollabEditor ref={editorRef} socket={socket} userId={userIdRef.current} language={language} users={users} />}
          </div>
          {showRun && <RunPanel getCode={getCode} language={language} runRequest={runRequest} onClose={() => setShowRun(false)} />}
        </div>
        {showAssistant && (
          <div className="absolute inset-0 z-20 md:static md:inset-auto md:w-[24rem] md:shrink-0">
            <AssistantPanel getCode={getCode} language={language} onInsertCode={insertCode} onClose={() => setShowAssistant(false)} />
          </div>
        )}
      </div>

      <dialog
        ref={leaveDialog}
        className="m-auto w-[calc(100vw-2rem)] max-w-sm rounded-xl border border-line bg-panel p-6 text-text backdrop:bg-black/60"
        onClick={(e) => e.target === leaveDialog.current && leaveDialog.current?.close()}
      >
        <h2 className="text-lg font-semibold">Leave this room?</h2>
        <p className="mt-2 text-sm text-muted">The file stays in the room. You can come back with the invite link.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={() => leaveDialog.current?.close()} className="rounded-md px-3.5 py-2 text-sm hover:bg-raised">
            Stay
          </button>
          <button type="button" onClick={leave} className="rounded-md bg-danger px-3.5 py-2 text-sm font-semibold text-bg hover:opacity-90">
            Leave room
          </button>
        </div>
      </dialog>
    </div>
  );
}