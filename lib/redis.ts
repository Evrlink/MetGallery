import { Redis } from '@upstash/redis'

let redisClient: Redis | null = null

const ARTWORK_IDS_KEY = 'metgallery:artwork:ids'
const SEARCH_IDS_KEY = 'metgallery:search:ids'
const DEPARTMENT_IDS_KEY = 'metgallery:department:ids'
const LEGACY_ARTWORK_IDS_KEY = 'artwork:ids'

export const artworkKey = (id: string | number) => `metgallery:artwork:${id}`
export const insightKey = (id: string | number) => `metgallery:insight:${id}`
const legacyArtworkKey = (id: string | number) => `artwork:${id}`
const legacyInsightKey = (id: string | number) => `insight:${id}`

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

export function tryGetRedis(): Redis | null {
  if (!isValidRedisConfig()) return null
  return getRedis()
}

async function clearKeySet(
  redis: Redis,
  idsKey: string,
  keyForId: (id: string) => string,
  extraKeyForId?: (id: string) => string
): Promise<number> {
  const ids = await redis.smembers(idsKey)
  if (!ids.length) return 0

  const pipeline = redis.pipeline()
  for (const id of ids) {
    pipeline.del(keyForId(id))
    if (extraKeyForId) pipeline.del(extraKeyForId(id))
  }
  pipeline.del(idsKey)
  await pipeline.exec()
  return ids.length
}

export async function clearMetGalleryCache(redis: Redis): Promise<void> {
  await clearKeySet(redis, ARTWORK_IDS_KEY, (id) => artworkKey(id), (id) =>
    insightKey(id)
  )
  await clearKeySet(
    redis,
    LEGACY_ARTWORK_IDS_KEY,
    (id) => legacyArtworkKey(id),
    (id) => legacyInsightKey(id)
  )
}

export {
  ARTWORK_IDS_KEY,
  SEARCH_IDS_KEY,
  DEPARTMENT_IDS_KEY,
  LEGACY_ARTWORK_IDS_KEY,
}
