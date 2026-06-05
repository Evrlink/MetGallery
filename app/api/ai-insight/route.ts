import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getRedis } from '@/lib/redis'

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { insight: 'AI insights are not configured. Add ANTHROPIC_API_KEY to .env.local.' },
        { status: 503 }
      )
    }

    const body = await req.json()
    const { id, title, artist, year, medium, department } = body

    const redis = getRedis()
    const cacheKey = `insight:${id}`
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
          content: `You are an expert art historian writing for a museum gallery app. Write an engaging, educational insight about this artwork for a curious visitor. Cover historical context, artistic significance, and what makes this piece notable. Write 4-5 sentences in clear, accessible prose. No markdown, no hashtags, no bold formatting, do not repeat the title verbatim.

Title: ${title}
Artist: ${artist}
Year: ${year}
Medium: ${medium}
Department: ${department}`,
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
