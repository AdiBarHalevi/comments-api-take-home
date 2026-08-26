import type { StaticPlatformUser } from '../../config/staticPlatformUser.js'
import type { CreateReplyResult, PlatformClient, PlatformPost } from './types.js'

interface XTweetsListResponse {
  data?: Array<{ id: string }>
}

interface XCreateTweetResponse {
  data?: { id?: string }
}

export async function listXPosts({
  user,
  limit = 5
}: {
  user: StaticPlatformUser
  limit?: number
}): Promise<PlatformPost[]> {
  const url = new URL(
    `${user.apiBaseUrl}/2/users/${user.externalAccountId}/tweets`
  )

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${user.accessToken}`
    }
  })
  if (!response.ok) {
    throw new Error(`X list posts failed: ${response.status} ${response.statusText}`)
  }

  const body = (await response.json()) as XTweetsListResponse
  return (body.data ?? []).slice(0, limit).map((item) => ({
    externalId: item.id
  }))
}

export async function createXReply({
  user,
  externalCommentId,
  text
}: {
  user: StaticPlatformUser
  externalCommentId: string
  text: string
}): Promise<CreateReplyResult> {
  const response = await fetch(`${user.apiBaseUrl}/2/tweets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${user.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      reply: { in_reply_to_tweet_id: externalCommentId }
    })
  })

  if (!response.ok) {
    throw new Error(
      `X create reply failed: ${response.status} ${response.statusText}`
    )
  }

  const body = (await response.json()) as XCreateTweetResponse
  const externalId = body.data?.id
  if (!externalId) {
    throw new Error('X create reply failed: missing id in response')
  }

  return { externalId }
}

export function createXClient(user: StaticPlatformUser): PlatformClient {
  return {
    createReply: ({ externalCommentId, text }) =>
      createXReply({ user, externalCommentId, text })
  }
}
