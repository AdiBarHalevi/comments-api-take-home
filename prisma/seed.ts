import { env } from '../src/config/env.js'
import { getStaticPlatformUser } from '../src/config/staticPlatformUser.js'
import { createPrismaClient } from '../src/lib/prisma.js'
import { listInstagramPosts } from '../src/platforms/instagram.js'
import { listXPosts } from '../src/platforms/x.js'

const POSTS_PER_PLATFORM = 5

async function seedPosts(): Promise<void> {
  const prisma = createPrismaClient(env.DATABASE_URL)

  try {
    const [instagramPosts, xPosts] = await Promise.all([
      listInstagramPosts(getStaticPlatformUser('instagram'), POSTS_PER_PLATFORM),
      listXPosts(getStaticPlatformUser('x'), POSTS_PER_PLATFORM)
    ])

    const mappings = [
      ...instagramPosts.map((post) => ({
        platform: 'INSTAGRAM' as const,
        externalId: post.externalId
      })),
      ...xPosts.map((post) => ({
        platform: 'X' as const,
        externalId: post.externalId
      }))
    ]

    for (const mapping of mappings) {
      await prisma.post.upsert({
        where: {
          platform_externalId: {
            platform: mapping.platform,
            externalId: mapping.externalId
          }
        },
        create: mapping,
        update: {}
      })
    }

    console.log(
      `Seeded ${mappings.length} posts (${instagramPosts.length} Instagram, ${xPosts.length} X).`
    )
  } finally {
    await prisma.$disconnect()
  }
}

seedPosts().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
