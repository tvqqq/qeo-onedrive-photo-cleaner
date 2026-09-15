# Qeo OneDrive Photo Cleaner

Local-first OneDrive photo maintenance for a personal Microsoft account. It indexes Graph metadata and thumbnails locally, provides a searchable photo browser, verifies exact duplicates before deletion, keeps visually similar matches review-only, classifies photos with a local CLIP model, and can add reviewed categories to OneDrive albums.

## Safety model

- Originals stay in OneDrive; the app stores metadata, hashes, thumbnails, review state, Qeo tags, and local model data under `/data`.
- Exact duplicate deletion requires streamed SHA-256 verification and explicit review. Normal OneDrive delete is used so items go to the Recycle Bin.
- Single-photo Library deletion also uses normal Graph DELETE only, requires the server-loaded local ETag to match the current Graph ETag, and never exposes permanent delete.
- Similar-photo detection is heuristic only and never exposes an automatic delete path.
- Album sync only adds reviewed, non-deleted photos. Library album actions only add to an existing OneDrive album; they never create or remove album membership automatically.
- Camera/exposure and source identity metadata come from Microsoft Graph when available. The app never infers the uploader device from camera model, path, filename, or application heuristics.
- Local classification and Qeo AI Tags run with Transformers.js/CLIP. No cloud vision API is required.
- `DEMO_MODE=1` blocks destructive OneDrive operations and album mutations.

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

The implementation uses the `consumers` authority and intentionally targets personal Microsoft accounts.

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

Open `http://localhost:3000`, then use **Settings → Connect OneDrive**. Docker Compose runs three services against the same persistent `/data` volume:

- `web` — Next.js UI/API.
- `worker` — core lane for `scan` and `verify-exact` jobs.
- `worker-ml` — ML lane for `classify`, `find-similar`, and `tag-photos` jobs.

Separating the lanes means a long local CLIP job does not prevent a new scan from starting. Each lane still runs one job at a time and both use the same restart-safe SQLite queue.

Useful commands:

```bash
docker compose ps
docker compose logs -f web worker worker-ml
docker compose down
```

Do not use `docker compose down -v` during a normal upgrade because that removes the persistent `/data` volume.

## Upgrade from v0.1 to v0.2

The schema v2 migration runs automatically in place. You do **not** need to delete `/data`, recreate the database, or reconnect Microsoft authentication.

```bash
docker compose down
docker compose up -d --build
```

After the upgraded services are healthy, run **one Full Scan**. This backfills the new Graph camera/exposure metadata fields for already indexed photos. After that, use Incremental Scan for normal day-to-day updates.

## Upgrade from v0.2 to v0.2.1

v0.2.1 splits background execution into core and ML worker lanes. It does not require a database migration and preserves existing queued/running job records in `/data`.

```bash
git pull
docker compose down
docker compose up -d --build
docker compose ps
```

After startup, `docker compose ps` should show `web`, `worker`, and `worker-ml`. Do **not** use `docker compose down -v`; the existing SQLite queue, auth state, metadata, review state, and caches should remain in the persistent volume.

## Upgrade from v0.2.1 to v0.3

v0.3 migrates the existing SQLite database in place to schema v3. No auth reconnect and no database or `/data` reset is required.

```bash
git pull
docker compose down
docker compose up -d --build
docker compose ps
```

Then:

1. Run one **Full Scan** to backfill Microsoft Graph source identity metadata.
2. Click **Generate AI Tags** once for the initial full-library backfill. If the scan already queued the same active `tag-photos` job, the action reuses that job rather than creating a duplicate.
3. Subsequent scans automatically queue or reuse incremental AI-tag work for photos whose ETag/model/taxonomy state changed.

**Do not use `docker compose down -v`.** The v0.3 migration is intentionally in-place and preserves the production `/data` volume.

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

### OAuth note

The Microsoft redirect URI remains the localhost callback above. Perform initial OAuth connection/reconnection from a browser on the host itself, or through a local port-forward that preserves `localhost:3000`. Normal app usage can then happen through the Tailscale Serve URL.

## Workflow

1. **Scan** → run a Full Scan for initial indexing/backfill, then use Incremental Scan for normal updates. Completed scans queue/reuse incremental Qeo AI tagging without blocking the core worker.
2. **Photos / Library** → browse indexed photos with server-side search, MIME/category/date filters, sorting, pagination, and rich detail metadata. Use `#tag` tokens such as `#family #travel`; multiple tags use AND semantics.
3. **Qeo Tags** → generate local CLIP-backed AI tags, add/remove manual tags from Photo Detail, and use quick tag filters. Qeo tags stay in local SQLite and are not written to OneDrive metadata.
4. **Existing OneDrive albums** → from Photo Detail, lazily browse existing Photos albums and add the current photo. Repeated adds are idempotent membership no-ops; Library never creates a new album.
5. **Single-photo delete** → use the explicit two-step Danger Zone confirmation to move a photo to the **OneDrive Recycle Bin**. The server re-checks the live Graph ETag before deleting.
6. **Duplicates** → verify exact candidates with SHA-256, choose non-keepers, and explicitly approve Recycle Bin deletion.
7. **Similar photos** → run local dHash + CLIP heuristics; review only, with no delete control.
8. **Categories** → run local classification, inspect photo metadata, manually correct labels, and mark reviewed.
9. **Category albums** → sync reviewed category members; reruns are idempotent and only add missing members.
10. **Settings** → inspect connection/runtime/model paths, tune duplicate thresholds, or clear only the thumbnail cache.

Default similar-photo thresholds are conservative:

- dHash distance: `8`
- CLIP cosine similarity: `0.94`

## Metadata behavior

The photo index stores Microsoft Graph metadata when Graph exposes it, including dimensions, capture/modified times, camera make/model, exposure fraction, f-number, focal length, ISO, orientation, and best-effort source identities for **Uploaded/created by** and **Last modified by**.

Microsoft Graph may omit device identity. The app displays only what Graph actually provides and never infers upload device from camera metadata, filename, path, or other heuristics. Missing Graph fields remain nullable and are omitted from the UI.

This metadata path does not download original photo files. Original bytes are streamed only where required for existing cleanup behavior such as SHA-256 exact-duplicate verification; thumbnails continue to flow through the local thumbnail cache API.

## Local development

```bash
npm ci
npm run dev
```

Run the core worker separately:

```bash
WORKER_LANE=core npm run worker
```

Run the ML worker in another terminal when testing classification/similarity/tag jobs:

```bash
WORKER_LANE=ml npm run worker
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
- local Qeo tags and AI tag state in SQLite
- `cache/thumbnails/` — disposable thumbnail cache
- `models/` — local Transformers.js model cache

The **Clear thumbnail cache** setting deletes only `cache/thumbnails/`; it does not delete indexed database records, review/tag state, originals, authentication data, or model files.
