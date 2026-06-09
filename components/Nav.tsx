import Link from 'next/link'

export function Nav() {
  return (
    <nav
      className="font-inter sticky top-0 z-[300]"
      style={{
        height: '60px',
        backgroundColor: 'rgb(228, 0, 43)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 0,
        fontFamily: 'var(--font-inter), Inter, sans-serif',
        fontSize: '14.9333px',
        fontWeight: 400,
        color: 'rgb(255, 255, 255)',
      }}
    >
      <Link
        href="/"
        className="font-display no-underline"
        style={{
          marginLeft: '65.4px',
          fontSize: '28px',
          fontWeight: 500,
          color: 'rgb(255, 255, 255)',
          letterSpacing: '0.02em',
        }}
      >
        MetGallery
      </Link>
    </nav>
  )
}
