# Qeo OneDrive Photo Cleaner v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Docker-first, local-only web app that safely indexes a Microsoft Personal OneDrive photo library, verifies duplicates before deletion, classifies thumbnails locally, and syncs approved categories to OneDrive albums.

**Architecture:** One repository and one Docker image run as two Compose services: `web` (Next.js) and `worker` (persisted background jobs). Both share SQLite plus cache/model/auth state under `/data`; Microsoft Graph is the only remote data plane and Tailscale Serve is optional for tailnet-only access.

**Tech Stack:** Node.js 24 LTS, Next.js 16.3.3 App Router, TypeScript, Tailwind + shadcn/ui, Drizzle ORM over built-in `node:sqlite`, `@azure/msal-node`, Microsoft Graph REST v1.0 via native `fetch`, `@huggingface/transformers` with `Xenova/clip-vit-base-patch32`, `sharp`, Vitest, Docker Compose, GitHub Actions, Gitleaks.

**Spec:** `docs/superpowers/specs/2026-09-14-onedrive-photo-cleaner-design.md`

## Global Constraints

- Public repository; never commit credentials, tokens, SQLite files, model binaries, thumbnails, or runtime logs.
- Host runtime is Docker only; `docker compose up -d` is the primary start command.
- Publish only `127.0.0.1:3000:3000`.
- v0.1 supports Microsoft Personal / OneDrive Home only.
- OAuth is delegated public-client authorization-code + PKCE, authority `https://login.microsoftonline.com/consumers`, no client secret.
- Scopes: `openid profile offline_access Files.ReadWrite`.
- First scan enumerates OneDrive; later scans use DriveItem delta.
- `quickXorHash + size` is candidate filtering only; verified exact duplicates require locally computed SHA-256 equality.
- No deletion without explicit user approval; no permanent-delete code path in v0.1.
- Similar-photo groups never preselect deletion.
- Original files are never persisted; only exact-duplicate candidates are streamed for SHA-256.
- Thumbnail inference is local; models cache under `/data/models`.
- No face recognition, video similarity, cloud AI, Redis, Supabase, public hosting, or Tailscale Funnel.
- SQLite uses WAL mode and migrations.
- All mutation APIs use same-origin JSON guards; Graph/token logs redact secrets.
- Initial Microsoft connection/reconnection is performed from localhost; normal use may occur through Tailscale Serve afterward.

## Target File Structure

```text
.
├── .env.example
├── .gitleaks.toml
├── .github/{dependabot.yml,workflows/ci.yml}
├── Dockerfile
├── docker-compose.yml
├── drizzle.config.ts
├── package.json
├── src/
│   ├── app/
│   │   ├── api/{health,auth,scan,jobs,thumbnails,duplicates,categories,albums,settings}/...
│   │   ├── duplicates/page.tsx
│   │   ├── categories/page.tsx
│   │   ├── scan/page.tsx
│   │   ├── settings/page.tsx
│   │   └── page.tsx
│   ├── components/
│   ├── lib/
│   │   ├── auth/
│   │   ├── albums/
│   │   ├── classification/
│   │   ├── db/
│   │   ├── duplicates/
│   │   ├── graph/
│   │   ├── jobs/
│   │   ├── scan/
│   │   ├── security/
│   │   └── thumbnails/
│   └── worker/
├── drizzle/
└── tests/
```

---

### Task 1: Scaffold the Docker-first application and public-repo safety baseline

