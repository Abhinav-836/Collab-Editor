import type { Metadata } from 'next';
import LegalPage, { CONTACT } from '@/components/LegalPage';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        Collab Editor is a free real-time code editor built by Abhinav Ashutosh (StrattonTrade). There are no accounts.
        This page explains what happens to what you type. We don&rsquo;t sell data or use it for advertising.
      </p>

      <h2>What we handle</h2>
      <ul>
        <li>
          <strong>Your code:</strong> the contents of each room are saved in our database so the room survives
          refreshes and restarts. Anyone with the room&rsquo;s link (and its password, if it&rsquo;s locked) can read
          and edit it.
        </li>
        <li>
          <strong>Your display name:</strong> the name you type is shown to others in the same room. Your browser
          remembers it locally; we don&rsquo;t store it with your code.
        </li>
        <li>
          <strong>Room passwords:</strong> stored only as a scrypt hash, never in plain text.
        </li>
        <li>
          <strong>Server logs and limits:</strong> your IP address and request times, used to stop abuse and apply the
          daily AI limit.
        </li>
        <li>
          <strong>Visit statistics:</strong> Vercel Web Analytics counts page views and a few actions (such as
          creating a room) without cookies and without storing personal information.
        </li>
      </ul>

      <h2>Running code and the AI assistant</h2>
      <ul>
        <li>
          <strong>Run</strong> sends the open file and its input to Wandbox (wandbox.org), a free online compiler, which
          runs it and returns the output.
        </li>
        <li>
          The <strong>AI assistant</strong> sends the open file (or your selection), your question and the recent chat
          to an AI model hosted by Ollama, which writes the answer.
        </li>
      </ul>
      <p>So don&rsquo;t put passwords, API keys or other secrets in a room.</p>

      <h2>Who else handles it</h2>
      <ul>
        <li>Render runs the server, Vercel hosts the website, Neon hosts the database and a Redis store holds short-term room data.</li>
        <li>Wandbox runs code when you press Run. Ollama answers AI questions.</li>
      </ul>

      <h2>Deleting a room</h2>
      <p>
        Rooms with nobody in them are cleared from the server&rsquo;s memory after a day, but their saved contents stay
        in the database so the link keeps working. To have a room deleted for good, email{' '}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a> with its link.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. If this policy changes, the date at the top changes too.
      </p>
    </LegalPage>
  );
}
