import { baseVerificationHtml } from '@/lib/base-metadata'

export async function GET() {
  return new Response(baseVerificationHtml(), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
