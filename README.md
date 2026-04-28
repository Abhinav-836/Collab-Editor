# 🤝 Collab Editor - Real-Time Collaborative Code Editor

A **real-time collaborative code editor** that allows multiple users to code together simultaneously with CRDT-based conflict resolution and AI-powered assistance.

## ✨ Features

- 🔄 **Real-time Collaboration** - Multiple users can edit the same document simultaneously
- ⚔️ **CRDT Conflict Resolution** - No lost edits, even with concurrent changes
- 🤖 **AI Chat Assistant** - Powered by Ollama Cloud, helps with code explanations and generation
- 🎛️ **Multi-Model AI Support** - Choose from multiple AI models (Llama 3.2, Codellama, Mistral, etc.)
- 👥 **User Presence** - See who's online and active in the room
- 📋 **Room System** - Create or join rooms with unique IDs
- 💾 **Persistent Storage** - PostgreSQL for data persistence, Redis for caching
- 🎨 **Modern UI** - Dark theme with Monaco Editor (VS Code's editor)

## 🏗️ Architecture

┌─────────────────────────────────────────────────────────────┐
│ Collab Editor │
├─────────────────────────────────────────────────────────────┤
│ Frontend (React + TypeScript) Backend (Node.js + WS) │
│ ├── Monaco Editor ├── WebSocket Server │
│ ├── AI Chat UI ├── CRDT Engine │
│ ├── User Presence ├── Room Management │
│ └── Model Selector ├── AI Service │
│ ├── PostgreSQL │
│ └── Redis │
└─────────────────────────────────────────────────────────────┘

🛠️ Tech Stack
Backend
Runtime: Node.js

Framework: Express.js

WebSocket: ws

Language: TypeScript

Database: PostgreSQL

Cache: Redis

AI: Ollama Cloud API

Frontend
Framework: React 18

Language: TypeScript

Editor: Monaco Editor

State Management: Zustand

HTTP Client: Fetch API

Styling: CSS-in-JS

🔄 CRDT Implementation
The editor uses CRDT (Conflict-free Replicated Data Type) for collaborative editing:

Insert operations - Adding characters at specific positions

Delete operations - Removing characters

Operation Transformation - Resolving concurrent edits

Document Sync - Maintaining consistency across clients

📝 License
MIT © Abhinav Ashutosh