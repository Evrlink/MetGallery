'use client'

import Link from 'next/link'
import { useRef, useState, type CSSProperties } from 'react'

interface ArtworkCardProps {
  href: string
  imageUrl: string
  alt: string
  width: number
  style: CSSProperties
}

export function ArtworkCard({
  href,
  imageUrl,
  alt,
  width,
  style,
}: ArtworkCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState('perspective(800px) rotateX(0deg) rotateY(0deg)')
  const [isHovering, setIsHovering] = useState(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -5
    const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 5
    setTilt(
      `perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`
    )
  }

  const handleMouseLeave = () => {
    setIsHovering(false)
    setTilt('perspective(800px) rotateX(0deg) rotateY(0deg)')
  }

  return (
    <Link
      href={href}
      className="absolute block"
      style={{ ...style, width }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: tilt,
          transition: isHovering
            ? 'transform 0.1s ease-out'
            : 'transform 0.3s ease-out',
        }}
        className="bg-museum-white rounded-lg overflow-hidden"
      >
        <div className="relative">
          <img src={imageUrl} alt={alt} className="w-full h-auto block" />
          <div
            className={`absolute inset-0 flex items-center justify-center transition-opacity duration-100 ${
              isHovering ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <span className="font-body text-[13px] font-semibold text-gallery-black bg-white/70 backdrop-blur-[8px] rounded-full py-2 px-5">
              Open
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
