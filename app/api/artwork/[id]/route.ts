import { NextRequest } from 'next/server'
import { fetchArtworkById } from '@/lib/met-api'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const artwork = await fetchArtworkById(Number(id))

  if (!artwork) {
    return Response.json({ error: 'Artwork not found' }, { status: 404 })
  }

  return Response.json(artwork)
}
