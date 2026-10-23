import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import MonacoEditor, { EditorHandle } from '../components/editor/MonacoEditor';
import LanguageSelector from '../components/editor/LanguageSelector';
import ActiveUsers from '../components/presence/ActiveUsers';
import ModelSelector from '../components/ai/ModelSelector';
import AIChatAssistant from '../components/ai/AIChatAssistant';
import RunPanel, { RUN_PANEL_HEIGHT } from '../components/editor/RunPanel';
import { CollabSocket, ConnectionStatus, getWsBase, CLOSE_PASSWORD_REQUIRED } from '../services/websocketService';
import { getLanguage } from '../constants/languages';
import { getRoomToken, setRoomToken } from '../utils/roomTokens';

const DEFAULT_MODEL = 'gemma4:31b-cloud';

/**
 * One id per page load. Reused across automatic reconnects (so the server
 * replaces the stale socket instead of showing a ghost user), but never shared
 * between tabs — two tabs with the same id would keep kicking each other off.
 */
const newUserId = () => `${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  connecting: 'Connecting…',
  open: 'Connected',
  reconnecting: 'Reconnecting…',
  closed: 'Disconnected'
};

export default function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userName = (searchParams.get('userName') || '').trim();

  const [socket, setSocket] = useState<CollabSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [users, setUsers] = useState<Array<{ userId: string; userName: string }>>([]);
  const [language, setLanguage] = useState('javascript');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [copied, setCopied] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [runRequest, setRunRequest] = useState(0);

  const userIdRef = useRef(newUserId());
  const editorRef = useRef<EditorHandle>(null);

  useEffect(() => {
    if (!roomId) {
      navigate('/', { replace: true });
      return;
    }
    if (!userName) {
      // Opened a shared link without a name → ask for one, keep the room id
      navigate(`/?room=${encodeURIComponent(roomId)}`, { replace: true });
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
          // Missing or expired token → ask for the password on the home page
          setRoomToken(roomId, null);
          navigate(`/?room=${encodeURIComponent(roomId)}&locked=1`, { replace: true });
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
  }, [roomId, userName, navigate]);

  const copyInviteLink = async () => {
    const link = `${window.location.origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy this invite link:', link);
    }
  };

  const leaveRoom = () => {
    socket?.close();
    navigate('/');
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    socket?.send('change_language', { language: newLanguage });
  };

  // Goes through the editor so it becomes a normal (synced) edit for everyone, including us
  const handleInsertCode = useCallback((code: string) => editorRef.current?.insertText(code) ?? false, []);
  const getCode = useCallback(() => editorRef.current?.getValue() ?? '', []);

  const isConnected = status === 'open';
  const lang = getLanguage(language);

  const runCode = () => {
    setShowRun(true);
    setRunRequest((n) => n + 1);
  };

  const downloadCode = () => {
    const code = getCode();
    // Java needs the file named after its public class (Main.java), others use the room id
    const javaClass = lang.id === 'java' ? code.match(/public\s+(?:final\s+)?class\s+(\w+)/)?.[1] : undefined;
    const fileName = `${javaClass ?? roomId}.${lang.extension}`;
    const url = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };

  const headerButton = (bg: string, border: string, color: string) => ({
    padding: '4px 10px',
    background: bg,
    border: `1px solid ${border}`,
    borderRadius: '4px',
    color,
    cursor: 'pointer',
    fontSize: '11px'
  });

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
      <div
        style={{
          background: '#252526',
          padding: '8px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #3e3e42',
          flexWrap: 'wrap',
          gap: '10px'
        }}
      >
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#888', fontSize: '12px' }}>Room:</span>
            <code
              style={{
                background: '#1e1e1e',
                padding: '4px 8px',
                borderRadius: '4px',
                color: '#4ECDC4',
                fontSize: '12px'
              }}
            >
              {roomId}
            </code>
            <button
              onClick={copyInviteLink}
              style={{
                padding: '4px 8px',
                background: copied ? '#2e7d32' : '#0e639c',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '11px'
              }}
              title="Copy invite link"
            >
              {copied ? '✓ Copied' : '📋 Invite'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#888', fontSize: '12px' }}>You:</span>
            <span style={{ color: '#FF6B6B', fontSize: '12px', fontWeight: 'bold' }}>{userName}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: isConnected ? '#4ECDC4' : status === 'closed' ? '#FF6B6B' : '#FFEAA7',
                animation: isConnected ? 'pulse 2s infinite' : 'none'
              }}
            />
            <span style={{ color: '#888', fontSize: '11px' }}>{STATUS_LABEL[status]}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <button
            onClick={runCode}
            disabled={!lang.runnable}
            title={lang.runnable ? 'Run the code (output is only shown to you)' : `${lang.name} can't be run`}
            style={{
              ...headerButton('#2e7d32', '#2e7d32', 'white'),
              opacity: lang.runnable ? 1 : 0.45,
              cursor: lang.runnable ? 'pointer' : 'not-allowed'
            }}
          >
            ▶ Run
          </button>
          <button onClick={downloadCode} title={`Download as .${lang.extension}`} style={headerButton('#3c3c3c', '#555', '#d4d4d4')}>
            ⬇ Download
          </button>
          <LanguageSelector language={language} onLanguageChange={handleLanguageChange} />
          <ModelSelector selectedModel={selectedModel} onModelChange={setSelectedModel} />
          <ActiveUsers users={users} />
          <button
            onClick={() => setShowLeaveConfirm(true)}
            style={{
              padding: '4px 12px',
              background: 'rgba(244, 135, 113, 0.2)',
              border: '1px solid #f48771',
              borderRadius: '4px',
              color: '#f48771',
              cursor: 'pointer',
              fontSize: '11px'
            }}
          >
            Leave
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {socket && (
          <MonacoEditor ref={editorRef} socket={socket} userId={userIdRef.current} language={language} users={users} />
        )}
      </div>

      {showRun && (
        <RunPanel getCode={getCode} language={language} runRequest={runRequest} onClose={() => setShowRun(false)} />
      )}

      <AIChatAssistant
        selectedModel={selectedModel}
        getCode={getCode}
        language={language}
        onInsertCode={handleInsertCode}
        bottomOffset={showRun ? RUN_PANEL_HEIGHT : 0}
      />

      {showLeaveConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}
          onClick={() => setShowLeaveConfirm(false)}
        >
          <div
            style={{
              background: '#252526',
              borderRadius: '12px',
              padding: '24px',
              width: '320px',
              maxWidth: 'calc(100vw - 32px)',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '15px', color: '#d4d4d4' }}>Leave Room?</h3>
            <p style={{ marginBottom: '20px', color: '#888', fontSize: '13px' }}>
              Are you sure you want to leave this room?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowLeaveConfirm(false)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#3c3c3c',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#d4d4d4',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={leaveRoom}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#f48771',
                  border: 'none',
                  borderRadius: '6px',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}