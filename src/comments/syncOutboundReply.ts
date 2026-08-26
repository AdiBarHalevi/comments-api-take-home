import type { PrismaClient } from '../generated/prisma/client.js'
import type { PlatformClients } from '../lib/clients/types.js'

/** Worker callback: post the pending reply to the platform and mark SYNCED. */
export async function syncOutboundReply({
  prisma,
  platformClients,
  commentId
}: {
  prisma: PrismaClient
  platformClients: PlatformClients
  commentId: string
}): Promise<void> {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    include: { parent: true, post: true }
  })

  if (!comment) {
    throw new Error(`Comment not found: ${commentId}`)
  }

  if (comment.status !== 'PENDING') {
    return
  }

  if (!comment.parent?.externalId) {
    throw new Error(
      `Parent comment missing platform externalId: ${comment.parentId}`
    )
  }

  if (!comment.text) {
    throw new Error(`Comment missing text: ${comment.id}`)
  }

  const client = platformClients[comment.post.platform]
  const result = await client.createReply({
    externalCommentId: comment.parent.externalId,
    text: comment.text
  })

  await prisma.comment.update({
    where: { id: comment.id },
    data: {
      status: 'SYNCED',
      externalId: result.externalId,
      lastError: null
    }
  })
}

export async function markOutboundReplyFailed({
  prisma,
  commentId,
  lastError
}: {
  prisma: PrismaClient
  commentId: string
  lastError: string
}): Promise<void> {
  await prisma.comment.updateMany({
    where: { id: commentId, status: 'PENDING' },
    data: { status: 'FAILED', lastError }
  })
}
