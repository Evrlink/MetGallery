import { Redis } from '@upstash/redis'

let redisClient: Redis | null = null

const ARTWORK_IDS_KEY = 'metgallery:artwork:ids'
export const artworkKey = (id: string | number) => `metgallery:artwork:${id}`
export const insightKey = (id: string | number) => `metgallery:insight:${id}`

function isValidRedisConfig(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  return Boolean(url?.startsWith('https://') && token)
}

export function getRedis(): Redis {
  if (!redisClient) {
    if (!isValidRedisConfig()) {
      throw new Error(
        'Upstash Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in .env.local'
      )
    }
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL as string,
      token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
    })
  }
  return redisClient
}

export async function clearMetGalleryCache(redis: Redis): Promise<void> {
  const ids = await redis.smembers(ARTWORK_IDS_KEY)
  if (!ids.length) return

  const pipeline = redis.pipeline()
  for (const id of ids) {
    pipeline.del(artworkKey(id))
    pipeline.del(insightKey(id))
  }
  pipeline.del(ARTWORK_IDS_KEY)
  await pipeline.exec()
}

export { ARTWORK_IDS_KEY }
