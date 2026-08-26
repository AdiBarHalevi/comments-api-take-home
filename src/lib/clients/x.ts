import { getStaticPlatformUser } from '../../config/staticPlatformUser.js'
import { createPlatformHttpClient } from './http.js'
import { X_REPLY_MAX_LENGTH } from './limits.js'
import type {
  CreateReplyResult,
  PlatformClient,
  PlatformPost
} from './types.js'

interface XTweetsListResponse {
  data?: Array<{ id: string }>
}

interface XCreateTweetResponse {
  data?: { id?: string }
}

const user = getStaticPlatformUser('x')
const http = createPlatformHttpClient({
  platform: 'X',
  baseUrl: user.apiBaseUrl,
  defaultHeaders: {
    Authorization: `Bearer ${user.accessToken}`
  }
})

export async function listXPosts({
  limit = 5
}: {
  limit?: number
} = {}): Promise<PlatformPost[]> {
  const body = await http.get<XTweetsListResponse>(
    `/2/users/${user.externalAccountId}/tweets`
  )

  return (body.data ?? []).slice(0, limit).map((item) => ({
    externalId: item.id
  }))
}

export async function createXReply({
  externalCommentId,
  text
}: {
  externalCommentId: string
  text: string
}): Promise<CreateReplyResult> {
  if (text.length > X_REPLY_MAX_LENGTH) {
    throw new Error(`X reply text exceeds ${X_REPLY_MAX_LENGTH} characters`)
  }

  const body = await http.post<XCreateTweetResponse>('/2/tweets', {
    json: {
      text,
      reply: { in_reply_to_tweet_id: externalCommentId }
    }
  })

  const externalId = body.data?.id
  if (!externalId) {
    throw new Error('X create reply failed: missing id in response')
  }

  return { externalId }
}

export function createXClient(): PlatformClient {
  return {
    createReply: createXReply
  }
}
