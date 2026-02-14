import { describe, expect, it } from 'vitest'
import type { EditorNode } from '../editor-store/types'
import { generateAiProposals, generatePageFromPrompt } from './refactor'

describe('AI refactor integration', () => {
  it('returns empty proposals when no nodes are selected', async () => {
    const result = await generateAiProposals('make this a hero', [])
    expect(result.proposals).toEqual([])
    expect(result.source).toBe('fallback')
  })

  it('returns fallback proposals without API key', async () => {
    const selected: EditorNode[] = [
      {
        id: 'text-1',
        type: 'text',
        name: 'Title',
        text: 'Hello',
        className: 'text-xl',
        x: 20,
        y: 30,
        width: 300,
        height: 60,
      },
    ]

    const result = await generateAiProposals('boost hero contrast', selected)
    expect(result.proposals.length).toBeGreaterThan(0)
    expect(result.proposals[0].patch).toBeTruthy()
  })

  it('generates fallback page when API key is missing', async () => {
    const page = await generatePageFromPrompt('Create a modern SaaS landing page')

    expect(page.title).toBe('着陆页面')
    expect(page.nodes.length).toBeGreaterThan(0)
    expect(page.nodes[0]?.id).toBeTruthy()
    expect(page.nodes.every((node) => node.width >= 20 && node.height >= 20)).toBe(true)
    expect(page.source).toBe('fallback')
    expect(page.warnings.length).toBeGreaterThan(0)
  })

  it('validates unsupported patch keys from LLM and emits degradation warnings', async () => {
    const originalFetch = globalThis.fetch
    const globalWithProcess = globalThis as typeof globalThis & {
      process?: { env?: Record<string, string | undefined> }
    }
    const originalEnv = { ...(globalWithProcess.process?.env ?? {}) }

    globalThis.fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  proposals: [
                    {
                      title: 'Invalid fields',
                      rationale: 'contains unsupported keys',
                      patch: {
                        className: 'text-red-500',
                        randomUnknownField: 'x',
                      },
                    },
                  ],
                }),
              },
            },
          ],
        }),
      }) as Response

    if (!globalWithProcess.process) {
      globalWithProcess.process = { env: {} }
    }
    if (!globalWithProcess.process.env) {
      globalWithProcess.process.env = {}
    }
    globalWithProcess.process.env.VITE_AI_API_KEY = 'test-key'
    globalWithProcess.process.env.VITE_AI_API_URL = 'https://fake.local/v1/chat/completions'
    globalWithProcess.process.env.VITE_AI_MODEL = 'test-model'

    const selected: EditorNode[] = [
      {
        id: 'text-1',
        type: 'text',
        name: 'Title',
        text: 'Hello',
        className: 'text-xl',
        x: 20,
        y: 30,
        width: 300,
        height: 60,
      },
    ]

    try {
      const result = await generateAiProposals('validate schema', selected)

      expect(result.source).toBe('llm')
      expect(result.proposals.length).toBe(1)
      expect(result.proposals[0].patch.className).toBe('text-red-500')
      expect(result.warnings.join(' ')).toContain('Unsupported patch keys ignored')
    } finally {
      globalThis.fetch = originalFetch
      if (globalWithProcess.process?.env) {
        globalWithProcess.process.env = originalEnv
      }
    }
  })
})
