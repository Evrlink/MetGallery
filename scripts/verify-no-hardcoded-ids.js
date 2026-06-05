const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()
const SCAN_DIRS = ['app', 'components', 'config', 'lib', 'scripts', 'public', 'types']
const SKIP_FILES = new Set([
  path.join(ROOT, 'scripts', 'verify-no-hardcoded-ids.js'),
])
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.html', '.json', '.mjs'])

const FORBIDDEN_PATTERNS = [
  { name: 'legacy Base app id', regex: /69f[a-f0-9]{20,}/i },
  { name: 'MoMA URL', regex: /moma\.org/i },
  { name: 'MoMA branding', regex: /\bMoMA\b/i },
  { name: 'placeholder Base app id', regex: /YOUR_BASE_APP_ID/i },
  { name: 'hardcoded wallet', regex: /0x[a-fA-F0-9]{40}/ },
]

const ALLOWED_BASE_META_FILES = new Set([
  path.join(ROOT, 'lib', 'base-metadata.ts'),
  path.join(ROOT, 'app', 'api', 'base-verification', 'route.ts'),
])

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, files)
    else if (EXTENSIONS.has(path.extname(entry.name))) files.push(full)
  }
  return files
}

function scanFile(file) {
  const content = fs.readFileSync(file, 'utf-8')
  const hits = []

  for (const { name, regex } of FORBIDDEN_PATTERNS) {
    if (regex.test(content)) hits.push(name)
  }

  if (
    /base:app_id/i.test(content) &&
    !ALLOWED_BASE_META_FILES.has(file) &&
    !content.includes('process.env.NEXT_PUBLIC_BASE_APP_ID') &&
    !content.includes('getBaseAppId()') &&
    !content.includes('buildAppMetadata')
  ) {
    hits.push('base:app_id meta outside env-driven helpers')
  }

  return hits
}

let failed = false
const files = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d)))

for (const file of files) {
  if (SKIP_FILES.has(file)) continue
  const hits = scanFile(file)
  if (hits.length) {
    failed = true
    console.error(`${path.relative(ROOT, file)}: ${hits.join(', ')}`)
  }
}

if (failed) {
  console.error('\nVerification failed: remove hardcoded IDs or legacy MoMA references.')
  process.exit(1)
}

console.log('OK: no hardcoded app IDs, wallet addresses, or legacy MoMA references found.')
