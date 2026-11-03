import { track as vercelTrack } from '@vercel/analytics';

type Props = Record<string, string | number | boolean | null>;

// Analytics must never break the app (ad-blockers, local dev).
export function track(event: string, props?: Props) {
  try {
    vercelTrack(event, props);
  } catch {
    /* ignore */
  }
}