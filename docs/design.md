# Comments API — Design

Supports the requirements in [assignment.md](./assignment.md).

# Assumptions

- Posts are already published on Instagram / X by the existing scheduling product.
- This feature does **not** create posts on platforms — only reads comments and creates replies.
- **Connected social account:** in production, each `Post` belongs to a customer’s linked social account (platform + OAuth token). That disambiguates posts when a workspace connects multiple IG/X accounts — `(platform, externalId)` alone is not globally unique. Conceptually: `Workspace → SocialAccount → Post`. We do **not** model `SocialAccount` in this take-home; each platform mock is one statically configured brand account (see `.env.example` / `src/config/env.ts`).
- **`platform` lives only on `Post`.** Comments resolve it by loading the post in the service layer.
- **Comment materialization:** platform comments are **upserted locally when first listed** so API clients get stable internal ids. `externalId` is the platform identifier; `id` is ours. This is required so `POST /comments/:commentId/replies` can load the parent row.
- **Authentication / authorization:** not implemented in this take-home. Assumed to be handled by existing product middleware (session/API key → workspace id). Services would verify the requested `Post` (and its comments) belongs to that workspace before read/reply. Locally, all routes are open against the seeded mock data.

# Schema (Prisma)

Local `Post` rows are pointers to platform posts, not a full local copy of the content.  
One **`Comment`** model covers materialized platform comments **and** outbound replies (`parentId`). Outbound replies carry `status` (`PENDING` → `SYNCED` / `FAILED`) so a single id works for async polling via `GET /comments/:id`.

```prisma
enum Platform {
  INSTAGRAM @map("instagram")
  X         @map("x")
}

enum CommentStatus {
  PENDING @map("pending")
  SYNCED  @map("synced")
  FAILED  @map("failed")
}

model Post {
  id         String   @id @default(uuid())
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")
  externalId String   @map("external_id") // platform post / media / tweet id
  platform   Platform
  isActive   Boolean  @default(true) @map("is_active")
  comments   Comment[]

  @@unique([platform, externalId])
  @@map("posts")
}

model Comment {
  id               String         @id @default(uuid())
  createdAt        DateTime       @default(now()) @map("created_at")
  updatedAt        DateTime       @updatedAt @map("updated_at")
  externalId       String?        @map("external_id") // platform id; null while outbound reply is pending
  text             String?
  authorUsername   String?        @map("author_username")
  authorExternalId String?        @map("author_external_id")
  isActive         Boolean        @default(true) @map("is_active")
  status           CommentStatus? // only outbound replies we create; null for materialized platform comments
  lastError        String?        @map("last_error")

  postId   String  @map("post_id")
  post     Post    @relation(fields: [postId], references: [id])
  parentId String? @map("parent_id")
  parent   Comment?  @relation("CommentThread", fields: [parentId], references: [id])
  replies  Comment[] @relation("CommentThread")

  @@unique([postId, externalId])
  @@index([postId, parentId])
  @@index([parentId])
  @@map("comments")
}
```

- `@@unique([postId, externalId])` — one local row per platform comment on a post. Pending outbound replies have `externalId = null` until `SYNCED` (Postgres allows multiple nulls in a unique index).
- **Materialized platform comments** — upserted on list GET (`externalId`, text, author, `parentId`). `status = null`.
- **Outbound replies we create** — inserted on POST (`status = PENDING` → `SYNCED` / `FAILED`, `externalId` filled after platform accepts).
- **Threading:** top-level → `parentId = null`; reply → `parentId` = parent local `Comment.id`. When upserting from the platform, resolve `parentExternalId` → local parent id (upsert parent first if needed, or link in same pass).
- **Same-post integrity:** a reply must belong to the **same post** as its parent (`child.postId === parent.postId`). The service validates on create/upsert and returns **`400 Bad Request`** if violated.
- **Modeling note:** a separate `ReplyOperation` table would split “comment exists” from “posting in progress” — cleaner at scale, but one `Comment` row with nullable `status` keeps the take-home API simple (`POST` and `GET /comments/:id` share the same id).
- BullMQ runs the work — no separate Job model for v1.

## How posts get into the DB

A **bootstrap CLI command** (e.g. `npm run bootstrap` / `npm run db:seed`) lists posts from the platform mocks and inserts **~10** into the local DB as mappings only (`platform` + `externalId`, plus our `id`).

- Instagram: `GET /{user_id}/media` (static account from env)
- X: `GET /2/users/{id}/tweets` (static account from env)
- Mix across both platforms (e.g. ~5 each).
- Seed also inserts **5 sample top-level comments** per post (synthetic local rows for dev convenience). This is separate from runtime materialization on list GET.
- Safe to re-run (upsert on `(platform, externalId)` / `(postId, externalId)`).

