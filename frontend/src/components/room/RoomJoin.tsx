import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface RoomJoinProps {
  onJoin?: (roomId: string, userName: string) => void;
}

export default function RoomJoin({ onJoin }: RoomJoinProps) {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const navigate = useNavigate();

  const handleJoin = () => {
    if (roomId.trim()) {
      const name = userName.trim() || `User_${Math.random().toString(36).substring(2, 6)}`;
      if (onJoin) {
        onJoin(roomId, name);
      } else {
        navigate(`/room/${roomId}?userName=${encodeURIComponent(name)}`);
      }
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h3 style={{ marginBottom: '15px', color: '#d4d4d4' }}>Join Existing Room</h3>
      <input
        type="text"
        placeholder="Room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '10px',
          background: '#3c3c3c',
          border: '1px solid #555',
          borderRadius: '4px',
          color: '#d4d4d4'
        }}
      />
      <input
        type="text"
        placeholder="Your Name (optional)"
        value={userName}
        onChange={(e) => setUserName(e.target.value)}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '15px',
          background: '#3c3c3c',
          border: '1px solid #555',
          borderRadius: '4px',
          color: '#d4d4d4'
        }}
      />
      <button
        onClick={handleJoin}
        style={{
          width: '100%',
          padding: '10px',
          background: '#0e639c',
          border: 'none',
          borderRadius: '4px',
          color: 'white',
          cursor: 'pointer'
        }}
      >
        Join Room
      </button>
    </div>
  );
}