import type { EditorNode } from '../editor-store/types'

export interface AIProposal {
  id: string
  title: string
  rationale: string
  patch: Partial<EditorNode>
}

export interface AIProposalResult {
  proposals: AIProposal[]
  warnings: string[]
  source: 'llm' | 'fallback'
}

interface LlmProposal {
  title?: string
  rationale?: string
  patch?: Partial<EditorNode>
}

interface LlmPageNode {
  id?: string
  type?: EditorNode['type']
  name?: string
  text?: string
  className?: string
  src?: string
  style?: Record<string, string>
  x?: number
  y?: number
  width?: number
  height?: number
}

interface LlmPageResponse {
  title?: string
  rationale?: string
  nodes?: LlmPageNode[]
}

export interface AIPageGenerationResult {
  title: string
  rationale: string
  nodes: EditorNode[]
  warnings: string[]
  source: 'llm' | 'fallback'
}

const ALLOWED_NODE_TYPES: EditorNode['type'][] = [
  'text',
  'button',
  'frame',
  'image',
  'card',
  'form',
]

const ALLOWED_PATCH_KEYS = new Set([
  'name',
  'text',
  'className',
  'src',
  'x',
  'y',
  'width',
  'height',
  'style',
])

function normalizePrompt(prompt: string) {
  return prompt.trim().toLowerCase()
}

function getEnvVar(name: string): string {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
  if (env && typeof env[name] === 'string') {
    return env[name] ?? ''
  }
  const globalWithProcess = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> }
  }
  if (
    globalWithProcess.process?.env &&
    typeof globalWithProcess.process.env[name] === 'string'
  ) {
    return globalWithProcess.process.env[name] ?? ''
  }
  return ''
}

function safeParseJson(raw: string): unknown {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }
  const fencedMatch = trimmed.match(/```json\s*([\s\S]*?)\s*```/i)
  const candidate = fencedMatch?.[1] ?? trimmed
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

