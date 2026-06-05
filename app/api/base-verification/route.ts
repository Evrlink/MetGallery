export async function GET() {
  const appId = process.env.NEXT_PUBLIC_BASE_APP_ID ?? ''
  const escaped = appId.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const html = `<!DOCTYPE html><html><head><meta name="base:app_id" content="${escaped}" /></head><body></body></html>`
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
