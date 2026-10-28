## Deploying to Freebuff Sites (frontend) + Render (backend)

This repo ships two halves: a Vite React frontend and a FastAPI backend. Freebuff Sites publishes
the frontend as a static site, but it cannot run the Python backend. The published site is the UI
only: its `/api/*` calls resolve against the Sites origin, where no API exists yet.

### 1. Backend on Render

`backend/render.yaml` defines a single free web service that builds the frontend and runs the
backend from one port. Deploy it from the Render dashboard (New → Blueprint) or by pushing the repo
and connecting it. The service exposes the API and serves the built frontend from the same URL, so
you get one backend origin the frontend can talk to.

After the backend is live, set `GEMINI_API_KEY` as a service environment variable on Render if you
want live multimodal analysis; otherwise it runs in demo mode automatically.

### 2. Frontend on Freebuff Sites

Build with `npm ci && npm run build` in `frontend/` (output in `frontend/dist`), then deploy from
the repo root using `deploy.json`. That manifest publishes `frontend/dist` plus a minimal Worker
(`frontend/worker.js`) that serves the built assets from `env.ASSETS`, with SPA fallback so client
routes deep-link correctly. The Worker does not run the backend.

The manifest must include `entrypoint`, and it must match `modules[].name`:

```json
{
  "entrypoint": "worker.js",
  "compatibilityDate": "2025-03-25",
  "modules": [{ "name": "worker.js", "type": "esm", "path": "frontend/worker.js" }],
  "assetsDirectory": "frontend/dist",
  "spa": true
}
```

Without `entrypoint`, Sites rejects the deploy with `invalid_type`, which is what the Publish
button was reporting.

### 3. Wiring the frontend to the backend

The frontend requests `/api/*` relative to its own origin (`frontend/src/lib/api.ts`). On the
Sites-published URL no API exists, so `frontend/worker.js` answers every `/api` and `/api/*`
request with a JSON `503` (`application/json`, `cache-control: no-store`) explaining that the
backend is not connected, instead of letting the SPA shell answer with HTML. Data features show
that message until the frontend talks to a real backend origin: either serve the built frontend
from the backend itself, or give the frontend an absolute API base URL and build it with that
origin.

`request()` in `api.ts` also checks the response content type, so a non-JSON body becomes an
`ApiError` with a readable message rather than an uncaught `Unexpected token '<'` from
`response.json()`.

### Why the backend is not published here

The backend is Python, SQLite and a local upload directory, none of which run inside a Workers
isolate, and the Sites deployer only uploads a Worker bundle plus static assets. Host it on a
Python service such as Render instead.
