# MetGallery

Browse The Metropolitan Museum of Art collection — **Photographs** (department 19) and **Modern Art** (department 21) — with AI-generated educational insights on Base.

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
- `npm run seed` — fetch Met artworks into Upstash Redis (clears cache first)
- `npm run build` — runs verify, then production build

## API

| Route | Description |
|-------|-------------|
| `GET /api/artworks?count=20` | Random cached artworks |
| `GET /api/artwork/[id]` | Single artwork |
| `POST /api/ai-insight` | Claude insight (cached 7 days) |
| `GET /base-verification.html` | Base app verification (uses `NEXT_PUBLIC_BASE_APP_ID`) |

Data source: [Met Collection API](https://collectionapi.metmuseum.org/public/collection/v1/)
