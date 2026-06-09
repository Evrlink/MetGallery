import { NextRequest, NextResponse } from 'next/server'
import {
  ARTWORK_IDS_KEY,
  artworkKey,
  clearMetGalleryCache,
  getRedis,
  LEGACY_ARTWORK_IDS_KEY,
} from '@/lib/redis'
import type { Artwork } from '@/types/artwork'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const SEED_SECRET = 'metgallery2024'
const MET_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1'
const MET_HEADERS = {
  'User-Agent': 'MetGallery/1.0 (educational; seed route)',
  Accept: 'application/json',
}
const DEPARTMENTS = [
  { id: 19, queries: ['photograph', 'photo', 'print'] as const },
  { id: 21, queries: ['painting', 'sculpture', 'modern'] as const },
]
const TARGET_COUNT = 500
const CONCURRENCY = 8
const FETCH_TIMEOUT_MS = 15000
const MAX_ATTEMPTS = TARGET_COUNT * 12

interface DepartmentProgress {
  queries: { query: string; objectIdsFound: number }[]
  totalObjectIds: number
}

interface SeedProgress {
  status: 'complete' | 'failed'
  redis: { ping: string; clearedCurrent: number; clearedLegacy: number }
  departments: Record<number, DepartmentProgress>
  totalUniqueIds: number
  artworksFetched: number
  artworksStored: number
  attempts: number
  error?: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(fetchUrl: string, attempt = 1): Promise<unknown> {
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
      ) as Error & { retryable?: boolean }
      err.retryable = blocked && attempt < maxAttempts
      throw err
    }

    if (!contentType.includes('application/json')) {
      const err = new Error(
        `Met API returned non-JSON for ${fetchUrl}: ${body.slice(0, 160)}`
      ) as Error & { retryable?: boolean }
      err.retryable = attempt < maxAttempts
      throw err
    }

    return JSON.parse(body)
  } catch (err) {
    const retryable =
      err instanceof Error &&
      'retryable' in err &&
      (err as Error & { retryable?: boolean }).retryable

    if (retryable) {
      const delay = attempt * 2000
      await sleep(delay)
      return fetchJson(fetchUrl, attempt + 1)
    }
    throw err
  }
}

async function fetchDepartmentImageIds(dept: {
  id: number
  queries: readonly string[]
}): Promise<{ queries: DepartmentProgress['queries']; ids: number[] }> {
  const ids = new Set<number>()
  const queries: DepartmentProgress['queries'] = []

  for (const query of dept.queries) {
    const searchUrl = `${MET_BASE}/search?departmentId=${dept.id}&hasImages=true&q=${encodeURIComponent(query)}`
    const data = (await fetchJson(searchUrl)) as { objectIDs?: number[] }
    const found = data.objectIDs ?? []
    queries.push({ query, objectIdsFound: found.length })
    found.forEach((objectId) => ids.add(objectId))
    await sleep(200)
  }

  return { queries, ids: [...ids] }
}

async function fetchObject(objectId: number): Promise<Artwork | null> {
  const obj = (await fetchJson(`${MET_BASE}/objects/${objectId}`)) as {
    objectID: number
    title: string
    artistDisplayName: string
    objectDate: string
    medium: string
    department: string
    primaryImage: string
    primaryImageSmall: string
    objectURL: string
  }

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

async function countCachedEntries(redis: ReturnType<typeof getRedis>) {
  const [current, legacy] = await Promise.all([
    redis.scard(ARTWORK_IDS_KEY),
    redis.scard(LEGACY_ARTWORK_IDS_KEY),
  ])
  return { current: current ?? 0, legacy: legacy ?? 0 }
}

async function runSeed(): Promise<SeedProgress> {
  const redis = getRedis()
  const ping = await redis.ping()
  const beforeClear = await countCachedEntries(redis)

  await clearMetGalleryCache(redis)

  const departmentProgress: Record<number, DepartmentProgress> = {}
  const allIds = new Set<number>()

  for (const dept of DEPARTMENTS) {
    const { queries, ids } = await fetchDepartmentImageIds(dept)
    ids.forEach((objectId) => allIds.add(objectId))
    departmentProgress[dept.id] = {
      queries,
      totalObjectIds: ids.length,
    }
  }

  if (!allIds.size) {
    throw new Error(
      'No image-bearing object IDs found from Met API departments 19 and 21.'
    )
  }

  const shuffled = [...allIds].sort(() => Math.random() - 0.5)
  const artworks: Artwork[] = []
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
        } catch {
          return null
        }
      })
    )

    for (const artwork of results) {
      if (artwork) artworks.push(artwork)
      if (artworks.length >= TARGET_COUNT) break
    }

    await sleep(100)
  }

  if (!artworks.length) {
    throw new Error(
      `Fetched 0 artworks after ${attempts} attempts. Check Met API availability.`
    )
  }

  const pipeline = redis.pipeline()
  for (const artwork of artworks) {
    pipeline.set(artworkKey(artwork.id), artwork)
    pipeline.sadd(ARTWORK_IDS_KEY, String(artwork.id))
  }
  await pipeline.exec()

  return {
    status: 'complete',
    redis: {
      ping: String(ping),
      clearedCurrent: beforeClear.current,
      clearedLegacy: beforeClear.legacy,
    },
    departments: departmentProgress,
    totalUniqueIds: allIds.size,
    artworksFetched: artworks.length,
    artworksStored: artworks.length,
    attempts,
  }
}

function isAuthorized(request: NextRequest): boolean {
  return request.headers.get('x-seed-secret') === SEED_SECRET
}

async function handleSeed(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const progress = await runSeed()
    return NextResponse.json(progress)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Seed failed'
    console.error('[api/seed] failed:', err)

    const progress: SeedProgress = {
      status: 'failed',
      redis: { ping: 'unknown', clearedCurrent: 0, clearedLegacy: 0 },
      departments: {},
      totalUniqueIds: 0,
      artworksFetched: 0,
      artworksStored: 0,
      attempts: 0,
      error: message,
    }

    return NextResponse.json(progress, { status: 503 })
  }
}

export async function GET(request: NextRequest) {
  return handleSeed(request)
}

export async function POST(request: NextRequest) {
  return handleSeed(request)
}
