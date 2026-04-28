import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';

interface EditorProps {
  ws: WebSocket | null;
  userId: string;
  initialContent?: string;
}

export default function MonacoEditor({ ws, userId, initialContent = '' }: EditorProps) {
  const editorRef = useRef<any>(null);
  const isApplyingRemote = useRef(false);

  const defaultContent = `// Welcome to Collaborative Code Editor!
// Share this room ID with friends to code together in real-time!
// 
// 🔗 How to collaborate:
// 1. Share this room ID with your friends
// 2. Have them join using the same room ID
// 3. Start coding together in real-time!
//
// 💡 Features:
// • Real-time sync - See changes as others type
// • AI Assistant - Get code suggestions (select model from dropdown)
// • Multiple cursors - See where others are editing
//
// Happy collaborating! 🚀

function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet("Collaborator");`;

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    
    // Set initial content if provided
    if (initialContent) {
      editor.setValue(initialContent);
    } else {
      editor.setValue(defaultContent);
    }
    
    // Send local changes
    editor.onDidChangeModelContent(() => {
      if (isApplyingRemote.current) return;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      
      const newContent = editor.getValue();
      ws.send(JSON.stringify({
        type: 'operation',
        operation: {
          type: 'insert',
          position: 0,
          chars: newContent,
          clientId: userId,
          timestamp: Date.now(),
          version: 0
        }
      }));
    });
  };

  // Handle incoming messages
  useEffect(() => {
    if (!ws) return;
    
    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'operation' && data.userId !== userId && data.operation?.chars) {
        if (editorRef.current) {
          isApplyingRemote.current = true;
          editorRef.current.setValue(data.operation.chars);
          setTimeout(() => { isApplyingRemote.current = false; }, 50);
        }
      }
      
      if (data.type === 'document_sync' && data.content) {
        if (editorRef.current && editorRef.current.getValue() !== data.content) {
          isApplyingRemote.current = true;
          editorRef.current.setValue(data.content);
          setTimeout(() => { isApplyingRemote.current = false; }, 50);
        }
      }
    };
    
    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, userId]);

  // Update when initialContent changes
  useEffect(() => {
    if (initialContent && editorRef.current && editorRef.current.getValue() !== initialContent) {
      isApplyingRemote.current = true;
      editorRef.current.setValue(initialContent);
      setTimeout(() => { isApplyingRemote.current = false; }, 50);
    }
  }, [initialContent]);

  return (
    <Editor
      height="100%"
      defaultLanguage="javascript"
      theme="vs-dark"
      onMount={handleEditorDidMount}
      options={{
        fontSize: 14,
        fontFamily: 'Consolas, "Courier New", monospace',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        wordWrap: 'on',
        tabSize: 2
      }}
    />
  );
}