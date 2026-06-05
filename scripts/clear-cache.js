const { Redis } = require('@upstash/redis')
const fs = require('fs')
const path = require('path')

const envPath = path.join(process.cwd(), '.env.local')
if (!fs.existsSync(envPath)) {
  console.error('Missing .env.local')
  process.exit(1)
}

fs.readFileSync(envPath, 'utf-8')
  .split('\n')
  .forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eq = trimmed.indexOf('=')
    if (eq === -1) return
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key) process.env[key] = value
  })

const url = process.env.UPSTASH_REDIS_REST_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN
if (!url?.startsWith('https://') || !token) {
  console.error('Invalid Upstash config in .env.local')
  process.exit(1)
}

const redis = new Redis({ url, token })

const ARTWORK_IDS_KEY = 'metgallery:artwork:ids'
const LEGACY_ARTWORK_IDS_KEY = 'artwork:ids'
const artworkKey = (id) => `metgallery:artwork:${id}`
const insightKey = (id) => `metgallery:insight:${id}`
const legacyArtworkKey = (id) => `artwork:${id}`
const legacyInsightKey = (id) => `insight:${id}`

async function clearKeySet(idsKey, keyForId, extraKeyForId) {
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

async function main() {
  const current = await clearKeySet(ARTWORK_IDS_KEY, artworkKey, insightKey)
  const legacy = await clearKeySet(LEGACY_ARTWORK_IDS_KEY, legacyArtworkKey, legacyInsightKey)
  console.log(`Cleared ${current} MetGallery and ${legacy} legacy entries. Redis is empty.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
