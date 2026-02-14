import { useMemo, useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import type { ReactNode } from 'react'
import type { EditorNode } from '../editor-store/types'

interface InspectorPanelProps {
  nodes: EditorNode[]
  onTextChange: (text: string) => void
  onPatchChange: (patch: Partial<EditorNode>) => void
}

type NumberKey = 'x' | 'y' | 'width' | 'height'

function mixedValue(values: Array<string | number | undefined>): { value: string; mixed: boolean } {
  if (values.length === 0) {
    return { value: '', mixed: false }
  }
  const first = values[0]
  const mixed = values.some((value) => value !== first)
  return { value: mixed ? '' : String(first ?? ''), mixed }
}

function mixedStyleValue(nodes: EditorNode[], key: string): { value: string; mixed: boolean } {
  return mixedValue(nodes.map((node) => node.style?.[key] ?? ''))
}

function buildDraftKey(nodes: EditorNode[]): string {
  return nodes
    .map(
      (node) =>
        `${node.id}:${node.x}:${node.y}:${node.width}:${node.height}:${node.text ?? ''}:${node.className ?? ''}:${node.src ?? ''}:${JSON.stringify(node.style ?? {})}`,
    )
    .join('|')
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded border border-slate-800 p-3">
      <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</h4>
      {children}
    </section>
  )
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
  onBlur,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
  onBlur?: () => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-slate-500">{label}</span>
      <input
        className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
    </label>
  )
}

