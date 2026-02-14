import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const distDir = join(process.cwd(), 'dist')
const indexHtmlPath = join(distDir, 'index.html')
const indexHtml = readFileSync(indexHtmlPath, 'utf8')

const modulePreloadHrefs = [...indexHtml.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)].map(
  (match) => match[1] ?? '',
)

const forbidden = ['ast-tools', 'babel-parser', 'babel-generator', 'babel-types']
const leaked = modulePreloadHrefs.filter((href) =>
  forbidden.some((token) => href.includes(token)),
)

if (leaked.length > 0) {
  console.error(
    `[verify:lazy-ast] Found forbidden eager preload chunks: ${leaked.join(', ')}`,
  )
  process.exit(1)
}

console.log('[verify:lazy-ast] OK: AST chunks are not eagerly preloaded in index.html')
