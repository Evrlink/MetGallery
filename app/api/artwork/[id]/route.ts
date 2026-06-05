import { NextRequest } from 'next/server'
import { getRedis } from '@/lib/redis'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const redis = getRedis()
  const artwork = await redis.get(`artwork:${id}`)

  if (!artwork) {
    return Response.json({ error: 'Artwork not found' }, { status: 404 })
  }

  return Response.json(artwork)
}
