import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const createRoom = async () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      // Use the Render backend URL directly
      const API_BASE = 'https://collab-editor-qib6.onrender.com';
      const response = await fetch(`${API_BASE}/api/rooms`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      navigate(`/room/${data.roomId}?userName=${encodeURIComponent(userName.trim())}`);
    } catch (error) {
      console.error('Failed to create room:', error);
      setError('Failed to create room. Please check if the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoom = () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }
    
    navigate(`/room/${roomId.trim()}?userName=${encodeURIComponent(userName.trim())}`);
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
    }}>
      <div style={{
        background: 'rgba(30, 30, 46, 0.95)',
        backdropFilter: 'blur(10px)',
        padding: '40px',
        borderRadius: '20px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        width: '450px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ 
            fontSize: '42px', 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '10px'
          }}>
            🤝 Collab Editor
          </h1>
          <p style={{ color: '#888', fontSize: '14px' }}>
            Real-time collaborative code editor
          </p>
        </div>
        
        {error && (
          <div style={{
            background: 'rgba(244, 135, 113, 0.15)',
            border: '1px solid #f48771',
            borderRadius: '8px',
            padding: '10px',
            marginBottom: '20px',
            color: '#f48771',
            fontSize: '13px',
            textAlign: 'center'
          }}>
            ⚠️ {error}
          </div>
        )}
        
        <input
          type="text"
          placeholder="👤 Your name *"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && createRoom()}
          style={{
            width: '100%',
            padding: '14px',
            marginBottom: '15px',
            background: '#1e1e2e',
            border: '1px solid #3a3a4a',
            borderRadius: '10px',
            fontSize: '14px',
            color: '#d4d4d4',
            outline: 'none',
            transition: 'border 0.2s'
          }}
          onFocus={(e) => e.target.style.border = '1px solid #667eea'}
          onBlur={(e) => e.target.style.border = '1px solid #3a3a4a'}
        />
        
        <button
          onClick={createRoom}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '14px',
            background: isLoading ? '#555' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            marginBottom: '20px',
            transition: 'transform 0.2s, opacity 0.2s'
          }}
          onMouseEnter={(e) => {
            if (!isLoading) e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {isLoading ? 'Creating...' : '🚀 Create New Room'}
        </button>
        
        <div style={{ 
          textAlign: 'center', 
          margin: '20px 0', 
          color: '#666',
          position: 'relative'
        }}>
          <span style={{ background: '#1e1e2e', padding: '0 10px' }}>or</span>
          <div style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: '1px',
            background: '#3a3a4a',
            zIndex: -1
          }} />
        </div>
        
        <input
          type="text"
          placeholder="🔗 Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
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
        
        <button
          onClick={joinRoom}
          style={{
            width: '100%',
            padding: '14px',
            background: 'rgba(78, 205, 196, 0.2)',
            color: '#4ECDC4',
            border: '1px solid #4ECDC4',
            borderRadius: '10px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#4ECDC4';
            e.currentTarget.style.color = '#1a1a2e';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(78, 205, 196, 0.2)';
            e.currentTarget.style.color = '#4ECDC4';
          }}
        >
          🔗 Join Room
        </button>
      </div>
    </div>
  );
}