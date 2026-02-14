import { describe, expect, it } from 'vitest'
import { applyCommand, sanitizeNode, sanitizePatch } from './store'
import type { EditorNode, EditorState, NodeType } from './types'

function createState(): EditorState {
  const nodeMap: Record<string, EditorNode> = {
    'text-1': {
      id: 'text-1',
      type: 'text',
      name: 'Heading',
      x: 10,
      y: 20,
      width: 300,
      height: 50,
      text: 'hello',
      className: 'text-xl',
    },
    'button-1': {
      id: 'button-1',
      type: 'button',
      name: 'CTA',
      x: 40,
      y: 60,
      width: 180,
      height: 44,
      text: 'click',
      className: 'btn',
    },
    'frame-1': {
      id: 'frame-1',
      type: 'frame',
      name: 'Frame',
      x: 100,
      y: 120,
      width: 640,
      height: 360,
      text: '',
      className: 'frame',
    },
  }

  return {
    nodeMap,
    rootIds: ['text-1', 'button-1', 'frame-1'],
    selectedId: 'text-1',
    selectedIds: ['text-1'],
    viewport: { panX: 0, panY: 0, zoom: 1 },
  }
}

describe('applyCommand - select', () => {
  it('selects existing node in non-additive mode', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'select',
      payload: { id: 'button-1', additive: false },
    })

    expect(next).not.toBe(prev)
    expect(next.selectedId).toBe('button-1')
    expect(next.selectedIds).toEqual(['button-1'])
  })

  it('returns same state when selecting non-existent node', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'select',
      payload: { id: 'missing', additive: false },
    })

    expect(next).toBe(prev)
  })

  it('adds node to selection in additive mode', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'select',
      payload: { id: 'button-1', additive: true },
    })

    expect(next.selectedIds).toEqual(['text-1', 'button-1'])
    expect(next.selectedId).toBe('button-1')
  })

  it('toggles selected node off in additive mode', () => {
    const prev: EditorState = {
      ...createState(),
      selectedId: 'button-1',
      selectedIds: ['text-1', 'button-1'],
      viewport: { panX: 0, panY: 0, zoom: 1 },
    }

    const next = applyCommand(prev, {
      type: 'select',
      payload: { id: 'button-1', additive: true },
    })

    expect(next.selectedIds).toEqual(['text-1'])
    expect(next.selectedId).toBe('text-1')
  })

  it('returns same reference when already exclusively selected', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'select',
      payload: { id: 'text-1', additive: false },
    })

    expect(next).toBe(prev)
  })
})

describe('applyCommand - selectAll', () => {
  it('selects all valid ids and uses first as selectedId', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'selectAll',
      payload: { ids: ['button-1', 'frame-1', 'text-1'] },
    })

    expect(next.selectedIds).toEqual(['button-1', 'frame-1', 'text-1'])
    expect(next.selectedId).toBe('button-1')
  })

  it('filters out non-existent ids', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'selectAll',
      payload: { ids: ['missing', 'frame-1', 'missing-2'] },
    })

    expect(next.selectedIds).toEqual(['frame-1'])
    expect(next.selectedId).toBe('frame-1')
  })
})

describe('applyCommand - setSelection', () => {
  it('replaces selection in non-additive mode', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'setSelection',
      payload: { ids: ['button-1', 'frame-1'], additive: false },
    })

    expect(next.selectedIds).toEqual(['button-1', 'frame-1'])
    expect(next.selectedId).toBe('frame-1')
  })

  it('merges selection in additive mode', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'setSelection',
      payload: { ids: ['button-1'], additive: true },
    })

    expect(next.selectedIds).toEqual(['text-1', 'button-1'])
    expect(next.selectedId).toBe('button-1')
  })
})

describe('applyCommand - clearSelection', () => {
  it('clears selectedId and selectedIds', () => {
    const prev = createState()
    const next = applyCommand(prev, { type: 'clearSelection' })

    expect(next.selectedId).toBeNull()
    expect(next.selectedIds).toEqual([])
  })

  it('returns same reference when already empty', () => {
    const prev: EditorState = {
      ...createState(),
      selectedId: null,
      selectedIds: [],
      viewport: { panX: 0, panY: 0, zoom: 1 },
    }
    const next = applyCommand(prev, { type: 'clearSelection' })

    expect(next).toBe(prev)
  })
})

