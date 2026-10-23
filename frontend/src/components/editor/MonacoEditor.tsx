import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { TextOperation } from '../../ot/textOperation';
import { OTClient } from '../../ot/otClient';
import { CollabSocket, ConnectionStatus } from '../../services/websocketService';
import { getUserColor } from '../../utils/userColor';

type MonacoEditorInstance = Parameters<OnMount>[0];
type MonacoApi = Parameters<OnMount>[1];

export interface EditorHandle {
  /** Current editor text ('' before the editor has loaded). */
  getValue: () => string;
  /** Insert text at the cursor (replacing the selection). Returns false if not synced yet. */
  insertText: (text: string) => boolean;
}

interface EditorProps {
  socket: CollabSocket;
  userId: string;
  language?: string;
  users: Array<{ userId: string; userName: string }>;
}

interface RemoteCursor {
  position: number;
  selectionEnd: number;
}

const CURSOR_SEND_INTERVAL_MS = 50;

const MonacoEditor = forwardRef<EditorHandle, EditorProps>(function MonacoEditor(
  { socket, userId, language = 'javascript', users },
  ref
) {
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  const otRef = useRef<OTClient | null>(null);
  const applyingRemoteRef = useRef(false);
  const pendingSyncRef = useRef<any>(null);
  const remoteCursorsRef = useRef<Map<string, RemoteCursor>>(new Map());
  const decorationIdsRef = useRef<string[]>([]);
  const usersRef = useRef(users);
  const styleElRef = useRef<HTMLStyleElement | null>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [synced, setSynced] = useState(false);

  usersRef.current = users;

  // ---------- helpers ----------

  /** Lock the editor until the next document_sync arrives. */
  const markUnsynced = () => {
    otRef.current = null;
    setSynced(false);
  };

  const requestDocument = useCallback(() => {
    socket.send('get_document');
  }, [socket]);

  /** Apply a full server snapshot (initial load, reconnect or recovery). */
  const applySync = useCallback(
    (data: { content: string; revision: number }) => {
      const editor = editorRef.current;
      const monaco = monacoRef.current;
      if (!editor || !monaco) {
        pendingSyncRef.current = data; // editor still loading — apply on mount
        return;
      }
      const model = editor.getModel();
      if (!model) return;

      if (model.getValue() !== data.content) {
        const selection = editor.getSelection();
        applyingRemoteRef.current = true;
        try {
          model.setValue(data.content);
          model.setEOL(monaco.editor.EndOfLineSequence.LF);
        } finally {
          applyingRemoteRef.current = false;
        }
        if (selection) editor.setSelection(model.validateRange(selection));
      }

      otRef.current = new OTClient(
        data.revision,
        (revision, op) => socket.send('operation', { revision, operation: op.toJSON() }),
        (op) => applyRemoteOperation(op)
      );
      setSynced(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [socket]
  );

  /** Turn a remote TextOperation into Monaco edits on the current model. */
  const applyRemoteOperation = (op: TextOperation) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;

    if (op.baseLength !== model.getValueLength()) {
      console.warn('Local document out of sync — resyncing');
      markUnsynced();
      requestDocument();
      return;
    }

    const edits: Array<{ range: any; text: string }> = [];
    let index = 0;
    let pendingInsert: string | null = null;

    const pos = (offset: number) => model.getPositionAt(offset);
    const flushInsert = () => {
      if (pendingInsert === null) return;
      const p = pos(index);
      edits.push({ range: new monaco.Range(p.lineNumber, p.column, p.lineNumber, p.column), text: pendingInsert });
      pendingInsert = null;
    };

    for (const component of op.ops) {
      if (typeof component === 'string') {
        pendingInsert = (pendingInsert ?? '') + component;
      } else if (component > 0) {
        flushInsert();
        index += component;
      } else {
        // An insert directly followed by a delete becomes one replace edit,
        // so Monaco never sees two edits touching the same point.
        const start = pos(index);
        const end = pos(index - component);
        edits.push({
          range: new monaco.Range(start.lineNumber, start.column, end.lineNumber, end.column),
          text: pendingInsert ?? ''
        });
        pendingInsert = null;
        index -= component;
      }
    }
    flushInsert();

    applyingRemoteRef.current = true;
    try {
      model.pushStackElement();
      model.pushEditOperations([], edits, () => null);
      model.pushStackElement();
    } finally {
      applyingRemoteRef.current = false;
    }

    if (model.getValueLength() !== op.targetLength) {
      console.warn('Remote edit produced unexpected length — resyncing');
      markUnsynced();
      requestDocument();
    }
  };

  // ---------- remote cursors ----------

  const renderRemoteCursors = useCallback(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;

    const names = new Map(usersRef.current.map((u) => [u.userId, u.userName]));
    const len = model.getValueLength();
    const decorations: any[] = [];
    let css = '';

    for (const [uid, cursor] of remoteCursorsRef.current) {
      if (!names.has(uid) || uid === userId) continue;
      const key = uid.replace(/[^A-Za-z0-9_-]/g, '');
      const color = getUserColor(uid);
      const name = (names.get(uid) || 'User').replace(/[\\"]/g, '\\$&').replace(/[\n\r]/g, ' ');
      const head = Math.max(0, Math.min(len, cursor.position));
      const anchor = Math.max(0, Math.min(len, cursor.selectionEnd));

      css += `.rc-caret-${key}{border-left:2px solid ${color};margin-left:-1px;}`;
      css += `.rc-caret-${key}::after{content:"${name}";position:absolute;transform:translateY(-100%);background:${color};color:#1e1e1e;font-size:10px;line-height:14px;padding:0 4px;border-radius:3px 3px 3px 0;white-space:nowrap;pointer-events:none;z-index:5;font-family:sans-serif;}`;
      css += `.rc-sel-${key}{background:${color}40;}`;

      const p = model.getPositionAt(head);
      decorations.push({
        range: new monaco.Range(p.lineNumber, p.column, p.lineNumber, p.column),
        options: {
          beforeContentClassName: `rc-caret-${key}`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          hoverMessage: { value: names.get(uid) || 'User' }
        }
      });
      if (anchor !== head) {
        const a = model.getPositionAt(Math.min(anchor, head));
        const b = model.getPositionAt(Math.max(anchor, head));
        decorations.push({
          range: new monaco.Range(a.lineNumber, a.column, b.lineNumber, b.column),
          options: {
            className: `rc-sel-${key}`,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
          }
        });
      }
    }

    if (!styleElRef.current) {
      styleElRef.current = document.createElement('style');
      document.head.appendChild(styleElRef.current);
    }
    styleElRef.current.textContent = css;
    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, decorations);
  }, [userId]);

  const sendCursor = () => {
    if (cursorTimerRef.current) return;
    cursorTimerRef.current = setTimeout(() => {
      cursorTimerRef.current = null;
      const editor = editorRef.current;
      const model = editor?.getModel();
      const selection = editor?.getSelection();
      if (!model || !selection || !otRef.current) return;
      // Monaco: "position" is the caret (head), "selectionStart" is the anchor
      socket.send('cursor', {
        position: model.getOffsetAt({ lineNumber: selection.positionLineNumber, column: selection.positionColumn }),
        selectionEnd: model.getOffsetAt({
          lineNumber: selection.selectionStartLineNumber,
          column: selection.selectionStartColumn
        })
      });
    }, CURSOR_SEND_INTERVAL_MS);
  };

  // ---------- mount ----------

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    const model = editor.getModel();
    model?.setEOL(monaco.editor.EndOfLineSequence.LF);
    // trimAutoWhitespace makes Monaco silently add extra deletions to ANY edit
    // (including remote ones) that touches a line with auto-inserted indentation.
    // Those hidden edits would never reach the server → documents drift apart.
    model?.updateOptions({ trimAutoWhitespace: false });

    // Listen on the MODEL, not the editor: editor.onDidChangeModelContent can be
    // delivered after pushEditOperations returns, i.e. after applyingRemoteRef was
    // reset — the remote edit would then be echoed back as if we had typed it.
    // model.onDidChangeContent fires synchronously inside the edit call.
    let contentListener: { dispose: () => void } | null = null;
    const bindModel = () => {
      contentListener?.dispose();
      const m = editor.getModel();
      if (m) contentListener = m.onDidChangeContent((event) => onLocalChange(event, m));
    };

    const onLocalChange = (event: any, m: NonNullable<ReturnType<typeof editor.getModel>>) => {
      if (applyingRemoteRef.current) return;
      const ot = otRef.current;
      if (!ot) return;

      // Monaco reports every change with offsets into the pre-change document.
      const changes = [...event.changes].sort((a, b) => a.rangeOffset - b.rangeOffset);
      const delta = changes.reduce((sum, c) => sum + c.text.length - c.rangeLength, 0);
      const oldLength = m.getValueLength() - delta;

      const op = new TextOperation();
      let cursor = 0;
      for (const c of changes) {
        op.retain(c.rangeOffset - cursor);
        op.delete(c.rangeLength);
        op.insert(c.text);
        cursor = c.rangeOffset + c.rangeLength;
      }
      op.retain(oldLength - cursor);
      ot.applyClient(op);
    };

    bindModel();
    editor.onDidChangeModel(bindModel);
    editor.onDidDispose(() => contentListener?.dispose());
    editor.onDidChangeCursorSelection(() => sendCursor());

    if (pendingSyncRef.current) {
      const data = pendingSyncRef.current;
      pendingSyncRef.current = null;
      applySync(data);
    } else {
      requestDocument();
    }
  };

  // ---------- socket wiring ----------

  useEffect(() => {
    const offs = [
      socket.on('document_sync', (data) => {
        if (typeof data.content !== 'string' || typeof data.revision !== 'number') return;
        if (data.resync) console.warn('Server requested resync');
        applySync(data);
      }),
      socket.on('ack', () => otRef.current?.serverAck()),
      socket.on('operation', (data) => {
        if (data.userId === userId || !otRef.current) return;
        try {
          otRef.current.applyServer(TextOperation.fromJSON(data.operation));
        } catch (err) {
          console.error('Failed to apply remote operation, resyncing:', err);
          markUnsynced();
          requestDocument();
        }
      }),
      socket.on('cursor_update', (data) => {
        if (typeof data.position !== 'number') return;
        const ot = otRef.current;
        remoteCursorsRef.current.set(data.userId, {
          position: ot ? ot.transformIndex(data.position) : data.position,
          selectionEnd: ot ? ot.transformIndex(data.selectionEnd ?? data.position) : data.selectionEnd ?? data.position
        });
        renderRemoteCursors();
      }),
      socket.onStatus((status: ConnectionStatus) => {
        if (status === 'open') {
          requestDocument();
        } else {
          // Lock the editor while offline; we resync from the server on reconnect.
          markUnsynced();
        }
      })
    ];
    if (socket.isOpen && editorRef.current) requestDocument();
    return () => offs.forEach((off) => off());
  }, [socket, userId, applySync, renderRemoteCursors, requestDocument]);

  // Drop cursors of users who left
  useEffect(() => {
    const present = new Set(users.map((u) => u.userId));
    for (const uid of remoteCursorsRef.current.keys()) {
      if (!present.has(uid)) remoteCursorsRef.current.delete(uid);
    }
    renderRemoteCursors();
  }, [users, renderRemoteCursors]);

  useEffect(
    () => () => {
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
      styleElRef.current?.remove();
    },
    []
  );

  // Must be memoized: @monaco-editor/react re-applies `options` whenever the object changes.
  const options = useMemo(
    () => ({
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      wordWrap: 'on' as const,
      tabSize: 2,
      trimAutoWhitespace: false,
      readOnly: !synced
    }),
    [synced]
  );

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => editorRef.current?.getValue() ?? '',
      insertText: (text: string) => {
        const editor = editorRef.current;
        const selection = editor?.getSelection();
        if (!editor || !selection || !otRef.current) return false;
        editor.executeEdits('ai-assistant', [{ range: selection, text, forceMoveMarkers: true }]);
        editor.pushUndoStop();
        editor.focus();
        return true;
      }
    }),
    []
  );

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <Editor
        height="100%"
        language={language}
        theme="vs-dark"
        onMount={handleEditorDidMount}
        loading={<div style={{ color: '#888', padding: 20 }}>Loading editor…</div>}
        options={options}
      />
      {!synced && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 16,
            background: 'rgba(37,37,38,0.95)',
            border: '1px solid #3e3e42',
            color: '#d4d4d4',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 12,
            zIndex: 10,
            pointerEvents: 'none'
          }}
        >
          ⏳ Syncing document… (read-only)
        </div>
      )}
    </div>
  );
});

export default MonacoEditor;