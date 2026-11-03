'use client';

import { useEffect, useRef, useState } from 'react';
import { AIModel, fetchModels, sendChat } from '@/lib/api';
import { track } from '@/lib/track';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  failed?: boolean;
}

interface AssistantPanelProps {
  getCode: () => string;
  language: string;
  /** Returns false if the editor can't accept the insert yet. */
  onInsertCode: (code: string) => boolean;
  onClose: () => void;
}

const DEFAULT_MODEL = 'gemma4:31b-cloud';
const FENCE_RE = /```[^\n`]*\r?\n([\s\S]*?)```/g;

/** Split a reply into prose and fenced code blocks. */
function splitReply(text: string): Array<{ kind: 'text' | 'code'; value: string }> {
  const parts: Array<{ kind: 'text' | 'code'; value: string }> = [];
  let last = 0;
  for (const m of text.matchAll(FENCE_RE)) {
    if (m.index! > last) parts.push({ kind: 'text', value: text.slice(last, m.index) });
    parts.push({ kind: 'code', value: m[1].replace(/\n$/, '') });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) });
  return parts;
}

const SUGGESTIONS = ['Explain what this file does', 'Find bugs in this code', 'Add comments to this function'];

export default function AssistantPanel({ getCode, language, onInsertCode, onClose }: AssistantPanelProps) {
  const [models, setModels] = useState<AIModel[]>([]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(1);

  useEffect(() => {
    fetchModels().then((list) => {
      if (!list.length) return;
      setModels(list);
      setModel((current) => (list.some((m) => m.name === current) ? current : list[0].name));
    });
    inputRef.current?.focus();
  }, []);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [messages, busy]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2200);
  };

  const send = async (text = input.trim()) => {
    if (!text || busy) return;
    const history = messages.filter((m) => !m.failed).slice(-5).map(({ role, content }) => ({ role, content }));
    setMessages((prev) => [...prev, { id: nextId.current++, role: 'user', content: text }]);
    setInput('');
    setBusy(true);
    track('ai_message', { model });
    try {
      const reply = await sendChat({ message: text, code: getCode(), language, model, history });
      setMessages((prev) => [...prev, { id: nextId.current++, role: 'assistant', content: reply || 'The assistant returned an empty reply.' }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId.current++,
          role: 'assistant',
          failed: true,
          content: "The assistant couldn't be reached. The AI service may be down — try again in a minute."
        }
      ]);
    } finally {
      setBusy(false);
    }
  };

  const insert = async (code: string) => {
    if (onInsertCode(code)) return flash('Inserted at your cursor.');
    try {
      await navigator.clipboard.writeText(code);
      flash('The editor is still syncing, so the code was copied instead.');
    } catch {
      flash("Couldn't insert or copy the code.");
    }
  };

  return (
    <aside aria-label="AI assistant" className="flex h-full min-h-0 w-full flex-col border-l border-line bg-panel">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold">Assistant</h2>
        <label htmlFor="ai-model" className="sr-only">
          Model
        </label>
        <select id="ai-model" className="select ml-auto max-w-[11rem]" value={model} onChange={(e) => setModel(e.target.value)}>
          {(models.length ? models : [{ id: DEFAULT_MODEL, name: DEFAULT_MODEL }]).map((m) => (
            <option key={m.id} value={m.name}>
              {m.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={onClose} aria-label="Close assistant" className="px-1 text-lg leading-none text-muted hover:text-text">
          ×
        </button>
      </div>

      {notice && (
        <p role="status" className="border-b border-line bg-ok/15 px-4 py-1.5 text-xs text-ok">
          {notice}
        </p>
      )}

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 text-sm">
        {messages.length === 0 && (
          <div>
            <p className="text-muted">Ask about the file that&rsquo;s open. The assistant sees its current contents.</p>
            <ul className="mt-4 space-y-2">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => void send(s)}
                    className="w-full rounded-lg border border-line px-3 py-2 text-left text-text hover:border-muted"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="ml-8 rounded-lg bg-raised px-3 py-2 whitespace-pre-wrap break-words">
              {m.content}
            </div>
          ) : (
            <div key={m.id} className={`space-y-3 ${m.failed ? 'text-danger' : 'text-text'}`}>
              {splitReply(m.content).map((part, i) =>
                part.kind === 'text' ? (
                  part.value.trim() && (
                    <p key={i} className="whitespace-pre-wrap break-words leading-relaxed">
                      {part.value.trim()}
                    </p>
                  )
                ) : (
                  <div key={i} className="overflow-hidden rounded-lg border border-line">
                    <pre className="max-h-72 overflow-auto bg-editor px-3 py-2.5 font-mono text-xs leading-relaxed">{part.value}</pre>
                    <div className="flex justify-end gap-1 border-t border-line bg-editor px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(part.value).then(() => flash('Copied.'))}
                        className="rounded px-2 py-1 text-xs text-muted hover:text-text"
                      >
                        Copy
                      </button>
                      <button
                        type="button"
                        onClick={() => void insert(part.value)}
                        className="rounded bg-amber px-2 py-1 text-xs font-medium text-amber-ink hover:opacity-90"
                      >
                        Insert at cursor
                      </button>
                    </div>
                  </div>
                )
              )}
            </div>
          )
        )}
        {busy && <p className="text-muted">Thinking…</p>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="border-t border-line p-3"
      >
        <label htmlFor="ai-input" className="sr-only">
          Message the assistant
        </label>
        <textarea
          id="ai-input"
          ref={inputRef}
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder="Ask about this code. Shift+Enter for a new line."
          className="field resize-none text-sm"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-md bg-amber px-3.5 py-1.5 text-sm font-semibold text-amber-ink hover:opacity-90 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </aside>
  );
}