describe('applyCommand - move', () => {
  it('moves existing node to exact x/y', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'move',
      payload: { id: 'text-1', x: 777, y: 888 },
    })

    expect(next.nodeMap['text-1'].x).toBe(774)
    expect(next.nodeMap['text-1'].y).toBe(882)
  })

  it('returns same state for non-existent node', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'move',
      payload: { id: 'missing', x: 1, y: 2 },
    })

    expect(next).toBe(prev)
  })

  it('does not move locked node', () => {
    const prev = createState()
    prev.nodeMap['text-1'] = { ...prev.nodeMap['text-1'], locked: true }

    const next = applyCommand(prev, {
      type: 'move',
      payload: { id: 'text-1', x: 300, y: 400 },
    })

    expect(next).toBe(prev)
  })
})

describe('applyCommand - moveMany', () => {
  it('moves multiple nodes by delta', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'moveMany',
      payload: { ids: ['text-1', 'button-1'], deltaX: 10.4, deltaY: -4.6 },
    })

    expect(next.nodeMap['text-1'].x).toBe(18)
    expect(next.nodeMap['text-1'].y).toBe(18)
    expect(next.nodeMap['button-1'].x).toBe(54)
    expect(next.nodeMap['button-1'].y).toBe(54)
  })

  it('returns same state for empty ids', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'moveMany',
      payload: { ids: [], deltaX: 5, deltaY: 5 },
    })

    expect(next).toBe(prev)
  })

  it('returns same state for zero delta', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'moveMany',
      payload: { ids: ['text-1'], deltaX: 0, deltaY: 0 },
    })

    expect(next).toBe(prev)
  })

  it('filters out non-existent ids and still updates valid nodes', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'moveMany',
      payload: { ids: ['missing', 'frame-1'], deltaX: -9, deltaY: 2 },
    })

    expect(next.nodeMap['frame-1'].x).toBe(90)
    expect(next.nodeMap['frame-1'].y).toBe(126)
    expect(next.nodeMap['text-1']).toEqual(prev.nodeMap['text-1'])
  })

  it('skips locked node during group move', () => {
    const prev = createState()
    prev.nodeMap['button-1'] = { ...prev.nodeMap['button-1'], locked: true }

    const next = applyCommand(prev, {
      type: 'moveMany',
      payload: { ids: ['text-1', 'button-1'], deltaX: 20, deltaY: 20 },
    })

    expect(next.nodeMap['text-1'].x).toBe(36)
    expect(next.nodeMap['text-1'].y).toBe(36)
    expect(next.nodeMap['button-1']).toEqual(prev.nodeMap['button-1'])
  })
})

describe('applyCommand - reorderRoots', () => {
  it('reorders rootIds when dragging between two existing ids', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'reorderRoots',
      payload: { fromId: 'frame-1', toId: 'text-1' },
    })

    expect(next.rootIds).toEqual(['frame-1', 'text-1', 'button-1'])
  })

  it('returns same state when ids are invalid or same', () => {
    const prev = createState()
    const same = applyCommand(prev, {
      type: 'reorderRoots',
      payload: { fromId: 'text-1', toId: 'text-1' },
    })
    const missing = applyCommand(prev, {
      type: 'reorderRoots',
      payload: { fromId: 'missing', toId: 'text-1' },
    })

    expect(same).toBe(prev)
    expect(missing).toBe(prev)
  })
})

describe('regression - marquee + drag + reorder flow', () => {
  it('keeps selection and geometry stable through multi-step interactions', () => {
    const base = createState()
    const marqueeSelected = applyCommand(base, {
      type: 'setSelection',
      payload: { ids: ['text-1', 'button-1'], additive: false },
    })

    expect(marqueeSelected.selectedIds).toEqual(['text-1', 'button-1'])

    const dragged = applyCommand(marqueeSelected, {
      type: 'moveMany',
      payload: { ids: marqueeSelected.selectedIds, deltaX: 20, deltaY: 18 },
    })

    expect(dragged.nodeMap['text-1'].x).toBe(36)
    expect(dragged.nodeMap['text-1'].y).toBe(36)
    expect(dragged.nodeMap['button-1'].x).toBe(54)
    expect(dragged.nodeMap['button-1'].y).toBe(72)

    const reordered = applyCommand(dragged, {
      type: 'reorderRoots',
      payload: { fromId: 'button-1', toId: 'text-1' },
    })

    expect(reordered.rootIds).toEqual(['button-1', 'text-1', 'frame-1'])
    expect(reordered.selectedIds).toEqual(['text-1', 'button-1'])
    expect(reordered.selectedId).toBe('button-1')
  })
})

