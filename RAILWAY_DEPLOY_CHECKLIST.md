# Railway Deploy Checklist (Backend)

Use this checklist before every Railway deployment.

## 1. Git and Repository

- [ ] Push latest code to `main` on `https://github.com/pushkarrd/neurolex.git`
- [ ] Confirm sensitive files are not tracked:
  - `backend-python/serviceAccountKey.json`
  - any `.env` files

## 2. Railway Service Setup

- [ ] Create a Railway project connected to this repository
- [ ] Set root directory to repository root (this project uses `railway.json`)
- [ ] Confirm start command is from `railway.json`:
  - `cd backend-python && uvicorn main:app --host 0.0.0.0 --port $PORT`

## 3. Required Environment Variables

Set these in Railway service variables:

- `FIREBASE_SERVICE_ACCOUNT_JSON` = full Firebase service account JSON string
- `GEMINI_API_KEY` = Gemini API key

Optional:

- `ASSEMBLYAI_API_KEY` = only required for `/api/transcribe-audio`
- `GEMINI_API_KEYS` = comma-separated key list for rotation

Notes:

- If `FIREBASE_SERVICE_ACCOUNT_JSON` is set, backend will use it directly.
- If it is not set, backend falls back to `FIREBASE_SERVICE_ACCOUNT_PATH` and local file path.

## 4. Build and Runtime Validation

- [ ] Deployment build succeeds
- [ ] Service starts without crash loop
- [ ] Health endpoint returns OK:
  - `GET /health`
- [ ] Root endpoint responds:
  - `GET /`

## 5. Feature Smoke Tests

- [ ] Assessment start and submit endpoints work
- [ ] Games endpoints return data
- [ ] TTS endpoint works for supported languages
- [ ] AI generation endpoints work (requires Gemini key)
- [ ] Audio transcription endpoint works if `ASSEMBLYAI_API_KEY` is set

## 6. Security Checks

- [ ] Firebase key is rotated if it was ever exposed
- [ ] No secrets exist in commit diff
- [ ] `.env` and key files remain ignored by git

## 7. Rollback Readiness

- [ ] Keep previous stable commit SHA noted
- [ ] If deploy fails, roll back to previous SHA in Railway