async function callLlmForJson(prompt: string, system: string): Promise<unknown> {
  const apiKey = getEnvVar('VITE_AI_API_KEY')
  const apiUrl = getEnvVar('VITE_AI_API_URL') || 'https://api.openai.com/v1/chat/completions'
  const model = getEnvVar('VITE_AI_MODEL') || 'gpt-4o-mini'
  if (!apiKey) {
    return null
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = payload.choices?.[0]?.message?.content ?? ''
  return safeParseJson(content)
}

function sanitizePatch(patch: Partial<EditorNode> | undefined): Partial<EditorNode> {
  if (!patch || typeof patch !== 'object') {
    return {}
  }
  const next: Partial<EditorNode> = {}
  if (typeof patch.name === 'string') next.name = patch.name.slice(0, 80)
  if (typeof patch.text === 'string') next.text = patch.text.slice(0, 1000)
  if (typeof patch.className === 'string') next.className = patch.className.slice(0, 500)
  if (typeof patch.src === 'string') next.src = patch.src.slice(0, 2000)
  if (typeof patch.x === 'number' && Number.isFinite(patch.x)) next.x = Math.round(patch.x)
  if (typeof patch.y === 'number' && Number.isFinite(patch.y)) next.y = Math.round(patch.y)
  if (typeof patch.width === 'number' && Number.isFinite(patch.width)) {
    next.width = Math.max(20, Math.round(patch.width))
  }
  if (typeof patch.height === 'number' && Number.isFinite(patch.height)) {
    next.height = Math.max(20, Math.round(patch.height))
  }
  if (patch.style && typeof patch.style === 'object') {
    const style: Record<string, string> = {}
    Object.entries(patch.style).forEach(([key, value]) => {
      if (typeof value === 'string') {
        style[key] = value
      }
    })
    next.style = style
  }
  return next
}

function validateProposalPatch(patch: Partial<EditorNode> | undefined): {
  patch: Partial<EditorNode>
  warnings: string[]
} {
  const warnings: string[] = []
  if (!patch || typeof patch !== 'object') {
    return { patch: {}, warnings: ['proposal.patch is missing or invalid'] }
  }

  const unsupportedKeys = Object.keys(patch).filter((key) => !ALLOWED_PATCH_KEYS.has(key))
  if (unsupportedKeys.length > 0) {
    warnings.push(
      `Unsupported patch keys ignored: ${unsupportedKeys.join(', ')}. Suggested patch: use className or style fields.`,
    )
  }

  return {
    patch: sanitizePatch(patch),
    warnings,
  }
}

function localFallbackProposals(prompt: string, selectedNodes: EditorNode[]): AIProposal[] {
  const n = normalizePrompt(prompt)
  const proposals: AIProposal[] = []

  if (selectedNodes.length === 0) return proposals
  const first = selectedNodes[0]!

  // Always offer a spacing proposal
  proposals.push({
    id: 'spacing-tight',
    title: '紧凑间距',
    rationale: '减小尺寸以获得更紧凑的视觉效果。',
    patch: {
      width: Math.max(120, Math.round((first.width ?? 200) * 0.92)),
      height: Math.max(36, Math.round((first.height ?? 44) * 0.92)),
    },
  })

  // Hero / headline
  if (/hero|主标题|headline|标题|头部|banner/.test(n)) {
    proposals.push({
      id: 'hero-style',
      title: '主视觉强调',
      rationale: '使用大字号和阴影增强主标题层级。',
      patch: {
        className: 'text-5xl font-bold tracking-tight text-slate-50 drop-shadow-[0_10px_30px_rgba(14,165,233,.35)]',
      },
    })
  }

  // CTA / button
  if (/cta|按钮|button|行动|点击|操作/.test(n)) {
    proposals.push({
      id: 'cta-boost',
      title: 'CTA 增强',
      rationale: '提高按钮视觉突出度，引导用户操作。',
      patch: {
        className: 'rounded-xl bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 shadow-[0_8px_24px_rgba(16,185,129,.45)]',
      },
    })
  }

  // Compact
  if (/compact|紧凑|缩小|小/.test(n)) {
    proposals.push({
      id: 'compact',
      title: '紧凑变体',
      rationale: '在有限空间内展示更多信息。',
      patch: {
        width: Math.max(96, Math.round((first.width ?? 180) * 0.78)),
        height: Math.max(30, Math.round((first.height ?? 44) * 0.84)),
      },
    })
  }

  // Color / style
  if (/颜色|配色|color|主题|theme|暗|dark|亮|light/.test(n)) {
    proposals.push({
      id: 'color-theme',
      title: '色彩优化',
      rationale: '使用现代渐变色系提升视觉层次。',
      patch: {
        className: 'bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold rounded-xl shadow-lg',
      },
    })
  }

  // Card / container
  if (/卡片|card|容器|container|框|box/.test(n)) {
    proposals.push({
      id: 'card-enhance',
      title: '卡片美化',
      rationale: '增加圆角、阴影和边框提升卡片质感。',
      patch: {
        className: 'rounded-2xl border border-slate-700 bg-slate-800/80 p-6 shadow-[0_8px_32px_rgba(0,0,0,.3)] backdrop-blur-sm',
      },
    })
  }

  // Enlarge
  if (/大|放大|enlarge|bigger|expand|宽/.test(n)) {
    proposals.push({
      id: 'enlarge',
      title: '放大尺寸',
      rationale: '增大节点尺寸以获得更好的视觉冲击力。',
      patch: {
        width: Math.round((first.width ?? 200) * 1.3),
        height: Math.round((first.height ?? 44) * 1.2),
      },
    })
  }

  // If only 1 proposal, add a contrast helper
  if (proposals.length === 1) {
    proposals.push({
      id: 'contrast-up',
      title: '提高对比度',
      rationale: '改善中低对比度元素的可读性。',
      patch: {
        className: `${first.className ?? ''} text-slate-50`.trim(),
      },
    })
  }

  return proposals
}

// ─── Prompt-aware template library ───

interface PageTemplate {
  keywords: RegExp
  title: string
  rationale: string
  build: (prompt: string) => LlmPageNode[]
}

const PAGE_TEMPLATES: PageTemplate[] = [
  // ── Login / Signin ──
  {
    keywords: /login|登录|signin|sign.?in|注册|register|signup|sign.?up|账号/,
    title: '登录页面',
    rationale: '基于提示词生成登录/注册表单布局。',
    build: (prompt) => [
      { type: 'text', name: '品牌标题', text: extractTitle(prompt, '欢迎登录'), className: 'text-3xl font-bold tracking-tight text-slate-100', x: 280, y: 60, width: 400, height: 48 },
      { type: 'text', name: '副标题', text: '请输入您的账户信息', className: 'text-sm text-slate-400', x: 280, y: 116, width: 400, height: 28 },
      { type: 'card', name: '登录卡片', text: '登录表单', className: 'rounded-2xl border border-slate-700 bg-slate-800/80 p-6 shadow-[0_8px_32px_rgba(0,0,0,.3)]', x: 280, y: 160, width: 400, height: 340 },
      { type: 'form', name: '邮箱字段', text: '邮箱地址', className: 'rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-300', x: 310, y: 220, width: 340, height: 44 },
      { type: 'form', name: '密码字段', text: '密码', className: 'rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-300', x: 310, y: 280, width: 340, height: 44 },
      { type: 'button', name: '登录按钮', text: '登 录', className: 'w-full rounded-xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(56,189,248,.35)]', x: 310, y: 350, width: 340, height: 48 },
      { type: 'text', name: '忘记密码', text: '忘记密码？', className: 'text-xs text-sky-400 hover:underline', x: 310, y: 410, width: 120, height: 24 },
      { type: 'text', name: '注册链接', text: '没有账号？立即注册', className: 'text-xs text-slate-400', x: 410, y: 410, width: 160, height: 24 },
    ],
  },

  // ── Pricing ──
  {
    keywords: /pricing|定价|价格|套餐|plan|会员|membership|订阅|subscri/,
    title: '定价页面',
    rationale: '基于提示词生成三列定价卡片布局。',
    build: (prompt) => [
      { type: 'text', name: '定价标题', text: extractTitle(prompt, '选择您的方案'), className: 'text-4xl font-bold tracking-tight text-slate-100', x: 160, y: 48, width: 640, height: 56 },
      { type: 'text', name: '定价副标题', text: '灵活的方案，满足不同规模的需求', className: 'text-base text-slate-400', x: 160, y: 112, width: 640, height: 32 },
      // Free tier
      { type: 'card', name: '基础版', text: '基础版', className: 'rounded-2xl border border-slate-700 bg-slate-800/80 p-6', x: 80, y: 176, width: 260, height: 320 },
      { type: 'text', name: '基础价格', text: '¥0 / 月', className: 'text-2xl font-bold text-slate-100', x: 104, y: 230, width: 200, height: 36 },
      { type: 'text', name: '基础描述', text: '• 5 个项目\n• 基础分析\n• 社区支持', className: 'text-sm text-slate-400 whitespace-pre-line', x: 104, y: 278, width: 200, height: 100 },
      { type: 'button', name: '基础CTA', text: '免费开始', className: 'rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-200', x: 104, y: 400, width: 200, height: 40 },
      // Pro tier
      { type: 'card', name: '专业版', text: '专业版', className: 'rounded-2xl border-2 border-sky-500 bg-slate-800 p-6 shadow-[0_0_40px_rgba(56,189,248,.15)]', x: 360, y: 160, width: 260, height: 350 },
      { type: 'text', name: '推荐标签', text: '最受欢迎', className: 'rounded-full bg-sky-500 px-3 py-1 text-xs font-medium text-white', x: 420, y: 172, width: 80, height: 24 },
      { type: 'text', name: '专业价格', text: '¥99 / 月', className: 'text-2xl font-bold text-sky-400', x: 384, y: 230, width: 200, height: 36 },
      { type: 'text', name: '专业描述', text: '• 无限项目\n• 高级分析\n• 优先支持\n• 团队协作', className: 'text-sm text-slate-300 whitespace-pre-line', x: 384, y: 278, width: 200, height: 120 },
      { type: 'button', name: '专业CTA', text: '立即升级', className: 'rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(56,189,248,.35)]', x: 384, y: 420, width: 200, height: 40 },
      // Enterprise tier
      { type: 'card', name: '企业版', text: '企业版', className: 'rounded-2xl border border-slate-700 bg-slate-800/80 p-6', x: 640, y: 176, width: 260, height: 320 },
      { type: 'text', name: '企业价格', text: '联系销售', className: 'text-2xl font-bold text-slate-100', x: 664, y: 230, width: 200, height: 36 },
      { type: 'text', name: '企业描述', text: '• 全部功能\n• 专属客户经理\n• SLA 保障\n• 定制开发', className: 'text-sm text-slate-400 whitespace-pre-line', x: 664, y: 278, width: 200, height: 120 },
      { type: 'button', name: '企业CTA', text: '联系我们', className: 'rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-200', x: 664, y: 400, width: 200, height: 40 },
    ],
  },

  // ── Dashboard ──
  {
    keywords: /dashboard|仪表盘|控制台|面板|后台|admin|管理|数据|analytics|统计/,
    title: '仪表盘页面',
    rationale: '基于提示词生成数据仪表盘布局。',
    build: (prompt) => [
      { type: 'text', name: '仪表盘标题', text: extractTitle(prompt, '数据概览'), className: 'text-2xl font-bold text-slate-100', x: 80, y: 40, width: 300, height: 40 },
      { type: 'text', name: '日期范围', text: '最近 30 天', className: 'text-sm text-slate-400', x: 720, y: 48, width: 120, height: 28 },
      // Stat cards row
      { type: 'card', name: '总访问量', text: '总访问量', className: 'rounded-xl border border-slate-700 bg-slate-800/80 p-4', x: 80, y: 100, width: 190, height: 110 },
      { type: 'text', name: '访问数值', text: '12,845', className: 'text-3xl font-bold text-emerald-400', x: 96, y: 140, width: 158, height: 40 },
      { type: 'card', name: '活跃用户', text: '活跃用户', className: 'rounded-xl border border-slate-700 bg-slate-800/80 p-4', x: 290, y: 100, width: 190, height: 110 },
      { type: 'text', name: '用户数值', text: '3,271', className: 'text-3xl font-bold text-sky-400', x: 306, y: 140, width: 158, height: 40 },
      { type: 'card', name: '转化率', text: '转化率', className: 'rounded-xl border border-slate-700 bg-slate-800/80 p-4', x: 500, y: 100, width: 190, height: 110 },
      { type: 'text', name: '转化数值', text: '8.7%', className: 'text-3xl font-bold text-amber-400', x: 516, y: 140, width: 158, height: 40 },
      { type: 'card', name: '收入', text: '月收入', className: 'rounded-xl border border-slate-700 bg-slate-800/80 p-4', x: 710, y: 100, width: 190, height: 110 },
      { type: 'text', name: '收入数值', text: '¥128,450', className: 'text-3xl font-bold text-purple-400', x: 726, y: 140, width: 158, height: 40 },
      // Charts area
      { type: 'card', name: '趋势图', text: '访问趋势', className: 'rounded-xl border border-slate-700 bg-slate-800/60 p-4', x: 80, y: 240, width: 540, height: 260 },
      { type: 'card', name: '来源分布', text: '流量来源', className: 'rounded-xl border border-slate-700 bg-slate-800/60 p-4', x: 640, y: 240, width: 260, height: 260 },
    ],
  },

  // ── Blog / Article ──
  {
    keywords: /blog|博客|article|文章|新闻|news|内容|content|帖子|post/,
    title: '博客文章页面',
    rationale: '基于提示词生成博客/文章阅读布局。',
    build: (prompt) => [
      { type: 'text', name: '文章标题', text: extractTitle(prompt, '如何构建现代 Web 应用'), className: 'text-4xl font-bold leading-tight tracking-tight text-slate-100', x: 160, y: 60, width: 640, height: 64 },
      { type: 'text', name: '作者信息', text: '作者 · 2026年2月14日 · 阅读 5 分钟', className: 'text-sm text-slate-400', x: 160, y: 140, width: 640, height: 24 },
      { type: 'image', name: '封面图', text: '', className: 'rounded-xl', src: '', x: 160, y: 184, width: 640, height: 280 },
      { type: 'text', name: '正文段落1', text: '在当今快速发展的技术环境中，构建现代 Web 应用需要考虑多个方面。从用户体验到性能优化，每一个细节都至关重要。', className: 'text-base leading-relaxed text-slate-300', x: 160, y: 488, width: 640, height: 72 },
      { type: 'text', name: '副标题', text: '关键技术选型', className: 'text-2xl font-semibold text-slate-100', x: 160, y: 580, width: 640, height: 36 },
      { type: 'text', name: '正文段落2', text: 'React、Vue 和 Svelte 等框架各有优势。选择合适的框架需要根据项目规模、团队经验和性能需求来综合考量。', className: 'text-base leading-relaxed text-slate-300', x: 160, y: 632, width: 640, height: 72 },
      { type: 'card', name: '引用卡片', text: '"好的设计是尽可能少的设计。" — Dieter Rams', className: 'rounded-xl border-l-4 border-sky-500 bg-slate-800/60 p-6 text-base italic text-slate-300', x: 160, y: 728, width: 640, height: 80 },
    ],
  },

  // ── Form / Contact ──
  {
    keywords: /form|表单|contact|联系|反馈|feedback|咨询|问卷|survey|申请|apply/,
    title: '表单页面',
    rationale: '基于提示词生成多字段联系/反馈表单。',
    build: (prompt) => [
      { type: 'text', name: '表单标题', text: extractTitle(prompt, '联系我们'), className: 'text-3xl font-bold tracking-tight text-slate-100', x: 240, y: 48, width: 480, height: 48 },
      { type: 'text', name: '表单描述', text: '有任何问题或建议？请填写以下表单，我们会尽快回复您。', className: 'text-sm text-slate-400', x: 240, y: 104, width: 480, height: 32 },
      { type: 'card', name: '表单容器', text: '表单', className: 'rounded-2xl border border-slate-700 bg-slate-800/80 p-8', x: 240, y: 156, width: 480, height: 440 },
      { type: 'text', name: '姓名标签', text: '姓名', className: 'text-sm font-medium text-slate-300', x: 272, y: 180, width: 200, height: 22 },
      { type: 'form', name: '姓名字段', text: '请输入姓名', className: 'rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-400', x: 272, y: 206, width: 416, height: 44 },
      { type: 'text', name: '邮箱标签', text: '邮箱', className: 'text-sm font-medium text-slate-300', x: 272, y: 264, width: 200, height: 22 },
      { type: 'form', name: '邮箱字段', text: '请输入邮箱地址', className: 'rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-400', x: 272, y: 290, width: 416, height: 44 },
      { type: 'text', name: '消息标签', text: '消息', className: 'text-sm font-medium text-slate-300', x: 272, y: 348, width: 200, height: 22 },
      { type: 'form', name: '消息字段', text: '请描述您的问题或建议...', className: 'rounded-lg border border-slate-600 bg-slate-900 px-4 py-3 text-sm text-slate-400', x: 272, y: 374, width: 416, height: 100 },
      { type: 'button', name: '提交按钮', text: '发送消息', className: 'rounded-xl bg-sky-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(56,189,248,.35)]', x: 272, y: 500, width: 416, height: 48 },
    ],
  },

  // ── Portfolio ──
  {
    keywords: /portfolio|作品集|展示|gallery|画廊|相册|案例|showcase|项目展示/,
    title: '作品集页面',
    rationale: '基于提示词生成网格图片展示布局。',
    build: (prompt) => [
      { type: 'text', name: '作品集标题', text: extractTitle(prompt, '我的作品'), className: 'text-4xl font-bold tracking-tight text-slate-100', x: 80, y: 48, width: 800, height: 56 },
      { type: 'text', name: '作品集描述', text: '精选项目 · 设计与开发', className: 'text-base text-slate-400', x: 80, y: 112, width: 400, height: 28 },
      // Grid
      { type: 'image', name: '项目 1', text: '项目一', className: 'rounded-xl', src: '', x: 80, y: 168, width: 280, height: 200 },
      { type: 'image', name: '项目 2', text: '项目二', className: 'rounded-xl', src: '', x: 380, y: 168, width: 280, height: 200 },
      { type: 'image', name: '项目 3', text: '项目三', className: 'rounded-xl', src: '', x: 680, y: 168, width: 280, height: 200 },
      { type: 'image', name: '项目 4', text: '项目四', className: 'rounded-xl', src: '', x: 80, y: 388, width: 280, height: 200 },
      { type: 'image', name: '项目 5', text: '项目五', className: 'rounded-xl', src: '', x: 380, y: 388, width: 280, height: 200 },
      { type: 'image', name: '项目 6', text: '项目六', className: 'rounded-xl', src: '', x: 680, y: 388, width: 280, height: 200 },
      { type: 'button', name: '查看更多', text: '查看全部作品', className: 'rounded-lg border border-slate-600 px-5 py-2.5 text-sm text-slate-200', x: 380, y: 616, width: 200, height: 40 },
    ],
  },

  // ── Landing Page (widest match, put last) ──
  {
    keywords: /landing|着陆|首页|home|官网|产品|product|saas|介绍|主页|网站|website/,
    title: '着陆页面',
    rationale: '基于提示词生成 SaaS/产品着陆页布局。',
    build: (prompt) => [
      { type: 'text', name: '导航品牌', text: extractBrand(prompt), className: 'text-lg font-bold text-sky-400', x: 80, y: 32, width: 160, height: 32 },
      { type: 'button', name: '导航CTA', text: '免费试用', className: 'rounded-lg bg-sky-500 px-4 py-2 text-xs font-semibold text-white', x: 760, y: 28, width: 120, height: 36 },
      { type: 'text', name: '主标题', text: extractTitle(prompt, '构建下一代数字体验'), className: 'text-5xl font-bold leading-tight tracking-tight text-slate-50 drop-shadow-[0_10px_30px_rgba(14,165,233,.2)]', x: 80, y: 100, width: 800, height: 80 },
      { type: 'text', name: '副标题', text: '简洁、高效、现代的解决方案，助力您的业务增长。', className: 'text-lg text-slate-300', x: 80, y: 196, width: 600, height: 36 },
      { type: 'button', name: '主CTA', text: '立即开始', className: 'rounded-xl bg-sky-500 px-8 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(56,189,248,.35)]', x: 80, y: 256, width: 180, height: 48 },
      { type: 'button', name: '次CTA', text: '了解更多', className: 'rounded-xl border border-slate-600 px-8 py-3 text-sm text-slate-300', x: 280, y: 256, width: 160, height: 48 },
      // Feature cards
      { type: 'card', name: '功能卡片1', text: '⚡ 极致性能', className: 'rounded-2xl border border-slate-700 bg-slate-800/80 p-6', x: 80, y: 348, width: 260, height: 180 },
      { type: 'card', name: '功能卡片2', text: '🎨 灵活设计', className: 'rounded-2xl border border-slate-700 bg-slate-800/80 p-6', x: 360, y: 348, width: 260, height: 180 },
      { type: 'card', name: '功能卡片3', text: '🔒 安全可靠', className: 'rounded-2xl border border-slate-700 bg-slate-800/80 p-6', x: 640, y: 348, width: 260, height: 180 },
      // Social proof
      { type: 'text', name: '社会证明', text: '已有 10,000+ 团队选择我们', className: 'text-center text-sm text-slate-500', x: 280, y: 560, width: 400, height: 24 },
    ],
  },
]

/** Extract a meaningful title from the prompt, or use fallback */
function extractTitle(prompt: string, fallback: string): string {
  // Remove common action verbs / prefixes
  const cleaned = prompt
    .replace(/^(创建|生成|做|制作|设计|build|create|make|design|generate)\s*/i, '')
    .replace(/一个|an?\s+/gi, '')
    .replace(/(页面|page|layout|布局|界面)$/i, '')
    .trim()
  return cleaned.length > 2 ? cleaned.slice(0, 72) : fallback
}

/** Extract a brand-like word from the prompt */
function extractBrand(prompt: string): string {
  const match = prompt.match(/(?:叫|called|named|for)\s+['"]?(\S+)['"]?/i)
  if (match?.[1]) return match[1].slice(0, 20)
  return 'Brand'
}

/** Match prompt to a template */
function matchTemplate(prompt: string): PageTemplate | null {
  const n = normalizePrompt(prompt)
  return PAGE_TEMPLATES.find((t) => t.keywords.test(n)) ?? null
}

function normalizeGeneratedNodes(nodes: LlmPageNode[]): EditorNode[] {
  const usedIds = new Set<string>()
  const typeCounters = new Map<EditorNode['type'], number>()

  const nextId = (type: EditorNode['type']) => {
    const current = (typeCounters.get(type) ?? 0) + 1
    typeCounters.set(type, current)
    return `${type}-${current}`
  }

  return nodes
    .map((node) => {
      const type = ALLOWED_NODE_TYPES.includes(node.type ?? 'text') ? (node.type ?? 'text') : 'frame'
      const preferredId = typeof node.id === 'string' && node.id.trim() ? node.id.trim() : nextId(type)
      const id = usedIds.has(preferredId) ? nextId(type) : preferredId
      usedIds.add(id)

      const patch = sanitizePatch({
        name: node.name,
        text: node.text,
        className: node.className,
        src: node.src,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        style: node.style,
      })

      return {
        id,
        type,
        name: patch.name ?? `${type.toUpperCase()} Block`,
        text: patch.text ?? (type === 'button' ? 'Action' : ''),
        className: patch.className ?? '',
        src: patch.src ?? '',
        style: patch.style ?? {},
        x: patch.x ?? 80,
        y: patch.y ?? 80,
        width: patch.width ?? (type === 'text' ? 320 : 220),
        height: patch.height ?? (type === 'text' ? 56 : 120),
      } satisfies EditorNode
    })
    .filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y))
}

export async function generateAiProposals(
  prompt: string,
  selectedNodes: EditorNode[],
): Promise<AIProposalResult> {
  if (selectedNodes.length === 0) {
    return { proposals: [], warnings: [], source: 'fallback' }
  }

  const system = [
    'You are an expert frontend designer assistant.',
    'Return JSON only with shape: {"proposals":[{"title":"...","rationale":"...","patch":{...}}]}',
    'Patch can include: name,text,className,src,x,y,width,height,style.',
    'Keep values concise and production-ready.',
  ].join(' ')

  const context = JSON.stringify(
    selectedNodes.map((n) => ({
      id: n.id,
      type: n.type,
      x: n.x,
      y: n.y,
      width: n.width,
      height: n.height,
      text: n.text,
      className: n.className,
      src: n.src,
      style: n.style,
    })),
  )

  const llmResponse = await callLlmForJson(`Prompt: ${prompt}\nSelected Nodes: ${context}`, system)
  const proposalsData =
    llmResponse && typeof llmResponse === 'object' && 'proposals' in llmResponse
      ? (llmResponse as { proposals?: LlmProposal[] }).proposals
      : null

  if (!Array.isArray(proposalsData) || proposalsData.length === 0) {
    return {
      proposals: localFallbackProposals(prompt, selectedNodes),
      warnings: ['LLM response invalid or empty. Used local fallback proposals.'],
      source: 'fallback',
    }
  }

  const warnings: string[] = []
  const mapped = proposalsData
    .map((proposal, index) => {
      const validated = validateProposalPatch(proposal.patch)
      warnings.push(...validated.warnings.map((warning) => `Proposal ${index + 1}: ${warning}`))
      return {
        id: `llm-${index + 1}`,
        title: (proposal.title ?? `Proposal ${index + 1}`).slice(0, 60),
        rationale: (proposal.rationale ?? 'Generated by model.').slice(0, 200),
        patch: validated.patch,
      }
    })
    .filter((proposal) => Object.keys(proposal.patch).length > 0)

  if (mapped.length === 0) {
    return {
      proposals: localFallbackProposals(prompt, selectedNodes),
      warnings: [
        ...warnings,
        'No valid fields remained after schema validation. Used local fallback proposals.',
      ],
      source: 'fallback',
    }
  }

  return { proposals: mapped, warnings, source: 'llm' }
}

export async function generatePageFromPrompt(prompt: string): Promise<AIPageGenerationResult> {
  const system = [
    'You generate complete UI node trees for a visual editor.',
    'Return JSON only with shape: {"title":"...","rationale":"...","nodes":[...]}.',
    'Each node supports: id,type,name,text,className,src,style,x,y,width,height.',
    'Allowed type values: text,button,frame,image,card,form.',
  ].join(' ')

  const llmResponse = await callLlmForJson(prompt, system)
  const data = llmResponse as LlmPageResponse | null

  if (!data || !Array.isArray(data.nodes) || data.nodes.length === 0) {
    // ── Prompt-aware local fallback ──
    const template = matchTemplate(prompt)
    const templateNodes = template
      ? template.build(prompt)
      : buildDefaultTemplate(prompt)

    const localNodes = normalizeGeneratedNodes(templateNodes)

    return {
      title: template?.title ?? '生成页面',
      rationale: template?.rationale ?? `基于提示词"${prompt.slice(0, 40)}"生成默认布局。`,
      nodes: localNodes,
      warnings: apiKeyMissing()
        ? ['未配置 VITE_AI_API_KEY，使用本地模板引擎生成。']
        : ['LLM 返回为空，使用本地模板引擎生成。'],
      source: 'fallback',
    }
  }

  const typeWarnings = data.nodes
    .filter((node) => !ALLOWED_NODE_TYPES.includes(node.type ?? 'text'))
    .map(
      (node, index) =>
        `Node ${index + 1}: unsupported type '${node.type ?? 'unknown'}' downgraded to 'frame'.`,
    )

  const nodes = normalizeGeneratedNodes(data.nodes)
  return {
    title: (data.title ?? 'AI Generated Page').slice(0, 80),
    rationale: (data.rationale ?? 'Generated by LLM response.').slice(0, 240),
    nodes,
    warnings: typeWarnings,
    source: 'llm',
  }
}

function apiKeyMissing(): boolean {
  return !getEnvVar('VITE_AI_API_KEY')
}

/** Default template when no keyword matches — uses prompt text as hero title */
function buildDefaultTemplate(prompt: string): LlmPageNode[] {
  const title = prompt.slice(0, 72) || '新页面'
  return [
    { type: 'text', name: '主标题', text: title, className: 'text-5xl font-bold tracking-tight text-slate-100 drop-shadow-[0_10px_30px_rgba(14,165,233,.2)]', x: 80, y: 72, width: 760, height: 72 },
    { type: 'text', name: '页面描述', text: `这是"${title}"的页面。您可以编辑节点来定制布局。`, className: 'text-base text-slate-300', x: 80, y: 160, width: 620, height: 40 },
    { type: 'button', name: '主操作', text: '开始', className: 'rounded-xl bg-sky-500 px-8 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(56,189,248,.35)]', x: 80, y: 224, width: 160, height: 48 },
    { type: 'button', name: '次操作', text: '了解更多', className: 'rounded-xl border border-slate-600 px-8 py-3 text-sm text-slate-300', x: 260, y: 224, width: 160, height: 48 },
    { type: 'card', name: '内容卡片 1', text: '功能亮点', className: 'rounded-2xl border border-slate-700 bg-slate-800/80 p-6', x: 80, y: 312, width: 260, height: 180 },
    { type: 'card', name: '内容卡片 2', text: '使用指南', className: 'rounded-2xl border border-slate-700 bg-slate-800/80 p-6', x: 360, y: 312, width: 260, height: 180 },
    { type: 'card', name: '内容卡片 3', text: '更多信息', className: 'rounded-2xl border border-slate-700 bg-slate-800/80 p-6', x: 640, y: 312, width: 260, height: 180 },
  ]
}