describe('applyCommand - updateMany', () => {
  it('updates text on multiple nodes', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'updateMany',
      payload: {
        ids: ['text-1', 'button-1'],
        patch: { text: 'updated' },
      },
    })

    expect(next.nodeMap['text-1'].text).toBe('updated')
    expect(next.nodeMap['button-1'].text).toBe('updated')
  })

  it('returns same state for empty ids', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'updateMany',
      payload: { ids: [], patch: { text: 'x' } },
    })

    expect(next).toBe(prev)
  })

  it('returns same state when all ids are invalid', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'updateMany',
      payload: { ids: ['missing-1', 'missing-2'], patch: { text: 'x' } },
    })

    expect(next).toBe(prev)
  })

  it('applies sanitizePatch constraints during update', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'updateMany',
      payload: {
        ids: ['text-1'],
        patch: {
          name: 'n'.repeat(120),
          text: 't'.repeat(1200),
          className: 'c'.repeat(700),
          x: 10.7,
          y: -1.2,
          width: 0,
          height: -999,
        },
      },
    })

    expect(next.nodeMap['text-1'].name).toHaveLength(80)
    expect(next.nodeMap['text-1'].text).toHaveLength(1000)
    expect(next.nodeMap['text-1'].className).toHaveLength(500)
    expect(next.nodeMap['text-1'].x).toBe(11)
    expect(next.nodeMap['text-1'].y).toBe(-1)
    expect(next.nodeMap['text-1'].width).toBe(1)
    expect(next.nodeMap['text-1'].height).toBe(1)
  })
})

describe('applyCommand - add', () => {
  it('adds valid node to map and rootIds and selects it', () => {
    const prev = createState()
    const newNode: EditorNode = {
      id: 'text-2',
      type: 'text',
      name: 'New',
      x: 1,
      y: 2,
      width: 3,
      height: 4,
      text: 'value',
      className: 'cls',
    }

    const next = applyCommand(prev, {
      type: 'add',
      payload: { node: newNode },
    })

    expect(next.nodeMap['text-2']).toBeDefined()
    expect(next.rootIds).toContain('text-2')
    expect(next.selectedId).toBe('text-2')
    expect(next.selectedIds).toEqual(['text-2'])
  })

  it('returns same state for duplicate id', () => {
    const prev = createState()
    const duplicate: EditorNode = {
      ...prev.nodeMap['text-1'],
      name: 'duplicate',
    }

    const next = applyCommand(prev, {
      type: 'add',
      payload: { node: duplicate },
    })

    expect(next).toBe(prev)
  })

  it('returns same state for invalid node type', () => {
    const prev = createState()
    const invalidNode: EditorNode = {
      id: 'bad-1',
      type: 'invalid' as NodeType,
      name: 'Bad',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      text: 'bad',
      className: 'bad',
    }

    const next = applyCommand(prev, {
      type: 'add',
      payload: { node: invalidNode },
    })

    expect(next).toBe(prev)
  })

  it('sanitizes fields when adding', () => {
    const prev = createState()
    const node: EditorNode = {
      id: 'button-2',
      type: 'button',
      name: 'n'.repeat(120),
      x: 7.8,
      y: -2.2,
      width: 0,
      height: 0,
      text: 't'.repeat(2000),
      className: 'c'.repeat(900),
    }

    const next = applyCommand(prev, {
      type: 'add',
      payload: { node },
    })

    expect(next.nodeMap['button-2'].name).toHaveLength(80)
    expect(next.nodeMap['button-2'].text).toHaveLength(1000)
    expect(next.nodeMap['button-2'].className).toHaveLength(500)
    expect(next.nodeMap['button-2'].x).toBe(8)
    expect(next.nodeMap['button-2'].y).toBe(-2)
    expect(next.nodeMap['button-2'].width).toBe(1)
    expect(next.nodeMap['button-2'].height).toBe(1)
  })
})

