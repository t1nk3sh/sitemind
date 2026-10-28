## API origin for the Sites-published frontend

The frontend's API client uses relative `/api/*` paths, so the published app calls the backend at
whichever origin the frontend is served from. There are two supported arrangements:

### 1. Backend serves the frontend too (recommended)

Deploy the backend on Render using `backend/render.yaml`. That service builds the frontend and serves
both the API and the built frontend from one origin. Point the browser at that backend URL directly —
no CORS, no separate frontend host, no API-base config.

### 2. Sites hosts the frontend, backend is separate

Publish the frontend to Freebuff Sites via `frontend/deploy.json`. The published frontend runs at a
Sites URL. For the analysis features to work, that Sites URL must be able to reach the backend at
`/api/*`. The simplest way is to configure the Sites Worker to proxy `/api/*` to the backend origin,
or to set the frontend's API base to the backend origin and let the published frontend call it from
the browser. Either way, the backend origin must be live and CORS-coordinated with the Sites origin.

### Updating the API base

The frontend build currently has no baked backend host — it relies on relative paths. If you need the
published frontend to call a backend at a different origin, configure that at build time or at the
edge (for example via an environment variable the Worker reads and rewrites `/api/*` requests to). The
manifest in `frontend/deploy.json` is for the same-origin static-site case; a cross-origin case needs
an explicit API-base configuration.
