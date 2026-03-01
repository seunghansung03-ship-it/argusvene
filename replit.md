# ArgusVene - AI Co-founder Engine

## Overview
ArgusVene is a Multi-Agent Co-founder Engine for founders and executives. It transforms meetings into documented decisions, structured artifacts, and actionable tasks through AI-powered agents.

## Architecture

### 3-Pillar Engine
1. **Consensus/Summarizer Engine** - Analyzes meeting transcripts to extract artifacts, decisions, and tasks
2. **Document Hub** - Stores and retrieves all generated artifacts and decisions per workspace
3. **OpenClaw Runtime** - AI-powered task execution system (ai_draft, ai_research, manual)

### Tech Stack
- **Frontend:** React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **AI Providers:** OpenAI (gpt-5.2) + Google Gemini (2.5 Flash) via Replit AI Integrations
- **Provider Abstraction:** `server/ai-provider.ts` - switchable per meeting
- **Routing:** wouter
- **State:** TanStack React Query

### Data Model
- `workspaces` - Organizations/projects (multi-org support)
- `agentPersonas` - AI agent configurations (Strategy, Tech, Finance, Design)
- `meetings` - Meeting rooms within workspaces (includes `aiProvider` field)
- `meetingMessages` - Chat messages (human + agent)
- `artifacts` - Generated documents (architecture docs, PRDs, specs, notes)
- `decisions` - Recorded decisions from meetings
- `tasks` - Action items with `executionType` (manual/ai_draft/ai_research) and `executionResult`
- `users` - User accounts (base schema)

### Key Features
- **Workspace Dashboard** with Quick Ideation Bar for instant AI chat
- **Meeting Room** with 3-panel layout (Chat, Center Stage, Utility)
- **Multi-Agent AI** chat with persona-specific responses (Atlas, Nova, Sage, Pixel)
- **Dual AI Provider** support - OpenAI and Gemini selectable per meeting
- **Consensus Engine** that auto-generates artifacts/decisions/tasks on meeting end
- **OpenClaw Runtime** for AI-powered task execution (drafting, research)
- **Document Hub** for viewing all generated artifacts
- **Task Management** with status tracking and AI execution
- **Dark/Light mode** toggle

### File Structure
- `client/src/pages/dashboard.tsx` - Main workspace dashboard
- `client/src/pages/workspace.tsx` - Workspace detail with tabs (incl. provider selection, OpenClaw)
- `client/src/pages/meeting-room.tsx` - 3-panel meeting room with provider badge
- `client/src/components/theme-provider.tsx` - Theme context
- `client/src/components/agent-avatar.tsx` - Agent avatar component
- `client/src/lib/api.ts` - SSE streaming helper
- `server/ai-provider.ts` - Multi-provider AI abstraction (OpenAI + Gemini)
- `server/routes.ts` - All API routes including AI streaming
- `server/storage.ts` - Database storage layer
- `server/seed.ts` - Seed data for workspaces and agents
- `server/db.ts` - Database connection
- `shared/schema.ts` - Drizzle schema definitions

### API Routes
- `GET/POST /api/workspaces` - Workspace CRUD
- `GET/POST /api/workspaces/:wsId/meetings` - Meeting management (accepts `aiProvider`)
- `POST /api/meetings/:id/messages` - Send message + get multi-agent AI responses (SSE)
- `POST /api/meetings/:id/summarize` - End meeting + generate artifacts (SSE)
- `POST /api/tasks/:id/execute` - OpenClaw task execution (SSE streaming)
- `GET /api/workspaces/:wsId/artifacts|decisions|tasks` - Document hub
- `POST /api/quick-chat` - Quick ideation chat (SSE, accepts `provider`)
- `GET /api/agents` - List AI agent personas
- `GET /api/providers` - List available AI providers
- `POST /api/providers/default` - Set default AI provider
