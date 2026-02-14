import type { EditorState } from '../editor-store/types'

export interface PreviewRuntimeStatus {
  ready: boolean
  message: string
}

export function getPreviewRuntimeStatus(): PreviewRuntimeStatus {
  return {
    ready: true,
    message: 'Vite HMR runtime connected.',
  }
}

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function buildPreviewRuntimeDocument(state: EditorState): string {
  const nodes = state.rootIds
    .map((id) => state.nodeMap[id])
    .filter((node): node is NonNullable<typeof node> => Boolean(node))

  const blocks = nodes
    .map((node) => {
      const styleEntries = Object.entries(node.style ?? {})
        .map(([key, value]) => `${key}: ${value};`)
        .join(' ')
      return `<div class="node ${escapeHtml(node.className ?? '')}" data-type="${escapeHtml(node.type)}" style="position:absolute;left:${node.x}px;top:${node.y}px;width:${node.width}px;min-height:${node.height}px;${styleEntries}">${escapeHtml(node.text ?? node.name)}</div>`
    })
    .join('')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin:0; background:#0b1220; color:#dbe4ff; font-family: Inter, ui-sans-serif, system-ui; }
      .canvas { position: relative; width: 1600px; height: 1200px; background-image: radial-gradient(circle at 1px 1px, #1f2a44 1px, transparent 0); background-size: 18px 18px; }
      .node { box-sizing: border-box; border: 1px solid rgba(148,163,184,.45); border-radius: 8px; padding: 8px; overflow:hidden; }
      .node[data-type="button"] { display: inline-flex; align-items:center; justify-content:center; }
      .node[data-type="image"] { background: #0f172a; }
      .node[data-type="frame"] { border-style: dashed; }
    </style>
  </head>
  <body>
    <div class="canvas">${blocks}</div>
  </body>
</html>`
}
