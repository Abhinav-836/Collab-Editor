import Link from 'next/link';
import type { ReactNode } from 'react';
import Wordmark from '@/components/Wordmark';
import StatusBarFooter from '@/components/StatusBarFooter';

export const CONTACT = 'ashutoshabhinavbachra0009@gmail.com';
export const UPDATED = '10 November 2026';

/** Shared layout for the privacy policy and terms of service. */
export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <Wordmark />
        <h1 className="mt-12 text-4xl font-semibold">{title}</h1>
        <p className="mt-2 font-mono text-[12px] text-muted">last updated {UPDATED}</p>
        <article className="mt-8 leading-relaxed text-muted [&_a]:text-teal [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-text [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_strong]:text-text [&_ul]:mt-3 [&_ul]:space-y-1.5">
          {children}
        </article>
        <p className="mb-12 mt-12 flex gap-5 text-sm">
          <Link href="/" className="text-teal hover:underline">Home</Link>
          <Link href="/privacy" className="text-teal hover:underline">Privacy</Link>
          <Link href="/terms" className="text-teal hover:underline">Terms</Link>
        </p>
      </div>
      <StatusBarFooter />
    </div>
  );
}
