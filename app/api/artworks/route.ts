import { NextRequest } from 'next/server'
import { ARTWORK_IDS_KEY, artworkKey, getRedis } from '@/lib/redis'
import type { Artwork } from '@/types/artwork'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const count = parseInt(searchParams.get('count') || '20', 10)

  const redis = getRedis()
  const allIds = await redis.smembers(ARTWORK_IDS_KEY)
  const shuffled = [...allIds].sort(() => Math.random() - 0.5)

  const artworks: Artwork[] = []
  for (const artId of shuffled) {
    if (artworks.length >= count) break
    const artwork = await redis.get<Artwork>(artworkKey(artId))
    if (artwork) artworks.push(artwork)
  }

  return Response.json(artworks)
}
