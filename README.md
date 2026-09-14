# Qeo OneDrive Photo Cleaner

Local-first OneDrive photo maintenance for a personal Microsoft account. It indexes metadata and thumbnails locally, verifies exact duplicates before deletion, keeps visually-similar matches review-only, classifies photos with a local CLIP model, and can add reviewed categories to OneDrive albums.

## Safety model

- Originals stay in OneDrive; the app stores metadata, hashes, thumbnails, and local model data under `/data`.
- Exact duplicate deletion requires streamed SHA-256 verification and explicit review. Normal OneDrive delete is used so items go to the Recycle Bin.
- Similar-photo detection is heuristic only and never exposes an automatic delete path.
- Album sync only adds reviewed, non-deleted photos. v0.1 never automatically removes existing album members.
- Local classification runs with Transformers.js/CLIP. No cloud vision API is required.
- `DEMO_MODE=1` blocks destructive OneDrive operations.

## Requirements

- Node.js 24
- Docker + Docker Compose for the recommended deployment
- A personal Microsoft account with OneDrive
- Optional: Tailscale for tailnet-only access

## Microsoft app registration

This app uses MSAL Node `PublicClientApplication` with authorization-code + PKCE. No client secret is used or needed.

1. Open Microsoft Entra **App registrations** and create an app that supports **Personal Microsoft accounts**.
2. Under **Authentication**, configure the loopback redirect URI used by this app:

   `http://localhost:3000/api/auth/callback`

   Keep the path exactly the same as `APP_BASE_URL + /api/auth/callback`. Localhost HTTP redirect URIs are supported for loopback development flows.
3. Enable **Allow public client flows**.
4. Under Microsoft Graph delegated permissions, add **Files.ReadWrite**. Do not add an application permission or client secret for this app.
5. Copy the **Application (client) ID** into `MICROSOFT_APP_ID`.

The implementation uses the `consumers` authority and therefore intentionally targets personal Microsoft accounts in v0.1.

## Configure

```bash
cp .env.example .env.local
```

Example:

```dotenv
APP_BASE_URL=http://localhost:3000
DATA_DIR=/data
DEMO_MODE=0
CLIP_MODEL_ID=Xenova/clip-vit-base-patch32
MICROSOFT_APP_ID=your-application-client-id
```

For a safe first run, set `DEMO_MODE=1` until scan/classification behavior looks correct.

## Run with Docker Compose

```bash
docker compose up -d --build
```

The web app is intentionally bound to localhost only:

`127.0.0.1:3000:3000`

Open `http://localhost:3000`, then use **Settings → Connect OneDrive**. The worker shares the same persistent `/data` volume as the web process.

Useful commands:

```bash
docker compose ps
docker compose logs -f web worker
docker compose down
```

## Tailnet-only access with Tailscale Serve

Keep Docker bound to `127.0.0.1:3000`; do not publish port 3000 on the LAN/WAN. On the host running Docker and Tailscale:

```bash
tailscale serve --bg localhost:3000
tailscale serve status
```

Tailscale Serve exposes the local app over HTTPS only to devices/users allowed by your tailnet ACLs. **Do not use Tailscale Funnel** for this project because Funnel is intended for public internet exposure.

To remove the Serve configuration:

```bash
tailscale serve reset
```

### OAuth limitation in v0.1

The Microsoft redirect URI remains the localhost callback above. Perform initial OAuth connection/reconnection from a browser on the host itself (or through a local port-forward that preserves `localhost:3000`). Normal app usage can then happen through the Tailscale Serve URL.

## Workflow

1. **Scan** OneDrive metadata incrementally.
2. **Duplicates** → verify exact candidates; review before Recycle Bin deletion.
3. **Similar photos** → run local dHash + CLIP heuristic; review only.
4. **Categories** → run local classification, manually correct labels, mark reviewed.
5. **OneDrive albums** → sync reviewed category members; reruns are idempotent and only add missing members.
6. **Settings** → inspect connection/runtime/model paths, tune duplicate thresholds, or clear thumbnail cache.

Default similar-photo thresholds are conservative:

- dHash distance: `8`
- CLIP cosine similarity: `0.94`

## Local development

```bash
npm install
npm run dev
```

Run the worker separately:

```bash
npm run worker
```

Validation:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Data layout

Persistent state lives under `DATA_DIR` (default `/data`):

- SQLite application database and encrypted MSAL token cache
- `cache/thumbnails/` — disposable thumbnail cache
- `models/` — local Transformers.js model cache

The **Clear thumbnail cache** setting deletes only `cache/thumbnails/`; it does not delete indexed database records, originals, or model files.
