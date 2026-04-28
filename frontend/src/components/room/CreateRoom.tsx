import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface CreateRoomProps {
  onCreate?: (roomId: string, userName: string) => void;
}

export default function CreateRoom({ onCreate }: CreateRoomProps) {
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/rooms', { method: 'POST' });
      const data = await response.json();
      const name = userName.trim() || `User_${Math.random().toString(36).substring(2, 6)}`;
      
      if (onCreate) {
        onCreate(data.roomId, name);
      } else {
        navigate(`/room/${data.roomId}?userName=${encodeURIComponent(name)}`);
      }
    } catch (error) {
      console.error('Failed to create room:', error);
      alert('Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h3 style={{ marginBottom: '15px', color: '#d4d4d4' }}>Create New Room</h3>
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
        onClick={handleCreate}
        disabled={isLoading}
        style={{
          width: '100%',
          padding: '10px',
          background: isLoading ? '#555' : '#4ECDC4',
          border: 'none',
          borderRadius: '4px',
          color: 'white',
          cursor: isLoading ? 'not-allowed' : 'pointer'
        }}
      >
        {isLoading ? 'Creating...' : 'Create Room'}
      </button>
    </div>
  );
}