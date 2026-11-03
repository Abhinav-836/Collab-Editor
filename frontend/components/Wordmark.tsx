import Link from 'next/link';

/** Two carets side by side — you and a collaborator. */
export function Mark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <rect x="5" y="2" width="2.5" height="16" rx="1.25" fill="var(--amber)" />
      <rect x="12.5" y="2" width="2.5" height="16" rx="1.25" fill="var(--teal)" />
    </svg>
  );
}

export default function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-text">
      <Mark />
      <span className={compact ? 'hidden sm:inline' : ''}>Collab Editor</span>
    </Link>
  );
}