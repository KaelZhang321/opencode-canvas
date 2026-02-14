import { useCallback, useEffect, useMemo, useState } from 'react'
import { generateAiProposals, generatePageFromPrompt } from './core/ai/refactor'
import type { AIProposal } from './core/ai/refactor'
import { WsSyncBridge } from './core/WsSyncBridge'
import type { WsClientStatus } from './core/ws-client'
import {
  TOKEN_PRESETS,
  TOKEN_THEMES,
  getTokenClassForNode,
} from './core/design-tokens/tokens'
import type { TokenPreset, TokenTheme } from './core/design-tokens/tokens'
import { CanvasView } from './core/canvas-renderer/CanvasView'
import {
  applyMarkerPatchToSource,
  buildGeneratedComponentSource,
  createCodeSyncPreview,
  createSemanticDiffSummary,
  getPatchTemplateSource,
  parseSourceToStateFallback,
  validateSyncState,
} from './core/code-sync'
import { useEditorStore } from './core/editor-store/store'
import type { EditorState } from './core/editor-store/types'
import { InspectorPanel } from './core/inspector/InspectorPanel'
import {
  buildPreviewRuntimeDocument,
  getPreviewRuntimeStatus,
} from './core/preview-runtime'
import { AIRefactorPanel } from './features/ai/AIRefactorPanel'
import { CodePreviewPanel } from './features/code-preview/CodePreviewPanel'
import { LayersPanel } from './features/layers/LayersPanel'
import { PatchPanel } from './features/patch/PatchPanel'
import { PreviewRuntimePanel } from './features/preview-runtime/PreviewRuntimePanel'
import { Toolbar } from './features/toolbar/Toolbar'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'

let astToolsPromise: Promise<typeof import('./core/code-sync/ast-tools')> | null = null

function loadAstTools() {
  if (!astToolsPromise) {
    astToolsPromise = import('./core/code-sync/ast-tools')
  }
  return astToolsPromise
}

function cloneState(state: EditorState): EditorState {
  return { nodeMap: JSON.parse(JSON.stringify(state.nodeMap)) as EditorState['nodeMap'], rootIds: [...state.rootIds], selectedId: state.selectedId, selectedIds: [...state.selectedIds], viewport: { ...state.viewport } }
}

