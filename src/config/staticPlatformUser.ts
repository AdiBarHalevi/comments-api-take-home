import { env } from './env'

/**
 * Take-home assumption: all platform API calls act as one static brand account.
 * Values come from validated `.env` (`src/config/env.ts`). Production would
 * resolve the connected account’s OAuth token for the post.
 */

export type StaticPlatformUser = {
  /** Platform user / account id used in list-posts paths (e.g. /{user_id}/media). */
  externalAccountId: string
  /** Handle shown on replies / media. */
  username: string
  /** Sent as access_token / Bearer to Mockoon. */
  accessToken: string
  /** Mockoon (or real) API base URL. */
  apiBaseUrl: string
}

export type PlatformKey = 'instagram' | 'x'

export function getStaticPlatformUser(platform: PlatformKey): StaticPlatformUser {
  if (platform === 'instagram') {
    return {
      externalAccountId: env.IG_EXTERNAL_ACCOUNT_ID,
      username: env.IG_USERNAME,
      accessToken: env.IG_ACCESS_TOKEN,
      apiBaseUrl: env.IG_API_BASE_URL,
    }
  }

  return {
    externalAccountId: env.X_EXTERNAL_ACCOUNT_ID,
    username: env.X_USERNAME,
    accessToken: env.X_ACCESS_TOKEN,
    apiBaseUrl: env.X_API_BASE_URL,
  }
}

export function getStaticPlatformUsers(): Record<PlatformKey, StaticPlatformUser> {
  return {
    instagram: getStaticPlatformUser('instagram'),
    x: getStaticPlatformUser('x'),
  }
}
