import Link from 'next/link'
import { Nav } from '@/components/Nav'
import { AIInsightPanel } from '@/components/AIInsightPanel'
import { getRedis } from '@/lib/redis'
import type { Artwork } from '@/types/artwork'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ArtworkPage({ params }: PageProps) {
  const { id } = await params
  const artwork = await getRedis().get<Artwork>(`artwork:${id}`)

  if (!artwork) notFound()

  return (
    <div className="bg-ivory min-h-screen font-body">
      <Nav />
      <Link
        href="/"
        className="fixed top-[4.5rem] left-5 md:left-8 z-40 font-display text-lg text-stone hover:text-gold transition-colors"
      >
        ← Back
      </Link>

      <div className="pt-[3.25rem] flex flex-col lg:flex-row min-h-screen">
        <div className="lg:flex-[0_0_58%] flex justify-center items-center p-8 md:p-12 lg:p-16 bg-ivory">
          <img
            src={artwork.imageUrl}
            alt={artwork.title}
            className="max-w-full max-h-[60vh] lg:max-h-[80vh] object-contain"
          />
        </div>

        <div className="lg:flex-[0_0_42%] flex flex-col px-6 md:px-10 lg:px-12 py-10 lg:py-16 overflow-y-auto border-t lg:border-t-0 lg:border-l border-gold/10">
          <p className="font-body text-[11px] uppercase tracking-[0.25em] text-gold mb-3">
            {artwork.department}
          </p>
          <h1 className="font-display text-2xl md:text-3xl lg:text-4xl text-charcoal leading-tight mb-3">
            {artwork.title}
          </h1>
          <p className="font-body text-base text-charcoal/80 mb-1">{artwork.artist}</p>
          <p className="font-body text-sm text-stone mb-1">{artwork.year}</p>
          {artwork.medium && (
            <p className="font-body text-sm text-stone/80 mb-6 italic">{artwork.medium}</p>
          )}

          <AIInsightPanel artwork={artwork} />

          <p className="font-body text-xs text-stone mt-auto pt-8">
            Source:{' '}
            <a
              href={artwork.objectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-charcoal/70 border-b border-gold/30 hover:text-gold hover:border-gold transition-colors"
            >
              The Metropolitan Museum of Art
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
