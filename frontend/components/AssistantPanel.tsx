'use client';

import { useEffect, useRef, useState } from 'react';
import { AIModel, ApiError, NETWORK_ERROR, explainCode, fetchModels, sendChat, suggestImprovements } from '@/lib/api';
import { track } from '@/lib/track';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  failed?: boolean;
}

interface AssistantPanelProps {
  getCode: () => string;
  /** Text the user has selected in the editor ('' if none). */
  getSelection: () => string;
  language: string;
  /** Returns false if the editor can't accept the insert yet. */
  onInsertCode: (code: string) => boolean;
  onClose: () => void;
}

const DEFAULT_MODEL = 'gemma4:31b-cloud';
const FENCE_RE = /(`{3,})[^\n`]*\r?\n([\s\S]*?)\1/g;
const TRUNCATED_NOTE = '\n\n(The file is very long, so only the first part was sent to the assistant.)';

/** Split a reply into prose and fenced code blocks. */
function splitReply(text: string): Array<{ kind: 'text' | 'code'; value: string }> {
  const parts: Array<{ kind: 'text' | 'code'; value: string }> = [];
  let last = 0;
  for (const m of text.matchAll(FENCE_RE)) {
    if (m.index! > last) parts.push({ kind: 'text', value: text.slice(last, m.index) });
    parts.push({ kind: 'code', value: m[2].replace(/\n$/, '') });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', value: text.slice(last) });
  return parts;
}

/** A readable message for any failed request. */
function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return NETWORK_ERROR;
}

const lineCount = (text: string) => text.split('\n').length;

const CHAT_STARTERS = ['Find bugs in this code', 'Add comments to this function', 'Write tests for this code'];

export default function AssistantPanel({ getCode, getSelection, language, onInsertCode, onClose }: AssistantPanelProps) {
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2200);
  };

  const addMessage = (role: Message['role'], content: string, failed = false) =>
    setMessages((prev) => [...prev, { id: nextId.current++, role, content, failed }]);

  /**
   * Shared flow for chat, explain and suggest: show what the user asked for,
   * run the request, then show the reply — or the real error, never a
   * made-up answer.
   */
  const ask = async (label: string, request: () => Promise<string>) => {
    if (busy) return;
    addMessage('user', label);
    setBusy(true);
    try {
      const reply = await request();
      addMessage('assistant', reply.trim() || 'The assistant returned an empty reply.');
    } catch (err) {
      addMessage('assistant', errorText(err), true);
    } finally {
      setBusy(false);
    }
  };

  const send = (text = input.trim()) => {
    if (!text || busy) return;
    // History is taken before this message is added, so it isn't sent twice
    const history = messages.filter((m) => !m.failed).slice(-5).map(({ role, content }) => ({ role, content }));
    setInput('');
    track('ai_message', { model });
    void ask(text, () => sendChat({ message: text, code: getCode(), language, model, history }));
  };

  const explain = () => {
    const code = getCode();
    if (!code.trim()) return flash('The file is empty. Write some code first.');
    const selection = getSelection();
    const hasSelection = selection.trim().length > 0;
    const label = hasSelection
      ? `Explain the selected code (${lineCount(selection)} line${lineCount(selection) === 1 ? '' : 's'})`
      : 'Explain this file';
    track('ai_explain', { model, scope: hasSelection ? 'selection' : 'file' });
    void ask(label, async () => {
      const result = await explainCode({ code, selection: hasSelection ? selection : '', language, model });
      return result.text + (result.truncated ? TRUNCATED_NOTE : '');
    });
  };

  const suggest = () => {
    const code = getCode();
    if (!code.trim()) return flash('The file is empty. Write some code first.');
    track('ai_suggest', { model });
    void ask('Suggest improvements for this file', async () => {
      const result = await suggestImprovements({ code, language, model });
      return result.text + (result.truncated ? TRUNCATED_NOTE : '');
    });
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

  const actionBtn =
    'flex-1 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-text hover:border-muted disabled:cursor-not-allowed disabled:opacity-40';

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
            <p className="text-muted">
              Ask about the file that&rsquo;s open. The assistant sees its current contents. Select some code first and
              <span className="text-text"> Explain</span> will explain just that part.
            </p>
            <p className="mt-2 text-xs text-muted">
              Your code and questions are sent to an AI model hosted by Ollama. Don&rsquo;t include passwords or keys.
            </p>
            <ul className="mt-4 space-y-2">
              {CHAT_STARTERS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => send(s)}
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
          send();
        }}
        className="border-t border-line p-3"
      >
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={explain}
            disabled={busy}
            title="Explains the code you've selected, or the whole file if nothing is selected"
            className={actionBtn}
          >
            Explain
          </button>
          <button
            type="button"
            onClick={suggest}
            disabled={busy}
            title="Reviews the whole file and suggests up to 5 concrete fixes"
            className={actionBtn}
          >
            Suggest improvements
          </button>
        </div>
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
              send();
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