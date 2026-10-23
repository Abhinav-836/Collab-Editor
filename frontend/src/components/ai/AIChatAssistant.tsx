import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIChatAssistantProps {
  selectedModel: string;
  /** Read the live editor text at send time (avoids re-rendering on every keystroke). */
  getCode: () => string;
  language: string;
  /** Returns false if the editor isn't ready to accept the insert. */
  onInsertCode?: (code: string) => boolean;
}

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/+$/, '');
const CODE_BLOCK_RE = /```[^\n`]*\r?\n([\s\S]*?)```/;

export default function AIChatAssistant({
  selectedModel,
  getCode,
  language,
  onInsertCode
}: AIChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `👋 Hi! I'm your AI coding assistant.\n\nI can help you with:\n• Writing code\n• Explaining code\n• Finding bugs\n• Suggesting improvements\n\nAsk me anything about your code!`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState<{ name: string; id: string }[]>([{ name: 'gemma4:31b-cloud', id: 'gemma4:31b-cloud' }]);
  const [chatModel, setChatModel] = useState(selectedModel);
  const [notice, setNotice] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    setChatModel(selectedModel);
  }, [selectedModel]);

  const fetchModels = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/ai/models`);
      const data = await response.json();
      if (data.success && data.models?.length > 0) {
        setAvailableModels(data.models);
      }
    } catch (error) {
      console.error('Failed to fetch models, using defaults');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          code: getCode(),
          language,
          model: chatModel,
          history: messages.slice(-5).map((m) => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok && !data.response) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "Sorry, I'm having trouble connecting. Please check if the AI service is running.",
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2000);
  };

  const insertCode = async (code: string) => {
    if (onInsertCode && onInsertCode(code)) {
      flash('✓ Inserted at cursor');
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      flash('Editor not ready — copied to clipboard');
    } catch {
      flash('Could not insert or copy the code');
    }
  };

  // Matches ```js, ```c++, ```c#, ``` (no language) and Windows line endings
  const extractCodeFromMessage = (content: string): string | null => {
    const match = content.match(CODE_BLOCK_RE);
    return match ? match[1] : null;
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          border: 'none',
          color: 'white',
          fontSize: '24px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 1000
        }}
      >
        💬
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '90px',
            right: '20px',
            width: '450px',
            maxWidth: 'calc(100vw - 40px)',
            height: '550px',
            maxHeight: 'calc(100vh - 110px)',
            background: '#252526',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 1000,
            border: '1px solid #3e3e42'
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              background: '#2d2d30',
              borderBottom: '1px solid #3e3e42',
              borderRadius: '12px 12px 0 0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>🤖 AI Assistant</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <select
                value={chatModel}
                onChange={(e) => setChatModel(e.target.value)}
                style={{
                  background: '#1e1e2e',
                  border: '1px solid #3a3a4a',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  color: '#4ECDC4',
                  fontSize: '11px',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {availableModels.map((model) => (
                  <option key={model.id} value={model.name}>
                    🤖 {model.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: '18px'
                }}
              >
                ×
              </button>
            </div>
          </div>

          {notice && (
            <div style={{ padding: '6px 16px', background: '#2e7d32', color: 'white', fontSize: '11px' }}>
              {notice}
            </div>
          )}
          <div
            style={{
              padding: '6px 16px',
              background: '#1e1e2e',
              borderBottom: '1px solid #3e3e42',
              fontSize: '11px',
              color: '#4ECDC4',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>⚡ Active Model:</span>
            <strong>{chatModel}</strong>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: msg.role === 'user' ? '#0e639c' : '#3c3c3c',
                    color: '#d4d4d4',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  <div>{msg.content}</div>
                  {msg.role === 'assistant' && extractCodeFromMessage(msg.content) !== null && (
                    <button
                      onClick={() => {
                        const code = extractCodeFromMessage(msg.content);
                        if (code !== null) insertCode(code);
                      }}
                      style={{
                        marginTop: '8px',
                        padding: '4px 8px',
                        background: '#4ECDC4',
                        border: 'none',
                        borderRadius: '4px',
                        color: '#1e1e1e',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      📋 Insert Code
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: '#3c3c3c',
                    color: '#888',
                    fontSize: '13px'
                  }}
                >
                  Thinking...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div
            style={{
              padding: '12px',
              borderTop: '1px solid #3e3e42',
              display: 'flex',
              gap: '8px'
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your code... (Shift+Enter for new line)"
              rows={2}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#1e1e2e',
                border: '1px solid #3a3a4a',
                borderRadius: '8px',
                color: '#d4d4d4',
                fontSize: '12px',
                resize: 'none',
                fontFamily: 'inherit'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              style={{
                padding: '8px 16px',
                background: isLoading || !input.trim() ? '#555' : '#0e639c',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: isLoading || !input.trim() ? 'not-allowed' : 'pointer',
                fontSize: '12px'
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}