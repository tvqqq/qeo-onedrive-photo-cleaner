# Qeo OneDrive Photo Cleaner — Design Specification

**Date:** 2026-09-14  
**Repository:** `tvqqq/qeo-onedrive-photo-cleaner`  
**Visibility:** Public  
**Runtime:** Docker Compose, local-first  
**Target account:** Microsoft Personal / OneDrive Home only for v0.1

## 1. Goal

Build a local-first web app that helps clean and organize a large OneDrive photo library without copying the full library to another cloud service.

The app must:

- index photo metadata from OneDrive Personal;
- detect duplicate photos safely;
- let the user explicitly review and approve every deletion;
- move approved deletions to the OneDrive Recycle Bin, never permanently delete in v0.1;
- classify photos into a small fixed taxonomy using local inference;
- let the user review classifications before creating/updating OneDrive albums;
- run entirely through Docker Compose;
- bind locally by default and use Tailscale Serve for remote access within the tailnet;
- keep all credentials, tokens, local databases, model files, and image caches out of the public repository.

## 2. Non-goals for v0.1

- Microsoft work/school accounts.
- Multi-user authentication or tenancy.
- Public internet hosting.
- Tailscale Funnel.
- Face recognition or person identity recognition.
- Automatic destructive cleanup.
- Permanent deletion.
- Video similarity processing.
- RAW-focused workflows.
- Native mobile apps.
- Cloud AI as the default classifier.

## 3. Architecture

The application is a local Docker Compose stack with one codebase and two runtime processes built from the same image:

1. **web** — Next.js UI/API.
2. **worker** — long-running scan, hashing, thumbnail, duplicate, and classification jobs.

Both processes share a persistent `/data` Docker volume. No Redis or external database is required.

```text
Browser
  |
  v
localhost:3000
  |
Docker Compose
  |-- web (Next.js)
  |-- worker (same application image)
  `-- persistent volume /data
        |-- app.db
        |-- cache/
        |-- models/
        `-- auth/

Microsoft Graph <----> web / worker
Tailscale Serve -----> localhost:3000   (optional, tailnet only)
```

### Why two processes

A 200GB library can require long scans and image-processing jobs. Keeping the worker separate prevents HTTP requests from owning long-running work while avoiding the complexity of a queue service. Jobs and checkpoints are persisted in SQLite so restart/recovery is deterministic.

## 4. Runtime and Docker

The host requires only:

- Docker / Docker Desktop;
- a browser;
- Tailscale only when tailnet access is desired.

Default startup:

```bash
docker compose up -d
```

The web service publishes only:

```text
127.0.0.1:3000:3000
```

It must not bind to all LAN interfaces by default.

Persistent state uses a named Docker volume mounted at `/data`. The repository must not contain runtime state.

For remote access inside the tailnet, Tailscale runs on the host and proxies the local web port with Tailscale Serve. Funnel is explicitly out of scope.

## 5. Microsoft authentication

v0.1 supports Microsoft Personal accounts only.

Authentication uses a public-client OAuth authorization-code flow with PKCE. The app registration must not require a client secret.

Required delegated scopes are limited to what the app needs, initially:

- `openid`
- `profile`
- `offline_access`
- `Files.ReadWrite`

`Files.ReadWrite.All` is not requested unless a concrete API requirement is proven during implementation.

### Token storage

MSAL token-cache data is local runtime state and never enters source control.

The cache is encrypted at rest with `APP_ENCRYPTION_KEY`, supplied via `.env.local` or another local secret mechanism. The repository contains only `.env.example` with empty placeholders.

Tokens must never be written to logs.

## 6. OneDrive indexing

The first scan enumerates the personal OneDrive hierarchy and stores photo-related DriveItem metadata locally.

The index stores only metadata and derived values, not original photo contents.

Subsequent scans use Microsoft Graph delta tracking and persist the latest delta link. Changed or deleted items update local state without rescanning the complete drive.

A file is considered a photo candidate when Graph exposes a photo/image-compatible item or when its MIME type/extension matches a supported image type.

## 7. Data model

### `photos`

- `id`
- `drive_item_id` (unique)
- `parent_drive_item_id`
- `name`
- `path`
- `mime_type`
- `size_bytes`
- `quickxor_hash`
- `sha256`
- `width`
- `height`
- `taken_at`
- `created_at`
- `modified_at`
- `etag`
- `thumbnail_state`
- `classification_state`
- `deleted_remote_at`

### `scan_state`

- `id`
- `delta_link`
- `last_full_scan_at`
- `last_incremental_scan_at`

### `jobs`

- `id`
- `type`
- `status`
- `progress_current`
- `progress_total`
- `payload_json`
- `error_message`
- `created_at`
- `started_at`
- `finished_at`

