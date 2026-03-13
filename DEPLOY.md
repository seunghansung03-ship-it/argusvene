# ArgusVene Deployment

## Local-First Workflow

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL locally:

```bash
docker compose up -d postgres
```

3. Push the schema:

```bash
npm run db:push
```

4. Start the app:

```bash
npm run dev
```

For the fastest local UI loop, you can bypass Firebase sign-in:

```bash
VITE_DEV_AUTH_BYPASS=true
```

### Required local environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `GOOGLE_API_KEY` | Gemini API for meetings, browser vision, and Gemini Live |
| `VITE_FIREBASE_API_KEY` | Firebase Auth client config |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Auth client config |
| `VITE_FIREBASE_APP_ID` | Firebase Auth client config |

### Optional local environment

| Variable | Purpose |
| --- | --- |
| `GEMINI_BASE_URL` | Gemini-compatible gateway override |
| `ELEVENLABS_API_KEY` | ElevenLabs TTS |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | Chromium override for browser automation |

## GCP Baseline

Use Google Cloud Run for the first public release, but keep the service single-instance for now.

Why:
- Meeting live state, Gemini Live sessions, and the browser automation layer are still stored in memory.
- Horizontal scaling would make browser/live session routing unstable until those sessions are externalized.

### Recommended first production shape

- Cloud Run service
- `min-instances=1`
- `max-instances=1`
- Cloud SQL for PostgreSQL
- Secret Manager for server secrets
- Custom domain on Cloud Run through the Google Cloud load balancer path

### Build and deploy

```bash
gcloud config set project YOUR_PROJECT_ID

gcloud builds submit \
  --tag asia-northeast3-docker.pkg.dev/YOUR_PROJECT_ID/argusvene/argusvene:latest

gcloud run deploy argusvene \
  --image asia-northeast3-docker.pkg.dev/YOUR_PROJECT_ID/argusvene/argusvene:latest \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 2 \
  --memory 2Gi \
  --timeout 900 \
  --min-instances 1 \
  --max-instances 1 \
  --session-affinity \
  --set-secrets DATABASE_URL=DATABASE_URL:latest \
  --set-secrets GOOGLE_API_KEY=GOOGLE_API_KEY:latest \
  --set-secrets ELEVENLABS_API_KEY=ELEVENLABS_API_KEY:latest \
  --set-env-vars VITE_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY,VITE_FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID,VITE_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID
```

### Production notes

- Keep Cloud Run on one instance until browser/live session state is moved out of memory.
- Store server secrets in Secret Manager, not `.env`.
- Use Cloud SQL with a production `DATABASE_URL`.
- Add your production domain to Firebase Authentication authorized domains before opening sign-in.

## Next Hardening Step

To scale beyond a single Cloud Run instance, move these out of process memory:

- browser sessions
- live meeting session state
- websocket routing assumptions
- transient meeting execution queues
