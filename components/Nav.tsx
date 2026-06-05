'use client'

import Link from 'next/link'
import { ConnectWallet } from '@/components/ConnectWallet'

export function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center h-[3.25rem] px-6 md:px-8 gap-6 backdrop-blur-md bg-ivory/80 border-b border-gold/15">
      <Link
        href="/"
        className="font-display text-lg tracking-wide text-charcoal hover:text-gold transition-colors"
      >
        MetGallery
      </Link>
      <div className="ml-auto">
        <ConnectWallet />
      </div>
    </nav>
  )
}
