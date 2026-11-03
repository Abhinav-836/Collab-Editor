import Link from 'next/link';
import Wordmark from '@/components/Wordmark';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-6 sm:px-6">
      <Wordmark />
      <div className="my-auto py-16">
        <h1 className="text-4xl font-semibold">Nothing at this address</h1>
        <p className="mt-3 text-muted">
          Room links look like <code className="font-mono text-text">/room/k3x9q2ab</code>. Check the link you were sent, or start a new room.
        </p>
        <Link href="/" className="mt-8 inline-block rounded-lg bg-amber px-4 py-2.5 font-semibold text-amber-ink hover:opacity-90">
          Start a room
        </Link>
      </div>
    </div>
  );
}