function Fields({ nodes, onTextChange, onPatchChange }: InspectorPanelProps) {
  const singleNode = nodes.length === 1 ? nodes[0] : null

  const textMeta = mixedValue(nodes.map((node) => node.text ?? ''))
  const classMeta = mixedValue(nodes.map((node) => node.className ?? ''))
  const srcMeta = mixedValue(nodes.map((node) => node.src ?? ''))
  const xMeta = mixedValue(nodes.map((node) => node.x))
  const yMeta = mixedValue(nodes.map((node) => node.y))
  const widthMeta = mixedValue(nodes.map((node) => node.width))
  const heightMeta = mixedValue(nodes.map((node) => node.height))

  const [textDraft, setTextDraft] = useState(textMeta.value)
  const [classNameDraft, setClassNameDraft] = useState(classMeta.value)
  const [srcDraft, setSrcDraft] = useState(srcMeta.value)
  const [positionDraft, setPositionDraft] = useState({
    x: xMeta.value,
    y: yMeta.value,
    width: widthMeta.value,
    height: heightMeta.value,
  })

  const [layoutDraft, setLayoutDraft] = useState({
    display: mixedStyleValue(nodes, 'display').value,
    flexDirection: mixedStyleValue(nodes, 'flexDirection').value,
    alignItems: mixedStyleValue(nodes, 'alignItems').value,
    justifyContent: mixedStyleValue(nodes, 'justifyContent').value,
    gap: mixedStyleValue(nodes, 'gap').value,
  })

  const [spacingDraft, setSpacingDraft] = useState({
    padding: mixedStyleValue(nodes, 'padding').value,
    paddingTop: mixedStyleValue(nodes, 'paddingTop').value,
    paddingRight: mixedStyleValue(nodes, 'paddingRight').value,
    paddingBottom: mixedStyleValue(nodes, 'paddingBottom').value,
    paddingLeft: mixedStyleValue(nodes, 'paddingLeft').value,
    margin: mixedStyleValue(nodes, 'margin').value,
    marginTop: mixedStyleValue(nodes, 'marginTop').value,
    marginRight: mixedStyleValue(nodes, 'marginRight').value,
    marginBottom: mixedStyleValue(nodes, 'marginBottom').value,
    marginLeft: mixedStyleValue(nodes, 'marginLeft').value,
  })

  const [typographyDraft, setTypographyDraft] = useState({
    fontSize: mixedStyleValue(nodes, 'fontSize').value,
    fontWeight: mixedStyleValue(nodes, 'fontWeight').value,
    lineHeight: mixedStyleValue(nodes, 'lineHeight').value,
    textAlign: mixedStyleValue(nodes, 'textAlign').value,
    color: mixedStyleValue(nodes, 'color').value,
  })

  const [visualDraft, setVisualDraft] = useState({
    backgroundColor: mixedStyleValue(nodes, 'backgroundColor').value,
    border: mixedStyleValue(nodes, 'border').value,
    borderRadius: mixedStyleValue(nodes, 'borderRadius').value,
    boxShadow: mixedStyleValue(nodes, 'boxShadow').value,
  })

  const [activeColorKey, setActiveColorKey] = useState<'color' | 'backgroundColor' | null>(
    null,
  )

  const styleEntries = useMemo(() => {
    if (!singleNode) {
      return [] as Array<[string, string]>
    }
    return Object.entries(singleNode.style ?? {})
  }, [singleNode])

  const commitNumber = (field: NumberKey) => {
    const rawValue = positionDraft[field]
    if (!rawValue.trim()) {
      return
    }
    const parsed = Number(rawValue)
    if (!Number.isFinite(parsed)) {
      return
    }
    if ((field === 'width' || field === 'height') && parsed <= 0) {
      return
    }
    onPatchChange({ [field]: Math.round(parsed) })
  }

  const commitStyle = (key: string, value: string) => {
    onPatchChange({ style: { [key]: value.trim() } })
  }

  const fieldLabels: Record<NumberKey, string> = {
    x: 'X 坐标',
    y: 'Y 坐标',
    width: '宽度',
    height: '高度',
  }

  return (
    <div className="space-y-4 overflow-auto p-4">
      <Section title="节点">
        <div className="text-xs text-slate-300">
          {nodes.length === 1 ? nodes[0]?.name : `已选中 ${nodes.length} 个节点`}
        </div>
      </Section>

      <Section title="内容">
        <label className="block">
          <span className="mb-1 block text-[11px] text-slate-500">文本</span>
          <textarea
            className="min-h-20 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none focus:border-sky-500"
            placeholder={textMeta.mixed ? '混合' : ''}
            value={textDraft}
            onChange={(event) => setTextDraft(event.target.value)}
            onBlur={() => onTextChange(textDraft)}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-[11px] text-slate-500">类名</span>
          <textarea
            className="min-h-16 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none focus:border-sky-500"
            placeholder={classMeta.mixed ? '混合' : ''}
            value={classNameDraft}
            onChange={(event) => setClassNameDraft(event.target.value)}
            onBlur={() => onPatchChange({ className: classNameDraft })}
          />
        </label>

        {singleNode?.type === 'image' && (
          <TextField
            label="图片地址"
            value={srcDraft}
            placeholder={srcMeta.mixed ? '混合' : ''}
            onChange={setSrcDraft}
            onBlur={() => onPatchChange({ src: srcDraft })}
          />
        )}
      </Section>

      <Section title="尺寸位置">
        <div className="grid grid-cols-2 gap-2">
          {(['x', 'y', 'width', 'height'] as NumberKey[]).map((field) => (
            <label key={field}>
              <span className="mb-1 block text-[11px] text-slate-500">{fieldLabels[field]}</span>
              <input
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
                type="number"
                placeholder={
                  field === 'x'
                    ? xMeta.mixed
                      ? '混合'
                      : ''
                    : field === 'y'
                      ? yMeta.mixed
                        ? '混合'
                        : ''
                      : field === 'width'
                        ? widthMeta.mixed
                          ? '混合'
                          : ''
                        : heightMeta.mixed
                          ? '混合'
                          : ''
                }
                value={positionDraft[field]}
                onChange={(event) =>
                  setPositionDraft((prev) => ({
                    ...prev,
                    [field]: event.target.value,
                  }))
                }
                onBlur={() => commitNumber(field)}
              />
            </label>
          ))}
        </div>
      </Section>

      <Section title="布局">
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="mb-1 block text-[11px] text-slate-500">显示方式</span>
            <select
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
              value={layoutDraft.display}
              onChange={(event) => {
                const value = event.target.value
                setLayoutDraft((prev) => ({ ...prev, display: value }))
                commitStyle('display', value)
              }}
            >
              <option value="">(继承)</option>
              <option value="block">block</option>
              <option value="flex">flex</option>
              <option value="inline-flex">inline-flex</option>
              <option value="grid">grid</option>
            </select>
          </label>

          <TextField
            label="间隙"
            value={layoutDraft.gap}
            onChange={(value) => setLayoutDraft((prev) => ({ ...prev, gap: value }))}
            onBlur={() => commitStyle('gap', layoutDraft.gap)}
          />

          <TextField
            label="排列方向"
            value={layoutDraft.flexDirection}
            onChange={(value) =>
              setLayoutDraft((prev) => ({
                ...prev,
                flexDirection: value,
              }))
            }
            onBlur={() => commitStyle('flexDirection', layoutDraft.flexDirection)}
          />

          <TextField
            label="对齐方式"
            value={layoutDraft.alignItems}
            onChange={(value) => setLayoutDraft((prev) => ({ ...prev, alignItems: value }))}
            onBlur={() => commitStyle('alignItems', layoutDraft.alignItems)}
          />

          <TextField
            label="主轴对齐"
            value={layoutDraft.justifyContent}
            onChange={(value) =>
              setLayoutDraft((prev) => ({
                ...prev,
                justifyContent: value,
              }))
            }
            onBlur={() => commitStyle('justifyContent', layoutDraft.justifyContent)}
          />
        </div>
      </Section>

      <Section title="间距">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              'padding',
              'paddingTop',
              'paddingRight',
              'paddingBottom',
              'paddingLeft',
              'margin',
              'marginTop',
              'marginRight',
              'marginBottom',
              'marginLeft',
            ] as const
          ).map((key) => (
            <TextField
              key={key}
              label={key}
              value={spacingDraft[key]}
              onChange={(value) =>
                setSpacingDraft((prev) => ({
                  ...prev,
                  [key]: value,
                }))
              }
              onBlur={() => commitStyle(key, spacingDraft[key])}
            />
          ))}
        </div>
      </Section>

      <Section title="文字">
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label="字体大小"
            value={typographyDraft.fontSize}
            onChange={(value) => setTypographyDraft((prev) => ({ ...prev, fontSize: value }))}
            onBlur={() => commitStyle('fontSize', typographyDraft.fontSize)}
          />
          <TextField
            label="字体粗细"
            value={typographyDraft.fontWeight}
            onChange={(value) =>
              setTypographyDraft((prev) => ({
                ...prev,
                fontWeight: value,
              }))
            }
            onBlur={() => commitStyle('fontWeight', typographyDraft.fontWeight)}
          />
          <TextField
            label="行高"
            value={typographyDraft.lineHeight}
            onChange={(value) =>
              setTypographyDraft((prev) => ({
                ...prev,
                lineHeight: value,
              }))
            }
            onBlur={() => commitStyle('lineHeight', typographyDraft.lineHeight)}
          />
          <label>
            <span className="mb-1 block text-[11px] text-slate-500">文本对齐</span>
            <select
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
              value={typographyDraft.textAlign}
              onChange={(event) => {
                const value = event.target.value
                setTypographyDraft((prev) => ({ ...prev, textAlign: value }))
                commitStyle('textAlign', value)
              }}
            >
              <option value="">(继承)</option>
              <option value="left">左对齐</option>
              <option value="center">居中</option>
              <option value="right">右对齐</option>
              <option value="justify">两端对齐</option>
            </select>
          </label>

          <div className="col-span-2 space-y-2 rounded border border-slate-800 p-2">
            <div className="flex items-end gap-2">
              <TextField
                label="文字颜色"
                value={typographyDraft.color}
                onChange={(value) => setTypographyDraft((prev) => ({ ...prev, color: value }))}
                onBlur={() => commitStyle('color', typographyDraft.color)}
              />
              <button
                type="button"
                className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200"
                onClick={() => setActiveColorKey((prev) => (prev === 'color' ? null : 'color'))}
              >
                选色
              </button>
            </div>
            {activeColorKey === 'color' && (
              <HexColorPicker
                color={typographyDraft.color || '#ffffff'}
                onChange={(value) => {
                  setTypographyDraft((prev) => ({ ...prev, color: value }))
                  commitStyle('color', value)
                }}
              />
            )}
          </div>
        </div>
      </Section>

      <Section title="视觉">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2 space-y-2 rounded border border-slate-800 p-2">
            <div className="flex items-end gap-2">
              <TextField
                label="背景颜色"
                value={visualDraft.backgroundColor}
                onChange={(value) =>
                  setVisualDraft((prev) => ({
                    ...prev,
                    backgroundColor: value,
                  }))
                }
                onBlur={() => commitStyle('backgroundColor', visualDraft.backgroundColor)}
              />
              <button
                type="button"
                className="rounded border border-slate-700 px-2 py-1 text-[11px] text-slate-200"
                onClick={() =>
                  setActiveColorKey((prev) =>
                    prev === 'backgroundColor' ? null : 'backgroundColor',
                  )
                }
              >
                选色
              </button>
            </div>
            {activeColorKey === 'backgroundColor' && (
              <HexColorPicker
                color={visualDraft.backgroundColor || '#0f172a'}
                onChange={(value) => {
                  setVisualDraft((prev) => ({ ...prev, backgroundColor: value }))
                  commitStyle('backgroundColor', value)
                }}
              />
            )}
          </div>

          <TextField
            label="边框"
            value={visualDraft.border}
            onChange={(value) => setVisualDraft((prev) => ({ ...prev, border: value }))}
            onBlur={() => commitStyle('border', visualDraft.border)}
          />
          <TextField
            label="圆角"
            value={visualDraft.borderRadius}
            onChange={(value) =>
              setVisualDraft((prev) => ({
                ...prev,
                borderRadius: value,
              }))
            }
            onBlur={() => commitStyle('borderRadius', visualDraft.borderRadius)}
          />
          <div className="col-span-2">
            <TextField
              label="阴影"
              value={visualDraft.boxShadow}
              onChange={(value) =>
                setVisualDraft((prev) => ({
                  ...prev,
                  boxShadow: value,
                }))
              }
              onBlur={() => commitStyle('boxShadow', visualDraft.boxShadow)}
            />
          </div>
        </div>
      </Section>

      {singleNode && (
        <Section title="样式快照">
          {styleEntries.length === 0 ? (
            <div className="text-xs text-slate-500">暂无样式值</div>
          ) : (
            <div className="space-y-1 text-xs text-slate-300">
              {styleEntries.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">{key}</span>
                  <span className="break-all text-right text-slate-200">{value}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}
    </div>
  )
}

export function InspectorPanel({ nodes, onTextChange, onPatchChange }: InspectorPanelProps) {
  return (
    <aside className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900/70" role="region" aria-label="属性面板">
      <header className="border-b border-slate-800 px-4 py-3 text-sm font-medium text-slate-300">
        属性面板
      </header>
      {nodes.length === 0 ? (
        <div className="space-y-4 p-4">
          <p className="text-sm text-slate-500">请至少选择一个节点</p>
        </div>
      ) : (
        <Fields
          key={buildDraftKey(nodes)}
          nodes={nodes}
          onTextChange={onTextChange}
          onPatchChange={onPatchChange}
        />
      )}
    </aside>
  )
}
