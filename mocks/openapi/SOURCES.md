# OpenAPI sources

## X

- **Original:** `GET https://api.x.com/2/openapi.json` (official, OpenAPI 3, ~150 paths)
- **Trimmed artifacts:** `x-comments-api.yaml`, `x-comments-api.json`
- **Kept paths (original operation objects):**
  - `GET /2/users/{id}/tweets` — list a user's posts (bootstrap)
  - `GET/POST /2/tweets`
  - `GET /2/tweets/search/recent` — list replies with `conversation_id`
  - `GET/DELETE /2/tweets/{id}`
  - `PUT /2/tweets/{tweet_id}/hidden`
- Components are copied from the official file and pruned to `$ref`s reachable from those paths.

## Instagram

- **Original comments:** https://github.com/api-evangelist/instagram/blob/main/openapi/instagram-comments-api-openapi.yml
- **Original media (list posts):** https://github.com/api-evangelist/instagram/blob/main/openapi/instagram-media-api-openapi.yml
  (Meta does not publish an official OpenAPI; these are community Graph mirrors.)
- **Artifact:** `instagram-comments-api.yaml`
- **Kept paths:**
  - `GET /{user_id}/media` — list user media/posts (bootstrap)
  - `GET /{media_id}` — get media
  - `GET/POST /{media_id}/comments`
  - `GET/POST/DELETE /{comment_id}`
  - `GET/POST /{comment_id}/replies`
