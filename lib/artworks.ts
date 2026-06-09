import { ARTWORK_IDS_KEY, artworkKey, getRedis } from '@/lib/redis'
import type { Artwork } from '@/types/artwork'

export async function fetchArtworkById(
  objectId: number
): Promise<Artwork | null> {
  const redis = getRedis()
  return redis.get<Artwork>(artworkKey(objectId))
}

export async function fetchArtworksFromRedis(
  count: number,
  exclude: Set<number> = new Set()
): Promise<Artwork[]> {
  const redis = getRedis()
  const allIds = await redis.smembers(ARTWORK_IDS_KEY)
  const shuffled = [...allIds].sort(() => Math.random() - 0.5)

  const artworks: Artwork[] = []
  for (const artId of shuffled) {
    const id = Number.parseInt(artId, 10)
    if (exclude.has(id)) continue

    const artwork = await redis.get<Artwork>(artworkKey(artId))
    if (artwork) artworks.push(artwork)
    if (artworks.length >= count) break
  }

  return artworks
}
