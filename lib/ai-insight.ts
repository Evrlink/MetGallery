import type { Artwork } from '@/types/artwork'

export interface InsightArtworkFields {
  title: string
  artist: string
  year: string
  medium: string
  department: string
}

export function artworkToInsightFields(artwork: Artwork | InsightArtworkFields): InsightArtworkFields {
  return {
    title: artwork.title,
    artist: artwork.artist,
    year: artwork.year,
    medium: artwork.medium,
    department: artwork.department,
  }
}

export function buildInsightPrompt(fields: InsightArtworkFields): string {
  return [
    'Write a concise educational insight for a museum visitor viewing this Metropolitan Museum artwork.',
    'Use 4–5 clear sentences. No markdown, hashtags, or bold. Do not repeat the title.',
    '',
    `Title: ${fields.title}`,
    `Artist: ${fields.artist}`,
    `Year: ${fields.year}`,
    `Medium: ${fields.medium}`,
    `Department: ${fields.department}`,
  ].join('\n')
}