**Files:** create `package.json`, lockfile, `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `.gitignore`, `.env.example`, `src/lib/env.ts`, `src/app/api/health/route.ts`, test `tests/env.test.ts`; update `README.md`.

**Interfaces:** `parseEnv()`, `env`, `GET /api/health -> {status:"ok"}`.

- [ ] **Step 1: Scaffold without overwriting existing docs**

```bash
tmpdir="$(mktemp -d)"
npx create-next-app@16.3.3 "$tmpdir/app" --ts --tailwind --eslint --app --src-dir --use-npm --import-alias="@/*"
cp -a "$tmpdir/app/." .
rm -rf "$tmpdir"
npm install drizzle-orm @azure/msal-node @huggingface/transformers sharp zod p-limit tsx
npm install -D drizzle-kit vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
npx shadcn@latest init -d
npx shadcn@latest add button card badge checkbox dialog progress tabs table alert
```

Add scripts: `worker`, `db:generate`, `db:migrate`, `test`, `typecheck`, `validate`.

- [ ] **Step 2: Write failing env test**

```ts
it("defaults to local-safe runtime values", () => {
  const value = parseEnv({});
  expect(value.DATA_DIR).toBe("/data");
  expect(value.APP_BASE_URL).toBe("http://localhost:3000");
  expect(value.DEMO_MODE).toBe(false);
});
```

- [ ] **Step 3: Implement typed env**

```ts
const schema = z.object({
  DATA_DIR: z.string().default("/data"),
  MICROSOFT_CLIENT_ID: z.string().default(""),
  APP_BASE_URL: z.string().url().default("http://localhost:3000"),
  DEMO_MODE: z.enum(["0", "1"]).default("0").transform(v => v === "1"),
  CLIP_MODEL_ID: z.string().default("Xenova/clip-vit-base-patch32"),
});
```

`.env.example` contains empty/safe values only. `.gitignore` excludes `.env*` except `.env.example`, `data/`, `*.db*`, caches, models, and logs.

- [ ] **Step 4: Add Docker runtime**

Use `node:24-bookworm-slim`, `NEXT_TELEMETRY_DISABLED=1`, non-root `nextjs` user, and pre-create/chown `/data`. `docker-compose.yml` runs the same image twice: `web` executes migration + `next start`, `worker` executes `npm run worker`, both mount a named volume at `/data`; only web publishes `127.0.0.1:3000:3000`.

Healthcheck:

```yaml
test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
```

- [ ] **Step 5: Verify and commit**

```bash
npm test -- tests/env.test.ts
npm run lint
npm run typecheck
docker compose config
docker build -t qeo-onedrive-photo-cleaner:test .
git add .
git commit -m "chore: scaffold docker-first photo cleaner"
```

---

### Task 2: SQLite schema, hierarchy index, migrations, and persisted jobs

**Files:** `drizzle.config.ts`, `src/lib/db/{schema,client,migrate,repositories}.ts`, `src/lib/jobs/{types,repository}.ts`, initial migration, `tests/db/jobs.test.ts`.

**Interfaces:** `createDatabase(path)`, `resolveDriveItemPath(db,id)`, `enqueueJob`, `claimNextJob`, `updateJobProgress`, `finishJob`, `failJob`, `requeueInterruptedJobs`.

- [ ] **Step 1: Write failing atomic-claim/requeue tests**

```ts
it("claims one queued job atomically", () => {
  const id = enqueueJob(db, "scan", { mode: "full" });
  expect(claimNextJob(db)?.id).toBe(id);
  expect(claimNextJob(db)).toBeNull();
});

