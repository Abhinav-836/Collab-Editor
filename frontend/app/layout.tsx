import '@fontsource-variable/schibsted-grotesk';
import '@fontsource-variable/fira-code';
import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Collab Editor — write code together in real time',
    template: '%s · Collab Editor'
  },
  description:
    'Open a room, share the link and edit the same file live. Run code in 7 languages, ask the AI assistant, and lock rooms with a password. No sign-up.',
  openGraph: {
    title: 'Collab Editor',
    description: 'Write code together, in the same file, at the same time.',
    type: 'website'
  }
};

export const viewport: Viewport = {
  themeColor: '#1a2130',
  colorScheme: 'dark'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        {children}
        <Analytics />
      </body>
    </html>
  );
}