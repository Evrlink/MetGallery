# MetGallery

Browse The Metropolitan Museum of Art **Modern and Contemporary Art** collection with AI-generated educational insights on Base.

## Stack

- Next.js 16.2.4, TypeScript, Tailwind v4
- @base-org/account, wagmi, viem
- @anthropic-ai/sdk, @upstash/redis, TanStack Query

## Environment

Create `.env.local` (never committed):

```
ANTHROPIC_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_BASE_APP_ID=
```

All secrets are read via `process.env` only.

## Setup

```bash
npm install
npm run seed
npm run dev
```

## Scripts

- `npm run verify:clean` — fail if hardcoded app IDs, wallets, or MoMA references exist
- `npm run clear-cache` — empty MetGallery and legacy Redis keys
- `npm run seed` — load 200 artworks from Met Open Access CSV into Upstash Redis (clears cache first)
- `npm run build` — runs verify, then production build

## API

| Route | Description |
|-------|-------------|
| `GET /api/artworks?count=20` | Random cached artworks |
| `GET /api/artwork/[id]` | Single artwork |
| `POST /api/ai-insight` | Claude insight (cached 7 days) |
| `GET /base-verification.html` | Base app verification (uses `NEXT_PUBLIC_BASE_APP_ID`) |

| `GET /api/seed` | Seed Redis from Met Open Access CSV (requires `x-seed-secret` header) |

Data source: [Met Open Access CSV](https://github.com/metmuseum/openaccess) and [met-openaccess-images](https://github.com/gregsadetsky/met-openaccess-images)
