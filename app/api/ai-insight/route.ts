import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildInsightPrompt } from '@/lib/ai-insight'
import { getAnthropicApiKey } from '@/lib/env'
import { getRedis, insightKey } from '@/lib/redis'

export async function POST(req: NextRequest) {
  try {
    const apiKey = getAnthropicApiKey()
    if (!apiKey) {
      return NextResponse.json(
        { insight: 'AI insights are not configured. Add ANTHROPIC_API_KEY to .env.local.' },
        { status: 503 }
      )
    }

    const body = await req.json()
    const { id, title, artist, year, medium, department } = body
    const redis = getRedis()
    const cacheKey = insightKey(id)
    const cached = await redis.get<string>(cacheKey)
    if (cached) {
      return NextResponse.json({ insight: cached })
    }

    const anthropic = new Anthropic({ apiKey })
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: buildInsightPrompt({ title, artist, year, medium, department }),
        },
      ],
    })

    const textBlock = message.content.find((block) => block.type === 'text')
    let insight = textBlock && 'text' in textBlock ? textBlock.text : 'No insight available.'
    insight = insight.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').trim()

    await redis.set(cacheKey, insight, { ex: 60 * 60 * 24 * 7 })

    return NextResponse.json({ insight })
  } catch {
    return NextResponse.json({ insight: 'Unable to generate insight at this time.' })
  }
}
