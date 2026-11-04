'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getLanguage } from '@/lib/languages';
import { runCode, RunResult } from '@/lib/api';
import { track } from '@/lib/track';

interface RunPanelProps {
  getCode: () => string;
  language: string;
  /** Increment to trigger a run (from the toolbar's Run button). */
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
      setError(`${lang.name} can't be run. Switch to JavaScript, TypeScript, Python, Java, C++, Go or Rust.`);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const res = await runCode({ language: lang.id, code: getCode(), stdin }, controller.signal);
      setResult(res);
      track('code_run', { language: lang.id, ok: res.exitCode === 0 });
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message || 'The run failed.');
    } finally {
      if (abortRef.current === controller) setRunning(false);
    }
  }, [getCode, lang, stdin]);

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
    <section aria-label="Program output" className="flex h-60 min-h-0 shrink-0 flex-col border-t border-line bg-editor">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-panel px-3 py-1.5 text-xs">
        <span className="font-semibold text-text">Output</span>
        <button
          type="button"
          onClick={() => void run()}
          disabled={running}
          className="rounded-md bg-raised px-2.5 py-1 text-text hover:bg-line disabled:cursor-wait disabled:opacity-60"
        >
          {running ? 'Running…' : 'Run again'}
        </button>
        <button
          type="button"
          aria-pressed={showStdin}
          onClick={() => setShowStdin((v) => !v)}
          className={`rounded-md px-2.5 py-1 ${showStdin ? 'bg-amber text-amber-ink' : 'bg-raised text-text hover:bg-line'}`}
        >
          Program input
        </button>
        {result && (
          <span className={ok ? 'text-ok' : 'text-danger'}>
            {result.signal ? `Stopped (${result.signal})` : `Exit ${result.exitCode ?? '?'}`}, {(result.durationMs / 1000).toFixed(1)}s,{' '}
            {result.compiler}
          </span>
        )}
        <span className="hidden text-faint sm:inline">Only you see this output</span>
        <button type="button" onClick={onClose} aria-label="Close output" className="ml-auto px-1 text-base leading-none text-muted hover:text-text">
          ×
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {showStdin && (
          <textarea
            aria-label="Program input (stdin)"
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            placeholder="One value per line"
            className="w-56 resize-none border-r border-line bg-editor p-3 font-mono text-xs text-text outline-none placeholder:text-faint"
          />
        )}
        <pre
          ref={outputRef}
          aria-live="polite"
          className="flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[12.5px] leading-relaxed text-text"
        >
          {running && <span className="text-muted">Running…</span>}
          {error && <span className="text-danger">{error}</span>}
          {result && (
            <>
              {result.compileOutput && <span className="text-amber">{result.compileOutput}</span>}
              {result.stdout}
              {result.stderr && <span className="text-danger">{result.stderr}</span>}
              {!result.stdout && !result.stderr && !result.compileOutput && <span className="text-faint">The program printed nothing.</span>}
            </>
          )}
        </pre>
      </div>
    </section>
  );
}