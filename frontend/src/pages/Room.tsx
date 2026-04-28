import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import MonacoEditor from '../components/editor/MonacoEditor';
import ActiveUsers from '../components/presence/ActiveUsers';
import ModelSelector from '../components/ai/ModelSelector';
import AIChatAssistant from '../components/ai/AIChatAssistant';

export default function Room() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userName = searchParams.get('userName') || '';
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [users, setUsers] = useState<Array<{ userId: string; userName: string }>>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [documentContent, setDocumentContent] = useState('');
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [selectedModel, setSelectedModel] = useState('llama3.2');

  const userIdRef = useRef(`${Math.random().toString(36).substring(7)}_${Date.now()}`);
  
  useEffect(() => {
    if (!userName) {
      navigate('/');
      return;
    }
  }, [userName, navigate]);

  useEffect(() => {
    // Use environment variable for WebSocket URL if available
    const WS_URL = import.meta.env.VITE_WS_URL || '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const baseUrl = WS_URL || `${protocol}//${window.location.host}`;
    const wsUrl = `${baseUrl}/ws?roomId=${roomId}&userId=${userIdRef.current}&userName=${encodeURIComponent(userName)}`;
    
    console.log('🔌 Connecting to WebSocket:', wsUrl);
    const websocket = new WebSocket(wsUrl);
    
    websocket.onopen = () => {
      console.log('✅ Connected to WebSocket');
      setIsConnected(true);
      websocket.send(JSON.stringify({ type: 'get_document' }));
    };
    
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('📨 Room received:', data.type, data);
      switch (data.type) {
        case 'user_joined':
        case 'user_left':
        case 'users_list':
          if (data.users) {
            setUsers(data.users);
          }
          break;
        case 'document_sync':
          console.log('📄 Document synced, length:', data.content?.length);
          setDocumentContent(data.content);
          break;
      }
    };
    
    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };
    
    websocket.onclose = () => {
      console.log('❌ WebSocket disconnected');
      setIsConnected(false);
    };
    
    setWs(websocket);
    
    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, [roomId, userName]);

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId || '');
  };

  const leaveRoom = () => {
    if (ws) {
      ws.close();
    }
    navigate('/');
  };

  const handleInsertCode = (code: string) => {
    console.log('Insert code:', code);
    // You can implement code insertion into editor here
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
      {/* Top Bar */}
      <div style={{
        background: '#252526',
        padding: '8px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #3e3e42'
      }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#888', fontSize: '12px' }}>Room:</span>
            <code style={{ 
              background: '#1e1e1e', 
              padding: '4px 8px', 
              borderRadius: '4px',
              color: '#4ECDC4',
              fontSize: '12px'
            }}>{roomId}</code>
            <button
              onClick={copyRoomId}
              style={{
                padding: '4px 8px',
                background: '#0e639c',
                border: 'none',
                borderRadius: '4px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '11px'
              }}
              title="Copy Room ID"
            >
              📋
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#888', fontSize: '12px' }}>You:</span>
            <span style={{ color: '#FF6B6B', fontSize: '12px', fontWeight: 'bold' }}>{userName}</span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ 
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: isConnected ? '#4ECDC4' : '#FF6B6B',
              animation: isConnected ? 'pulse 2s infinite' : 'none'
            }}></span>
            <span style={{ color: '#888', fontSize: '11px' }}>{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
        
        {/* Right side - Model Selector, Active Users, Leave Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
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
              fontSize: '11px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f48771';
              e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(244, 135, 113, 0.2)';
              e.currentTarget.style.color = '#f48771';
            }}
          >
            Leave
          </button>
        </div>
      </div>
      
      {/* Editor */}
      <div style={{ flex: 1 }}>
        {ws && (
          <MonacoEditor 
            ws={ws} 
            userId={userIdRef.current}
            initialContent={documentContent}
          />
        )}
      </div>
      
      {/* AI Chat Assistant */}
      <AIChatAssistant 
        selectedModel={selectedModel}
        currentCode={documentContent}
        language="javascript"
        onInsertCode={handleInsertCode}
      />
      
      {/* Leave Confirmation Modal */}
      {showLeaveConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }} onClick={() => setShowLeaveConfirm(false)}>
          <div style={{
            background: '#252526',
            borderRadius: '12px',
            padding: '24px',
            width: '320px',
            textAlign: 'center'
          }} onClick={(e) => e.stopPropagation()}>
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
      
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}