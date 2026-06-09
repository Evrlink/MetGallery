import Link from 'next/link'

const interTextStyle = {
  fontSize: '14.9333px',
  fontWeight: 400,
  lineHeight: '23.8933px',
  color: 'rgb(255, 255, 255)',
} as const

const barPaddingStyle = {
  paddingTop: '10.18px',
  paddingBottom: '10.18px',
  paddingLeft: '65.4px',
  paddingRight: '65.4px',
} as const

export function Nav() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div
        className="font-inter text-center"
        style={{
          backgroundColor: 'rgb(110, 24, 46)',
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          rowGap: '10.18px',
          ...barPaddingStyle,
          ...interTextStyle,
        }}
      >
        Exploring The Met · Photographs & Modern Art
      </div>
      <nav
        className="font-inter bg-met-red"
        style={{
          display: 'flex',
          alignItems: 'center',
          rowGap: '10.18px',
          ...barPaddingStyle,
          ...interTextStyle,
        }}
      >
        <Link
          href="/"
          className="font-display no-underline"
          style={{
            fontSize: '28px',
            fontWeight: 500,
            color: 'rgb(255, 255, 255)',
            letterSpacing: '0.02em',
          }}
        >
          MetGallery
        </Link>
      </nav>
    </header>
  )
}