### `duplicate_groups`

- `id`
- `type` (`exact`, `similar`)
- `confidence`
- `status` (`pending`, `reviewed`, `actioned`, `dismissed`)
- `reclaimable_bytes`
- `created_at`
- `reviewed_at`

### `duplicate_group_items`

- `group_id`
- `photo_id`
- `recommended_keep`
- `selected_for_delete`
- `selection_source` (`recommendation`, `manual`)

### `categories`

- `id`
- `slug`
- `name`

### `photo_categories`

- `photo_id`
- `category_id`
- `confidence`
- `source` (`rule`, `local_ai`, `manual`)
- `reviewed`

### `album_sync`

- `category_id`
- `onedrive_bundle_id`
- `last_synced_at`
- `status`

SQLite runs in WAL mode. Migrations are versioned in source control.

## 8. Duplicate detection

### 8.1 Exact duplicate candidate discovery

Use:

```text
same file size + same quickXorHash
```

This is an efficient candidate filter because `quickXorHash` is available for OneDrive Home, but it is not treated as cryptographic proof of equality.

### 8.2 Exact duplicate verification

Before a group can be labeled `exact`, the worker streams each candidate file from OneDrive and computes SHA-256 locally.

- Originals are not persisted to disk.
- The computed SHA-256 digest is cached in SQLite.
- Only candidates require full-content streaming; the entire library does not.

A verified exact group requires matching file size and matching SHA-256.

### 8.3 Keep recommendation

The app can recommend which copy to keep using deterministic rules such as:

1. richer useful metadata;
2. higher dimensions when candidates differ before verification;
3. preferred/original-looking path;
4. filename without copy suffixes such as `(1)`, `copy`, or `duplicate`;
5. consistent capture timestamp.

For verified exact copies, content is identical, so the recommendation primarily protects path/name/metadata context.

### 8.4 Delete behavior

No file is deleted automatically.

The UI may preselect a recommendation for verified exact groups, but the user must explicitly approve the deletion batch.

Deletion uses the normal Microsoft Graph DriveItem delete API, which sends the item to the OneDrive Recycle Bin. v0.1 contains no permanent-delete endpoint or UI.

Before issuing delete, the app checks the stored item identity and current ETag when available. If the item changed after review, deletion is blocked and the group returns to review.

## 9. Similar-photo detection

Similar-photo detection is review-only.

Pipeline:

```text
thumbnail
  -> perceptual hash candidate search
  -> local image embedding
  -> similarity score
  -> review queue
```

Rules:

- similar groups never auto-select files for deletion;
- thresholds are configurable in Settings;
- the app labels similarity as a heuristic, not proof of duplication;
- user dismissals are persisted so the same pair is not repeatedly surfaced unless either item changes.

## 10. Thumbnail strategy

Thumbnails are fetched lazily from Microsoft Graph and cached locally under `/data/cache`.

The app does not download original photos for classification. Originals are streamed only when exact-duplicate verification needs SHA-256.

Cache entries are disposable and can be cleared from Settings without affecting the database index.

## 11. Local classification

The default classifier runs locally inside Docker using a CLIP-compatible image embedding model through an ONNX/Transformers.js-style runtime.

The model is downloaded at runtime into `/data/models` and is never committed to Git.

Initial fixed taxonomy:

- Family
- Kids
- Couple
- Friends
- Travel
- Food
- Pets
- Work
- Documents
- Screenshots
- Home
- Events
- Nature
- Vehicles
- Shopping
- Memes
- Other

A photo may belong to multiple categories.

Classification order:

1. deterministic metadata/path/filename rules;
2. local image model for unresolved or low-confidence items;
3. manual user correction.

Manual corrections override automated classifications.

No face recognition or identity labeling is performed.

## 12. Category review and OneDrive albums

The app distinguishes local categories from OneDrive albums.

```text
Category = local app metadata
Album    = user-approved OneDrive organization
```

Automated classification never creates albums directly.

For a category, the user can review its photos and choose **Create/Sync OneDrive Album**. The app then creates or updates a personal OneDrive album/bundle and records the remote bundle ID in `album_sync`.

A single photo may be included in multiple albums without duplicating its underlying file.

## 13. UI

### Dashboard

Shows:

- indexed photo count;
- indexed storage size;
- scan status;
- verified exact duplicate groups;
- similar-photo groups;
- estimated reclaimable storage;
- unclassified / unreviewed counts.

### Scan

Supports:

- initial full scan;
- incremental scan;
- job progress;
- resumable/retry states;
- API throttling/error visibility.

### Duplicates

Supports:

