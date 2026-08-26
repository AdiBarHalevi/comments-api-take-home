import type { Platform } from '../../generated/prisma/client.js'

export type PlatformPost = {
  externalId: string
}

export type CreateReplyResult = {
  externalId: string
}

/**
 * Platform-specific adapter. Public REST stays agnostic; services select a
 * client by `post.platform`.
 */
export interface PlatformClient {
  createReply(args: {
    externalCommentId: string
    text: string
  }): Promise<CreateReplyResult>
}

export type PlatformClients = Record<Platform, PlatformClient>
