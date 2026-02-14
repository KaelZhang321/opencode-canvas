import { describe, expect, it } from 'vitest'
import type { EditorState } from '../editor-store/types'
import {
  applyMarkerPatchToSource,
  buildGeneratedComponentSource,
  createSemanticDiffSummary,
  getPatchTemplateSource,
  OCODE_BLOCK_END,
  OCODE_BLOCK_START,
  parseSourceToStateFallback,
  validateSyncState,
} from './index'
import { applyAstPatch, parseSourceToState } from './ast-tools'

const mockState: EditorState = {
  nodeMap: {
    'text-1': {
      id: 'text-1',
      type: 'text',
      name: 'Heading',
      text: 'Hello Canvas',
      className: 'text-xl',
      x: 10,
      y: 20,
      width: 200,
      height: 40,
    },
  },
  rootIds: ['text-1'],
  selectedId: 'text-1',
  selectedIds: ['text-1'],
  viewport: { panX: 0, panY: 0, zoom: 1 },
}

describe('code-sync marker patch', () => {
  it('builds patch template with required markers', () => {
    const source = getPatchTemplateSource()
    expect(source).toContain('OCODE-CANVAS-START hash:')
    expect(source).toContain(OCODE_BLOCK_END)
  })

  it('applies patch for valid marker block', () => {
    const source = getPatchTemplateSource()
    const result = applyMarkerPatchToSource(source, mockState)

    expect(result.applied).toBe(true)
    expect(result.patchedSource).toContain('Hello Canvas')
    expect(result.changedLineCount).toBeGreaterThan(0)
  })

  it('rejects marker hash mismatch unless force enabled', () => {
    const source = getPatchTemplateSource().replace(
      '<div>replace me</div>',
      '<div>manually changed</div>',
    )

    const rejected = applyMarkerPatchToSource(source, mockState)
    expect(rejected.applied).toBe(false)
    expect(rejected.reason).toContain('hash mismatch')

    const forced = applyMarkerPatchToSource(source, mockState, { force: true })
    expect(forced.applied).toBe(true)
    expect(forced.patchedSource).toContain('Hello Canvas')
  })

  it('rejects invalid marker structure', () => {
    const source = `${OCODE_BLOCK_START}\n${OCODE_BLOCK_START}\n${OCODE_BLOCK_END}`
    const result = applyMarkerPatchToSource(source, mockState)

    expect(result.applied).toBe(false)
    expect(result.reason).toContain('exactly one start marker')
  })

  it('validates sync state with warnings and errors', () => {
    const validation = validateSyncState({
      ...mockState,
      rootIds: ['text-1', 'text-1', 'missing-node'],
      selectedIds: ['text-1', 'missing-selected'],
      nodeMap: {
        ...mockState.nodeMap,
        'text-1': {
          ...mockState.nodeMap['text-1'],
          width: -1,
          className: 'x'.repeat(240),
        },
      },
    })

    expect(validation.errors.length).toBeGreaterThan(0)
    expect(validation.warnings.length).toBeGreaterThan(0)
  })
})

