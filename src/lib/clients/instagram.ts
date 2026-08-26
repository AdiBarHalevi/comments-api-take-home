import { getStaticPlatformUser } from '../../config/staticPlatformUser.js'
import { createPlatformHttpClient } from './http.js'
import { INSTAGRAM_REPLY_MAX_LENGTH } from './limits.js'
import type {
  CreateReplyResult,
  PlatformClient,
  PlatformPost
} from './types.js'

interface InstagramMediaListResponse {
  data?: Array<{ id: string }>
}

interface InstagramCreateReplyResponse {
  id?: string
}

const user = getStaticPlatformUser('instagram')
const http = createPlatformHttpClient({
  platform: 'Instagram',
  baseUrl: user.apiBaseUrl
})

export async function listInstagramPosts({
  limit = 5
}: {
  limit?: number
} = {}): Promise<PlatformPost[]> {
  const body = await http.get<InstagramMediaListResponse>(
    `/${user.externalAccountId}/media`,
    { query: { access_token: user.accessToken } }
  )

  return (body.data ?? []).slice(0, limit).map((item) => ({
    externalId: item.id
  }))
}

export async function createInstagramReply({
  externalCommentId,
  text
}: {
  externalCommentId: string
  text: string
}): Promise<CreateReplyResult> {
  if (text.length > INSTAGRAM_REPLY_MAX_LENGTH) {
    throw new Error(
      `Instagram reply text exceeds ${INSTAGRAM_REPLY_MAX_LENGTH} characters`
    )
  }

  const body = await http.post<InstagramCreateReplyResponse>(
    `/${externalCommentId}/replies`,
    {
      json: {
        message: text,
        access_token: user.accessToken
      }
    }
  )

  if (!body.id) {
    throw new Error('Instagram create reply failed: missing id in response')
  }

  return { externalId: body.id }
}

export function createInstagramClient(): PlatformClient {
  return {
    createReply: createInstagramReply
  }
}
