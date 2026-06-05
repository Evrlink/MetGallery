# MetGallery

A Next.js 16 app for browsing The Metropolitan Museum of Art collection — filtered to **Photographs** (dept. 19) and **Modern Art** (dept. 21) — with AI-generated educational insights powered by Claude.

## Tech Stack

- Next.js 16.2.4, TypeScript, Tailwind v4
- @base-org/account, wagmi, viem
- @anthropic-ai/sdk (claude-opus-4-5)
- @upstash/redis, TanStack Query

## Setup

1. Copy environment variables to `.env.local`:

```
ANTHROPIC_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_BASE_APP_ID=
```

2. Install dependencies and seed the artwork cache:

```bash
npm install
npm run seed
```

3. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Routes

- `GET /api/artworks?count=20` — random artworks from Redis cache
- `GET /api/artwork/[id]` — single artwork by ID
- `POST /api/ai-insight` — AI-generated educational insight (cached 7 days)

## Data Source

Artworks are fetched from [The Met Collection API](https://collectionapi.metmuseum.org/public/collection/v1/) and cached in Upstash Redis via `scripts/seed.js`.
