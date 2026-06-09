import { NextRequest } from 'next/server'
import { toArtwork } from '@/lib/met-api'
import type { Artwork } from '@/types/artwork'

export const dynamic = 'force-dynamic'

const MET_OBJECTS_URL =
  'https://collectionapi.metmuseum.org/public/collection/v1/objects'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const count = Math.min(
    Math.max(parseInt(searchParams.get('count') || '20', 10), 1),
    50
  )
  const exclude = new Set(
    (searchParams.get('exclude') ?? '')
      .split(',')
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => !Number.isNaN(id))
  )

  try {
    const listRes = await fetch(`${MET_OBJECTS_URL}?departmentIds=21`)
    if (!listRes.ok) {
      throw new Error(`Met objects list failed: ${listRes.status}`)
    }

    const listData = await listRes.json()
    const allIds: number[] = listData.objectIDs ?? []

    const sampledIds = [...allIds]
      .sort(() => Math.random() - 0.5)
      .slice(0, 100)

    const artworks: Artwork[] = []

    for (const objectId of sampledIds) {
      if (exclude.has(objectId)) continue

      const res = await fetch(`${MET_OBJECTS_URL}/${objectId}`)
      if (!res.ok) continue

      const obj = await res.json()
      if (!obj.primaryImage && !obj.primaryImageSmall) continue

      const artwork = toArtwork(obj)
      if (artwork) artworks.push(artwork)

      if (artworks.length >= count) break
    }

    return Response.json(artworks)
  } catch (err) {
    console.error('[api/artworks] failed:', err)
    return Response.json(
      { error: 'Failed to fetch artworks from The Met API' },
      { status: 503 }
    )
  }
}
