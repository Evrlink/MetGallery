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

const MET_OBJECTS_CSV_URL =
  'https://media.githubusercontent.com/media/metmuseum/openaccess/master/MetObjects.csv'
const MET_IMAGES_CSV_URL =
  'https://raw.githubusercontent.com/gregsadetsky/met-openaccess-images/master/met-openaccess-images.csv'
const DEPARTMENT = 'Modern and Contemporary Art'
const TARGET_COUNT = 200
const IMAGE_BASE = 'https://images.metmuseum.org/CRDImages/'
const ARTWORK_IDS_KEY = 'metgallery:artwork:ids'
const LEGACY_ARTWORK_IDS_KEY = 'artwork:ids'
const artworkKey = (id) => `metgallery:artwork:${id}`
const insightKey = (id) => `metgallery:insight:${id}`
const legacyArtworkKey = (id) => `artwork:${id}`
const legacyInsightKey = (id) => `insight:${id}`

function parseCsvLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }

  fields.push(current)
  return fields
}

async function loadImagePathMap() {
  console.log('Fetching image paths CSV...')
  const res = await fetch(MET_IMAGES_CSV_URL)
  if (!res.ok) {
    throw new Error(`Failed to fetch images CSV: ${res.status}`)
  }

  const text = await res.text()
  const lines = text.split('\n')
  const map = new Map()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim()
    if (!line) continue

    const comma = line.indexOf(',')
    if (comma === -1) continue

    const id = Number.parseInt(line.slice(0, comma), 10)
    const urlpath = line.slice(comma + 1).trim()
    if (!Number.isNaN(id) && urlpath) {
      map.set(id, urlpath)
    }
  }

  console.log(`Loaded ${map.size} image paths.`)
  return map
}

async function loadArtworksFromCsv() {
  const imagePaths = await loadImagePathMap()

  console.log('Fetching MetObjects CSV...')
  const res = await fetch(MET_OBJECTS_CSV_URL)
  if (!res.ok) {
    throw new Error(`Failed to fetch MetObjects CSV: ${res.status}`)
  }

  const text = await res.text()
  const lines = text.split('\n')
  const headers = parseCsvLine(lines[0])
  const indexOf = (name) => headers.indexOf(name)
  const objectIdIdx = indexOf('Object ID')
  const departmentIdx = indexOf('Department')
  const titleIdx = indexOf('Title')
  const artistIdx = indexOf('Artist Display Name')
  const dateIdx = indexOf('Object Date')
  const mediumIdx = indexOf('Medium')
  const linkIdx = indexOf('Link Resource')

  const candidates = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim()
    if (!line) continue

    const fields = parseCsvLine(line)
    if (fields[departmentIdx] !== DEPARTMENT) continue

    const id = Number.parseInt(fields[objectIdIdx] ?? '', 10)
    const title = fields[titleIdx]?.trim()
    const urlpath = imagePaths.get(id)

    if (!title || Number.isNaN(id) || !urlpath) continue

    candidates.push({
      id,
      title,
      artist: fields[artistIdx]?.trim() || 'Unknown Artist',
      year: fields[dateIdx]?.trim() || '',
      medium: fields[mediumIdx]?.trim() || '',
      department: DEPARTMENT,
      imageUrl: `${IMAGE_BASE}${urlpath}`,
      objectUrl:
        fields[linkIdx]?.trim() ||
        `https://www.metmuseum.org/art/collection/search/${id}`,
    })
  }

  if (!candidates.length) {
    throw new Error(
      `No artworks found for department "${DEPARTMENT}" with matching images.`
    )
  }

  console.log(`Found ${candidates.length} matching artworks with images.`)
  const shuffled = [...candidates].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, TARGET_COUNT)
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
  console.log('MetGallery seed — Met Open Access CSV (Modern and Contemporary Art)')
  await verifyRedis()
  await clearCache()

  const artworks = await loadArtworksFromCsv()

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
  process.exit(1)
})
