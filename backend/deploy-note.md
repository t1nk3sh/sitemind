## Backend deployment (Render)

The backend is a FastAPI app with SQLite and a local upload directory. It is not publishable as a
Cloudflare Worker through Freebuff Sites without a rewrite, because Sites runs Workers (V8 isolates),
not a Python server. This repo keeps the backend on a Python host (Render) and publishes the frontend
to Sites.

### What `backend/render.yaml` does

- Builds the frontend with `scripts/build.sh` (installs Python deps, then `npm install && npm run build`).
- Starts `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- Mounts a 1 GB persistent disk at `./data` for the SQLite database and uploaded images.
- Exposes both the API and the built frontend from the same origin, so the Sites-published frontend
  can point at one backend URL.

### Environment variables

Set these on the Render service (Environment tab), not in the repo:

- `GEMINI_API_KEY` — your Gemini API key (optional; without it, the backend runs in demo mode).
- `GEMINI_MODEL` — optional; defaults to `gemini-3.8-flash`.
- `DATA_DIR` — optional; defaults to `./data` (the mounted disk).
- `CORS_ORIGINS` — set to the Sites-published frontend origin once known, or `*` during setup.
- `MAX_UPLOAD_MB`, `AI_TIMEOUT_SECONDS`, `REQUIRE_LIVE_AI` — optional tuning.

### Functional dependency

The Sites-published frontend calls `/api/*` at the origin it is served from. For the published app
to work, that origin must be the backend (or the backend must be reached via an API base the frontend
is configured to use). Until the backend is live and the frontend is pointed at it, the published
frontend renders but the analysis features cannot reach a backend.