describe('code-sync AST writeback', () => {
  it('buildGeneratedComponentSource creates deterministic TSX with node metadata', () => {
    const code = buildGeneratedComponentSource(mockState)

    expect(code).toContain('export function GeneratedCanvasView()')
    expect(code).toContain('data-node-type="text"')
    expect(code).toContain('Hello Canvas')
    expect(code).toContain('minHeight: 40')
  })

  it('applyAstPatch inserts GeneratedCanvasView when missing', () => {
    const source = [
      "import React from 'react'",
      '',
      'export function Existing() {',
      '  return <div>existing</div>',
      '}',
      '',
    ].join('\n')

    const result = applyAstPatch(source, mockState)

    expect(result.applied).toBe(true)
    expect(result.patchedSource).toContain('export function Existing()')
    expect(result.patchedSource).toContain('export function GeneratedCanvasView()')
    expect(result.patchedSource).toContain('data-node-type="text"')
  })

  it('applyAstPatch replaces existing GeneratedCanvasView body', () => {
    const source = [
      "import React from 'react'",
      '',
      'export function GeneratedCanvasView() {',
      '  return <div>old content</div>',
      '}',
      '',
    ].join('\n')

    const result = applyAstPatch(source, mockState)

    expect(result.applied).toBe(true)
    expect(result.patchedSource).not.toContain('old content')
    expect(result.patchedSource).toContain('Hello Canvas')
  })

  it('applyAstPatch returns failure for invalid TSX source', () => {
    const result = applyAstPatch('export function Broken( {', mockState)

    expect(result.applied).toBe(false)
    expect(result.reason).toContain('AST patch failed')
  })

  it('parseSourceToState parses GeneratedCanvasView back to editor state', () => {
    const source = buildGeneratedComponentSource(mockState)
    const parsed = parseSourceToState(source)

    expect(parsed.ok).toBe(true)
    expect(parsed.state?.rootIds.length).toBe(1)
    expect(parsed.state?.nodeMap['text-1']?.text).toContain('Hello Canvas')
  })

  it('parseSourceToState handles nested JSX text and expression className', () => {
    const source = [
      "import React from 'react'",
      '',
      'export function GeneratedCanvasView() {',
      '  return (',
      '    <div className="relative h-[1200px] w-[1600px]">',
      '      <div key="hero" className={"absolute text-4xl"} style={{ left: 36, top: 54, width: 360, minHeight: 72, letterSpacing: "0.02em" }} data-node-type="text">',
      '        Hello <span>Canvas</span>{"!"}',
      '      </div>',
      '      <div key="img-1" className="absolute" style={{ left: 72, top: 180, width: 220, minHeight: 160, "border-radius": "16px" }} data-node-type="image" data-src="https://example.com/a.png">',
      '      </div>',
      '    </div>',
      '  )',
      '}',
      '',
    ].join('\n')

    const parsed = parseSourceToState(source)
    const heroNode = parsed.state?.nodeMap.hero
    const imageNode = parsed.state?.nodeMap['img-1']

    expect(parsed.ok).toBe(true)
    expect(parsed.state?.rootIds).toEqual(['hero', 'img-1'])
    expect(heroNode?.text).toBe('Hello Canvas !')
    expect(heroNode?.className).toContain('text-4xl')
    expect(heroNode?.style?.letterSpacing).toBe('0.02em')
    expect(imageNode?.src).toContain('example.com')
    expect(imageNode?.style?.['border-radius']).toBe('16px')
  })

  it('parseSourceToState supports TargetCanvas import flow shape', () => {
    const source = [
      "import React from 'react'",
      '',
      'export function TargetCanvas() {',
      '  return (',
      '    <div className="relative h-[1200px] w-[1600px]">',
      '      <div key="btn-1" className="absolute btn" style={{ left: 18, top: 18, width: 144, minHeight: 54 }} data-node-type="button">Submit</div>',
      '    </div>',
      '  )',
      '}',
      '',
    ].join('\n')

    const parsed = parseSourceToState(source)

    expect(parsed.ok).toBe(true)
    expect(parsed.state?.rootIds).toEqual(['btn-1'])
    expect(parsed.state?.nodeMap['btn-1'].type).toBe('button')
    expect(parsed.state?.nodeMap['btn-1'].x).toBe(18)
    expect(parsed.state?.nodeMap['btn-1'].height).toBe(54)
  })

  it('regression: marker patch + parse import keeps node count stable', () => {
    const state: EditorState = {
      ...mockState,
      nodeMap: {
        ...mockState.nodeMap,
        'button-1': {
          id: 'button-1',
          type: 'button',
          name: 'Action',
          text: 'Continue',
          className: 'btn-primary',
          x: 216,
          y: 72,
          width: 180,
          height: 54,
        },
      },
      rootIds: ['text-1', 'button-1'],
      selectedId: 'text-1',
      selectedIds: ['text-1'],
      viewport: { panX: 0, panY: 0, zoom: 1 },
    }

    const markerPatched = applyMarkerPatchToSource(getPatchTemplateSource(), state)
    expect(markerPatched.applied).toBe(true)
    const imported = parseSourceToState(markerPatched.patchedSource ?? '')

    expect(imported.ok).toBe(true)
    expect(imported.state?.rootIds.length).toBe(2)
    expect(imported.state?.nodeMap['button-1'].text).toBe('Continue')
  })

  it('createSemanticDiffSummary reports node-level changes', () => {
    const nextState: EditorState = {
      ...mockState,
      nodeMap: {
        ...mockState.nodeMap,
        'text-1': {
          ...mockState.nodeMap['text-1'],
          x: 22,
          y: 44,
          width: 230,
          text: 'Updated',
          className: 'text-2xl',
        },
        'button-1': {
          id: 'button-1',
          type: 'button',
          name: 'Button',
          x: 10,
          y: 10,
          width: 120,
          height: 40,
          text: 'Go',
          className: 'btn',
        },
      },
      rootIds: ['text-1', 'button-1'],
      selectedId: 'text-1',
      selectedIds: ['text-1'],
      viewport: { panX: 0, panY: 0, zoom: 1 },
    }

    const summary = createSemanticDiffSummary(mockState, nextState)

    expect(summary.added).toBe(1)
    expect(summary.moved).toBe(1)
    expect(summary.resized).toBe(1)
    expect(summary.textChanged).toBe(1)
    expect(summary.styleChanged).toBe(1)
  })
})

describe('code-sync fallback parser', () => {
  it('parseSourceToStateFallback parses basic target source without AST module', () => {
    const source = [
      "import React from 'react'",
      '',
      'export function TargetCanvas() {',
      '  return (',
      '    <div className="relative h-[1200px] w-[1600px]">',
      '      <div key="hero-fallback" className="absolute text-3xl" style={{ left: 18, top: 24, width: 300, minHeight: 70, "border-radius": "12px" }} data-node-type="text">Fallback Hero</div>',
      '    </div>',
      '  )',
      '}',
      '',
    ].join('\n')

    const parsed = parseSourceToStateFallback(source)

    expect(parsed.ok).toBe(true)
    expect(parsed.state?.rootIds).toEqual(['hero-fallback'])
    expect(parsed.state?.nodeMap['hero-fallback'].text).toBe('Fallback Hero')
    expect(parsed.state?.nodeMap['hero-fallback'].style?.['border-radius']).toBe('12px')
  })
})
