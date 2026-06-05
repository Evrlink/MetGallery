import type { Artwork } from '@/types/artwork'

const MET_BASE = 'https://collectionapi.metmuseum.org/public/collection/v1'

export const MET_DEPARTMENTS = [19, 21] as const

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
    objectUrl: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
  }
}

export async function fetchDepartmentObjectIds(departmentId: number): Promise<number[]> {
  const res = await fetch(`${MET_BASE}/objects?departmentIds=${departmentId}`, {
    next: { revalidate: 86400 },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.objectIDs ?? []
}

export async function fetchMetObject(objectId: number): Promise<MetObject | null> {
  const res = await fetch(`${MET_BASE}/objects/${objectId}`, {
    next: { revalidate: 86400 },
  })
  if (!res.ok) return null
  return res.json()
}
