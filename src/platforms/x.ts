import type { StaticPlatformUser } from '../config/staticPlatformUser.js'
import type { PlatformPost } from './types.js'

interface XTweetsListResponse {
  data?: Array<{ id: string }>
}

export async function listXPosts(
  user: StaticPlatformUser,
  limit = 5
): Promise<PlatformPost[]> {
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
