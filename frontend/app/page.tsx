import { Suspense } from 'react';
import LiveDemo from '@/components/LiveDemo';
import StartPanel from '@/components/StartPanel';
import Wordmark from '@/components/Wordmark';

const FEATURES = [
  {
    title: 'Everyone types at once',
    body: 'Edits merge as you make them, and each person’s cursor and selection show up in their own colour with their name.'
  },
  {
    title: 'Run it right there',
    body: 'JavaScript, TypeScript, Python, Java, C++, Go and Rust run on the server. Add input for programs that read from stdin.'
  },
  {
    title: 'Ask the assistant',
    body: 'The AI panel reads the current file, answers questions about it and drops suggested code straight in at your cursor.'
  },
  {
    title: 'Lock a room',
    body: 'Add a password when you create a room. Nobody needs an account, and the link is all you share.'
  }
];

export default function HomePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Wordmark />
        <a
          href="https://github.com/Abhinav-836/collab-editor"
          className="text-sm text-muted underline-offset-4 hover:text-text hover:underline"
        >
          Source on GitHub
        </a>
      </header>

      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-16 pt-8 sm:px-6 md:pt-14 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start lg:gap-14">
          <div>
            <h1 className="text-4xl font-semibold sm:text-5xl">Write code together, in the same file, at the same time.</h1>
            <p className="mt-4 max-w-[46ch] text-lg text-muted">
              Open a room, send the link, and start typing. No accounts, no installs.
            </p>
            <div className="mt-8">
              <Suspense fallback={<div className="h-96 rounded-xl border border-line bg-panel" />}>
                <StartPanel />
              </Suspense>
            </div>
          </div>
          <div className="lg:pt-24">
            <LiveDemo />
          </div>
        </section>

        <section aria-labelledby="features" className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <h2 id="features" className="sr-only">
              What you get in a room
            </h2>
            <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div key={f.title}>
                  <dt className="font-semibold">{f.title}</dt>
                  <dd className="mt-2 text-sm text-muted">{f.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-faint sm:px-6">
          Built by{' '}
          <a href="https://github.com/Abhinav-836" className="text-muted hover:text-text">
            Abhinav Ashutosh
          </a>
          .
        </div>
      </footer>
    </div>
  );
}