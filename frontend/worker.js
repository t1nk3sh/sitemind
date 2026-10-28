/**
 * SiteMind frontend Worker.
 *
 * Serves the Vite-built static site from env.ASSETS. This Worker does not run
 * the backend — the backend lives on a separate host (Render), and this
 * frontend calls it at /api/* relative to the origin it is served from.
 *
 * Because the static site has no backend behind /api/*, those requests must
 * never fall through to the SPA shell: answering an API call with index.html
 * makes the browser's response.json() throw "Unexpected token '<'". They get a
 * JSON error body instead, which the UI can render as a normal message.
 */

const NO_BACKEND = {
  detail:
    "This deployment is the static frontend only — no API backend is connected to this origin. " +
    "Run the FastAPI backend (backend/) and point the frontend at it to use the analysis features.",
};

const isApiRequest = (pathname) =>
  pathname === "/api" || pathname.startsWith("/api/");

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (isApiRequest(pathname)) {
      return new Response(JSON.stringify(NO_BACKEND), {
        status: 503,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
