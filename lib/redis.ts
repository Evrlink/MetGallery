import { Redis } from '@upstash/redis'

let redisClient: Redis | null = null

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
