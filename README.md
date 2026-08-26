# Comments API (take-home)

Platform-agnostic REST API for listing comments on published social posts and creating async replies to Instagram / X.

See [docs/assignment.md](docs/assignment.md) for the brief and [docs/design.md](docs/design.md) for schema, assumptions, and design decisions. The OpenAPI contract is [docs/openapi.json](docs/openapi.json).

## Prerequisites

- Node.js 22 (see `.nvmrc`)
- Docker (dev Postgres/Redis/mocks; integration tests use Testcontainers)

## Setup

```bash
cp .env.example .env
npm install
npm run bootstrap   # docker up + prisma generate + migrate
npm run db:seed     # map ~10 mock posts and sample comments
npm run dev         # API at http://127.0.0.1:3000
```

Swagger UI: [http://127.0.0.1:3000/documentation](http://127.0.0.1:3000/documentation)

## API

| Method | Path                            | Notes                                                       |
| ------ | ------------------------------- | ----------------------------------------------------------- |
| `GET`  | `/posts`                        | Local post mappings (`platform` + `externalId`)             |
| `GET`  | `/posts/{postId}/comments`      | Local top-level comments for a post                         |
| `POST` | `/comments/{commentId}/replies` | `202` — queues outbound reply; worker syncs to the platform |

Replies are fire-and-forget for this take-home. Delivery status (`PENDING` → `SYNCED` / `FAILED`) is stored on the comment row for the BullMQ worker; there is no client poll endpoint.

## Scripts

| Script                            | Purpose                                                      |
| --------------------------------- | ------------------------------------------------------------ |
| `npm run bootstrap`               | Start Docker deps, generate Prisma client, deploy migrations |
| `npm run db:seed`                 | Seed posts from mocks + sample comments                      |
| `npm run db:studio`               | Prisma Studio                                                |
| `npm run dev`                     | Watch-compile + Fastify with reload                          |
| `npm start`                       | Production build + start                                     |
| `npm test`                        | Unit tests, then integration (Testcontainers)                |
| `npm run test:unit`               | Unit tests only (no Docker)                                  |
| `npm run test:integration`        | Integration tests via Testcontainers                         |
| `npm run lint` / `npm run format` | ESLint / Prettier                                            |

## Stack

Fastify, Prisma (Postgres), BullMQ (Redis), OpenAPI-driven routes, Dockerized Instagram/X mocks.
