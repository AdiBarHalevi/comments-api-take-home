import type { StaticPlatformUser } from '../config/staticPlatformUser.js'
import type { PlatformPost } from './types.js'

interface InstagramMediaListResponse {
  data?: Array<{ id: string }>
}

export async function listInstagramPosts(
  user: StaticPlatformUser,
  limit = 5
): Promise<PlatformPost[]> {
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
