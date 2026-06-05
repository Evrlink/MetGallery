const { Redis } = require('@upstash/redis')
const fs = require('fs')

const env = fs.readFileSync('.env.local', 'utf-8')
env.split('\n').forEach((l) => {
  const [k, ...v] = l.split('=')
  if (k && v.length)
    process.env[k.trim()] = v.join('=').trim().replace(/"/g, '')
})

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

const MET_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1'
const DEPARTMENTS = [19, 21]
const TARGET_COUNT = 500

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
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

async function seed() {
  console.log('Fetching Met Museum object IDs (departments 19 & 21)...')
  const allIds = new Set()
  for (const dept of DEPARTMENTS) {
    const ids = await fetchDepartmentIds(dept)
    ids.forEach((id) => allIds.add(id))
    await sleep(200)
  }
  console.log(`Total unique object IDs: ${allIds.size}`)

  const shuffled = [...allIds].sort(() => Math.random() - 0.5)

  console.log('Clearing old data...')
  const oldIds = await redis.smembers('artwork:ids')
  if (oldIds.length) {
    const p = redis.pipeline()
    oldIds.forEach((id) => p.del('artwork:' + id))
    p.del('artwork:ids')
    await p.exec()
  }

  console.log(`Loading up to ${TARGET_COUNT} artworks with images...`)
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
    pipeline.set('artwork:' + a.id, JSON.stringify(a))
    pipeline.sadd('artwork:ids', String(a.id))
  })
  await pipeline.exec()

  console.log(`Done! ${artworks.length} artworks loaded from The Met.`)
}

seed().catch(console.error)