Comments are fetched from the platform on list GETs, **materialized locally**, then returned with our ids (see Read APIs).

# Comments

## Read APIs

List endpoints fetch from the platform, **upsert** into `Comment` by `(postId, externalId)`, then return **local** rows. Clients use `id` for reply URLs; `externalId` is exposed for debugging/transparency.

**Pagination (both list endpoints):**

- Query params: `cursor` (optional), `limit` (optional, default **50**).
- `limit` must be **1–100**; out of range → **`400 Bad Request`**.
- `cursor` is **opaque** to API consumers — pass through whatever we returned in `pagination.nextCursor`. Platform clients translate it to IG/X paging tokens internally.
- Omit `nextCursor` (or return `null`) when there is no next page.

### `GET /posts/:postId/comments?cursor=&limit=50` (paginated)

1. `comments.service` loads `Post` → `PlatformClient`.
2. `listComments(post.externalId, cursor)` → normalized platform comments.
3. Upsert each into `Comment` (set `text`, author, `parentId` from platform parent link).
4. Return local comments + opaque `nextCursor` (adapter translates platform cursor).

Example response:

```json
{
  "data": [
    {
      "id": "local-uuid",
      "externalId": "17858893269000001",
      "text": "Nice post!",
      "parentId": null,
      "authorUsername": "fan_account"
    }
  ],
  "pagination": { "nextCursor": "..." }
}
```

### `GET /comments/:commentId/replies?cursor=&limit=50` (paginated)

1. Load parent `Comment` (must exist — typically materialized by a prior comments GET).
2. `listReplies(parent.externalId, cursor)` on the platform.
3. Upsert replies with `parentId = :commentId`.
4. Return local rows + `nextCursor`.

We do **not** merge local `PENDING` outbound replies into these paginated lists (see Consistency model).

### `GET /comments/:commentId`

Load a single `Comment` by local id. Used to poll outbound reply status after `POST /comments/:commentId/replies` (same id returned in the `202` body).

- Materialized platform comments → `status` omitted / `null`, `externalId` set.
- Outbound replies → `status` is `PENDING`, `SYNCED`, or `FAILED`; `externalId` null until `SYNCED`; `lastError` set on `FAILED`.

Example (outbound reply, still pending):

```json
{
  "id": "local-uuid",
  "status": "PENDING",
  "text": "Thanks!",
  "parentId": "parent-uuid",
  "externalId": null,
  "lastError": null
}
```

Example (synced):

```json
{
  "id": "local-uuid",
  "status": "SYNCED",
  "text": "Thanks!",
  "parentId": "parent-uuid",
  "externalId": "17858893269000002",
  "lastError": null
}
```

- **`404`** if no row exists.

## Reply to a comment (required)

Instagram/X reply calls can be slow, rate-limited, or flaky. We **do not block the HTTP request** on the platform — the handler returns quickly and a **BullMQ worker** performs the outbound call with retries.

Outbound replies are **async** (`202`). The local `PENDING` `Comment` is a durable record of the operation; poll the same id via `GET /comments/:id`.

### API

`POST /comments/:commentId/replies`

- Body: `{ "text": "Thanks!" }`
- Response: **`202 Accepted`**
  ```json
  {
    "id": "<local-comment-id>",
    "status": "PENDING",
    "text": "Thanks!",
    "parentId": "<commentId>"
  }
  ```
- Poll **`GET /comments/:id`** (same id) until `SYNCED` or `FAILED`. After `SYNCED`, the reply also appears in normal platform list GETs.

### Flow

1. `comments.service` loads parent `Comment` by **local** `:commentId` (materialized earlier, or 404).
2. Insert local `Comment` with `parentId = :commentId`, `postId = parent.postId`, `status = PENDING`.
3. **Enqueue** outbound job (BullMQ / Redis) in a try/catch with short retries (e.g. 3 attempts). Use the comment `id` as the BullMQ `jobId`.
   - **Success** → return `202` with the `PENDING` comment.
   - **Persistent enqueue failure** → update comment to `status = FAILED`, set `lastError`, return **`503 Service Unavailable`**.
4. Worker calls `platformClient.createReply(parent.externalId, text)`.
5. On success → `status = SYNCED`, store platform `externalId`.
6. On worker failure → BullMQ retries with backoff; after max attempts → `status = FAILED`, store `lastError`.

**Platform retry caveat:** worker retries reuse the **same** BullMQ job and `Comment` row. Instagram/X do **not** guarantee idempotent replies — if the platform accepts the reply but our worker times out, a retry can create a **duplicate** on the platform. Full reconciliation is out of scope for this take-home; calling out the failure mode is enough.

# Architecture

## Platform clients (multi-platform)

Public REST stays platform-agnostic. Platform differences live behind clients selected by the **service** layer (not HTTP middleware).