- exact/similar filters;
- side-by-side thumbnails;
- file metadata and OneDrive path;
- keep recommendation;
- explicit selection for deletion;
- per-group and batch approval;
- stale-item protection before deletion.

### Categories

Supports:

- category browsing;
- confidence display;
- manual add/remove category;
- reviewed state;
- create/sync OneDrive album.

### Settings

Supports:

- Microsoft connection state;
- local model status;
- similar-photo thresholds;
- cache usage/cleanup;
- local data path information;
- Tailscale Serve setup guidance.

## 14. Security requirements

The repository is public and must be safe to clone.

### Never committed

- `.env`
- `.env.local`
- OAuth access/refresh tokens
- encrypted token-cache files
- `APP_ENCRYPTION_KEY`
- SQLite databases
- thumbnails
- model binaries
- logs containing credentials

### Repository controls

- strict `.gitignore`;
- `.env.example` contains only variable names and safe examples;
- Gitleaks runs in CI;
- dependency scanning/Dependabot is enabled where available;
- secret-scanning support is enabled where GitHub provides it;
- logs redact authorization headers and token-shaped values;
- Docker image runs as non-root unless a dependency proves this impossible;
- no telemetry by default.

### Destructive-operation controls

- no auto-delete;
- no permanent-delete code path in v0.1;
- only verified exact groups may have delete recommendations preselected;
- similar groups require manual selection;
- changed/stale remote items block deletion;
- every delete action is recorded locally with timestamp and DriveItem ID.

## 15. Failure and recovery behavior

- Graph throttling (`429`) honors `Retry-After` and retries with bounded backoff.
- Expired authentication pauses jobs rather than failing them destructively.
- Worker restart resumes queued/in-progress jobs from persisted checkpoints where safe.
- Thumbnail/model failures do not block metadata indexing.
- One failed item does not abort a full scan; errors are counted and surfaced for retry.
- A missing/deleted remote item is reconciled during delta sync.
- SQLite migrations run before web/worker startup and abort startup on migration failure.

## 16. Testing and validation

Required before v0.1 is considered merge-ready:

- unit tests for duplicate candidate grouping;
- unit tests for SHA-256 exact verification decisions;
- unit tests for keep recommendation rules;
- unit tests for category rules;
- mocked Microsoft Graph tests for scan, delta, thumbnails, album sync, and recycle-bin deletion;
- destructive-operation tests proving no permanent-delete request is used;
- authentication/token-redaction tests;
- lint;
- TypeScript typecheck;
- production build;
- Docker image build;
- `docker compose` startup smoke test;
- health-check verification;
- Gitleaks scan.

A demo/dry-run mode uses fixture metadata and local test images so duplicate/deletion UI can be exercised without touching a real OneDrive account.

## 17. Implementation boundaries

Use the existing architecture before introducing abstractions. Keep the project as one repository and one application image.

Expected high-level modules:

```text
src/
  app/                  # Next.js routes/UI
  lib/
    auth/               # Microsoft auth/token cache
    graph/              # Graph API boundary
    db/                 # SQLite + migrations/repositories
    jobs/               # persisted job orchestration
    scan/               # full/delta indexing
    duplicates/         # exact + similar detection
    classification/     # rules + local model
    albums/             # OneDrive bundle sync
    security/           # redaction and destructive guards
  worker/               # background job runner entrypoint
```

Avoid microservices, Redis, Supabase, and external queues for v0.1.

## 18. Acceptance criteria

v0.1 is successful when the user can:

1. start the entire app with Docker Compose;
2. open it only at localhost by default;
3. connect a Microsoft Personal account without a client secret;
4. index a real OneDrive photo library and resume via delta sync;
5. see duplicate candidates without downloading all originals;
6. verify exact duplicates with local SHA-256 before any delete recommendation;
7. explicitly approve a deletion and observe the item move to OneDrive Recycle Bin;
8. review similar-photo candidates without automatic deletion;
9. classify thumbnails locally into the fixed taxonomy;
10. correct classifications manually;
11. review a category and create/sync a OneDrive album;
12. access the local app from another trusted device through Tailscale Serve;
13. run repository validation with no committed secrets or runtime data.

## 19. Official API assumptions verified for this design

The design relies on the following current platform behavior:

- Microsoft Graph exposes Drive/DriveItem APIs for OneDrive Personal.
- `quickXorHash` is available for OneDrive Home and is used only as a candidate filter.
- DriveItem delta supports incremental change tracking for personal OneDrive.
- normal DriveItem delete moves an item to the recycle bin.
- personal OneDrive exposes drive bundles/albums.
- Tailscale Serve shares a local service only within the tailnet; Funnel is the public-internet mechanism and is not used by this project.
