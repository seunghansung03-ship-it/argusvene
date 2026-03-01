# ArgusVene - AI Co-founder Engine

## Overview
ArgusVene is a Live AI Decision Participant (co-founder) built for the Gemini Live Agent Challenge hackathon. It transforms live meetings into documented decisions, structured artifacts, and actionable tasks through a multi-agent AI system powered by Google Gemini.

## Architecture - 5-Layer Decision Engine

### Layer 1: Voice/Text Input
- **Live Mode** ("Go Live" button): Continuous STT → auto-send on 1.2s silence → agents respond with TTS → STT resumes after TTS finishes
- Browser-based speech recognition (Web Speech API) for voice input
- ElevenLabs TTS auto-play in Live Mode with per-agent voices
- Feedback prevention: STT pauses while TTS plays, resumes via `setOnQueueDone` callback
- `voiceModeRef` (ref) used in `handleSendMessage` useCallback to avoid stale closure bug
- Text input fallback with manual send
- Real-time transcript with speaker labels + interim transcript display
- Visual indicators: LIVE badge, voice waveform animation, current speaker name
- **Natural conversation prompts**: Agents speak conversationally (2-4 sentences, no markdown), reference each other by name, ask follow-ups
- **Agent-to-agent discussion**: After initial responses, one random agent adds a reaction to what others said, creating organic inter-agent dialogue
- **Immediate per-agent TTS**: Each agent's voice plays as soon as they finish (not batched at end), creating a natural sequential conversation flow

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

### Layer 5: Decision Memory
- Full reasoning history with premises, chosen options, rejected alternatives
- Exportable as JSON per meeting
- Workspace-level decision memory aggregation
- WorldState versioning for session replay

### Tech Stack
- **Frontend:** React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **AI Provider:** Google Gemini (2.5 Flash) via Replit AI Integrations (primary)
- **Provider Abstraction:** `server/ai-provider.ts` - Gemini default, OpenAI fallback
- **TTS:** ElevenLabs API (`eleven_multilingual_v2` model, per-agent unique voices), browser SpeechSynthesis fallback
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
- `workspaces` - Organizations/projects
- `agentPersonas` - AI agent configurations (Atlas/Strategy, Nova/Tech, Sage/Finance, Pixel/Design)
- `meetings` - Meeting rooms with `worldState` JSONB column and `aiProvider` field
- `meetingMessages` - Chat messages (human + agent + co-founder interrupts)
- `artifacts` - Generated documents (architecture docs, PRDs, specs, notes, decision briefs)
- `decisions` - Recorded decisions from meetings
- `tasks` - Action items with `executionType` (manual/ai_draft/ai_research)
- `users` - User accounts

### Key Files
- `client/src/pages/meeting-room.tsx` - 3-panel meeting room (transcript, Live Canvas, agents)
- `client/src/pages/workspace.tsx` - Workspace with Decision Memory tab
- `client/src/pages/dashboard.tsx` - Main workspace dashboard
- `client/src/components/live-canvas.tsx` - Decision tree + scenario comparison + assumptions
- `client/src/components/agent-avatar.tsx` - Agent avatar component
- `client/src/lib/api.ts` - SSE streaming helper
- `server/world-compiler.ts` - Transcript → WorldState compiler (Gemini)
- `server/ai-participant.ts` - Interrupt + counterfactual engine (Gemini)
- `server/ai-provider.ts` - Multi-provider AI abstraction
- `server/elevenlabs.ts` - ElevenLabs TTS with per-agent voice mapping
- `server/assistant-actions.ts` - Quick chat action execution engine (workspace/agent/meeting CRUD)
- `server/routes.ts` - All API routes including AI streaming
- `server/storage.ts` - Database storage layer
- `shared/schema.ts` - Drizzle schema definitions
- `shared/types/worldstate.ts` - WorldState TypeScript interfaces

### API Routes
- `GET/POST /api/workspaces` - Workspace CRUD
- `GET/POST /api/workspaces/:wsId/meetings` - Meeting management
- `POST /api/meetings/:id/messages` - Send message + multi-agent responses + WorldState update + interrupt check (SSE)
- `GET /api/meetings/:id/worldstate` - Get current WorldState + mermaid + comparison
- `POST /api/meetings/:id/summarize` - End meeting + generate artifacts (SSE)
- `GET /api/meetings/:id/decision-memory` - Export full decision memory as JSON
- `GET /api/workspaces/:wsId/decision-memory` - Workspace-level decision memory
- `POST /api/tasks/:id/execute` - OpenClaw task execution (SSE)
- `GET /api/workspaces/:wsId/artifacts|decisions|tasks` - Document hub
- `POST /api/quick-chat` - AI Assistant with action execution (SSE) - can create workspaces, agents, meetings
- `GET/POST /api/agents` - List/create AI agent personas
- `PATCH/DELETE /api/agents/:id` - Update/delete agent (delete blocked if in use)
- `GET/POST /api/providers` - AI provider management
- `GET /api/tts/status` - ElevenLabs availability + voice mapping
- `POST /api/tts/synthesize` - Text-to-speech synthesis (returns audio/mpeg, optional voiceId override)
- `GET /api/tts/voices` - List all ElevenLabs voices for voice selection

### SSE Event Types (Meeting Messages)
- `user_message` - User's message saved
- `agent_start/agent_chunk/agent_done` - Agent streaming response
- `worldstate_updating/worldstate_updated` - World Compiler processing
- `interrupt` - co-founder intervenes (with reason)
- `counterfactuals` - 2 alternative scenarios generated
- `done` - Stream complete