it("requeues interrupted running jobs", () => {
  const id = enqueueJob(db, "scan", {});
  claimNextJob(db);
  requeueInterruptedJobs(db);
  expect(getJob(db, id)?.status).toBe("queued");
});
```

- [ ] **Step 2: Implement schema from spec plus support tables**

Add `drive_nodes` (all DriveItems, including folders) because Graph delta does not reliably provide full paths; derive paths by walking parent IDs. Add `photo_features` (dHash, 4 LSH bands, CLIP embedding, feature ETag), `deletion_log`, `settings`, and `album_sync_items` for idempotent sync.

Required indexes: unique `drive_nodes.drive_item_id`, `drive_nodes.parent_drive_item_id`, unique `photos.drive_item_id`, `(photos.quickxor_hash, photos.size_bytes)`, `(jobs.status, jobs.created_at)`, LSH band indexes, unique `(photo_categories.photo_id, category_id)`, unique `(album_sync_items.category_id, photo_id)`.

- [ ] **Step 3: Configure SQLite**

On open:

```sql
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=5000;
```

- [ ] **Step 4: Generate migration and verify**

```bash
npm run db:generate
DATA_DIR="$(mktemp -d)" npm run db:migrate
npm test -- tests/db/jobs.test.ts
git add drizzle drizzle.config.ts src/lib/db src/lib/jobs tests/db
git commit -m "feat: add sqlite persistence and job queue"
```

---

### Task 3: Microsoft Personal PKCE auth and encrypted MSAL cache

**Files:** `src/lib/auth/{crypto,token-cache,msal}.ts`, `src/lib/security/{redact,request}.ts`, auth routes, auth/security tests.

**Interfaces:** `getOrCreateEncryptionKey`, `encryptJson/decryptJson`, `createPkcePair`, `buildLoginUrl`, `redeemAuthorizationCode`, `getAccessToken`, `assertSameOriginJson`, `redact`.

- [ ] **Step 1: Test AES-GCM round trip and PKCE S256**

```ts
expect(encryptJson({refresh_token:"secret"}, key)).not.toContain("secret");
expect(decryptJson(cipher, key)).toEqual({refresh_token:"secret"});
expect(createPkcePair().verifier.length).toBeGreaterThanOrEqual(43);
```

- [ ] **Step 2: Implement local encryption key**

Default secret source is `/data/auth/app.key`, generated as 32 random bytes, chmod `0600`, never committed. Encrypt serialized MSAL token-cache data to `/data/auth/msal-cache.enc` with AES-256-GCM.

- [ ] **Step 3: Configure MSAL public client**

```ts
new PublicClientApplication({
  auth: {
    clientId: env.MICROSOFT_CLIENT_ID,
    authority: "https://login.microsoftonline.com/consumers",
  },
  cache: { cachePlugin },
  system: { loggerOptions: { piiLoggingEnabled: false, loggerCallback } },
});
```

Use scopes `openid profile offline_access Files.ReadWrite` and callback `http://localhost:3000/api/auth/callback`. Store PKCE verifier + state encrypted locally and reject mismatched callback state.

- [ ] **Step 4: Add request mutation guard**

```ts
export function assertSameOriginJson(request: Request) {
  const origin = request.headers.get("origin");
  const target = new URL(request.url);
  if (!origin || new URL(origin).host !== target.host) throw new Error("Cross-origin mutation blocked");
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) throw new Error("JSON required");
}
```

All state-changing app APIs use this guard; OAuth callback is exempt because PKCE state protects it.

- [ ] **Step 5: Verify redaction and auth tests**

```bash
npm test -- tests/auth tests/security
npm run typecheck
git add src/lib/auth src/lib/security src/app/api/auth tests/auth tests/security
git commit -m "feat: add secretless microsoft personal auth"
```

---

### Task 4: Guarded Microsoft Graph REST boundary

**Files:** `src/lib/graph/{types,client,drive}.ts`, graph tests.

**Interfaces:** `GraphClient.json`, `GraphClient.stream`; `DriveApi.getDeltaPage`, `getThumbnailContent`, `openContent`, `getItem`, `deleteItem`, `createAlbum`, `addAlbumItem`.

- [ ] **Step 1: Test Graph retry behavior**

Mock 429 with `Retry-After`, then success. Retry only `429/502/503/504`, maximum 5 attempts.

- [ ] **Step 2: Add permanent-delete guard**

Reject normalized Graph paths containing `permanentDelete` or recycle-bin permanent deletion. Keep a regression test that proves such a request throws before network I/O.

- [ ] **Step 3: Implement v1.0 endpoints**

