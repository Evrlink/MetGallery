const PLACEHOLDER_PREFIX = /^your_/i

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim()
  if (!value || PLACEHOLDER_PREFIX.test(value)) return undefined
  return value
}

export function getBaseAppId(): string | undefined {
  return readEnv('NEXT_PUBLIC_BASE_APP_ID')
}

export function getAnthropicApiKey(): string | undefined {
  return readEnv('ANTHROPIC_API_KEY')
}
