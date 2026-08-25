# Platform mocks (Mockoon)

Local stand-ins for Instagram and X comment APIs.

| Platform  | Port | Base URL                      |
|-----------|------|-------------------------------|
| Instagram | 3001 | `http://localhost:3001/v21.0` |
| X         | 3002 | `http://localhost:3002`       |

OpenAPI specs under `openapi/` are **trimmed from originals** (not hand-written). See `openapi/SOURCES.md`.

**Acting user:** all mock calls use a static brand account per platform. Copy `.env.example` → `.env` (Zod-validated in `src/config/env.ts`).

## Run

```bash
# API (3000) + Instagram mock (3001) + X mock (3002)
npm run dev

# mocks only
npm run mocks

# API only
npm run dev:api
```

## Smoke-test

```bash
# List posts (bootstrap sources)
curl "http://localhost:3001/v21.0/17841400000000000/media?access_token=test"
curl "http://localhost:3002/2/users/2244994945/tweets"

# Instagram post + comments
curl "http://localhost:3001/v21.0/17841405309211841?access_token=test"
curl "http://localhost:3001/v21.0/17841405309211841/comments?access_token=test"

# X post + conversation replies
curl "http://localhost:3002/2/tweets/1848291029384756291"
curl "http://localhost:3002/2/tweets/search/recent?query=conversation_id:1848291029384756291"
```
