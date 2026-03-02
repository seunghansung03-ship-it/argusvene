# ArgusVene - AI Co-founder Engine

## Overview
ArgusVene is a Live AI Decision Participant (co-founder) built for the Gemini Live Agent Challenge hackathon. It transforms live meetings into documented decisions, structured artifacts, and actionable tasks through a multi-agent AI system powered exclusively by Google Gemini.

## Architecture - 5-Layer Decision Engine

### Layer 1: Voice/Text Input
- **Live Mode** ("Go Live" button): Continuous STT → auto-send on 1.0s silence → agents respond with TTS
- Browser-based speech recognition (Web Speech API) for voice input
- ElevenLabs TTS auto-play in Live Mode with per-agent voices
- **Feedback prevention**: STT pauses while TTS plays (both text mode and Live Mode), resumes 500ms after TTS finishes to prevent mic picking up speaker audio
- Text input fallback with manual send
- Real-time transcript with speaker labels + interim transcript display
- **Natural conversation prompts**: Agents speak conversationally (1-3 sentences, under 80 words, no markdown/name tags), show emotion, take stances
- **Agent Selection**: In text mode, after user types a message, agent selection buttons appear to pick who responds. Options: individual agents, or "Auto (AI picks)" for AI-routed selection. In Live Mode, auto-routing is used.
- **Stop Response**: Button to abort AI mid-response. Uses AbortController on client + `res.on("close")` abort detection on server.
- **Smart Agent Routing** (3-tier): 1) Direct name detection, 2) Keyword domain matching (finance/tech/strategy/marketing), 3) AI router fallback (Gemini chatJSON picks 2-3 agents)
- **Agent-to-agent discussion**: After 2+ agents respond, one additional agent adds a reaction

### Layer 2: World Compiler (`server/world-compiler.ts`)
- Processes transcript through Gemini to extract/update structured WorldState
- Incremental updates: entities, assumptions, constraints, options, scenarios, metrics
- Generates Mermaid.js decision tree diagrams
- Produces scenario comparison data

### Layer 3: AI Participant Engine (`server/ai-participant.ts`)
- Interrupt policy: detects risk, uncertainty, unvalidated assumptions
- Always generates 2 counterfactual scenarios per decision point
- Critical question queue for challenging blind spots
- Outputs AgentAction { interrupt, counterfactuals[], questions[] }

### Layer 4: Live Canvas (`client/src/components/live-canvas.tsx`)
- Decision Tree visualization (Mermaid.js)
- Scenario Comparison view (side-by-side metrics)
- Assumption Panel (confidence bars, challenge tracking)
- Counterfactual display
- Real-time updates via SSE
- **Coding Agent (Code tab)**: AI code generation based on meeting context
- **UI Navigator (Browser Panel)**: Playwright-powered headless browser with Gemini Vision

### Layer 5: Decision Memory
- Full reasoning history with premises, chosen options, rejected alternatives
- Exportable as JSON per workspace (Export JSON button)
- Copy All decisions to clipboard
- WorldState versioning for session replay
- Combined view: formal decisions + WorldState-derived decisions with premises and rejected alternatives
- Workspace-level decision memory aggregation across all meetings

### Authentication
- **Firebase Auth** with Google OAuth + Email/Password
- Per-user workspace isolation via `x-user-id` header
- **Workspace Members**: Email-based invitation system for workspace collaboration

### Tech Stack
- **Frontend:** React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Auth:** Firebase Authentication (Google OAuth)
- **AI Provider:** Google Gemini 2.5 Flash (primary and only provider for hackathon compliance)
- **Provider Abstraction:** `server/ai-provider.ts` - Gemini-only (personal GOOGLE_API_KEY prioritized over Replit integration key)
- **TTS:** ElevenLabs API (`eleven_multilingual_v2` model, per-agent unique voices), browser SpeechSynthesis fallback
- **Browser Automation:** Playwright (Nix Chromium) for UI Navigator
- **Visualization:** Mermaid.js for decision trees
- **Routing:** wouter
- **State:** TanStack React Query
- **Streaming:** Server-Sent Events (SSE)

### WorldState Data Model (JSONB on meetings table)
```
WorldState {
  sessionId, version, lastUpdated,
  entities[]: { id, name, type, description }
  assumptions[]: { id, text, basis, confidence, challengedBy, status }
  constraints[]: { id, type, description, severity }
  options[]: { id, title, description, pros[], cons[], metrics }
  scenarios[]: { id, label, type, optionId, metrics, description }
  metrics[]: { id, name, value, unit, trend }
  decisions[]: { id, title, chosenOptionId, reasoning, rejectedOptions[], premises[], timestamp }
}
```

### Database Tables
- `workspaces` - Organizations/projects (with `userId` column for per-user isolation)
- `workspace_members` - Email-based workspace sharing (invitedBy, role, status)
- `agentPersonas` - AI co-founder agents (Atlas/Strategy, Nova/Tech, Sage/Finance, Pixel/Product)
- `meetings` - Meeting rooms with `worldState` JSONB column and `aiProvider` field
- `meetingMessages` - Chat messages (human + agent + co-founder interrupts)
- `artifacts` - Generated documents (architecture docs, PRDs, specs, notes, decision briefs, code)
- `decisions` - Recorded decisions from meetings
- `tasks` - Action items with `executionType` (manual/ai_draft/ai_research)
- `users` - User accounts

### Key Files
- `client/src/pages/meeting-room.tsx` - 3-panel meeting room (transcript, Live Canvas, agents)
- `client/src/pages/workspace.tsx` - Workspace with Decision Memory tab + export
- `client/src/pages/dashboard.tsx` - Main workspace dashboard with user profile/signout
- `client/src/components/live-canvas.tsx` - Decision tree + scenario comparison + assumptions
- `server/world-compiler.ts` - Transcript → WorldState compiler (Gemini)
- `server/ai-participant.ts` - Interrupt + counterfactual engine (Gemini)
- `server/ai-provider.ts` - Gemini AI abstraction
- `server/gemini-live.ts` - Gemini Live WebSocket proxy
- `server/routes.ts` - All API routes including AI streaming
- `server/storage.ts` - Database storage layer
- `shared/schema.ts` - Drizzle schema definitions
- `shared/types/worldstate.ts` - WorldState TypeScript interfaces

### SSE Event Types (Meeting Messages)
- `user_message` - User's message saved
- `agent_start/agent_chunk/agent_done` - Agent streaming response
- `worldstate_updating/worldstate_updated` - World Compiler processing
- `interrupt` - co-founder intervenes (with reason)
- `counterfactuals` - 2 alternative scenarios generated
- `done` - Stream complete
