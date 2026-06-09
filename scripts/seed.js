const { Redis } = require('@upstash/redis')
const fs = require('fs')
const path = require('path')

const envPath = path.join(process.cwd(), '.env.local')
if (!fs.existsSync(envPath)) {
  console.error('Missing .env.local. Add UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.')
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

const MET_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1'
const MET_HEADERS = {
  'User-Agent': 'MetGallery/1.0 (educational; seed script)',
  Accept: 'application/json',
}
const DEPARTMENTS = [
  { id: 19, queries: ['photograph', 'photo', 'print'] },
  { id: 21, queries: ['painting', 'sculpture', 'modern'] },
]
const TARGET_COUNT = 500
const CONCURRENCY = 8
const FETCH_TIMEOUT_MS = 15000
const MAX_ATTEMPTS = TARGET_COUNT * 12
const ARTWORK_IDS_KEY = 'metgallery:artwork:ids'
const LEGACY_ARTWORK_IDS_KEY = 'artwork:ids'
const artworkKey = (id) => `metgallery:artwork:${id}`
const insightKey = (id) => `metgallery:insight:${id}`
const legacyArtworkKey = (id) => `artwork:${id}`
const legacyInsightKey = (id) => `insight:${id}`

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function fetchJson(fetchUrl, attempt = 1) {
  const maxAttempts = 3

  try {
    const res = await fetch(fetchUrl, {
      headers: MET_HEADERS,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    const contentType = res.headers.get('content-type') || ''
    const body = await res.text()

    if (!res.ok) {
      const blocked = res.status === 403 || body.includes('Incapsula')
      const err = new Error(
        `Met API HTTP ${res.status} for ${fetchUrl}: ${body.slice(0, 160)}`
      )
      err.retryable = blocked && attempt < maxAttempts
      throw err
    }

    if (!contentType.includes('application/json')) {
      const err = new Error(
        `Met API returned non-JSON for ${fetchUrl}: ${body.slice(0, 160)}`
      )
      err.retryable = attempt < maxAttempts
      throw err
    }

    return JSON.parse(body)
  } catch (err) {
    if (err.retryable) {
      const delay = attempt * 2000
      console.warn(`  Met API retry ${attempt}/${maxAttempts - 1} in ${delay}ms...`)
      await sleep(delay)
      return fetchJson(fetchUrl, attempt + 1)
    }
    throw err
  }
}

async function fetchDepartmentImageIds({ id, queries }) {
  const ids = new Set()

  for (const query of queries) {
    const searchUrl = `${MET_BASE}/search?departmentId=${id}&hasImages=true&q=${encodeURIComponent(query)}`
    console.log(`  Searching department ${id} (q="${query}", hasImages=true)...`)
    const data = await fetchJson(searchUrl)
    const found = data.objectIDs || []
    console.log(`    Found ${found.length} object IDs`)
    found.forEach((objectId) => ids.add(objectId))
    await sleep(200)
  }

  return [...ids]
}

async function fetchObject(objectId) {
  const obj = await fetchJson(`${MET_BASE}/objects/${objectId}`)
  const imageUrl = obj.primaryImage || obj.primaryImageSmall
  if (!imageUrl || !obj.title) return null

  return {
    id: obj.objectID,
    title: obj.title,
    artist: obj.artistDisplayName || 'Unknown Artist',
    year: obj.objectDate || '',
    medium: obj.medium || '',
    department: obj.department || '',
    imageUrl,
    objectUrl:
      obj.objectURL ||
      `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
  }
}

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

async function clearCache() {
  const current = await clearKeySet(ARTWORK_IDS_KEY, artworkKey, insightKey)
  const legacy = await clearKeySet(
    LEGACY_ARTWORK_IDS_KEY,
    legacyArtworkKey,
    legacyInsightKey
  )
  if (current === 0 && legacy === 0) {
    console.log('Redis cache already empty.')
  } else {
    console.log(
      `Cleared ${current} MetGallery and ${legacy} legacy cached entries.`
    )
  }
}

async function verifyRedis() {
  const pong = await redis.ping()
  if (pong !== 'PONG') {
    throw new Error(`Unexpected Redis ping response: ${pong}`)
  }
  console.log('Redis connection OK.')
}

async function seed() {
  console.log('MetGallery seed — The Met API (departments 19 & 21)')
  await verifyRedis()
  await clearCache()

  const allIds = new Set()
  for (const dept of DEPARTMENTS) {
    const ids = await fetchDepartmentImageIds(dept)
    ids.forEach((objectId) => allIds.add(objectId))
  }

  if (!allIds.size) {
    throw new Error(
      'No image-bearing object IDs found. The Met API may be blocking requests (HTTP 403). Try again later.'
    )
  }

  console.log(`Total unique image-bearing object IDs: ${allIds.size}`)

  const shuffled = [...allIds].sort(() => Math.random() - 0.5)
  const artworks = []
  let attempts = 0

  for (
    let i = 0;
    i < shuffled.length &&
    artworks.length < TARGET_COUNT &&
    attempts < MAX_ATTEMPTS;
    i += CONCURRENCY
  ) {
    const batch = shuffled.slice(i, i + CONCURRENCY)
    attempts += batch.length

    const results = await Promise.all(
      batch.map(async (objectId) => {
        try {
          return await fetchObject(objectId)
        } catch (err) {
          console.warn(`  Skipping object ${objectId}: ${err.message}`)
          return null
        }
      })
    )

    for (const artwork of results) {
      if (artwork) artworks.push(artwork)
      if (artworks.length >= TARGET_COUNT) break
    }

    if (attempts % 40 === 0 || artworks.length % 25 === 0) {
      console.log(
        `  Progress: ${artworks.length}/${TARGET_COUNT} artworks (${attempts} API calls)...`
      )
    }

    await sleep(100)
  }

  if (!artworks.length) {
    throw new Error(
      `Fetched 0 artworks after ${attempts} attempts. Check Met API availability.`
    )
  }

  console.log(`Writing ${artworks.length} artworks to Redis...`)
  const pipeline = redis.pipeline()
  artworks.forEach((a) => {
    pipeline.set(artworkKey(a.id), a)
    pipeline.sadd(ARTWORK_IDS_KEY, String(a.id))
  })
  await pipeline.exec()

  console.log(`Done. ${artworks.length} artworks cached in Redis.`)
}

seed().catch((err) => {
  console.error('Seed failed:', err.message)
  if (String(err.message).includes('403') || String(err.message).includes('Incapsula')) {
    console.error(
      'The Met API appears to be blocking requests from this network. Wait a few minutes and retry, or run seed from a different connection.'
    )
  }
  process.exit(1)
})
