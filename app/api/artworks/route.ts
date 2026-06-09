import { NextRequest, NextResponse } from 'next/server'
import { fetchArtworksFromRedis } from '@/lib/artworks'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const exclude = new Set(
    (searchParams.get('exclude') ?? '')
      .split(',')
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => !Number.isNaN(id))
  )

  try {
    const artworks = await fetchArtworksFromRedis(exclude)
    return NextResponse.json(artworks)
  } catch (err) {
    console.error('[api/artworks] failed:', err)
    return NextResponse.json(
      { error: 'Failed to load artworks from cache' },
      { status: 503 }
    )
  }
}
