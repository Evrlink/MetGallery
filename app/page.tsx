import Gallery from '@/components/Gallery'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default function Home() {
  return <Gallery />
}