```text
GET    /me/drive/root/delta
GET    /me/drive/items/{id}/thumbnails/0/large/content
GET    /me/drive/items/{id}/content
GET    /me/drive/items/{id}
DELETE /me/drive/items/{id}
POST   /drive/bundles
POST   /drive/bundles/{bundle-id}/children
```

`deleteItem` accepts expected ETag and sends `If-Match`.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- tests/graph
npm run typecheck
git add src/lib/graph tests/graph
git commit -m "feat: add guarded microsoft graph client"
```

---

### Task 5: Full/delta scan jobs, worker loop, demo fixtures, Scan UI

**Files:** `src/lib/scan/service.ts`, `src/worker/{handlers,index}.ts`, scan/job routes, scan page, progress component, fixture metadata/images, scan tests.

**Interfaces:** `isPhotoCandidate`, `runScanJob(ctx,jobId,mode)`; `POST /api/scan -> {jobId}`; `GET /api/jobs/:id`.

- [ ] **Step 1: Write reconciliation test**

Fixture contains photo, screenshot MIME image, non-image, deletion, and repeated DriveItem ID. Assert last delta occurrence wins and deleted items are reconciled.

- [ ] **Step 2: Implement page checkpoints**

Per Graph delta page, one transaction: upsert every DriveItem into `drive_nodes`, upsert photo rows only for image candidates, process deletions, persist progress and `nextLink`. Persist final `deltaLink` to `scan_state` only after the last page commits. Derive paths from `drive_nodes`, not `parentReference.path`.

- [ ] **Step 3: Implement restart-safe worker**

```ts
requeueInterruptedJobs(db);
while (true) {
  const job = claimNextJob(db);
  if (!job) { await sleep(1000); continue; }
  try { await dispatchJob(job); finishJob(db, job.id); }
  catch (error) { failJob(db, job.id, redactError(error)); }
}
```

- [ ] **Step 4: Demo mode**

When `DEMO_MODE=1`, scan local fixtures only and never call destructive Graph methods.

- [ ] **Step 5: Scan UI + tests + commit**

```bash
npm test -- tests/scan
npm run typecheck
git add src/lib/scan src/worker src/app/api/scan src/app/api/jobs src/app/scan tests/scan tests/fixtures
git commit -m "feat: add resumable onedrive scan jobs"
```

---

### Task 6: Lazy thumbnail cache and dashboard

**Files:** thumbnail cache/API/component, dashboard page/repository query, thumbnail tests.

**Interfaces:** `getThumbnailPath(photo,driveApi)`, cache key includes DriveItem ID + ETag.

- [ ] Write a failing test proving ETag change causes refetch.
- [ ] Download Graph thumbnail content to a temp file then atomic rename under `/data/cache/thumbnails`; never expose Graph temporary thumbnail URLs to browser.
- [ ] Dashboard metrics: indexed count/bytes, active job, exact groups, similar groups, reclaimable bytes, unreviewed classifications.
- [ ] Verify and commit:

```bash
npm test -- tests/thumbnails
npm run typecheck
git commit -am "feat: add thumbnail cache and dashboard"
```

---

### Task 7: Verified exact duplicates and recycle-bin deletion workflow

**Files:** `src/lib/duplicates/{exact,recommend,delete}.ts`, duplicate UI/API, tests; update worker handlers.

**Interfaces:** `findExactCandidates`, `computeSha256`, `runExactDuplicateJob`, `recommendKeep`, `deleteApprovedExactGroup`.

- [ ] **Step 1: Test that equal quickXor/size is not enough**

Two candidates with same quickXor but different streamed bytes must not create an exact group. Matching streams must create one.

- [ ] **Step 2: Worker verification**

Group by `(size_bytes, quickxor_hash)`, ignore singleton groups, stream only candidates, compute/cache SHA-256 while ETag is unchanged, create exact group only for equal size + equal SHA-256.

- [ ] **Step 3: Deterministic keep recommendation**

Prefer non-copy filename, avoid obvious Downloads/Temp/Recovered paths, then earlier creation timestamp, then stable DriveItem ID tie-break.

- [ ] **Step 4: Test stale-item deletion block**

If `DriveApi.getItem()` returns changed ETag, deletion must stop and `deleteItem` must not run.

- [ ] **Step 5: Delete implementation**

Require verified exact group + reviewed selection; keeper cannot be selected. Re-fetch item, compare ETag, normal Graph DELETE with If-Match, append deletion log, mark local photo deleted. Any stale item returns group to pending review.

- [ ] **Step 6: UI**

Show side-by-side thumbnail/path/metadata/recommendation; preselect delete only for verified exact copies; confirmation dialog shows count + reclaimable bytes.

- [ ] **Step 7: Verify and commit**

```bash
npm test -- tests/duplicates/exact.test.ts tests/duplicates/recommend.test.ts tests/duplicates/delete.test.ts
npm run typecheck
git add src/lib/duplicates src/app/duplicates src/app/api/duplicates src/worker tests/duplicates
git commit -m "feat: add verified duplicate cleanup workflow"
```

---

### Task 8: Similar-photo detection with dHash + CLIP

**Files:** `src/lib/duplicates/similar.ts`, `src/lib/classification/clip.ts`, worker/UI updates, tests.

**Interfaces:** `computeDHash`, `splitDHashBands`, `hammingDistance64`, `ClipService.embedImage`, `cosineSimilarity`.

- [ ] Test compressed/resized fixture remains within dHash distance <= 8 while unrelated image does not.
- [ ] Store four 16-bit LSH bands from 64-bit dHash. Candidate SQL uses shared bands; JS applies Hamming threshold. When both timestamps exist require <=24h; without timestamps require at least two shared bands. This avoids O(n²) all-pairs scanning.
- [ ] Configure Transformers.js once with `transformersEnv.cacheDir = `${env.DATA_DIR}/models`` and use `image-feature-extraction` with `Xenova/clip-vit-base-patch32`; normalize/store 512-float embeddings.
- [ ] Default CLIP cosine threshold `0.94`; similar groups are heuristic and every item starts `selected_for_delete=false`.
- [ ] Verify and commit.

---

### Task 9: Local taxonomy classification and manual review

**Files:** `src/lib/classification/{rules,service}.ts`, Categories UI/API, tests, worker handler.

**Interfaces:** `applyCategoryRules`, `classifyPhoto`; manual source overrides automated sources.

- [ ] Seed exact taxonomy: `family`, `kids`, `couple`, `friends`, `travel`, `food`, `pets`, `work`, `documents`, `screenshots`, `home`, `events`, `nature`, `vehicles`, `shopping`, `memes`, `other`.
- [ ] Write conservative path/name rule tests, e.g. `/Pictures/Screenshots/` -> screenshots, strong invoice/receipt filename -> documents.
- [ ] Use Transformers.js `zero-shot-image-classification` with short prompts; keep up to 3 scores >=0.20, otherwise `other`.
- [ ] Manual API accepts `{photoId, add, remove, markReviewed}`; manual changes survive future classifier jobs until ETag changes and user explicitly reclassifies.
- [ ] Category UI shows source/confidence, add/remove, reviewed status.
- [ ] Verify and commit.

---

### Task 10: Reviewed category -> OneDrive album sync

**Files:** `src/lib/albums/service.ts`, album sync route, Categories UI update, tests.

**Interface:** `syncCategoryAlbum(ctx,categoryId) -> {albumId,added}`.

- [ ] Test only reviewed, non-deleted category members are synced.
- [ ] First sync creates `POST /drive/bundles` with album facet, persists bundle ID, then adds remaining items in bounded batches.
- [ ] Repeat sync only adds members absent from `album_sync_items`, recording successful additions. v0.1 never auto-removes remote album members when local classification changes.
- [ ] Verify and commit.

---

### Task 11: Settings, cache controls, Microsoft setup docs, Tailscale Serve docs

**Files:** Settings page/API, thumbnail cache cleanup, README, tests.

- [ ] Test clearing thumbnail cache does not remove indexed photos.
- [ ] Settings shows Microsoft connection, model status, `/data`, demo badge, dHash threshold default 8, CLIP threshold 0.94; persist thresholds in SQLite `settings`.
- [ ] README Microsoft setup: personal-account compatible app registration, public client enabled, exact loopback redirect `http://localhost:3000/api/auth/callback`, delegated `Files.ReadWrite`, only client ID copied to `.env.local`, no client secret.
- [ ] README Tailscale:

