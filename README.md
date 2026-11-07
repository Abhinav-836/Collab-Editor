# Collab Editor

[![CI](https://github.com/Abhinav-836/Collab-Editor/actions/workflows/ci.yml/badge.svg)](https://github.com/Abhinav-836/Collab-Editor/actions/workflows/ci.yml)

A real-time collaborative code editor. Create a room, share the link, and everyone edits the same file at the same time — with live cursors, a built-in code runner for seven languages, and an AI assistant that can see the code you're working on.

**Live:** [collab-editor-ruby-beta.vercel.app](https://collab-editor-ruby-beta.vercel.app)

| | |
|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, Monaco Editor (the editor inside VS Code), Tailwind CSS 4 — deployed on Vercel |
| **Backend** | Node.js, Express, `ws` WebSockets, TypeScript — deployed on Render |
| **Storage** | PostgreSQL for room documents (optional), Redis for presence (optional) |
| **Code runner** | [Wandbox](https://wandbox.org) — free, no API key |
| **AI** | Ollama Cloud models |

## How it works

Concurrent edits are merged with **operational transformation (OT)**, the same approach Google Docs uses:

```
client edits ─► TextOperation (retain / insert / delete) + the revision it was based on
             ─► server transforms it against every op accepted since that revision
             ─► applies it to the authoritative document, revision + 1
             ─► broadcasts the transformed op ─► other clients transform it against their own pending edits
```

The server holds the single source of truth for each room, so two people typing in the same line never lose characters or end up with different documents. Each client keeps at most one operation in flight and buffers the rest, so the protocol stays simple even on slow connections.

**Saving.** Room documents are saved to PostgreSQL a short time after the last edit (debounced, with a maximum wait so a busy room still saves regularly). On shutdown — for example a Render redeploy — every unsaved room is flushed first, so deploys don't lose edits. Without `DATABASE_URL`, rooms live in memory only.

## Features

- **Rooms** — create a room and share its URL; optional **password protection** (scrypt-hashed, signed access tokens valid for 30 days, 10 password attempts per IP per room every 10 minutes)
- **Live presence** — see who's in the room, each with their own colour and cursor
- **10 languages** with syntax highlighting: JavaScript, TypeScript, Python, Java, C++, Go, Rust, HTML, CSS, JSON — changing the language syncs to everyone in the room
- **Run code** for JavaScript, TypeScript, Python, Java, C++, Go and Rust, with stdin support (10 runs per minute per IP)
- **AI assistant** — three ways to use it, all with your current file and language as context:
  - **Explain**: explains the code you've selected, or the whole file if nothing is selected
  - **Suggest improvements**: reviews the file and gives up to 5 concrete fixes, most important first, each with a pasteable code block
  - **Chat**: ask anything about the code

  Any code block in a reply can be inserted at your cursor. Pick from the Ollama Cloud models your plan can use (default `gemma4:31b-cloud`). If the AI service is down you get a clear error, never a made-up answer
- Works on mobile

## Run locally

Needs Node 20+. PostgreSQL and Redis are optional — the server starts without them and tells you what it's skipping.

**Backend** (http://localhost:8080, WebSocket on `ws://localhost:8080/ws`)

```bash
git clone https://github.com/Abhinav-836/Collab-Editor.git
cd Collab-Editor/backend
npm install
```

Create `backend/.env`:

```env
PORT=8080
CORS_ORIGIN=http://localhost:5173
# Optional — without these, rooms are kept in memory and presence is skipped
DATABASE_URL=postgresql://user:password@localhost:5432/collab
REDIS_URL=redis://localhost:6379
# Optional — needed for the AI assistant
OLLAMA_CLOUD_API_KEY=your-key
```

```bash
npm run dev
```

Tables are created automatically on startup. `npm run migrate` runs the SQL files in `src/db/postgres/migrations` if you'd rather manage the schema yourself.

**Frontend** (http://localhost:5173)

```bash
cd Collab-Editor/frontend
npm install
echo NEXT_PUBLIC_API_URL=http://localhost:8080 > .env.local
npm run dev
```

## Configuration

**Backend**

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `8080` | |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allowed origins (also checked for WebSocket connections); `*` allows any |
| `DATABASE_URL` | — | PostgreSQL; enables saved rooms and room passwords |
| `REDIS_URL` | `redis://localhost:6379` | Presence store; the server runs without it |
| `OLLAMA_CLOUD_API_KEY` | — | Required for the AI assistant |
| `OLLAMA_CLOUD_URL` | `https://ollama.com/api` | |
| `ROOM_TOKEN_SECRET` | derived from `DATABASE_URL` | Secret for signing room access tokens. Set it explicitly in production |
| `CODE_RUNNER_URL` | `https://wandbox.org/api` | |
| `RATE_LIMIT_MAX` | `100` | General API requests per minute per IP |

**Frontend**

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend URL, no trailing slash |
| `NEXT_PUBLIC_WS_URL` | Optional; defaults to `NEXT_PUBLIC_API_URL` with `http` → `ws` |

## API

| Method | Path | |
|---|---|---|
| `GET` | `/health`, `/health/detailed` | Status, active rooms |
| `POST` / `GET` | `/api/rooms` | Create a room (optional `password`) / list rooms |
| `GET` | `/api/rooms/:id`, `/api/rooms/:id/stats` | Room info |
| `POST` | `/api/rooms/:id/join` | Exchange a room password for an access token |
| `DELETE` | `/api/rooms/:id` | Delete a room |
| `POST` | `/api/run` | Run code (`language`, `code`, `stdin`) |
| `POST` | `/api/ai/explain` | Explain `selection` (with `code` as context), or the whole `code` |
| `POST` | `/api/ai/suggest` | Up to 5 concrete improvements for `code` |
| `POST` | `/api/ai/chat` | Chat about `code` (`message`, `history`) |
| `GET` | `/api/ai/models` | Models available on your Ollama plan |
| WS | `/ws?roomId=…&userId=…&userName=…` | Messages: `operation`, `get_document`, `cursor`, `change_language` |

## Project structure

```
backend/src/
  index.ts          Express + WebSocket server, graceful shutdown
  ot/               TextOperation (apply / compose / transform) and the server document
  websocket/        connection manager and message handler
  services/         persistence, room passwords, code runner, Ollama client, AI prompts
  api/              rooms, run, ai, health
  db/               PostgreSQL queries + migrations, Redis presence
  __tests__/        OT, persistence, WebSocket and feature tests (Vitest)
frontend/
  app/              home page and /room/[roomId]
  components/       editor, room view, run panel, assistant panel
  lib/ot/           client-side OT (pending / buffered operations)
```

## Tests

```bash
cd backend
npm test
```

45 tests covering OT transform/compose correctness, convergence under concurrent edits, persistence, the WebSocket protocol and the AI endpoints (including that a failed AI call never returns a fabricated answer).

GitHub Actions runs the typecheck and all tests, and builds the frontend, on every push (`.github/workflows/ci.yml`).

## Limitations

- One file per room.
- The OT server keeps the last 2,000 operations per room; a client that falls further behind than that is sent a fresh copy of the document instead of having its edit merged.
- Rooms are capped at 500,000 characters.
- Code runs on Wandbox's public service, so it depends on Wandbox being up and its available compiler versions.

---

Built by **Abhinav Ashutosh** · [GitHub](https://github.com/Abhinav-836)

## License

MIT. See [LICENSE](LICENSE).
