import type { Artwork } from '@/types/artwork'

const MET_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1'

export interface MetObject {
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

export function toArtwork(obj: MetObject): Artwork | null {
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

export async function fetchMetObject(
  objectId: number
): Promise<MetObject | null> {
  const res = await fetch(`${MET_BASE}/objects/${objectId}`)
  if (!res.ok) return null
  return res.json()
}

export async function fetchArtworkById(
  objectId: number
): Promise<Artwork | null> {
  const obj = await fetchMetObject(objectId)
  return obj ? toArtwork(obj) : null
}