```ts
interface PlatformComment {
  externalId: string
  text: string
  author: { externalId?: string; username?: string }
  createdAt: Date
  parentExternalId?: string
}

interface Page<T> {
  data: T[]
  nextCursor?: string
}

interface PlatformClient {
  listPosts(accountId: string): Promise<PlatformPost[]>
  listComments(
    externalPostId: string,
    cursor?: string
  ): Promise<Page<PlatformComment>>
  listReplies(
    externalCommentId: string,
    cursor?: string
  ): Promise<Page<PlatformComment>>
  createReply(
    externalCommentId: string,
    text: string
  ): Promise<{ externalId: string }>
}

class InstagramClient implements PlatformClient {
  /* maps createReply → IG Graph comment reply API */
}
class XClient implements PlatformClient {
  /* maps createReply → X POST /2/tweets reply payload */
}

class PlatformClientRegistry {
  constructor(private readonly clients: Record<Platform, PlatformClient>) {}

  get(platform: Platform): PlatformClient {
    const client = this.clients[platform]
    if (!client) throw new UnsupportedPlatformError(platform)
    return client
  }
}

// wired once at startup; injected into services for testability
const platformClientRegistry = new PlatformClientRegistry({
  INSTAGRAM: new InstagramClient(),
  X: new XClient()
})
```

Services take `PlatformClientRegistry` (constructor injection) rather than importing a module-level map — fake clients in tests without patching globals.

```ts
// comments.service.ts (sketch)
class CommentsService {
  constructor(private readonly platformClients: PlatformClientRegistry) {}

  async listPostComments(postId: string, cursor?: string) {
    const post = await db.post.findUniqueOrThrow({ where: { id: postId } })
    const client = this.platformClients.get(post.platform)
    // ...
  }
}
```

Service upserts `PlatformComment` → local `Comment` before returning API responses.

- Routes stay thin; `comments.service.ts` (and similar) load the `Post`, map `post.platform` → client, then call it.
- Adding a platform later = new client + one registry entry — **no** REST route changes.

## Resolving platform (service + mapper)

- `GET /posts/:postId/comments` → load `Post` → platform fetch → upsert → return local rows.
- `GET /comments/:commentId` → load single `Comment` (poll outbound reply status).
- `GET|POST /comments/:commentId/replies` → load materialized parent `Comment` → platform fetch or outbound create.

## Outbound reply queue

- One queue for **create reply** jobs (not a general event bus for v1).
- Retries: exponential backoff, capped attempts, platform-aware handling of `429`.
- Mockoon latency / error responses are used to exercise this path locally.

### DB → queue reliability

Insert and enqueue are two steps (Postgres vs Redis). **v1 handles immediate enqueue failures** in the request path:

```ts
const comment = await db.comment.create({ status: 'PENDING', ... })

try {
  await enqueueWithRetries(comment.id, { commentId: comment.id }, { jobId: comment.id })
} catch {
  await db.comment.update({
    where: { id: comment.id },
    data: { status: 'FAILED', lastError: 'Queue unavailable' },
  })
  throw serviceUnavailable()
}
```

- Covers Redis down / `queue.add` throws — no orphan `PENDING` rows.
- BullMQ `jobId = comment.id` — one job per outbound reply; worker retries reuse that job.

**Remaining edge case:** process crash **after** DB commit, **before** enqueue — try/catch never runs. A transactional outbox would close that gap in production; out of scope for this take-home.

## Consistency model (v1)

| Path                        | Behavior                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Read** comments / replies | Fetch from platform → **upsert materialize** → return local ids. We do not pre-sync the full thread; only what each page returns is stored. |
| **Create reply**            | Load materialized parent → insert outbound `Comment` (`PENDING`) → queue → platform → `SYNCED` / `FAILED`. Poll via `GET /comments/:id`.    |
| **Post mapping**            | `Post` rows link our API ids to platform post ids.                                                                                          |

**What we store locally and why:**

- **`Post`** — routing (`platform` + `externalId`).
- **`Comment`** — materialized platform comments (stable ids for reply) **and** outbound replies (async `status`).

List GETs do **not** merge local `PENDING` outbound replies into platform pagination. Pending replies are visible via `202` and `GET /comments/:id`; after `SYNCED`, the next list GET upserts them from the platform like any other comment.

## Scalability (brief)

Each list request still hits the platform (latency / rate limits). Materialization adds DB writes but keeps the API coherent. At scale we’d add caching or webhook-driven sync instead of upsert-on-every-read — out of scope here.

# AI usage

AI was used to critique the design, surface edge cases (materialize-on-read vs reply flow, queue failure modes, idempotency scope), and pressure-test API/schema decisions. Architecture choices (async replies via BullMQ, platform client boundary, unified `Comment` model with `status`) were reviewed and adapted manually.
