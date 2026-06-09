import { NextRequest } from 'next/server'
import { toArtwork } from '@/lib/met-api'
import type { Artwork } from '@/types/artwork'

export const dynamic = 'force-dynamic'

const SEARCH_URL =
  'https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&departmentId=21&q=art'

const MET_OBJECTS_URL =
  'https://collectionapi.metmuseum.org/public/collection/v1/objects'

let artworkPool: Artwork[] | null = null

async function loadArtworkPool(): Promise<Artwork[]> {
  if (artworkPool) return artworkPool

  const searchRes = await fetch(SEARCH_URL)
  if (!searchRes.ok) {
    throw new Error(`Met search failed: ${searchRes.status}`)
  }

  const searchData = await searchRes.json()
  const objectIds: number[] = (searchData.objectIDs ?? []).slice(0, 200)

  const artworks: Artwork[] = []

  for (const objectId of objectIds) {
    const res = await fetch(`${MET_OBJECTS_URL}/${objectId}`)
    if (!res.ok) continue

    const obj = await res.json()
    if (!obj.primaryImage) continue

    const artwork = toArtwork(obj)
    if (artwork) artworks.push(artwork)
  }

  artworkPool = artworks
  return artworks
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const count = Math.min(
    Math.max(parseInt(searchParams.get('count') || '20', 10), 1),
    50
  )

  try {
    const pool = await loadArtworkPool()
    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    return Response.json(shuffled.slice(0, count))
  } catch (err) {
    console.error('[api/artworks] failed:', err)
    return Response.json(
      { error: 'Failed to fetch artworks from The Met API' },
      { status: 503 }
    )
  }
}
