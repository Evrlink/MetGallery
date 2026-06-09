import type { Metadata } from 'next'
import { EB_Garamond, Inter, Source_Sans_3 } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { buildAppMetadata } from '@/lib/base-metadata'

const ebGaramond = EB_Garamond({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['400', '500'],
})

const sourceSans = Source_Sans_3({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '600'],
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500'],
})

export async function generateMetadata(): Promise<Metadata> {
  return buildAppMetadata()
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${ebGaramond.variable} ${sourceSans.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-parchment text-gallery-black font-body">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
