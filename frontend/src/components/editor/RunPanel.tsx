import { useCallback, useEffect, useRef, useState } from 'react';
import { getLanguage } from '../../constants/languages';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/+$/, '');

export const RUN_PANEL_HEIGHT = 240;

interface RunResult {
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  compileOutput: string;
  compiler: string;
  durationMs: number;
}

interface RunPanelProps {
  getCode: () => string;
  language: string;
  /** Increment to trigger a run (e.g. from the header's ▶ Run button). */
  runRequest: number;
  onClose: () => void;
}

export default function RunPanel({ getCode, language, runRequest, onClose }: RunPanelProps) {
  const [stdin, setStdin] = useState('');
  const [showStdin, setShowStdin] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);

  const lang = getLanguage(language);

  const run = useCallback(async () => {
    if (!lang.runnable) {
      setResult(null);
      setError(`${lang.name} can't be run — only JavaScript, TypeScript, Python, Java, C++, Go and Rust.`);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: lang.id, code: getCode(), stdin }),
        signal: controller.signal
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `Run failed (HTTP ${res.status})`);
      setResult(data.result);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message || 'Run failed');
    } finally {
      if (abortRef.current === controller) setRunning(false);
    }
  }, [getCode, lang, stdin]);

  // Run whenever the header button is pressed
  const lastRequest = useRef(0);
  useEffect(() => {
    if (runRequest > lastRequest.current) {
      lastRequest.current = runRequest;
      void run();
    }
  }, [runRequest, run]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    outputRef.current?.scrollTo({ top: 0 });
  }, [result]);

  const ok = result && result.exitCode === 0 && !result.signal;

  return (
    <div
      style={{
        height: RUN_PANEL_HEIGHT,
        borderTop: '1px solid #3e3e42',
        background: '#1b1b1c',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 12px',
          background: '#252526',
          borderBottom: '1px solid #3e3e42',
          fontSize: 12,
          flexWrap: 'wrap'
        }}
      >
        <strong style={{ color: '#d4d4d4' }}>Output</strong>
        <button
          onClick={() => void run()}
          disabled={running}
          style={{
            padding: '3px 10px',
            background: running ? '#555' : '#2e7d32',
            border: 'none',
            borderRadius: 4,
            color: 'white',
            cursor: running ? 'wait' : 'pointer',
            fontSize: 11
          }}
        >
          {running ? '⏳ Running…' : '▶ Run again'}
        </button>
        <button
          onClick={() => setShowStdin((v) => !v)}
          style={{
            padding: '3px 10px',
            background: showStdin ? '#0e639c' : '#3c3c3c',
            border: 'none',
            borderRadius: 4,
            color: 'white',
            cursor: 'pointer',
            fontSize: 11
          }}
          title="Text passed to the program's standard input"
        >
          ⌨ Input (stdin)
        </button>
        {result && (
          <span style={{ color: ok ? '#4ECDC4' : '#f48771' }}>
            {result.signal ? `Killed (${result.signal})` : `Exit code ${result.exitCode ?? '?'}`} ·{' '}
            {(result.durationMs / 1000).toFixed(1)}s · {result.compiler}
          </span>
        )}
        <span style={{ color: '#666' }}>Only you see this output</span>
        <button
          onClick={onClose}
          title="Close output"
          style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 16 }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {showStdin && (
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="Program input, one value per line…"
            style={{
              width: 220,
              resize: 'none',
              background: '#1e1e1e',
              color: '#d4d4d4',
              border: 'none',
              borderRight: '1px solid #3e3e42',
              padding: 8,
              fontFamily: 'Consolas, "Courier New", monospace',
              fontSize: 12,
              outline: 'none'
            }}
          />
        )}
        <pre
          ref={outputRef}
          data-testid="run-output"
          style={{
            flex: 1,
            margin: 0,
            padding: '8px 12px 8px 12px',
            paddingRight: 90, // keep clear of the floating AI chat button
            overflow: 'auto',
            fontFamily: 'Consolas, "Courier New", monospace',
            fontSize: 12.5,
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            color: '#d4d4d4'
          }}
        >
          {running && <span style={{ color: '#888' }}>Running your code…</span>}
          {error && <span style={{ color: '#f48771' }}>{error}</span>}
          {result && (
            <>
              {result.compileOutput && <span style={{ color: '#FFEAA7' }}>{result.compileOutput}</span>}
              {result.stdout}
              {result.stderr && <span style={{ color: '#f48771' }}>{result.stderr}</span>}
              {!result.stdout && !result.stderr && !result.compileOutput && (
                <span style={{ color: '#666' }}>(no output)</span>
              )}
            </>
          )}
          {!running && !error && !result && <span style={{ color: '#666' }}>Press ▶ Run to execute the code.</span>}
        </pre>
      </div>
    </div>
  );
}