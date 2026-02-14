import type { NodeType } from '../editor-store/types'

export type TokenTheme = 'ocean' | 'sunset' | 'forest'
export type TokenPreset = 'neutral' | 'emphasis' | 'ghost'

export const TOKEN_THEMES: TokenTheme[] = ['ocean', 'sunset', 'forest']
export const TOKEN_PRESETS: TokenPreset[] = ['neutral', 'emphasis', 'ghost']

const CLASS_BY_PRESET: Record<TokenPreset, Partial<Record<NodeType, string>>> = {
  neutral: {
    text: 'text-[color:var(--token-text-primary)]',
    button:
      'rounded-lg bg-[color:var(--token-accent)] px-4 py-2 text-sm font-semibold text-[color:var(--token-on-accent)]',
    card: 'rounded-xl border border-[color:var(--token-border)] bg-[color:var(--token-surface)] p-4',
    frame: 'border border-dashed border-[color:var(--token-border)]',
    form: 'rounded-lg border border-[color:var(--token-border)] bg-[color:var(--token-surface)] p-4',
    image: 'rounded-lg',
  },
  emphasis: {
    text: 'text-[color:var(--token-text-strong)] tracking-tight',
    button:
      'rounded-xl bg-[color:var(--token-accent-strong)] px-5 py-2 text-sm font-bold text-[color:var(--token-on-accent)] shadow-[0_8px_24px_var(--token-shadow)]',
    card:
      'rounded-xl border border-[color:var(--token-border-strong)] bg-[color:var(--token-surface-strong)] p-4 shadow-[0_10px_28px_var(--token-shadow)]',
    frame: 'border-2 border-dashed border-[color:var(--token-border-strong)]',
    form:
      'rounded-xl border border-[color:var(--token-border-strong)] bg-[color:var(--token-surface-strong)] p-4',
    image: 'rounded-xl ring-1 ring-[color:var(--token-border-strong)]',
  },
  ghost: {
    text: 'text-[color:var(--token-text-muted)]',
    button:
      'rounded-lg border border-[color:var(--token-border)] bg-transparent px-4 py-2 text-sm text-[color:var(--token-text-primary)]',
    card: 'rounded-lg border border-[color:var(--token-border)] bg-transparent p-4',
    frame: 'border border-dashed border-[color:var(--token-border)]',
    form: 'rounded-lg border border-[color:var(--token-border)] bg-transparent p-4',
    image: 'rounded-md opacity-95',
  },
}

export function getTokenClassForNode(
  type: NodeType,
  preset: TokenPreset,
): string {
  return CLASS_BY_PRESET[preset][type] ?? ''
}
