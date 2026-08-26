# Comments API — Design

Supports the requirements in [assignment.md](./assignment.md).

# Assumptions

- Posts are already published on Instagram / X by the existing scheduling product.
- This feature does **not** create posts on platforms — only reads comments and creates replies.
- **Connected social account:** in production, each `Post` belongs to a customer’s linked social account (platform + OAuth token). That disambiguates posts when a workspace connects multiple IG/X accounts — `(platform, externalId)` alone is not globally unique. Conceptually: `Workspace → SocialAccount → Post`. We do **not** model `SocialAccount` in this take-home; each platform mock is one statically configured brand account (see `.env.example` / `src/config/env.ts`).
- **`platform` lives only on `Post`.** Comments resolve it by loading the post (or parent comment’s post) in the service layer.
- **Comment rows are local.** Seed (and any future sync) inserts platform comments with stable internal `id`s so `POST /comments/:commentId/replies` can load the parent. Live “fetch from platform → upsert on every list GET” is left as a production follow-up; this take-home serves comments from the local DB.
- **Authentication / authorization:** not implemented. Assumed to be handled by existing product middleware. Locally, all routes are open against the seeded mock data.

# Schema (Prisma)

Local `Post` rows are pointers to platform posts, not a full local copy of the content.  
One **`Comment`** model covers seeded/platform comments **and** outbound replies (`parentId`). Outbound replies carry `status` (`PENDING` → `SYNCED` / `FAILED`) so the worker can track delivery without a separate job table.

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
  status           CommentStatus? // only outbound replies we create; null for platform comments
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
- **Platform comments** — seeded (or synced) with `externalId`, text, author. `status = null`.
- **Outbound replies we create** — inserted on POST (`status = PENDING` → `SYNCED` / `FAILED`, `externalId` filled after platform accepts).
- **Threading:** top-level → `parentId = null`; reply → `parentId` = parent local `Comment.id`.
- **Same-post integrity:** a reply must belong to the **same post** as its parent (`child.postId === parent.postId`).
- **Modeling note:** a separate `ReplyOperation` table would split “comment exists” from “posting in progress” — cleaner at scale, but one `Comment` row with nullable `status` keeps the take-home simple.
- BullMQ runs the work — no separate Job model for v1.

## How posts get into the DB

A **bootstrap seed** (`npm run db:seed`) lists posts from the platform mocks and inserts mappings (`platform` + `externalId`, plus our `id`).

- Instagram: `GET /{user_id}/media` (static account from env)
- X: `GET /2/users/{id}/tweets` (static account from env)
- Mix across both platforms (e.g. ~5 each).
- Seed also inserts **5 sample top-level comments** per post for local list/reply demos.
- Safe to re-run (upsert on `(platform, externalId)` / `(postId, externalId)`).

# Comments

## Read APIs

**Pagination:** query params `offset` (optional, default **0**) and `limit` (optional, default **50**, max **100**). Response includes `pagination.nextOffset` (or `null` when done).

### `GET /posts/:postId/comments?offset=&limit=50`

Returns **local** top-level comments for the post (`parentId = null`). Clients use `id` for reply URLs; `externalId` is exposed for debugging/transparency.

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
  "pagination": { "nextOffset": null }
}
```

## Reply to a comment (required)

Instagram/X reply calls can be slow, rate-limited, or flaky. We **do not block the HTTP request** on the platform — the handler returns quickly and a **BullMQ worker** performs the outbound call with retries.

Outbound replies are **async** (`202`). The local `PENDING` `Comment` is a durable record for the worker. For this take-home the API is fire-and-forget: clients get an acknowledgment and do not poll for `SYNCED` / `FAILED`. A get-by-id or webhook status surface would be the production follow-up.

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

### Flow

1. Load parent `Comment` by **local** `:commentId` (must have a platform `externalId`, or 400).
2. Insert local `Comment` with `parentId = :commentId`, `postId = parent.postId`, `status = PENDING`.
3. **Enqueue** outbound job (BullMQ / Redis). Use the comment `id` as the BullMQ `jobId`.
   - **Success** → return `202` with the `PENDING` acknowledgment.
   - **Persistent enqueue failure** → update comment to `status = FAILED`, set `lastError`, return **`503 Service Unavailable`**.
4. Worker calls `platformClient.createReply(parent.externalId, text)`.
5. On success → `status = SYNCED`, store platform `externalId`.
6. On worker failure → BullMQ retries with backoff; after max attempts → `status = FAILED`, store `lastError`.

**Platform retry caveat:** worker retries reuse the **same** BullMQ job and `Comment` row. Instagram/X do **not** guarantee idempotent replies — if the platform accepts the reply but our worker times out, a retry can create a **duplicate** on the platform. Full reconciliation is out of scope; calling out the failure mode is enough.

# Architecture

## Platform clients (multi-platform)

Public REST stays platform-agnostic. Platform differences live behind clients selected by **`post.platform`** in the service / worker (not HTTP middleware).

```ts
interface PlatformClient {
  createReply(args: {
    externalCommentId: string
    text: string
  }): Promise<{ externalId: string }>
}

type PlatformClients = Record<Platform, PlatformClient>

const platformClients: PlatformClients = {
  INSTAGRAM: createInstagramClient(/* static account from env */),
  X: createXClient(/* static account from env */)
}
```

Seed uses separate platform helpers (`listInstagramPosts` / `listXPosts`) to bootstrap `Post` mappings. Outbound reply work only needs `createReply`.

- Routes stay thin; services load the parent/`Post`, pick the client, then call it.
- Adding a platform later = new client + one registry entry — **no** REST route changes.

## Resolving platform

- `GET /posts/:postId/comments` → local DB list for that post.
- `POST /comments/:commentId/replies` → load parent `Comment` + its `Post` → enqueue `createReply` on that platform.

## Outbound reply queue

- One queue for **create reply** jobs (not a general event bus for v1).
- Retries: exponential backoff, capped attempts.
- Mockoon latency / error responses exercise this path locally.

### DB → queue reliability

Insert and enqueue are two steps (Postgres vs Redis). Immediate enqueue failures are handled in the request path:

```ts
const comment = await db.comment.create({ status: 'PENDING', ... })

try {
  await enqueue(/* jobId = comment.id */)
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

**Remaining edge case:** process crash **after** DB commit, **before** enqueue — try/catch never runs. A transactional outbox would close that gap in production; out of scope here.

## Consistency model (v1)

| Path              | Behavior                                                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Read** comments | Serve local top-level comments for the post (seeded / previously synced).                                                    |
| **Create reply**  | Load parent → insert outbound `Comment` (`PENDING`) → queue → platform → `SYNCED` / `FAILED`. Client gets `202` and moves on. |
| **Post mapping**  | `Post` rows link our API ids to platform post ids.                                                                           |

**What we store locally and why:**

- **`Post`** — routing (`platform` + `externalId`).
- **`Comment`** — platform comments (stable ids for reply) **and** outbound replies (async `status` for the worker).

The `202` body acknowledges the request. `status` updates happen in the background; this take-home does not expose a poll endpoint.

## Out of scope (intentionally)

- Live platform fetch + upsert on list endpoints
- `GET /comments/:id` (status poll) and `GET /comments/:id/replies`
- Auth / `SocialAccount` modeling
- Transactional outbox / full platform idempotency reconciliation
- Caching or webhook-driven sync at scale

# AI usage

AI was used to critique the design, surface edge cases (queue failure modes, idempotency scope), and pressure-test API/schema decisions. Architecture choices (async replies via BullMQ, platform client boundary, unified `Comment` model with `status`) were reviewed and adapted manually.
