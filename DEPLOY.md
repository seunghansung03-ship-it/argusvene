# ArgusVene - Google Cloud Run 배포 가이드

## 1. GitHub Push 준비 (Git 히스토리에서 큰 파일 제거)

Shell에서 실행:

```bash
# Git 캐시에서 Playwright 바이너리 제거
git filter-branch --force --index-filter \
  'git rm -r --cached --ignore-unmatch .playwright/ .cache/' \
  --prune-empty HEAD

# 새 파일 추가 및 커밋
git add .gitignore .dockerignore Dockerfile server/browser-manager.ts
git commit -m "Add Docker support for Cloud Run deployment"

# GitHub에 강제 push
git push --force origin main
```

## 2. Google Cloud Run 배포

### 사전 준비
- Google Cloud CLI 설치 (https://cloud.google.com/sdk/docs/install)
- Cloud SQL (PostgreSQL) 인스턴스 생성

### 배포 명령어

```bash
# GCP 프로젝트 설정
gcloud config set project YOUR_PROJECT_ID

# Cloud Run에 직접 배포 (소스에서 빌드)
gcloud run deploy argusvene \
  --source . \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 2 \
  --port 8080 \
  --set-env-vars "DATABASE_URL=YOUR_DB_URL" \
  --set-env-vars "ELEVENLABS_API_KEY=YOUR_KEY" \
  --set-env-vars "SESSION_SECRET=YOUR_SECRET" \
  --set-env-vars "VITE_FIREBASE_API_KEY=YOUR_KEY" \
  --set-env-vars "VITE_FIREBASE_APP_ID=YOUR_APP_ID" \
  --set-env-vars "VITE_FIREBASE_PROJECT_ID=argusvene"
```

### 또는 Docker로 직접 빌드 후 배포

```bash
# Artifact Registry에 이미지 빌드 & push
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/argusvene

# Cloud Run 배포
gcloud run deploy argusvene \
  --image gcr.io/YOUR_PROJECT_ID/argusvene \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 2 \
  --port 8080
```

## 3. 환경변수 (필수)

| 변수명 | 설명 |
|--------|------|
| DATABASE_URL | PostgreSQL 연결 URL |
| ELEVENLABS_API_KEY | ElevenLabs TTS API 키 |
| SESSION_SECRET | 세션 암호화 키 |
| VITE_FIREBASE_API_KEY | Firebase API 키 |
| VITE_FIREBASE_APP_ID | Firebase App ID |
| VITE_FIREBASE_PROJECT_ID | Firebase 프로젝트 ID |
| PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH | (자동 설정됨: /usr/bin/chromium) |

## 4. 주의사항

- Cloud Run은 stateless이므로 브라우저 세션은 요청 간 유지되지 않습니다
- 최소 1Gi 메모리, 2 CPU 권장 (Chromium 사용 시)
- Cloud SQL 연결 시 Unix socket 또는 Cloud SQL Proxy 사용
