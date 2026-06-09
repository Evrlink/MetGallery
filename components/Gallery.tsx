'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Nav } from '@/components/Nav'
import { ArtworkCard } from '@/components/ArtworkCard'
import type { Artwork, ArtworkLayout } from '@/types/artwork'

const DESKTOP_COLS = 3
const MOBILE_COLS = 2
const GAP = 10.18
const BATCH_SIZE = 20

const mainStyle = {
  marginLeft: '65.4px',
  marginRight: '65.4px',
  marginTop: 0,
  columnGap: '10.18px',
  rowGap: '10.18px',
  scrollMarginTop: '70.18px',
  display: 'flex',
  flexDirection: 'column' as const,
}

function computeColHeightsFromItems(
  items: ArtworkLayout[],
  COLS: number,
  COL_WIDTH: number,
  GAP: number
) {
  const colHeights = Array(COLS).fill(0)
  for (const item of items) {
    const col = Math.round(item.x / (COL_WIDTH + GAP))
    if (col >= 0 && col < COLS)
      colHeights[col] = Math.max(colHeights[col], item.y + item.h + GAP)
  }
  return colHeights
}

export default function Gallery() {
  const [items, setItems] = useState<ArtworkLayout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gridHeight, setGridHeight] = useState(0)
  const [colWidth, setColWidth] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const itemsRef = useRef<ArtworkLayout[]>([])
  const artworksRef = useRef<Artwork[]>([])
  const loadingMoreRef = useRef(false)
  const initialLoadDoneRef = useRef(false)
  const loadMoreRef = useRef<() => void>(() => {})
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)

  const COLS = isMobile ? MOBILE_COLS : DESKTOP_COLS

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return

    const update = () => {
      setIsMobile(window.innerWidth < 768)
      const cols = window.innerWidth < 768 ? MOBILE_COLS : DESKTOP_COLS
      const containerWidth = grid.clientWidth
      setColWidth((containerWidth - (cols - 1) * GAP) / cols)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(grid)
    return () => observer.disconnect()
  }, [])

  const layoutBatch = useCallback(
    async (
      artworks: Artwork[],
      initialColHeights: number[],
      COL_WIDTH: number
    ) => {
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
        const x = col * (COL_WIDTH + GAP)
        const y = heights[col]
        heights[col] += item.h + GAP
        return { ...item, x, y }
      })
      return { positioned, gridHeight: Math.max(...heights, 0) }
    },
    []
  )

  const relayoutAll = useCallback(
    async (artworks: Artwork[], COL_WIDTH: number) => {
      if (!artworks.length || COL_WIDTH <= 0) return
      const { positioned, gridHeight: gh } = await layoutBatch(
        artworks,
        Array(COLS).fill(0),
        COL_WIDTH
      )
      setItems(positioned)
      setGridHeight(gh)
    },
    [COLS, layoutBatch]
  )

  const fetchArtworks = useCallback(async (count: number, excludeIds: number[] = []) => {
    const params = new URLSearchParams({ count: String(count) })
    if (excludeIds.length) {
      params.set('exclude', excludeIds.join(','))
    }
    const res = await fetch(`/api/artworks?${params}`)
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to load artworks')
    }
    return data as Artwork[]
  }, [])

  useEffect(() => {
    if (!colWidth) return
    if (artworksRef.current.length) {
      relayoutAll(artworksRef.current, colWidth)
    }
  }, [colWidth, COLS, relayoutAll])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const artworks = await fetchArtworks(BATCH_SIZE)
        if (cancelled) return
        artworksRef.current = artworks
        initialLoadDoneRef.current = true
        if (colWidth > 0) {
          await relayoutAll(artworks, colWidth)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load artworks'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [colWidth, fetchArtworks, relayoutAll])

  const loadMore = useCallback(async () => {
    if (!initialLoadDoneRef.current || loadingMoreRef.current || !colWidth)
      return
    loadingMoreRef.current = true
    try {
      const existingIds = artworksRef.current.map((a) => a.id)
      const artworks = await fetchArtworks(BATCH_SIZE, existingIds)
      if (!artworks.length) return
      artworksRef.current = [...artworksRef.current, ...artworks]
      const prev = itemsRef.current
      const continueHeights = computeColHeightsFromItems(
        prev,
        COLS,
        colWidth,
        GAP
      )
      const { positioned, gridHeight: gh } = await layoutBatch(
        artworks,
        continueHeights,
        colWidth
      )
      setItems((cur) => [...cur, ...positioned])
      setGridHeight(gh)
    } catch {
      // Ignore load-more errors to avoid disrupting the grid
    } finally {
      loadingMoreRef.current = false
    }
  }, [COLS, colWidth, fetchArtworks, layoutBatch])

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
    <div
      className="min-h-screen font-body"
      style={{ backgroundColor: '#F5F3F0' }}
    >
      <Nav />
      <main style={{ ...mainStyle, backgroundColor: '#F5F3F0' }}>
        {loading && !items.length && (
          <p className="py-16 text-center font-body text-sm text-neutral-gray">
            Loading artworks from The Met…
          </p>
        )}
        {error && !items.length && (
          <p className="py-16 text-center font-body text-sm text-met-red">
            {error}
          </p>
        )}
        <div
          ref={gridRef}
          className="relative w-full"
          style={{ height: gridHeight, paddingTop: '32px' }}
        >
          {colWidth > 0 &&
            items.map((item) => (
              <ArtworkCard
                key={item.id}
                href={`/artwork/${item.id}`}
                imageUrl={item.imageUrl}
                alt={item.title}
                width={colWidth}
                style={{ left: item.x, top: item.y }}
              />
            ))}
          <div
            ref={sentinelRef}
            aria-hidden
            className="absolute left-0 bottom-0 w-full h-px pointer-events-none opacity-0"
          />
        </div>
      </main>
    </div>
  )
}