function App() {
  const { state, selectedNodes, canUndo, canRedo, selectNode, selectAllNodes, setSelection, clearSelection, moveNode, moveSelectedBy, updateSelectedText, updateSelectedPatch, updateNode, addNode, removeSelectedNode, reorderRoots, undo, redo, restoreState, panBy, zoomTo } = useEditorStore()
  const runtime = getPreviewRuntimeStatus()
  const [baselineState, setBaselineState] = useState<EditorState>(() => cloneState(state))
  const [patchTargetSource, setPatchTargetSource] = useState(() => getPatchTemplateSource())
  const [patchResult, setPatchResult] = useState<{ patchedSource: string; changedLineCount: number; message: string; success: boolean } | null>(null)
  const [forcePatch, setForcePatch] = useState(false)
  const [aiPromptHistory, setAiPromptHistory] = useState<string[]>([])
  const [aiProposals, setAiProposals] = useState<AIProposal[]>([])
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null)
  const [aiStatusMessage, setAiStatusMessage] = useState('AI 面板就绪。选择节点并生成提案。')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiDrawerCollapsed, setAiDrawerCollapsed] = useState(false)
  const [lastAiApplySnapshot, setLastAiApplySnapshot] = useState<EditorState | null>(null)
  const [tokenTheme, setTokenTheme] = useState<TokenTheme>(TOKEN_THEMES[0])
  const [tokenPreset, setTokenPreset] = useState<TokenPreset>(TOKEN_PRESETS[0])
  const baselineCode = useMemo(() => buildGeneratedComponentSource(baselineState), [baselineState])
  const codePreview = useMemo(() => createCodeSyncPreview(state, baselineCode), [state, baselineCode])
  const semanticDiff = useMemo(
    () => createSemanticDiffSummary(baselineState, state),
    [baselineState, state],
  )
  const syncValidation = useMemo(() => validateSyncState(state), [state])
  const previewRuntimeDoc = useMemo(() => buildPreviewRuntimeDocument(state), [state])
  const selectedProposal = useMemo(() => aiProposals.find((item) => item.id === selectedProposalId) ?? null, [aiProposals, selectedProposalId])

  const handleSetBaseline = () => setBaselineState(cloneState(state))
  const handleRollbackToBaseline = () => restoreState(cloneState(baselineState))
  const handleApplyPatch = async () => {
    try {
      const { applyAstPatch } = await loadAstTools()
      const astResult = applyAstPatch(patchTargetSource, state)
      const result =
        astResult.applied && astResult.patchedSource
          ? astResult
          : applyMarkerPatchToSource(patchTargetSource, state, { force: forcePatch })
      if (!result.applied || !result.patchedSource) {
        return setPatchResult({
          patchedSource: patchTargetSource,
          changedLineCount: 0,
          message: result.reason ?? '补丁应用失败。',
          success: false,
        })
      }
      setPatchTargetSource(result.patchedSource)
      setPatchResult({
        patchedSource: result.patchedSource,
        changedLineCount: result.changedLineCount ?? 0,
        message: `补丁已应用。变更行数: ${result.changedLineCount ?? 0}${astResult.applied ? ' (AST)' : ' (标记回退)'}`,
        success: true,
      })
    } catch {
      setPatchResult({
        patchedSource: patchTargetSource,
        changedLineCount: 0,
        message: '加载 AST 补丁模块失败。',
        success: false,
      })
    }
  }
  const handleImportSourceToCanvas = async () => {
    try {
      const { parseSourceToState } = await loadAstTools()
      const parsed = parseSourceToState(patchTargetSource)
      if (!parsed.ok || !parsed.state) {
        setPatchResult({
          patchedSource: patchTargetSource,
          changedLineCount: 0,
          message: parsed.reason ?? '导入失败。',
          success: false,
        })
        return
      }
      restoreState(parsed.state)
      setPatchResult({
        patchedSource: patchTargetSource,
        changedLineCount: 0,
        message: `已从源码导入 ${parsed.state.rootIds.length} 个节点。`,
        success: true,
      })
    } catch {
      const fallback = parseSourceToStateFallback(patchTargetSource)
      if (!fallback.ok || !fallback.state) {
        setPatchResult({
          patchedSource: patchTargetSource,
          changedLineCount: 0,
          message: '加载导入解析模块失败。',
          success: false,
        })
        return
      }
      restoreState(fallback.state)
      setPatchResult({
        patchedSource: patchTargetSource,
        changedLineCount: 0,
        message: `已从源码导入 ${fallback.state.rootIds.length} 个节点。(回退解析器)`,
        success: true,
      })
    }
  }
  const handleGenerateAiProposals = async (prompt: string) => {
    if (selectedNodes.length === 0) {
      setAiStatusMessage('请至少选择一个节点来生成定向提案。')
      return
    }

    setAiLoading(true)
    setAiPromptHistory((prev) => [prompt, ...prev].slice(0, 12))
    try {
      const result = await generateAiProposals(prompt, selectedNodes)
      setAiProposals(result.proposals)
      setSelectedProposalId(result.proposals[0]?.id ?? null)
      const warningSuffix =
        result.warnings.length > 0
          ? ` Warnings: ${result.warnings.slice(0, 2).join(' | ')}`
          : ''
      setAiStatusMessage(
        result.proposals.length === 0
          ? '当前选中的节点未生成提案。'
          : `已从 ${result.source} 生成 ${result.proposals.length} 个提案。${warningSuffix}`,
      )
    } catch {
      setAiStatusMessage('AI 提案生成失败。请检查 API 设置后重试。')
    } finally {
      setAiLoading(false)
    }
  }

  const handleGenerateAiPage = async (prompt: string) => {
    setAiLoading(true)
    setAiPromptHistory((prev) => [prompt, ...prev].slice(0, 12))
    try {
      const page = await generatePageFromPrompt(prompt)
      if (page.nodes.length === 0) {
        setAiStatusMessage('AI 未生成任何节点。请尝试更具体的提示词。')
        return
      }

      const nodeMap = page.nodes.reduce<EditorState['nodeMap']>((acc, node) => {
        acc[node.id] = node
        return acc
      }, {})
      const rootIds = page.nodes.map((node) => node.id)
      const selectedId = rootIds[0] ?? null
      const generatedState: EditorState = {
        nodeMap,
        rootIds,
        selectedId,
        selectedIds: selectedId ? [selectedId] : [],
        viewport: state.viewport,
      }

      setLastAiApplySnapshot(cloneState(state))
      restoreState(generatedState)
      setAiProposals([])
      setSelectedProposalId(null)
      const warningSuffix =
        page.warnings.length > 0
          ? ` Warnings: ${page.warnings.slice(0, 2).join(' | ')}`
          : ''
      setAiStatusMessage(
        `已生成页面: ${page.title} (${page.source}). ${page.rationale}${warningSuffix}`,
      )
    } catch {
      setAiStatusMessage('AI 页面生成失败。请检查 API 设置后重试。')
    } finally {
      setAiLoading(false)
    }
  }
  const handleApplyAiProposal = (proposal: AIProposal) => {
    if (selectedNodes.length === 0) return setAiStatusMessage('无法应用：未选择节点。')
    setLastAiApplySnapshot(cloneState(state))
    updateSelectedPatch(proposal.patch)
    setAiStatusMessage(`已应用: ${proposal.title}`)
  }
  const handleApplyTokenPreset = () => {
    if (selectedNodes.length === 0) {
      return
    }
    const firstType = selectedNodes[0]?.type
    if (!firstType) {
      return
    }
    const tokenClass = getTokenClassForNode(firstType, tokenPreset)
    if (!tokenClass) {
      return
    }
    setLastAiApplySnapshot(cloneState(state))
    updateSelectedPatch({ className: tokenClass })
  }
  const handleRevertLastAiApply = () => {
    if (!lastAiApplySnapshot) return
    restoreState(cloneState(lastAiApplySnapshot))
    setAiStatusMessage('已撤销上次 AI 应用。')
    setLastAiApplySnapshot(null)
  }
  const handleExportPatchedSource = () => {
    const source = patchResult?.patchedSource ?? patchTargetSource
    const blob = new Blob([source], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'generated-canvas-patch.tsx'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleToggleLocked = (id: string) => {
    const node = state.nodeMap[id]
    if (!node) {
      return
    }
    updateNode(id, { locked: !node.locked })
  }

  const handleToggleVisible = (id: string) => {
    const node = state.nodeMap[id]
    if (!node) {
      return
    }
    updateNode(id, { visible: node.visible === false })
  }

  const visibleNodes = useMemo(
    () => state.rootIds.map((id) => state.nodeMap[id]).filter((node) => Boolean(node) && node.visible !== false),
    [state.nodeMap, state.rootIds],
  )

  const [wsStatus, setWsStatus] = useState<WsClientStatus>('disconnected')
  const handleWsStatusChange = useCallback((s: WsClientStatus) => setWsStatus(s), [])

  useKeyboardShortcuts({ selectAllNodes, clearSelection, moveSelectedBy, redo, undo, removeSelectedNode })

  useEffect(() => {
    document.documentElement.setAttribute('data-token-theme', tokenTheme)
  }, [tokenTheme])

  // ── Responsive breakpoint detection ──
  const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1440))
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const sectionGridStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (windowWidth < 1280) return undefined // tablet & mobile handled by CSS
    const layers = 240
    const inspector = 300
    const ai = aiDrawerCollapsed ? 44 : 280
    const padding = 24 // p-3 = 12px * 2
    const gaps = 36 // gap-3 = 12px * 3 gaps between 4 columns
    return {
      display: 'grid',
      gridTemplateColumns: `${layers}px calc(100vw - ${layers + inspector + ai + padding + gaps}px) ${inspector}px ${ai}px`,
      gridTemplateRows: '1fr',
    }
  }, [windowWidth, aiDrawerCollapsed])

  return (
    <main className="grid min-h-screen max-w-[100vw] overflow-hidden grid-rows-[auto_1fr_auto] bg-slate-950 text-slate-100">
      <WsSyncBridge onStatusChange={handleWsStatusChange} />
      <Toolbar onAddText={() => addNode('text')} onAddButton={() => addNode('button')} onAddFrame={() => addNode('frame')} onAddImage={() => addNode('image')} onAddCard={() => addNode('card')} onAddForm={() => addNode('form')} onDelete={removeSelectedNode} onUndo={undo} onRedo={redo} tokenTheme={tokenTheme} tokenPreset={tokenPreset} onTokenThemeChange={setTokenTheme} onTokenPresetChange={setTokenPreset} onApplyTokenPreset={handleApplyTokenPreset} canDelete={state.selectedIds.length > 0} canUndo={canUndo} canRedo={canRedo} />
      <section
        className="oc-main-grid gap-3 p-3"
        style={sectionGridStyle}
      >
        <div className="oc-layers-col"><LayersPanel rootIds={state.rootIds} nodeMap={state.nodeMap} selectedIds={state.selectedIds} onSelect={selectNode} onReorder={reorderRoots} onToggleLocked={handleToggleLocked} onToggleVisible={handleToggleVisible} /></div>
        <div className="oc-canvas-col"><CanvasView nodes={visibleNodes} nodeMap={state.nodeMap} selectedIds={state.selectedIds} viewport={state.viewport} onSelect={selectNode} onSetSelection={setSelection} onMove={moveNode} onMoveSelection={moveSelectedBy} onResize={updateNode} onPan={panBy} onZoom={zoomTo} /></div>
        <div className="oc-inspector-col"><InspectorPanel nodes={selectedNodes} onTextChange={updateSelectedText} onPatchChange={updateSelectedPatch} /></div>
        <div className="oc-ai-col"><AIRefactorPanel collapsed={aiDrawerCollapsed} onToggleCollapse={() => setAiDrawerCollapsed((prev) => !prev)} canGenerateProposal={selectedNodes.length > 0} loading={aiLoading} promptHistory={aiPromptHistory} proposals={aiProposals} proposalPreview={selectedProposal} canRevert={Boolean(lastAiApplySnapshot)} statusMessage={aiStatusMessage} onGenerate={handleGenerateAiProposals} onGeneratePage={handleGenerateAiPage} onApply={handleApplyAiProposal} onSelectProposal={(proposal) => setSelectedProposalId(proposal.id)} onRevert={handleRevertLastAiApply} /></div>
      </section>
      <footer className="grid grid-rows-[auto_1fr] border-t border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-1 text-xs text-slate-400">
          <span>预览运行时: {runtime.message}</span>
          <span>状态: {runtime.ready ? '就绪' : '离线'} | MCP: {wsStatus} | 网格: 18px 吸附 | 变更行数: {codePreview.changedLineCount}{' | '}校验: {syncValidation.errors.length} 个错误, {syncValidation.warnings.length} 个警告</span>
        </div>
        <div className="oc-footer-grid gap-3 px-3 pb-3">
          <CodePreviewPanel code={codePreview.code} hasChanges={codePreview.hasChanges} semanticDiff={semanticDiff} onSetBaseline={handleSetBaseline} onRollback={handleRollbackToBaseline} />
          <PatchPanel forcePatch={forcePatch} onForcePatchChange={setForcePatch} onApplyPatch={handleApplyPatch} onImportToCanvas={handleImportSourceToCanvas} onExportPatchedSource={handleExportPatchedSource} patchTargetSource={patchTargetSource} onPatchTargetSourceChange={setPatchTargetSource} statusMessage={patchResult?.message ?? '准备补丁。源码中需包含 OCODE-CANVAS 标记。'} statusSuccess={patchResult?.success ?? false} previewSource={patchResult?.patchedSource ?? baselineCode} />
          <PreviewRuntimePanel srcDoc={previewRuntimeDoc} />
        </div>
      </footer>
    </main>
  )
}

export default App
