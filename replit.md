# ArgusVene - AI Co-founder Engine

## Overview
ArgusVene is a Live AI Decision Participant (co-founder) built for the Gemini Live Agent Challenge hackathon. It transforms live meetings into documented decisions, structured artifacts, and actionable tasks through a multi-agent AI system powered by Google Gemini.

## Architecture - 5-Layer Decision Engine

### Layer 1: Voice/Text Input
- **Live Mode** ("Go Live" button): Continuous STT → auto-send on 1.0s silence → agents respond with TTS → STT stays active for user interruption
- Browser-based speech recognition (Web Speech API) for voice input
- ElevenLabs TTS auto-play in Live Mode with per-agent voices
- **User Interruption**: In Live Mode, STT keeps listening during TTS playback. If user speaks (2+ words detected), TTS stops immediately, AI response is aborted, and user's new input takes priority
- **Feedback prevention (text mode)**: STT pauses while TTS plays, resumes after TTS finishes. Live Mode uses interrupt-based approach instead.
- `voiceModeRef` (ref) used in `handleSendMessage` useCallback to avoid stale closure bug
- Text input fallback with manual send
- Real-time transcript with speaker labels + interim transcript display
- Visual indicators: LIVE badge, voice waveform animation, current speaker name
- **Natural conversation prompts**: Agents speak conversationally (1-3 sentences, under 80 words, no markdown/name tags), show emotion, take stances
- **Agent Selection (발언권 시스템)**: In text mode, after user types a message, agent selection buttons appear to pick who responds. Options: individual agents, or "Auto (AI picks)" for AI-routed selection. In Live Mode, auto-routing is used.
- **Stop Response**: Button to abort AI mid-response. Uses AbortController on client + `res.on("close")` abort detection on server.
- **Smart Agent Routing** (3-tier): 1) Direct name detection (regex: "Atlas 말해봐" → Atlas only), 2) Keyword domain matching (finance/tech/strategy/marketing keywords → relevant agent), 3) AI router fallback (Gemini chatJSON picks 2-3 agents)
- **targetAgentIds**: Server accepts optional `targetAgentIds` in message body to bypass AI routing and send to specific agents
- **Agent-to-agent discussion**: After 2+ agents respond, one additional agent adds a reaction to what others said
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
- **UI Navigator (Browser Panel)**: Playwright-powered headless browser with Gemini Vision
  - Per-user browser session isolation via `BrowserContext`
  - WebSocket screenshot streaming (`/ws/browser?userId=xxx`)
  - Gemini 2.5 Flash Vision loop: screenshot → analyze → click/type/scroll → repeat
  - Canvas rendering of live browser view with click passthrough
  - AI command input: user describes task → Gemini executes multi-step browser automation
  - Auto-cleanup of inactive sessions (10 min timeout)

### Layer 5: Decision Memory
- Full reasoning history with premises, chosen options, rejected alternatives
- Exportable as JSON per meeting
- Workspace-level decision memory aggregation
- WorldState versioning for session replay

### Authentication
- **Firebase Auth** with Google OAuth (signInWithPopup)
- `client/src/lib/firebase.ts` - Firebase app initialization with VITE_ env vars
- `client/src/hooks/use-auth.tsx` - AuthProvider context + useAuth hook
- `client/src/pages/login.tsx` - Login page with Google sign-in button
- Protected routes in `App.tsx` via `ProtectedRoutes` component
- User profile display + sign-out button on dashboard
- **Workspace Delete**: Trash icon on workspace card hover → AlertDialog confirmation → DELETE /api/workspaces/:id
- Per-user workspace isolation: `x-user-id` header sent with all API requests, workspaces filtered by `userId`
- `queryClient.ts` sends `x-user-id` header via `setCurrentUserId`; `api.ts` does the same via `setUserIdGetter`
- `assistant-actions.ts` `executeAction()` accepts optional `userId` for workspace CRUD
- **Setup required**: Add Replit dev domain to Firebase Console → Authentication → Authorized Domains

### Tech Stack
- **Frontend:** React + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL with Drizzle ORM
- **Auth:** Firebase Authentication (Google OAuth)
- **AI Provider:** Google Gemini (2.5 Flash) via Replit AI Integrations (primary)
- **Provider Abstraction:** `server/ai-provider.ts` - Gemini default (personal GOOGLE_API_KEY prioritized over Replit integration key), OpenAI fallback
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
- `agentPersonas` - AI agent configurations (Atlas/Strategy, Nova/Tech, Sage/Finance, Pixel/Design)
- `meetings` - Meeting rooms with `worldState` JSONB column and `aiProvider` field
- `meetingMessages` - Chat messages (human + agent + co-founder interrupts)
- `artifacts` - Generated documents (architecture docs, PRDs, specs, notes, decision briefs)
- `decisions` - Recorded decisions from meetings
- `tasks` - Action items with `executionType` (manual/ai_draft/ai_research)
- `users` - User accounts

### Key Files
- `client/src/pages/login.tsx` - Login page (Google OAuth + Email/Password)
- `client/src/hooks/use-auth.tsx` - Firebase auth context/provider (Google + Email auth, userId propagation)
- `client/src/lib/firebase.ts` - Firebase app config (Google + Email auth functions)
- `client/src/pages/meeting-room.tsx` - 3-panel meeting room (transcript, Live Canvas, agents)
- `client/src/pages/workspace.tsx` - Workspace with Decision Memory tab
- `client/src/pages/dashboard.tsx` - Main workspace dashboard with user profile/signout
- `client/src/components/live-canvas.tsx` - Decision tree + scenario comparison + assumptions
- `client/src/components/agent-avatar.tsx` - Agent avatar component
- `client/src/lib/api.ts` - SSE streaming helper
- `server/world-compiler.ts` - Transcript → WorldState compiler (Gemini)
- `server/ai-participant.ts` - Interrupt + counterfactual engine (Gemini)
- `server/ai-provider.ts` - Multi-provider AI abstraction
- `server/elevenlabs.ts` - ElevenLabs TTS with per-agent voice mapping
- `server/assistant-actions.ts` - Quick chat action execution engine (workspace/agent/meeting CRUD)
- `server/browser-manager.ts` - Playwright browser session manager (per-user isolation)
- `server/browser-vision.ts` - Gemini Vision screenshot analysis + action planning
- `client/src/components/browser-panel.tsx` - Browser panel UI (canvas rendering, URL bar, AI command input)
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
- `POST /api/browser/session` - Create per-user Playwright browser session
- `DELETE /api/browser/session` - Destroy browser session
- `POST /api/browser/navigate` - Navigate to URL
- `POST /api/browser/action` - Perform browser action (click/type/scroll/press)
- `GET /api/browser/screenshot` - Get current screenshot as JPEG
- `GET /api/browser/status` - Check browser session status
- `POST /api/browser/ai-command` - AI Vision command loop (SSE) - Gemini analyzes screenshots and executes multi-step tasks
- `WS /ws/browser?userId=xxx` - WebSocket for real-time screenshot streaming

### SSE Event Types (Meeting Messages)
- `user_message` - User's message saved
- `agent_start/agent_chunk/agent_done` - Agent streaming response
- `worldstate_updating/worldstate_updated` - World Compiler processing
- `interrupt` - co-founder intervenes (with reason)
- `counterfactuals` - 2 alternative scenarios generated
- `done` - Stream complete
