'use client';

import { useEffect, useState } from 'react';

const BASE = [
  'function median(values) {',
  '  const sorted = [...values].sort((a, b) => a - b);',
  '  const mid = Math.floor(sorted.length / 2);',
  '',
  '}',
  '',
  ''
];

// Two people typing on different lines of the same file.
const TYPISTS = [
  { name: 'Meera', color: 'var(--teal)', line: 3, text: '  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;' },
  { name: 'You', color: 'var(--amber)', line: 6, text: 'console.log(median([7, 1, 4, 9])); // 5.5' }
];

const KEYWORDS = /\b(function|const|return|console|Math)\b/g;

function Highlight({ text }: { text: string }) {
  if (text.includes('//')) {
    const i = text.indexOf('//');
    return (
      <>
        <Highlight text={text.slice(0, i)} />
        <span className="text-faint">{text.slice(i)}</span>
      </>
    );
  }
  const parts = text.split(KEYWORDS);
  return (
    <>
      {parts.map((p, i) =>
        p.match(/^(function|const|return|console|Math)$/) ? (
          <span key={i} className="text-[#8fb4ff]">
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

export default function LiveDemo() {
  const [progress, setProgress] = useState([0, 0]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(TYPISTS.map((t) => t.text.length));
      return;
    }
    let hold = 0;
    const id = setInterval(() => {
      setProgress((prev) => {
        const done = prev.every((p, i) => p >= TYPISTS[i].text.length);
        if (done) {
          hold += 1;
          if (hold > 40) {
            hold = 0;
            return [0, 0];
          }
          return prev;
        }
        // Meera starts first; you join a moment later, then both type at once.
        return prev.map((p, i) => {
          const max = TYPISTS[i].text.length;
          if (p >= max) return p;
          if (i === 1 && prev[0] < 18) return p;
          return Math.random() < 0.75 ? p + 1 : p;
        });
      });
    }, 55);
    return () => clearInterval(id);
  }, []);

  const lines = BASE.map((l, idx) => {
    const t = TYPISTS.findIndex((ty) => ty.line === idx);
    return t === -1 ? { text: l, typist: -1 } : { text: TYPISTS[t].text.slice(0, progress[t]), typist: t };
  });

  return (
    <figure className="overflow-hidden rounded-xl border border-line bg-editor shadow-2xl shadow-black/40" aria-label="Two people editing the same file">
      <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-2.5 text-xs text-muted">
        <span className="font-mono">median.js</span>
        <span className="flex items-center gap-3">
          {TYPISTS.map((t) => (
            <span key={t.name} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
              {t.name}
            </span>
          ))}
        </span>
      </div>
      <pre className="overflow-x-auto py-4 font-mono text-[12.5px] leading-6 sm:text-[13px]" aria-hidden="true">
        {lines.map((l, i) => (
          <div key={i} className="flex">
            <span className="w-10 shrink-0 select-none pr-4 text-right text-faint">{i + 1}</span>
            <span className="relative whitespace-pre pr-6 text-text">
              <Highlight text={l.text} />
              {l.typist !== -1 && (
                <span className="relative inline-block h-5 w-0 align-middle">
                  <span className="caret-blink absolute -left-px top-0 h-5 w-0.5" style={{ background: TYPISTS[l.typist].color }} />
                  <span
                    className="absolute -top-4 left-0 whitespace-nowrap rounded-sm px-1 font-sans text-[10px] font-medium leading-4 text-bg"
                    style={{ background: TYPISTS[l.typist].color }}
                  >
                    {TYPISTS[l.typist].name}
                  </span>
                </span>
              )}
            </span>
          </div>
        ))}
      </pre>
      <figcaption className="sr-only">Meera writes the function body while you add a test line below it.</figcaption>
    </figure>
  );
}