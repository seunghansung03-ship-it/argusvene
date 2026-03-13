# ArgusVene

ArgusVene is a live meeting operating system for teams that need to talk, build, inspect, and revise with AI agents inside the same room.

This repository is the public hackathon codebase for the Gemini Live Agent Challenge submission. The deployment target is Google Cloud Run, the model layer is Gemini via the Google Gen AI SDK, and the live voice path uses Gemini Live.

## Hackathon compliance

- Gemini model path: `gemini-2.5-flash` and Gemini Live native audio
- Google SDK: `@google/genai`
- Google Cloud service: Cloud Run, Cloud SQL, Vertex AI, Artifact Registry, Cloud Build
- Public code repository: this repo
- Architecture diagram: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Deployment automation: [cloudbuild.yaml](./cloudbuild.yaml), [.github/workflows/deploy-cloud-run.yml](./.github/workflows/deploy-cloud-run.yml)

## Product shape

- `/` organization home
- `/org/settings` shared agent library and room defaults
- `/workspace/:id` workspace prep for people, files, and room launch
- `/meeting/:id` live room with transcript, workbench, and operator rail
- `/workspace/:id/outcomes` decisions, tasks, and artifacts after the room

## Local development

1. Copy [.env.example](./.env.example) to `.env`.
2. Start PostgreSQL:

```bash
docker compose up -d postgres
```

3. Push the schema:

```bash
npm run db:push
```

4. Run the app:

```bash
npm run dev
```

5. Verify the project:

```bash
npm run check
npm run build
```

## Required environment variables

### Runtime

- `DATABASE_URL`
- `GOOGLE_GENAI_USE_VERTEXAI=true` or `GOOGLE_API_KEY`
- `GOOGLE_CLOUD_PROJECT` when using Vertex AI
- `GOOGLE_CLOUD_LOCATION`

### Client build

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

## Hackathon deployment path

The canonical deployment target is Cloud Run in `us-central1`.

### Repo automation

Push to `main` triggers [.github/workflows/deploy-cloud-run.yml](./.github/workflows/deploy-cloud-run.yml), which:

1. Authenticates to Google Cloud with Workload Identity Federation
2. Submits [cloudbuild.yaml](./cloudbuild.yaml)
3. Builds a Docker image into Artifact Registry
4. Deploys the image to Cloud Run
5. Keeps the service single-instance with Cloud SQL and Vertex AI runtime env

### GitHub repository variables

Set these repository variables in GitHub:

- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GAR_REPOSITORY`
- `CLOUD_RUN_SERVICE`
- `CLOUD_RUN_RUNTIME_SA`
- `CLOUD_SQL_INSTANCE`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOYER_SERVICE_ACCOUNT`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Recommended values for the current project:

- `GCP_PROJECT_ID=argusvene`
- `GCP_REGION=us-central1`
- `GAR_REPOSITORY=argusvene`
- `CLOUD_RUN_SERVICE=argusvene-demo`
- `CLOUD_RUN_RUNTIME_SA=argusvene-run@argusvene.iam.gserviceaccount.com`
- `CLOUD_SQL_INSTANCE=argusvene:us-central1:argusvene-db`

## Manual deployment

```bash
gcloud builds submit \
  --project argusvene \
  --config cloudbuild.yaml \
  --substitutions \
  _REGION=us-central1,\
  _AR_REPOSITORY=argusvene,\
  _SERVICE=argusvene-demo,\
  _IMAGE=web,\
  _IMAGE_TAG=manual,\
  _RUNTIME_SERVICE_ACCOUNT=argusvene-run@argusvene.iam.gserviceaccount.com,\
  _CLOUD_SQL_INSTANCE=argusvene:us-central1:argusvene-db,\
  _VITE_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY,\
  _VITE_FIREBASE_PROJECT_ID=argusvene,\
  _VITE_FIREBASE_APP_ID=YOUR_FIREBASE_APP_ID,\
  _VITE_DEV_AUTH_BYPASS=false
```

## Current hosted service

- Cloud Run URL: [argusvene-demo](https://argusvene-demo-xtmkcvedsq-uc.a.run.app)

## Notes

- The client bundle currently carries default Firebase values for the `argusvene` project in [`client/src/lib/firebase.ts`](./client/src/lib/firebase.ts), but CI builds should still pass explicit `VITE_*` values.
- Cloud Run is intentionally single-instance for now because live room presence and some execution state are not yet externalized.
