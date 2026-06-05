'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Nav } from '@/components/Nav'
import type { Artwork, ArtworkLayout } from '@/types/artwork'

const DESKTOP = { COLS: 4, COL_WIDTH: 280, GAP: 40, PAD: 48 }
const MOBILE = { COLS: 2, COL_WIDTH: 160, GAP: 12, PAD: 16 }

function computeColHeightsFromItems(
  items: ArtworkLayout[],
  COLS: number,
  COL_WIDTH: number,
  GAP: number,
  PAD: number
) {
  const colHeights = Array(COLS).fill(PAD)
  for (const item of items) {
    const col = Math.round((item.x - PAD) / (COL_WIDTH + GAP))
    if (col >= 0 && col < COLS)
      colHeights[col] = Math.max(colHeights[col], item.y + item.h + GAP)
  }
  return colHeights
}

export default function Gallery() {
  const [items, setItems] = useState<ArtworkLayout[]>([])
  const [gridHeight, setGridHeight] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const itemsRef = useRef<ArtworkLayout[]>([])
  const loadingMoreRef = useRef(false)
  const initialLoadDoneRef = useRef(false)
  const loadMoreRef = useRef<() => void>(() => {})
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const { COLS, COL_WIDTH, GAP, PAD } = isMobile ? MOBILE : DESKTOP

  const layoutBatch = useCallback(
    async (artworks: Artwork[], initialColHeights: number[]) => {
      const heights = [...initialColHeights]
      const loaded = await Promise.all(
        artworks.map(
          (a) =>
            new Promise<ArtworkLayout>((resolve) => {
              const img = new window.Image()
              img.onload = () =>
                resolve({
                  ...a,
                  x: 0,
                  y: 0,
                  h: (COL_WIDTH / img.naturalWidth) * img.naturalHeight,
                })
              img.onerror = () => resolve({ ...a, x: 0, y: 0, h: COL_WIDTH })
              img.src = a.imageUrl
            })
        )
      )
      const positioned = loaded.map((item) => {
        const col = heights.indexOf(Math.min(...heights))
        const x = PAD + col * (COL_WIDTH + GAP)
        const y = heights[col]
        heights[col] += item.h + GAP
        return { ...item, x, y }
      })
      return { positioned, gridHeight: Math.max(...heights) + PAD }
    },
    [COL_WIDTH, GAP, PAD]
  )

  useEffect(() => {
    let cancelled = false
    initialLoadDoneRef.current = false
    ;(async () => {
      const res = await fetch('/api/artworks?count=20')
      const artworks: Artwork[] = await res.json()
      if (cancelled) return
      const { positioned, gridHeight: gh } = await layoutBatch(
        artworks,
        Array(COLS).fill(PAD)
      )
      if (cancelled) return
      setItems(positioned)
      setGridHeight(gh)
      initialLoadDoneRef.current = true
    })()
    return () => {
      cancelled = true
    }
  }, [COLS, layoutBatch, PAD])

  const loadMore = useCallback(async () => {
    if (!initialLoadDoneRef.current || loadingMoreRef.current) return
    loadingMoreRef.current = true
    try {
      const res = await fetch('/api/artworks?count=20')
      const artworks: Artwork[] = await res.json()
      if (!artworks.length) return
      const prev = itemsRef.current
      const continueHeights = computeColHeightsFromItems(
        prev,
        COLS,
        COL_WIDTH,
        GAP,
        PAD
      )
      const { positioned, gridHeight: gh } = await layoutBatch(
        artworks,
        continueHeights
      )
      setItems((cur) => [...cur, ...positioned])
      setGridHeight(gh)
    } finally {
      loadingMoreRef.current = false
    }
  }, [COLS, COL_WIDTH, GAP, PAD, layoutBatch])

  useEffect(() => {
    loadMoreRef.current = loadMore
  }, [loadMore])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        loadMoreRef.current()
      },
      { root: null, rootMargin: '320px 0px', threshold: 0 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [gridHeight, items.length])

  return (
    <div className="bg-ivory min-h-screen font-body">
      <Nav />
      <div className="pt-[3.25rem]">
        <header className="px-4 md:px-12 py-8 md:py-12 border-b border-gold/10">
          <h1 className="font-display text-3xl md:text-5xl text-charcoal tracking-tight mb-2">
            The Met
          </h1>
          <p className="font-body text-sm text-stone tracking-wide">
            Photographs &amp; Modern Art — curated from the Metropolitan Museum
          </p>
        </header>

        <div className="relative" style={{ height: gridHeight }}>
          {items.map((item) => (
            <Link
              key={`${item.id}-${item.x}-${item.y}`}
              href={`/artwork/${item.id}`}
              className="group absolute overflow-hidden cursor-pointer"
              style={{ left: item.x, top: item.y, width: COL_WIDTH }}
            >
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-auto block transition-transform duration-500 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 bg-charcoal/0 group-hover:bg-charcoal/10 transition-colors duration-300" />
            </Link>
          ))}
          <div
            ref={sentinelRef}
            aria-hidden
            className="absolute left-0 bottom-0 w-full h-px pointer-events-none opacity-0"
          />
        </div>
      </div>
    </div>
  )
}
