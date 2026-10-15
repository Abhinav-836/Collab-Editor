import { useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';

interface EditorProps {
  ws: WebSocket | null;
  userId: string;
  initialContent?: string;
  language?: string;
  onContentChange?: (content: string) => void;
}

const WELCOME_BY_LANG: Record<string, string> = {
  javascript: `// Welcome to Collaborative Code Editor!
// Share this room ID with friends to code together in real-time.

function greet(name) {
  console.log(\`Hello, \${name}!\`);
}

greet("Collaborator");`,
  typescript: `// Welcome to Collaborative Code Editor!
// Share this room ID with friends to code together in real-time.

interface User {
  name: string;
}

function greet(user: User): void {
  console.log(\`Hello, \${user.name}!\`);
}

greet({ name: "Collaborator" });`,
  python: `# Welcome to Collaborative Code Editor!
# Share this room ID with friends to code together in real-time.

def greet(name):
    print(f"Hello, {name}!")

greet("Collaborator")`,
  java: `// Welcome to Collaborative Code Editor!
public class Main {
    public static void main(String[] args) {
        greet("Collaborator");
    }

    static void greet(String name) {
        System.out.println("Hello, " + name + "!");
    }
}`,
  cpp: `// Welcome to Collaborative Code Editor!
#include <iostream>
#include <string>

void greet(const std::string& name) {
    std::cout << "Hello, " << name << "!" << std::endl;
}

int main() {
    greet("Collaborator");
    return 0;
}`,
  go: `// Welcome to Collaborative Code Editor!
package main

import "fmt"

func greet(name string) {
    fmt.Printf("Hello, %s!\\n", name)
}

func main() {
    greet("Collaborator")
}`,
  rust: `// Welcome to Collaborative Code Editor!
fn greet(name: &str) {
    println!("Hello, {}!", name);
}

fn main() {
    greet("Collaborator");
}`,
  html: `<!-- Welcome to Collaborative Code Editor! -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Collaborative Editor</title>
</head>
<body>
  <h1>Hello, Collaborator!</h1>
</body>
</html>`,
  css: `/* Welcome to Collaborative Code Editor! */
body {
  font-family: sans-serif;
  background: #1e1e1e;
  color: #d4d4d4;
}`,
  json: `{
  "welcome": "Collaborative Code Editor",
  "collaborators": ["You", "Friend"]
}`
};

const DEFAULT_CONTENT = WELCOME_BY_LANG.javascript;

export default function MonacoEditor({
  ws,
  userId,
  initialContent = '',
  language = 'javascript',
  onContentChange
}: EditorProps) {
  const editorRef = useRef<any>(null);
  const isApplyingRemote = useRef(false);
  const lastContentRef = useRef<string>(initialContent || DEFAULT_CONTENT);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Set the language on the model
    const model = editor.getModel();
    if (model) {
      monaco.editor.setModelLanguage(model, language);
    }

    const initial = initialContent || WELCOME_BY_LANG[language] || DEFAULT_CONTENT;
    editor.setValue(initial);
    lastContentRef.current = initial;

    // Send diffs
    editor.onDidChangeModelContent(() => {
      if (isApplyingRemote.current) return;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;

      const newContent = editor.getValue();
      const oldContent = lastContentRef.current;
      if (newContent === oldContent) return;

      const op = computeDiff(oldContent, newContent, userId);
      if (op) {
        ws.send(JSON.stringify({ type: 'operation', operation: op }));
      }

      lastContentRef.current = newContent;
      onContentChange?.(newContent);
    });

    // Cursor tracking
    editor.onDidChangeCursorPosition((e: any) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      const m = editor.getModel();
      if (!m) return;
      const position = m.getOffsetAt(e.position);
      ws.send(JSON.stringify({ type: 'cursor', position }));
    });
  };

  // Change Monaco language when the `language` prop changes
  useEffect(() => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;

    // Only update if different (avoid resetting on every render)
    if (model.getLanguageId() !== language) {
      // Access monaco via the editor's helper
      const monaco = (window as any).monaco;
      if (monaco) {
        monaco.editor.setModelLanguage(model, language);
      } else {
        // Fallback: use editor's setModelLanguage via the editor instance API
        try {
          (editorRef.current as any).setModel?.(model);
          // Alternative approach — Monaco bundles a helper
        } catch { /* ignore */ }
      }
    }
  }, [language]);

  // Handle incoming messages
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);

      if (data.type === 'operation' && data.userId !== userId && data.operation) {
        if (!editorRef.current) return;
        isApplyingRemote.current = true;

        const current = editorRef.current.getValue();
        const op = data.operation;
        let updated = current;

        if (op.type === 'insert') {
          updated = current.slice(0, op.position) + op.chars + current.slice(op.position);
        } else if (op.type === 'delete') {
          updated = current.slice(0, op.position) + current.slice(op.position + op.length);
        }

        editorRef.current.setValue(updated);
        lastContentRef.current = updated;
        onContentChange?.(updated);

        setTimeout(() => {
          isApplyingRemote.current = false;
        }, 50);
      }

      if (data.type === 'document_sync' && typeof data.content === 'string') {
        if (editorRef.current && editorRef.current.getValue() !== data.content) {
          isApplyingRemote.current = true;
          editorRef.current.setValue(data.content);
          lastContentRef.current = data.content;
          onContentChange?.(data.content);
          setTimeout(() => {
            isApplyingRemote.current = false;
          }, 50);
        }
      }

      // Language changed by someone else
      if (data.type === 'language_changed' && typeof data.language === 'string') {
        if (editorRef.current) {
          const model = editorRef.current.getModel();
          const monaco = (window as any).monaco;
          if (model && monaco) {
            monaco.editor.setModelLanguage(model, data.language);
          }
        }
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, userId, onContentChange]);

  return (
    <Editor
      height="100%"
      defaultLanguage={language}
      language={language}
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

function computeDiff(oldText: string, newText: string, clientId: string) {
  let start = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (start < minLen && oldText[start] === newText[start]) start++;

  let endOld = oldText.length;
  let endNew = newText.length;
  while (endOld > start && endNew > start && oldText[endOld - 1] === newText[endNew - 1]) {
    endOld--;
    endNew--;
  }

  const removedLength = endOld - start;
  const inserted = newText.slice(start, endNew);

  if (removedLength > 0 && inserted.length === 0) {
    return {
      type: 'delete' as const,
      position: start,
      length: removedLength,
      clientId,
      timestamp: Date.now(),
      version: 0
    };
  }

  if (inserted.length > 0) {
    return {
      type: 'insert' as const,
      position: start,
      chars: inserted,
      clientId,
      timestamp: Date.now(),
      version: 0
    };
  }

  return null;
}