```bash
tailscale serve --bg localhost:3000
tailscale serve status
```

State explicitly that Docker remains localhost-bound, Serve is tailnet-only/ACL-controlled, Funnel is not used, and OAuth reconnect is localhost-only in v0.1.
- [ ] Verify and commit.

---

### Task 12: CI, secret scan, Docker smoke, and merge readiness

**Files:** `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.gitleaks.toml`, README/package scripts.

- [ ] GitHub Actions `validate` job: checkout with full history, Node 24, `npm ci`, lint, typecheck, tests, build with demo env, Docker build, Gitleaks.
- [ ] Dependabot weekly for npm + Actions.
- [ ] Local full validation:

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
docker build -t qeo-onedrive-photo-cleaner:local .
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:3000/api/health
docker compose logs --no-color --tail=200 web worker
docker compose down
```

- [ ] Secret/destructive source audit:

```bash
grep -RniE 'permanentDelete|recycleBin/.*/delete' src && exit 1 || true
grep -RniE 'client_secret|CLIENT_SECRET' src .env.example docker-compose.yml Dockerfile && exit 1 || true
```

Negative permanent-delete strings are allowed only in tests.

- [ ] Demo smoke proves dashboard loads, fixture scan completes, exact fixture appears, similar group is unchecked, categories appear, and no Graph delete call occurs.
- [ ] Gitleaks scan returns zero findings.
- [ ] Final commit only after all commands have fresh exit-0 evidence.

## Final Verification Matrix

| Requirement | Evidence |
|---|---|
| Docker-only host runtime | `docker compose up -d` on clean checkout |
| Local-only default | `127.0.0.1:3000:3000` in Compose |
| No client secret | MSAL public client + public repo source audit |
| Full + delta scan | scan fixture tests + real OneDrive smoke |
| Exact duplicate safety | quickXor candidate test + streamed SHA-256 test |
| Explicit approval | delete service rejects unreviewed selections |
| Recycle Bin only | production Graph client has normal DriveItem DELETE only |
| Similar review-only | persisted selection defaults false |
| Local classification | model cache under `/data/models` and no cloud vision key |
| Manual correction | manual-source precedence tests |
| Album sync | mocked bundle create/add tests |
| Tailscale only | README uses Serve and explicitly excludes Funnel |
| Public-repo safety | `.gitignore` + Gitleaks + source audit |
| Recovery | requeue + delta nextLink checkpoint tests |
| Merge readiness | lint + typecheck + tests + build + Docker smoke + Gitleaks green |

## Implementation Notes

- Use direct Microsoft Graph REST instead of the large Graph SDK so destructive endpoints remain explicit and mockable.
- Prefer built-in `node:sqlite` to avoid native SQLite build friction.
- Keep Graph URL construction in `src/lib/graph/drive.ts`; feature modules must not build arbitrary Graph URLs.
- Every worker handler must be idempotent at page/item boundaries.
- Start CLIP CPU inference with concurrency 1; only optimize after profiling.
- Do not add face/person clustering, video handling, cloud inference, remote OAuth callbacks, Redis, or extra services in v0.1.