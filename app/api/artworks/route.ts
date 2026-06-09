import { NextRequest, NextResponse } from 'next/server'
import { toArtwork } from '@/lib/met-api'
import type { Artwork } from '@/types/artwork'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MET_OBJECTS_URL =
  'https://collectionapi.metmuseum.org/public/collection/v1/objects'

const ROUTE_TIMEOUT_MS = 30_000
const MAX_ARTWORKS = 20
const SAMPLE_SIZE = 60

async function fetchArtworkByObjectId(
  objectId: number,
  signal: AbortSignal
): Promise<Artwork | null> {
  try {
    const res = await fetch(`${MET_OBJECTS_URL}/${objectId}`, { signal })
    if (!res.ok) return null

    const obj = await res.json()
    if (!obj.primaryImage && !obj.primaryImageSmall) return null

    return toArtwork(obj)
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const count = Math.min(
    Math.max(parseInt(searchParams.get('count') || '20', 10), 1),
    MAX_ARTWORKS
  )
  const exclude = new Set(
    (searchParams.get('exclude') ?? '')
      .split(',')
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => !Number.isNaN(id))
  )

  const artworks: Artwork[] = []
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ROUTE_TIMEOUT_MS)

  try {
    const listRes = await fetch(`${MET_OBJECTS_URL}?departmentIds=21`, {
      signal: controller.signal,
    })
    if (!listRes.ok) {
      throw new Error(`Met objects list failed: ${listRes.status}`)
    }

    const listData = await listRes.json()
    const allIds: number[] = listData.objectIDs ?? []

    const sampledIds = [...allIds]
      .sort(() => Math.random() - 0.5)
      .slice(0, SAMPLE_SIZE)

    for (const objectId of sampledIds) {
      if (controller.signal.aborted) break
      if (exclude.has(objectId)) continue

      const artwork = await fetchArtworkByObjectId(objectId, controller.signal)
      if (artwork) artworks.push(artwork)
      if (artworks.length >= count) break
    }

    return NextResponse.json(artworks)
  } catch (err) {
    if (artworks.length > 0) {
      return NextResponse.json(artworks)
    }

    console.error('[api/artworks] failed:', err)
    return NextResponse.json(
      { error: 'Failed to fetch artworks from The Met API' },
      { status: 503 }
    )
  } finally {
    clearTimeout(timeout)
  }
}
