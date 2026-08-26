import type { Platform } from '../../generated/prisma/client.js'

/** Instagram Graph API comment/reply body limit. */
export const INSTAGRAM_REPLY_MAX_LENGTH = 2200

/** X (Twitter) tweet / reply body limit. */
export const X_REPLY_MAX_LENGTH = 280

/** Absolute ceiling across supported platforms — used for OpenAPI request validation. */
export const REPLY_TEXT_ABSOLUTE_MAX_LENGTH = INSTAGRAM_REPLY_MAX_LENGTH

export function maxReplyLengthForPlatform(platform: Platform): number {
  return platform === 'X' ? X_REPLY_MAX_LENGTH : INSTAGRAM_REPLY_MAX_LENGTH
}
