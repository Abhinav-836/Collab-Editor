import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage, { CONTACT } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Terms of service' };

export default function Terms() {
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms cover your use of Collab Editor, a free tool built by Abhinav Ashutosh (StrattonTrade). By creating
        or joining a room, you agree to them.
      </p>

      <h2>Rooms and your code</h2>
      <ul>
        <li>You keep all rights to the code you write. Only put code in a room that you&rsquo;re allowed to share.</li>
        <li>Anyone you give the link to can read and change the room. Lock it with a password if that matters.</li>
        <li>Rooms are saved as described in the <Link href="/privacy">privacy policy</Link>, but keep your own copy of anything important.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>
        Don&rsquo;t use Collab Editor to break the law, share malware, harass people, attack or overload the service
        (including the code runner), or get around its limits. We may close rooms or block access that does.
      </p>

      <h2>AI answers and code runs</h2>
      <p>
        The AI assistant can be wrong, so check its suggestions before using them. Code runs on Wandbox, a third-party
        service with its own limits; we can&rsquo;t guarantee it&rsquo;s available.
      </p>

      <h2>The service</h2>
      <p>
        Collab Editor is free and provided &ldquo;as is&rdquo;, without any guarantee that it will always be available
        or that rooms will be kept forever. To the extent the law allows, we are not liable for losses that come from
        using it. These terms are governed by the laws of India.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. If these terms change, the date at the top changes too.
      </p>
    </LegalPage>
  );
}
