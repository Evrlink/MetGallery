import {
  ARTWORK_IDS_KEY,
  artworkKey,
  clearMetGalleryCache,
  getRedis,
  LEGACY_ARTWORK_IDS_KEY,
} from '@/lib/redis'
import type { Artwork } from '@/types/artwork'
import type { Redis } from '@upstash/redis'

export const MET_OBJECTS_CSV_URL =
  'https://media.githubusercontent.com/media/metmuseum/openaccess/master/MetObjects.csv'

export const MET_IMAGES_CSV_URL =
  'https://raw.githubusercontent.com/gregsadetsky/met-openaccess-images/master/met-openaccess-images.csv'

export const DEPARTMENT = 'Modern and Contemporary Art'
export const TARGET_COUNT = 100
export const IMAGE_BASE = 'https://images.metmuseum.org/CRDImages/'

export interface SeedProgress {
  status: 'complete' | 'failed'
  redis: { ping: string; clearedCurrent: number; clearedLegacy: number }
  department: string
  matchingObjects: number
  artworksStored: number
  error?: string
}

export function parseCsvLine(line: string): string[] {
  const fields: string[] = []
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

export async function loadImagePathMap(): Promise<Map<number, string>> {
  const res = await fetch(MET_IMAGES_CSV_URL)
  if (!res.ok) {
    throw new Error(`Failed to fetch images CSV: ${res.status}`)
  }

  const text = await res.text()
  const lines = text.split('\n')
  const map = new Map<number, string>()

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

  return map
}

export async function loadArtworksFromCsv(
  targetCount = TARGET_COUNT
): Promise<{ artworks: Artwork[]; matchingObjects: number }> {
  const imagePaths = await loadImagePathMap()

  const res = await fetch(MET_OBJECTS_CSV_URL)
  if (!res.ok) {
    throw new Error(`Failed to fetch MetObjects CSV: ${res.status}`)
  }

  const text = await res.text()
  const lines = text.split('\n')
  if (!lines[0]) {
    throw new Error('MetObjects CSV is empty')
  }

  const headers = parseCsvLine(lines[0])
  const indexOf = (name: string) => headers.indexOf(name)
  const objectIdIdx = indexOf('Object ID')
  const departmentIdx = indexOf('Department')
  const titleIdx = indexOf('Title')
  const artistIdx = indexOf('Artist Display Name')
  const dateIdx = indexOf('Object Date')
  const mediumIdx = indexOf('Medium')
  const linkIdx = indexOf('Link Resource')

  if (
    objectIdIdx === -1 ||
    departmentIdx === -1 ||
    titleIdx === -1
  ) {
    throw new Error('MetObjects CSV is missing required columns')
  }

  const candidates: Artwork[] = []

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

  const shuffled = [...candidates].sort(() => Math.random() - 0.5)
  return {
    artworks: shuffled.slice(0, targetCount),
    matchingObjects: candidates.length,
  }
}

async function countCachedEntries(redis: Redis) {
  const [current, legacy] = await Promise.all([
    redis.scard(ARTWORK_IDS_KEY),
    redis.scard(LEGACY_ARTWORK_IDS_KEY),
  ])
  return { current: current ?? 0, legacy: legacy ?? 0 }
}

export async function storeArtworksInRedis(
  redis: Redis,
  artworks: Artwork[]
): Promise<void> {
  const pipeline = redis.pipeline()
  for (const artwork of artworks) {
    pipeline.set(artworkKey(artwork.id), artwork)
    pipeline.sadd(ARTWORK_IDS_KEY, String(artwork.id))
  }
  await pipeline.exec()
}

export async function runSeedFromCsv(): Promise<SeedProgress> {
  const redis = getRedis()
  const ping = await redis.ping()
  const beforeClear = await countCachedEntries(redis)

  await clearMetGalleryCache(redis)

  const { artworks, matchingObjects } = await loadArtworksFromCsv(TARGET_COUNT)
  await storeArtworksInRedis(redis, artworks)

  return {
    status: 'complete',
    redis: {
      ping: String(ping),
      clearedCurrent: beforeClear.current,
      clearedLegacy: beforeClear.legacy,
    },
    department: DEPARTMENT,
    matchingObjects,
    artworksStored: artworks.length,
  }
}
