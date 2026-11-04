import Link from 'next/link';
import { Mark } from './Wordmark';

/*
 * Footer as an editor status bar: one dense strip of segments, the way the
 * bottom of a code editor reports branch, position and encoding.
 */
const seg = 'flex items-center gap-1.5 px-3 py-1.5 whitespace-nowrap';

export default function StatusBarFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-panel font-mono text-[12px] text-muted">
      <div className="mx-auto flex max-w-6xl flex-wrap items-stretch justify-between">
        <div className="flex flex-wrap items-stretch">
          <Link href="/" className={`${seg} bg-teal/15 text-text hover:bg-teal/25`}>
            <Mark className="h-3.5 w-3.5" />
            collab-editor
          </Link>
          <span className={seg}>
            <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
            ready
          </span>
          <a href="https://github.com/Abhinav-836/collab-editor" className={`${seg} hover:bg-raised hover:text-text`}>
            source
          </a>
        </div>
        <div className="flex flex-wrap items-stretch">
          <span className={`${seg} hidden sm:flex`}>7 runnable languages</span>
          <span className={`${seg} hidden sm:flex`}>UTF-8</span>
          <span className={`${seg} hidden sm:flex`}>LF</span>
          <a href="https://github.com/Abhinav-836" className={`${seg} bg-amber font-semibold text-amber-ink hover:opacity-90`}>
            built by Abhinav Ashutosh
          </a>
        </div>
      </div>
    </footer>
  );
}