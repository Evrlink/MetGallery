import { NextRequest, NextResponse } from 'next/server'
import { runSeedFromCsv } from '@/lib/seed-from-csv'

export const dynamic = 'force-dynamic'
export const maxDuration = 900

const SEED_SECRET = 'metgallery2024'

function isAuthorized(request: NextRequest): boolean {
  return request.headers.get('x-seed-secret') === SEED_SECRET
}

async function handleSeed(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const progress = await runSeedFromCsv()
    return NextResponse.json(progress)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Seed failed'
    console.error('[api/seed] failed:', err)

    return NextResponse.json(
      {
        status: 'failed',
        redis: { ping: 'unknown', clearedCurrent: 0, clearedLegacy: 0 },
        department: 'Modern and Contemporary Art',
        matchingObjects: 0,
        artworksStored: 0,
        error: message,
      },
      { status: 503 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handleSeed(request)
}

export async function POST(request: NextRequest) {
  return handleSeed(request)
}
