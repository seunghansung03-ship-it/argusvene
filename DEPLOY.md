# ArgusVene Deployment

This repository is configured for the Gemini Live Agent Challenge deployment path:

- public GitHub repository
- Google Cloud Run runtime
- Vertex AI Gemini model path
- Cloud SQL Postgres
- Cloud Build image pipeline
- GitHub Actions deployment on push to `main`

## One-time GCP setup

1. Create or confirm these resources in project `argusvene`:
   - Cloud Run service `argusvene-demo`
   - Cloud SQL instance `argusvene-db`
   - Secret Manager secret `database-url`
   - Artifact Registry repository `argusvene`
2. Ensure the Cloud Run runtime service account is:
   - `argusvene-run@argusvene.iam.gserviceaccount.com`
3. Ensure Firebase auth allows the final Cloud Run or custom domain.

## One-time GitHub setup

Set these repository variables:

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

## Automated deployment

Push to `main` runs:

- [.github/workflows/deploy-cloud-run.yml](./.github/workflows/deploy-cloud-run.yml)
- [cloudbuild.yaml](./cloudbuild.yaml)

The pipeline:

1. Authenticates with Workload Identity Federation
2. Runs `npm run check`
3. Builds the Docker image with explicit `VITE_*` build args
4. Pushes the image to Artifact Registry
5. Deploys the image to Cloud Run

## Manual fallback

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

## Runtime constraints

- Cloud Run stays single-instance for now
- `DATABASE_URL` comes from Secret Manager
- Vertex AI is enabled with:
  - `GOOGLE_GENAI_USE_VERTEXAI=true`
  - `GOOGLE_CLOUD_PROJECT=argusvene`
  - `GOOGLE_CLOUD_LOCATION=us-central1`

## Required follow-up before judges use it

- Add production and demo domains to Firebase authorized domains
- Confirm the latest `main` push completed in GitHub Actions
- Confirm the deployed Cloud Run revision is healthy
- Record the public URL in the submission form