describe('applyCommand - removeMany', () => {
  it('removes nodes from nodeMap, rootIds and selectedIds', () => {
    const prev: EditorState = {
      ...createState(),
      selectedId: 'text-1',
      selectedIds: ['text-1', 'frame-1'],
      viewport: { panX: 0, panY: 0, zoom: 1 },
    }
    const next = applyCommand(prev, {
      type: 'removeMany',
      payload: { ids: ['text-1', 'frame-1'] },
    })

    expect(next.nodeMap['text-1']).toBeUndefined()
    expect(next.nodeMap['frame-1']).toBeUndefined()
    expect(next.rootIds).toEqual(['button-1'])
    expect(next.selectedIds).toEqual([])
    expect(next.selectedId).toBe('button-1')
  })

  it('returns same state when no ids exist', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'removeMany',
      payload: { ids: ['missing-1', 'missing-2'] },
    })

    expect(next).toBe(prev)
  })

  it('updates selectedId based on remaining selectedIds after removal', () => {
    const prev: EditorState = {
      ...createState(),
      selectedId: 'button-1',
      selectedIds: ['button-1', 'frame-1'],
      viewport: { panX: 0, panY: 0, zoom: 1 },
    }

    const next = applyCommand(prev, {
      type: 'removeMany',
      payload: { ids: ['button-1'] },
    })

    expect(next.selectedIds).toEqual(['frame-1'])
    expect(next.selectedId).toBe('frame-1')
  })
})

describe('sanitizePatch', () => {
  it('rounds number fields and enforces minimum size', () => {
    const current = createState().nodeMap['text-1']
    const next = sanitizePatch(
      {
        x: 11.6,
        y: -2.4,
        width: -20,
        height: 0,
      },
      current,
    )

    expect(next.x).toBe(12)
    expect(next.y).toBe(-2)
    expect(next.width).toBe(1)
    expect(next.height).toBe(1)
  })

  it('truncates string fields to max limits', () => {
    const current = createState().nodeMap['text-1']
    const next = sanitizePatch(
      {
        name: 'n'.repeat(300),
        text: 't'.repeat(3000),
        className: 'c'.repeat(2000),
      },
      current,
    )

    expect(next.name).toHaveLength(80)
    expect(next.text).toHaveLength(1000)
    expect(next.className).toHaveLength(500)
  })

  it('falls back to current values for NaN and Infinity', () => {
    const current = createState().nodeMap['text-1']
    const next = sanitizePatch(
      {
        x: Number.NaN,
        y: Number.POSITIVE_INFINITY,
        width: Number.NEGATIVE_INFINITY,
        height: Number.NaN,
      },
      current,
    )

    expect(next.x).toBe(current.x)
    expect(next.y).toBe(current.y)
    expect(next.width).toBe(current.width)
    expect(next.height).toBe(current.height)
  })
})

describe('sanitizeNode', () => {
  it('returns sanitized node for valid type', () => {
    const node: EditorNode = {
      id: 'text-9',
      type: 'text',
      name: 'n'.repeat(120),
      x: 1.8,
      y: -3.2,
      width: 0,
      height: 0,
      text: 't'.repeat(1200),
      className: 'c'.repeat(700),
    }

    const next = sanitizeNode(node)

    expect(next).not.toBeNull()
    expect(next?.name).toHaveLength(80)
    expect(next?.text).toHaveLength(1000)
    expect(next?.className).toHaveLength(500)
    expect(next?.x).toBe(2)
    expect(next?.y).toBe(-3)
    expect(next?.width).toBe(1)
    expect(next?.height).toBe(1)
  })

  it('returns null for invalid type', () => {
    const invalidNode: EditorNode = {
      id: 'bad-node',
      type: 'invalid' as NodeType,
      name: 'Bad',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      text: 'x',
      className: 'y',
    }

    const next = sanitizeNode(invalidNode)

    expect(next).toBeNull()
  })

  it('fills optional text and className when absent', () => {
    const node: EditorNode = {
      id: 'frame-9',
      type: 'frame',
      name: 'Frame',
      x: 5,
      y: 6,
      width: 7,
      height: 8,
    }
    const next = sanitizeNode(node)

    expect(next).not.toBeNull()
    expect(next?.text).toBe('')
    expect(next?.className).toBe('')
    expect(next?.locked).toBe(false)
    expect(next?.visible).toBe(true)
  })

  it('accepts image, card, and form node types', () => {
    const imageNode: EditorNode = {
      id: 'image-1',
      type: 'image',
      name: 'Img',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      src: 'https://example.com/pic.png',
    }
    const cardNode: EditorNode = {
      id: 'card-1',
      type: 'card',
      name: 'Card',
      x: 0,
      y: 0,
      width: 200,
      height: 150,
      text: 'Title',
    }
    const formNode: EditorNode = {
      id: 'form-1',
      type: 'form',
      name: 'Form',
      x: 0,
      y: 0,
      width: 300,
      height: 200,
      text: 'Login',
    }

    expect(sanitizeNode(imageNode)).not.toBeNull()
    expect(sanitizeNode(imageNode)?.src).toBe('https://example.com/pic.png')
    expect(sanitizeNode(cardNode)).not.toBeNull()
    expect(sanitizeNode(formNode)).not.toBeNull()
  })

  it('sanitizes style field — shallow-clones and preserves only string values', () => {
    const node: EditorNode = {
      id: 'text-99',
      type: 'text',
      name: 'Styled',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      style: { color: 'red', fontSize: '14px' },
    }
    const next = sanitizeNode(node)

    expect(next).not.toBeNull()
    expect(next?.style).toEqual({ color: 'red', fontSize: '14px' })
    expect(next?.style).not.toBe(node.style)
  })

  it('defaults style to empty object when absent', () => {
    const node: EditorNode = {
      id: 'text-100',
      type: 'text',
      name: 'NoStyle',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    }
    const next = sanitizeNode(node)

    expect(next?.style).toEqual({})
  })

  it('truncates src to 2000 chars', () => {
    const node: EditorNode = {
      id: 'image-99',
      type: 'image',
      name: 'LongSrc',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      src: 'x'.repeat(3000),
    }
    const next = sanitizeNode(node)

    expect(next?.src).toHaveLength(2000)
  })

  it('defaults src to empty string when absent', () => {
    const node: EditorNode = {
      id: 'image-100',
      type: 'image',
      name: 'NoSrc',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    }
    const next = sanitizeNode(node)

    expect(next?.src).toBe('')
  })
})

