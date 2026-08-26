import type { StaticPlatformUser } from '../../config/staticPlatformUser.js'
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

export async function listInstagramPosts({
  user,
  limit = 5
}: {
  user: StaticPlatformUser
  limit?: number
}): Promise<PlatformPost[]> {
  const url = new URL(`${user.apiBaseUrl}/${user.externalAccountId}/media`)
  url.searchParams.set('access_token', user.accessToken)

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Instagram list posts failed: ${response.status} ${response.statusText}`
    )
  }

  const body = (await response.json()) as InstagramMediaListResponse
  return (body.data ?? []).slice(0, limit).map((item) => ({
    externalId: item.id
  }))
}

export async function createInstagramReply({
  user,
  externalCommentId,
  text
}: {
  user: StaticPlatformUser
  externalCommentId: string
  text: string
}): Promise<CreateReplyResult> {
  const response = await fetch(
    `${user.apiBaseUrl}/${externalCommentId}/replies`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        access_token: user.accessToken
      })
    }
  )

  if (!response.ok) {
    throw new Error(
      `Instagram create reply failed: ${response.status} ${response.statusText}`
    )
  }

  const body = (await response.json()) as InstagramCreateReplyResponse
  if (!body.id) {
    throw new Error('Instagram create reply failed: missing id in response')
  }

  return { externalId: body.id }
}

export function createInstagramClient(
  user: StaticPlatformUser
): PlatformClient {
  return {
    createReply: ({ externalCommentId, text }) =>
      createInstagramReply({ user, externalCommentId, text })
  }
}
