import { parse as babelParse } from '@babel/parser'
import generate from '@babel/generator'
import * as t from '@babel/types'
import type { EditorNode, EditorState } from '../editor-store/types'
import { DEFAULT_VIEWPORT } from '../editor-store/types'
import { buildGeneratedComponentSource } from './index'
import type { CodeParseResult, CodeSyncResult } from './index'

function parseTsxModule(source: string): t.File {
  return babelParse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  })
}

function countChangedLines(previous: string, next: string): number {
  const prevLines = previous.split('\n')
  const nextLines = next.split('\n')
  const maxLength = Math.max(prevLines.length, nextLines.length)
  let changed = 0
  for (let index = 0; index < maxLength; index += 1) {
    if ((prevLines[index] ?? '') !== (nextLines[index] ?? '')) {
      changed += 1
    }
  }
  return changed
}

export function applyAstPatch(source: string, state: EditorState): CodeSyncResult {
  try {
    const ast = parseTsxModule(source)
    const componentSource = buildGeneratedComponentSource(state)
    const componentAst = parseTsxModule(componentSource)

    const replacementNode = componentAst.program.body.find(
      (node: t.Statement) =>
        node.type === 'ExportNamedDeclaration' &&
        node.declaration?.type === 'FunctionDeclaration' &&
        node.declaration.id?.name === 'GeneratedCanvasView',
    )

    if (!replacementNode || replacementNode.type !== 'ExportNamedDeclaration') {
      return {
        applied: false,
        reason: 'Failed to build AST replacement node for GeneratedCanvasView.',
      }
    }

    const targetBody = ast.program.body
    const existingIndex = targetBody.findIndex(
      (node: t.Statement) =>
        node.type === 'ExportNamedDeclaration' &&
        node.declaration?.type === 'FunctionDeclaration' &&
        node.declaration.id?.name === 'GeneratedCanvasView',
    )

    if (existingIndex >= 0) {
      targetBody[existingIndex] = replacementNode
    } else {
      targetBody.push(replacementNode)
    }

    const patchedSource = generate(ast, {
      comments: true,
      retainLines: true,
    }).code
    const changedLineCount = countChangedLines(source, patchedSource)

    return {
      applied: true,
      patchedSource,
      changedLineCount,
      reason:
        changedLineCount === 0
          ? 'No AST-level changes detected for GeneratedCanvasView.'
          : undefined,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown AST patch error'
    return {
      applied: false,
      reason: `AST patch failed: ${message}`,
    }
  }
}

function getJsxAttributeAsString(
  element: t.JSXOpeningElement,
  attributeName: string,
): string | undefined {
  const attr = element.attributes.find(
    (item): item is t.JSXAttribute =>
      item.type === 'JSXAttribute' && item.name.name === attributeName,
  )
  if (!attr?.value) {
    return undefined
  }

  if (attr.value.type === 'StringLiteral') {
    return attr.value.value
  }

  if (attr.value.type !== 'JSXExpressionContainer') {
    return undefined
  }

  const expr = attr.value.expression
  if (expr.type === 'StringLiteral') {
    return expr.value
  }
  if (expr.type === 'TemplateLiteral' && expr.expressions.length === 0) {
    return expr.quasis[0]?.value.cooked ?? ''
  }

  return undefined
}

function getJsxStyleObject(
  element: t.JSXOpeningElement,
): Record<string, string | number> {
  const attr = element.attributes.find(
    (item) => item.type === 'JSXAttribute' && item.name.name === 'style',
  )
  if (
    !attr ||
    attr.type !== 'JSXAttribute' ||
    attr.value?.type !== 'JSXExpressionContainer' ||
    attr.value.expression.type !== 'ObjectExpression'
  ) {
    return {}
  }

  const output: Record<string, string | number> = {}
  attr.value.expression.properties.forEach((property) => {
    if (property.type !== 'ObjectProperty') {
      return
    }
    let key = ''
    if (property.key.type === 'Identifier') {
      key = property.key.name
    } else if (property.key.type === 'StringLiteral') {
      key = property.key.value
    }
    if (!key) {
      return
    }
    if (property.value.type === 'NumericLiteral') {
      output[key] = property.value.value
      return
    }
    if (property.value.type === 'StringLiteral') {
      output[key] = property.value.value
    }
  })
  return output
}

function collectJsxText(
  children: (t.JSXText | t.JSXExpressionContainer | t.JSXSpreadChild | t.JSXElement | t.JSXFragment)[],
): string {
  const parts: string[] = []

  children.forEach((content) => {
    if (content.type === 'JSXText') {
      const text = content.value.replace(/\s+/g, ' ').trim()
      if (text) {
        parts.push(text)
      }
      return
    }

    if (content.type === 'JSXExpressionContainer') {
      if (content.expression.type === 'StringLiteral') {
        const text = content.expression.value.trim()
        if (text) {
          parts.push(text)
        }
      }
      return
    }

    if (content.type === 'JSXElement') {
      const nested = collectJsxText(content.children)
      if (nested) {
        parts.push(nested)
      }
      return
    }

    if (content.type === 'JSXFragment') {
      const nested = collectJsxText(content.children)
      if (nested) {
        parts.push(nested)
      }
    }
  })

  return parts.join(' ').trim()
}

function inferNodeType(raw: string | undefined): EditorNode['type'] {
  switch (raw) {
    case 'text':
    case 'button':
    case 'image':
    case 'frame':
      return raw
    default:
      return 'text'
  }
}

export function parseSourceToState(source: string): CodeParseResult {
  try {
    const ast = parseTsxModule(source)
    const exportDecl = ast.program.body.find(
      (node: t.Statement) =>
        node.type === 'ExportNamedDeclaration' &&
        node.declaration?.type === 'FunctionDeclaration' &&
        (node.declaration.id?.name === 'GeneratedCanvasView' ||
          node.declaration.id?.name === 'TargetCanvas'),
    )

    if (
      !exportDecl ||
      exportDecl.type !== 'ExportNamedDeclaration' ||
      exportDecl.declaration?.type !== 'FunctionDeclaration'
    ) {
      return { ok: false, reason: 'No target canvas function found in source.' }
    }

    const returnStmt = exportDecl.declaration.body.body.find(
      (statement: t.Statement) => statement.type === 'ReturnStatement',
    )
    if (!returnStmt || returnStmt.type !== 'ReturnStatement') {
      return { ok: false, reason: 'Target function has no return statement.' }
    }

    if (!returnStmt.argument || returnStmt.argument.type !== 'JSXElement') {
      return { ok: false, reason: 'Target function does not return JSX.' }
    }

    const rootElement = returnStmt.argument
    const nodes: EditorNode[] = []

    rootElement.children.forEach((child, index) => {
      if (child.type !== 'JSXElement') {
        return
      }
      const open = child.openingElement
      if (open.name.type !== 'JSXIdentifier' || open.name.name !== 'div') {
        return
      }

      const styleObject = getJsxStyleObject(open)
      const type = inferNodeType(getJsxAttributeAsString(open, 'data-node-type'))
      const id = getJsxAttributeAsString(open, 'key') || `${type}-${index + 1}`
      const className = getJsxAttributeAsString(open, 'className') || ''
      const src = getJsxAttributeAsString(open, 'data-src') || ''
      const textContent = collectJsxText(child.children)

      const style: Record<string, string> = {}
      Object.entries(styleObject).forEach(([key, value]) => {
        if (key === 'left' || key === 'top' || key === 'width' || key === 'minHeight') {
          return
        }
        style[key] = String(value)
      })

      nodes.push({
        id,
        type,
        name: `${type}-${index + 1}`,
        text: textContent,
        className,
        src,
        style,
        x: Number(styleObject.left ?? 0),
        y: Number(styleObject.top ?? 0),
        width: Math.max(1, Number(styleObject.width ?? 200)),
        height: Math.max(1, Number(styleObject.minHeight ?? 60)),
      })
    })

    if (nodes.length === 0) {
      return { ok: false, reason: 'No parseable canvas nodes found in return JSX.' }
    }

    const nodeMap = nodes.reduce<Record<string, EditorNode>>((acc, node) => {
      acc[node.id] = node
      return acc
    }, {})
    const rootIds = nodes.map((node) => node.id)
    const selectedId = rootIds[0] ?? null

    return {
      ok: true,
      state: {
        nodeMap,
        rootIds,
        selectedId,
        selectedIds: selectedId ? [selectedId] : [],
        viewport: DEFAULT_VIEWPORT,
      },
    }
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? `Parse failed: ${error.message}`
          : 'Parse failed with unknown error.',
    }
  }
}