describe('sanitizePatch - style and src', () => {
  it('shallow-clones style keeping only string values', () => {
    const current = createState().nodeMap['text-1']
    const next = sanitizePatch(
      {
        style: { color: 'blue', background: '#fff' },
      },
      current,
    )

    expect(next.style).toEqual({ color: 'blue', background: '#fff' })
  })

  it('skips style when not an object', () => {
    const current = createState().nodeMap['text-1']
    const next = sanitizePatch(
      { style: null as unknown as Record<string, string> },
      current,
    )

    expect(next.style).toBeUndefined()
  })

  it('truncates src to 2000 chars', () => {
    const current = createState().nodeMap['text-1']
    const next = sanitizePatch({ src: 's'.repeat(3000) }, current)

    expect(next.src).toHaveLength(2000)
  })

  it('skips src when not a string', () => {
    const current = createState().nodeMap['text-1']
    const next = sanitizePatch(
      { src: 123 as unknown as string },
      current,
    )

    expect(next.src).toBeUndefined()
  })
})

describe('applyCommand - add new node types', () => {
  it('adds image node with src', () => {
    const prev = createState()
    const imageNode: EditorNode = {
      id: 'image-1',
      type: 'image',
      name: 'Photo',
      x: 50,
      y: 50,
      width: 200,
      height: 150,
      src: 'https://example.com/photo.jpg',
    }

    const next = applyCommand(prev, {
      type: 'add',
      payload: { node: imageNode },
    })

    expect(next.nodeMap['image-1']).toBeDefined()
    expect(next.nodeMap['image-1'].type).toBe('image')
    expect(next.nodeMap['image-1'].src).toBe('https://example.com/photo.jpg')
    expect(next.rootIds).toContain('image-1')
    expect(next.selectedId).toBe('image-1')
  })

  it('adds card node', () => {
    const prev = createState()
    const cardNode: EditorNode = {
      id: 'card-1',
      type: 'card',
      name: 'Info Card',
      x: 100,
      y: 100,
      width: 280,
      height: 200,
      text: 'Card Content',
      className: 'rounded-xl bg-slate-800 p-4',
    }

    const next = applyCommand(prev, {
      type: 'add',
      payload: { node: cardNode },
    })

    expect(next.nodeMap['card-1']).toBeDefined()
    expect(next.nodeMap['card-1'].type).toBe('card')
  })

  it('adds form node', () => {
    const prev = createState()
    const formNode: EditorNode = {
      id: 'form-1',
      type: 'form',
      name: 'Login Form',
      x: 200,
      y: 200,
      width: 320,
      height: 240,
      text: 'Login',
    }

    const next = applyCommand(prev, {
      type: 'add',
      payload: { node: formNode },
    })

    expect(next.nodeMap['form-1']).toBeDefined()
    expect(next.nodeMap['form-1'].type).toBe('form')
  })
})

