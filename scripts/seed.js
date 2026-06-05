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
const DEPARTMENTS = [19, 21]
const TARGET_COUNT = 500
const ARTWORK_IDS_KEY = 'metgallery:artwork:ids'
const artworkKey = (id) => `metgallery:artwork:${id}`
const insightKey = (id) => `metgallery:insight:${id}`

async function fetchJson(fetchUrl) {
  const res = await fetch(fetchUrl)
  if (!res.ok) throw new Error(`Failed to fetch ${fetchUrl}: ${res.status}`)
  return res.json()
}

async function fetchDepartmentIds(deptId) {
  console.log(`Fetching object IDs for department ${deptId}...`)
  const data = await fetchJson(`${MET_BASE}/objects?departmentIds=${deptId}`)
  return data.objectIDs || []
}

async function fetchObject(objectId) {
  try {
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
  } catch {
    return null
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function clearCache() {
  const ids = await redis.smembers(ARTWORK_IDS_KEY)
  if (!ids.length) {
    console.log('Redis cache already empty.')
    return
  }
  const pipeline = redis.pipeline()
  for (const id of ids) {
    pipeline.del(artworkKey(id))
    pipeline.del(insightKey(id))
  }
  pipeline.del(ARTWORK_IDS_KEY)
  await pipeline.exec()
  console.log(`Cleared ${ids.length} cached artworks and insights.`)
}

async function seed() {
  console.log('MetGallery seed — The Met API (departments 19 & 21)')
  await clearCache()

  const allIds = new Set()
  for (const dept of DEPARTMENTS) {
    const ids = await fetchDepartmentIds(dept)
    ids.forEach((id) => allIds.add(id))
    await sleep(200)
  }
  console.log(`Total unique object IDs: ${allIds.size}`)

  const shuffled = [...allIds].sort(() => Math.random() - 0.5)
  const artworks = []

  for (const objectId of shuffled) {
    if (artworks.length >= TARGET_COUNT) break
    const artwork = await fetchObject(objectId)
    if (artwork) {
      artworks.push(artwork)
      if (artworks.length % 25 === 0) {
        console.log(`  Loaded ${artworks.length} artworks...`)
      }
    }
    await sleep(80)
  }

  const pipeline = redis.pipeline()
  artworks.forEach((a) => {
    pipeline.set(artworkKey(a.id), a)
    pipeline.sadd(ARTWORK_IDS_KEY, String(a.id))
  })
  await pipeline.exec()

  console.log(`Done. ${artworks.length} artworks cached in Redis.`)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
