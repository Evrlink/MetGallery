'use client'

import { useEffect, useState } from 'react'
import type { Artwork } from '@/types/artwork'

interface AIInsightPanelProps {
  artwork: Artwork
}

export function AIInsightPanel({ artwork }: AIInsightPanelProps) {
  const [insight, setInsight] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch('/api/ai-insight', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: artwork.id,
            title: artwork.title,
            artist: artwork.artist,
            year: artwork.year,
            medium: artwork.medium,
            department: artwork.department,
          }),
        })
        const data = await res.json()
        if (!cancelled) setInsight(data.insight)
      } catch {
        if (!cancelled) setInsight('Unable to generate insight at this time.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [artwork])

  return (
    <div className="mt-8 pt-6 border-t border-gold/20">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-gold" />
        <h3 className="font-display text-sm uppercase tracking-[0.2em] text-gold">
          AI Insight
        </h3>
      </div>
      <p
        className={`font-body text-[0.9rem] leading-[1.8] text-charcoal/80 ${
          loading ? 'italic text-stone' : ''
        }`}
      >
        {loading ? 'Generating insight…' : insight}
      </p>
    </div>
  )
}
