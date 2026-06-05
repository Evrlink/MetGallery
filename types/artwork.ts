export interface Artwork {
  id: number
  title: string
  artist: string
  year: string
  medium: string
  department: string
  imageUrl: string
  objectUrl: string
}

export interface ArtworkLayout extends Artwork {
  x: number
  y: number
  h: number
}

export interface AIInsightResponse {
  insight: string
}