describe('applyCommand - updateMany with style/src', () => {
  it('updates node style via updateMany', () => {
    const prev = createState()
    const next = applyCommand(prev, {
      type: 'updateMany',
      payload: {
        ids: ['text-1'],
        patch: { style: { backgroundColor: '#000' } },
      },
    })

    expect(next.nodeMap['text-1'].style).toEqual({ backgroundColor: '#000' })
  })

  it('updates node src via updateMany', () => {
    const prev = createState()
    const imageNode: EditorNode = {
      id: 'image-1',
      type: 'image',
      name: 'Img',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      src: 'old.png',
    }

    const withImage = applyCommand(prev, {
      type: 'add',
      payload: { node: imageNode },
    })

    const updated = applyCommand(withImage, {
      type: 'updateMany',
      payload: {
        ids: ['image-1'],
        patch: { src: 'new.png' },
      },
    })

    expect(updated.nodeMap['image-1'].src).toBe('new.png')
  })
})

describe('applyCommand - addToFrame', () => {
  it('moves a root node into a frame', () => {
    let state = createState()
    const frame: EditorNode = {
      id: 'frame-1',
      type: 'frame',
      name: 'Container',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
    }
    state = applyCommand(state, { type: 'add', payload: { node: frame } })
    state = applyCommand(state, {
      type: 'addToFrame',
      payload: { nodeId: 'text-1', frameId: 'frame-1' },
    })

    expect(state.nodeMap['text-1'].parentId).toBe('frame-1')
    expect(state.nodeMap['frame-1'].children).toContain('text-1')
    expect(state.rootIds).not.toContain('text-1')
    expect(state.rootIds).toContain('frame-1')
  })

  it('rejects adding a node to a non-frame', () => {
    const state = createState()
    const next = applyCommand(state, {
      type: 'addToFrame',
      payload: { nodeId: 'text-1', frameId: 'button-1' },
    })

    expect(next).toBe(state)
  })

  it('rejects adding a node to itself', () => {
    let state = createState()
    const frame: EditorNode = {
      id: 'frame-1',
      type: 'frame',
      name: 'Container',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
    }
    state = applyCommand(state, { type: 'add', payload: { node: frame } })
    const next = applyCommand(state, {
      type: 'addToFrame',
      payload: { nodeId: 'frame-1', frameId: 'frame-1' },
    })

    expect(next).toBe(state)
  })
})

describe('applyCommand - removeFromFrame', () => {
  it('removes a child node back to root', () => {
    let state = createState()
    const frame: EditorNode = {
      id: 'frame-1',
      type: 'frame',
      name: 'Container',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
    }
    state = applyCommand(state, { type: 'add', payload: { node: frame } })
    state = applyCommand(state, {
      type: 'addToFrame',
      payload: { nodeId: 'text-1', frameId: 'frame-1' },
    })
    state = applyCommand(state, {
      type: 'removeFromFrame',
      payload: { nodeId: 'text-1' },
    })

    expect(state.nodeMap['text-1'].parentId).toBeUndefined()
    expect(state.nodeMap['frame-1'].children).not.toContain('text-1')
    expect(state.rootIds).toContain('text-1')
  })

  it('no-ops if node has no parent', () => {
    const state = createState()
    const next = applyCommand(state, {
      type: 'removeFromFrame',
      payload: { nodeId: 'text-1' },
    })

    expect(next).toBe(state)
  })
})

describe('applyCommand - removeMany with children', () => {
  it('promotes orphaned children to root when parent is deleted', () => {
    let state = createState()
    const frame: EditorNode = {
      id: 'frame-1',
      type: 'frame',
      name: 'Container',
      x: 0,
      y: 0,
      width: 400,
      height: 300,
    }
    state = applyCommand(state, { type: 'add', payload: { node: frame } })
    state = applyCommand(state, {
      type: 'addToFrame',
      payload: { nodeId: 'text-1', frameId: 'frame-1' },
    })
    state = applyCommand(state, {
      type: 'removeMany',
      payload: { ids: ['frame-1'] },
    })

    expect(state.nodeMap['frame-1']).toBeUndefined()
    expect(state.nodeMap['text-1']).toBeDefined()
    expect(state.nodeMap['text-1'].parentId).toBeUndefined()
    expect(state.rootIds).toContain('text-1')
  })
})
