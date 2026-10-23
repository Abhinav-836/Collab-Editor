import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setRoomToken } from '../utils/roomTokens';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/+$/, '');
const ROOM_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const NAME_KEY = 'collab-editor-name';

const loadName = () => {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
};

/** Accept a bare room id or a pasted invite link like https://site/room/abc123 */
const parseRoomInput = (value: string) => {
  const trimmed = value.trim();
  const fromLink = trimmed.match(/\/room\/([^/?#]+)/);
  return fromLink ? decodeURIComponent(fromLink[1]) : trimmed;
};

export default function Home() {
  const [searchParams] = useSearchParams();
  const [roomId, setRoomId] = useState(searchParams.get('room') || '');
  const [userName, setUserName] = useState(loadName);
  const [newRoomPassword, setNewRoomPassword] = useState('');
  const [joinPassword, setJoinPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(searchParams.get('locked') === '1');
  const [isLoading, setIsLoading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState(
    searchParams.get('locked') === '1' ? 'This room is password-protected. Enter the password to join.' : ''
  );
  const navigate = useNavigate();

  const goToRoom = (id: string) => {
    const name = userName.trim().slice(0, 40);
    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      /* private mode */
    }
    navigate(`/room/${encodeURIComponent(id)}?userName=${encodeURIComponent(name)}`);
  };

  const createRoom = async () => {
    if (isLoading) return;
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (newRoomPassword && newRoomPassword.length < 4) {
      setError('Room password must be at least 4 characters (or leave it empty)');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoomPassword ? { password: newRoomPassword } : {})
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 400 && data.error) {
          setError(data.error);
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }
      if (!data.roomId) throw new Error('No room id in response');
      if (data.token) setRoomToken(data.roomId, data.token);
      goToRoom(data.roomId);
    } catch (error) {
      console.error('Failed to create room:', error);
      setError('Failed to create room. Please check if the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoom = async () => {
    if (isJoining) return;
    if (!userName.trim()) return setError('Please enter your name');
    const id = parseRoomInput(roomId);
    if (!id) return setError('Please enter a room ID');
    if (!ROOM_ID_RE.test(id)) return setError('Room ID can only contain letters, numbers, - and _');

    setIsJoining(true);
    setError('');
    try {
      // The server says whether the room is protected and, with the right password, returns a token
      const response = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(id)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(joinPassword ? { password: joinPassword } : {})
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        setNeedsPassword(true);
        setError(joinPassword ? 'Wrong password' : 'This room is password-protected. Enter the password to join.');
        return;
      }
      if (!response.ok) {
        setError(data.error || `Could not join (HTTP ${response.status})`);
        return;
      }
      setRoomToken(id, data.token ?? null);
      goToRoom(id);
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
      }}
    >
      <div
        style={{
          background: 'rgba(30, 30, 46, 0.95)',
          backdropFilter: 'blur(10px)',
          padding: '40px',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          width: '450px',
          maxWidth: 'calc(100vw - 32px)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1
            style={{
              fontSize: '42px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '10px'
            }}
          >
            🤝 Collab Editor
          </h1>
          <p style={{ color: '#888', fontSize: '14px' }}>
            Real-time collaborative code editor
          </p>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(244, 135, 113, 0.15)',
              border: '1px solid #f48771',
              borderRadius: '8px',
              padding: '10px',
              marginBottom: '20px',
              color: '#f48771',
              fontSize: '13px',
              textAlign: 'center'
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <input
          type="text"
          placeholder="👤 Your name *"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (roomId.trim() ? joinRoom() : createRoom())}
          maxLength={40}
          autoFocus
          style={{
            width: '100%',
            padding: '14px',
            marginBottom: '15px',
            background: '#1e1e2e',
            border: '1px solid #3a3a4a',
            borderRadius: '10px',
            fontSize: '14px',
            color: '#d4d4d4',
            outline: 'none'
          }}
        />

        <input
          type="password"
          placeholder="🔒 Password for new room (optional)"
          value={newRoomPassword}
          onChange={(e) => setNewRoomPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createRoom()}
          maxLength={100}
          autoComplete="new-password"
          style={{
            width: '100%',
            padding: '12px 14px',
            marginBottom: '10px',
            background: '#1e1e2e',
            border: '1px solid #3a3a4a',
            borderRadius: '10px',
            fontSize: '13px',
            color: '#d4d4d4',
            outline: 'none'
          }}
        />

        <button
          onClick={createRoom}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '14px',
            background: isLoading
              ? '#555'
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            marginBottom: '20px'
          }}
        >
          {isLoading ? 'Creating...' : '🚀 Create New Room'}
        </button>

        <input
          type="text"
          placeholder="🔗 Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
          style={{
            width: '100%',
            padding: '14px',
            marginBottom: '15px',
            background: '#1e1e2e',
            border: '1px solid #3a3a4a',
            borderRadius: '10px',
            fontSize: '14px',
            color: '#d4d4d4',
            outline: 'none'
          }}
        />

        {needsPassword && (
          <input
            type="password"
            placeholder="🔑 Room password"
            value={joinPassword}
            onChange={(e) => setJoinPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
            autoFocus
            autoComplete="current-password"
            style={{
              width: '100%',
              padding: '14px',
              marginBottom: '15px',
              background: '#1e1e2e',
              border: '1px solid #f4b400',
              borderRadius: '10px',
              fontSize: '14px',
              color: '#d4d4d4',
              outline: 'none'
            }}
          />
        )}

        <button
          onClick={joinRoom}
          disabled={isJoining}
          style={{
            width: '100%',
            padding: '14px',
            background: 'rgba(78, 205, 196, 0.2)',
            color: '#4ECDC4',
            border: '1px solid #4ECDC4',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          {isJoining ? 'Joining…' : needsPassword ? '🔓 Unlock & Join' : '🔗 Join Room'}
        </button>
      </div>
    </div>
  );
}