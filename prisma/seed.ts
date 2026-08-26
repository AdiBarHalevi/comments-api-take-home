import { env } from '../src/config/env.js'
import { createPrismaClient } from '../src/lib/prisma.js'
import { listInstagramPosts } from '../src/lib/clients/instagram.js'
import { listXPosts } from '../src/lib/clients/x.js'

const POSTS_PER_PLATFORM = 5

async function seed(): Promise<void> {
  const prisma = createPrismaClient(env.DATABASE_URL)

  try {
    const [instagramPosts, xPosts] = await Promise.all([
      listInstagramPosts({
        limit: POSTS_PER_PLATFORM
      }),
      listXPosts({
        limit: POSTS_PER_PLATFORM
      })
    ])

    const mappings = [
      ...instagramPosts.map((p) => ({
        platform: 'INSTAGRAM' as const,
        externalId: p.externalId
      })),
      ...xPosts.map((p) => ({
        platform: 'X' as const,
        externalId: p.externalId
      }))
    ]

    for (const mapping of mappings) {
      const post = await prisma.post.upsert({
        where: {
          platform_externalId: {
            platform: mapping.platform,
            externalId: mapping.externalId
          }
        },
        create: mapping,
        update: {}
      })

      for (const n of [1, 2, 3, 4, 5]) {
        const externalId = `seed-${post.externalId}-${n}`
        await prisma.comment.upsert({
          where: { postId_externalId: { postId: post.id, externalId } },
          create: {
            postId: post.id,
            externalId,
            text: `Sample comment ${n}`,
            authorUsername: `fan_${n}`,
            authorExternalId: `author-${n}`
          },
          update: {}
        })
      }
    }

    console.log(
      `Seeded ${mappings.length} posts (${instagramPosts.length} Instagram, ${xPosts.length} X) and ${mappings.length * 5} comments.`
    )
  } finally {
    await prisma.$disconnect()
  }
}

seed().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
