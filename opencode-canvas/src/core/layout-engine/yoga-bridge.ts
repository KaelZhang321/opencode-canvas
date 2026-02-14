/**
 * Yoga Layout Bridge
 * Wraps yoga-layout WASM to compute Flexbox positions for Frame children.
 */
import Yoga, {
  type Node as YogaNode,
  Align,
  FlexDirection,
  Justify,
  Wrap,
} from 'yoga-layout'

import type { EditorNode } from '../editor-store/types'

export interface LayoutResult {
  id: string
  x: number
  y: number
  width: number
  height: number
}

function mapFlexDirection(mode: EditorNode['layoutMode']): FlexDirection {
  switch (mode) {
    case 'flex-row':
      return FlexDirection.Row
    case 'flex-column':
      return FlexDirection.Column
    default:
      return FlexDirection.Column
  }
}

function mapAlign(align: EditorNode['layoutAlign']): Align {
  switch (align) {
    case 'start':
      return Align.FlexStart
    case 'center':
      return Align.Center
    case 'end':
      return Align.FlexEnd
    case 'stretch':
      return Align.Stretch
    default:
      return Align.FlexStart
  }
}

function mapJustify(justify: EditorNode['layoutJustify']): Justify {
  switch (justify) {
    case 'start':
      return Justify.FlexStart
    case 'center':
      return Justify.Center
    case 'end':
      return Justify.FlexEnd
    case 'space-between':
      return Justify.SpaceBetween
    case 'space-around':
      return Justify.SpaceAround
    default:
      return Justify.FlexStart
  }
}

/**
 * Compute absolute positions for all children of a frame node using Yoga.
 * Returns an array of { id, x, y, width, height } relative to the frame's top-left.
 */
export function computeFrameLayout(
  frame: EditorNode,
  children: EditorNode[],
): LayoutResult[] {
  if (children.length === 0 || !frame.layoutMode || frame.layoutMode === 'none') {
    return []
  }

  const root: YogaNode = Yoga.Node.create()
  root.setWidth(frame.width)
  root.setHeight(frame.height)
  root.setFlexDirection(mapFlexDirection(frame.layoutMode))
  root.setAlignItems(mapAlign(frame.layoutAlign))
  root.setJustifyContent(mapJustify(frame.layoutJustify))
  root.setFlexWrap(Wrap.NoWrap)

  if (frame.layoutGap != null && frame.layoutGap > 0) {
    root.setGap(Yoga.GUTTER_ALL, frame.layoutGap)
  }

  const padding = frame.layoutPadding
  if (padding) {
    root.setPadding(Yoga.EDGE_TOP, padding[0])
    root.setPadding(Yoga.EDGE_RIGHT, padding[1])
    root.setPadding(Yoga.EDGE_BOTTOM, padding[2])
    root.setPadding(Yoga.EDGE_LEFT, padding[3])
  }

  const childNodes: YogaNode[] = children.map((child) => {
    const yogaChild = Yoga.Node.create()
    yogaChild.setWidth(child.width)
    yogaChild.setHeight(child.height)
    return yogaChild
  })

  childNodes.forEach((child, i) => {
    root.insertChild(child, i)
  })

  root.calculateLayout(frame.width, frame.height)

  const results: LayoutResult[] = children.map((child, i) => {
    const yogaChild = childNodes[i]
    return {
      id: child.id,
      x: yogaChild.getComputedLeft(),
      y: yogaChild.getComputedTop(),
      width: yogaChild.getComputedWidth(),
      height: yogaChild.getComputedHeight(),
    }
  })

  // Cleanup
  childNodes.forEach((child) => child.free())
  root.free()

  return results
}
