# ArgusVene - AI Co-founder Engine

## Overview
ArgusVene is a Multi-Agent Co-founder Engine for founders and executives. It transforms meetings into documented decisions, structured artifacts, and actionable tasks through AI-powered agents.

## Architecture

### 3-Pillar Engine
1. **Consensus/Summarizer Engine** - Analyzes meeting transcripts to extract artifacts, decisions, and tasks
2. **Document Hub** - Stores and retrieves all generated artifacts and decisions per workspace
3. **Task Execution** - Tracks action items generated from meetings

### Tech Stack
- **Frontend:** React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **AI:** OpenAI via Replit AI Integrations (gpt-5.2)
- **Routing:** wouter
- **State:** TanStack React Query

### Data Model
- `workspaces` - Organizations/projects (multi-org support)
- `agentPersonas` - AI agent configurations (Strategy, Tech, Finance, Design)
- `meetings` - Meeting rooms within workspaces
- `meetingMessages` - Chat messages (human + agent)
- `artifacts` - Generated documents (architecture docs, PRDs, specs, notes)
- `decisions` - Recorded decisions from meetings
- `tasks` - Action items with status tracking
- `users` - User accounts (base schema)

### Key Features
- **Workspace Dashboard** with Quick Ideation Bar for instant AI chat
- **Meeting Room** with 3-panel layout (Chat, Center Stage, Utility)
- **Multi-Agent AI** chat with persona-specific responses (Atlas, Nova, Sage, Pixel)
- **Consensus Engine** that auto-generates artifacts/decisions/tasks on meeting end
- **Document Hub** for viewing all generated artifacts
- **Task Management** with status tracking
- **Dark/Light mode** toggle

### File Structure
- `client/src/pages/dashboard.tsx` - Main workspace dashboard
- `client/src/pages/workspace.tsx` - Workspace detail with tabs
- `client/src/pages/meeting-room.tsx` - 3-panel meeting room
- `client/src/components/theme-provider.tsx` - Theme context
- `client/src/components/agent-avatar.tsx` - Agent avatar component
- `client/src/lib/api.ts` - SSE streaming helper
- `server/routes.ts` - All API routes including AI streaming
- `server/storage.ts` - Database storage layer
- `server/seed.ts` - Seed data for workspaces and agents
- `server/db.ts` - Database connection
- `shared/schema.ts` - Drizzle schema definitions

### API Routes
- `GET/POST /api/workspaces` - Workspace CRUD
- `GET/POST /api/workspaces/:wsId/meetings` - Meeting management
- `POST /api/meetings/:id/messages` - Send message + get multi-agent AI responses (SSE)
- `POST /api/meetings/:id/summarize` - End meeting + generate artifacts (SSE)
- `GET /api/workspaces/:wsId/artifacts|decisions|tasks` - Document hub
- `POST /api/quick-chat` - Quick ideation chat (SSE)
- `GET /api/agents` - List AI agent personas
