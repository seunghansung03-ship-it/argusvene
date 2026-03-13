# ArgusVene Architecture

```mermaid
flowchart LR
  A["Browser Client<br/>React + Vite"] --> B["Firebase Auth"]
  A --> C["Cloud Run Service<br/>ArgusVene Web + API"]
  C --> D["Cloud SQL<br/>PostgreSQL"]
  C --> E["Vertex AI<br/>Gemini 2.5 Flash"]
  C --> F["Gemini Live<br/>Native Audio Session"]
  C --> G["Secret Manager<br/>DATABASE_URL"]
  H["GitHub main"] --> I["GitHub Actions<br/>WIF Auth"]
  I --> J["Cloud Build"]
  J --> K["Artifact Registry"]
  J --> C

  subgraph Room["Live Room Runtime"]
    C1["Transcript Lane"]
    C2["Workbench / Live Canvas"]
    C3["Operator Rail"]
  end

  C --> Room
```

## Deployment boundary

- Public source of truth: [argusvene](https://github.com/seunghansung03-ship-it/argusvene)
- CI entrypoint: push to `main`
- Build system: Cloud Build
- Image registry: Artifact Registry
- Runtime: Cloud Run
- Database: Cloud SQL Postgres
- Model runtime: Vertex AI Gemini

## Why this shape fits the hackathon

- The model stack is Google-native
- The backend is hosted on Google Cloud
- The repository is public and reproducible
- The deployment path is automated and inspectable
