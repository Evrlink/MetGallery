import type { Metadata } from 'next'
import { getBaseAppId } from '@/lib/env'

export function buildAppMetadata(): Metadata {
  const metadata: Metadata = {
    title: 'MetGallery',
    description: 'Explore The Met Photographs & Modern Art collection on Base',
  }

  const appId = getBaseAppId()
  if (appId) {
    metadata.other = { 'base:app_id': appId }
  }

  return metadata
}

export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
}

export function baseVerificationHtml(): string {
  const appId = getBaseAppId() ?? ''
  const escaped = escapeHtmlAttribute(appId)
  return `<!DOCTYPE html><html><head><meta name="base:app_id" content="${escaped}" /></head><body></body></html>`
}
