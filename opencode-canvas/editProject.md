---
Opencode Canvas — 更新后完整分析
---
一、变更总览（vs 上次分析）
| 维度 | 上次（Sprint 1） | 现在（Sprint 4） | 变化 |
|------|-----------------|-----------------|------|
| 文件数 | 7 个源文件 | 15 个源文件 | +8 (含测试) |
| 代码量 | ~830 行 | ~2,380 行 | +187% |
| 依赖 | 仅 react/react-dom | + vitest | +1 |
| 阻塞问题 | store.ts 缺失 ❌ | 已修复 ✅ | 已解决 |
| 编译 | 无法编译 | tsc --noEmit 通过 ✅ | 已解决 |
| 测试 | 无测试 | 5 个测试全部通过 ✅ | 从 0 到 1 |
| README 版本标记 | P0 MVP | P1 MVP+ | 升级 |
---
二、新增/变更文件详细分析
| 文件 | 状态 | 行数 | 评价 |
|------|------|------|------|
| core/editor-store/store.ts | 🆕 新增 | 447 | 核心骨干 — 完整的 command 系统 + undo/redo 历史栈 + 输入消毒。质量高。 |
| core/ai/refactor.ts | 🆕 新增 | 84 | 本地 AI 提案策略（基于关键词匹配，无 LLM 调用）。MVP 占位合理。 |
| features/ai/AIRefactorPanel.tsx | 🆕 新增 | 129 | AI 面板 UI — prompt 输入 / 提案列表 / 预览 / 应用 / 回退。 |
| core/code-sync/index.test.ts | 🆕 新增 | 88 | 5 个测试覆盖 marker patch 核心路径。 |
| core/code-sync/index.ts | 📝 变更 | 160→303 | +90%：新增 hash 校验、marker 结构验证、force 覆盖、状态验证。 |
| App.tsx | 📝 变更 | 248→398 | +60%：集成多选、AI 面板、键盘快捷键、验证状态栏。 |
| core/canvas-renderer/CanvasView.tsx | 📝 变更 | 108→120 | 支持多选高亮 + ⌘/Ctrl/Shift 增量选择 + 多选拖拽。 |
| core/inspector/InspectorPanel.tsx | 📝 变更 | 190→240 | 重构为多选感知 — "Mixed" 占位符 + 批量更新。 |
| features/layers/LayersPanel.tsx | 📝 变更 | 48→50 | 支持 selectedIds + 增量选择。 |
| core/editor-store/types.ts | 未变 | 21 | — |
| core/preview-runtime/index.ts | 未变 | 12 | 仍是空壳 stub |
| App.css | 未变 | 43 | 仍是 Vite 模板残留 |
---
三、架构质量评估
✅ 做得好的
1. Command 模式 + 历史栈：store.ts 的 applyCommand + dispatchCommand 是教科书级实现，所有状态变更走统一路径，undo/redo 一致性好。
2. 输入消毒：sanitizePatch() / sanitizeNode() 对长度限制（name:80, text:1000, className:500）、类型校验、维度下限做了防御性处理。
3. HISTORY_LIMIT = 120：防止无界内存增长，合理的工程约束。
4. Marker Hash 校验：FNV-1a 变体 checksum，防止手动修改后的意外覆盖，force 选项留了后门。
5. Marker 结构验证：正则验证 START/END 唯一性和顺序，错误原因明确。
6. 多选实现：Canvas / Layers / Inspector 三处统一支持 selectedIds，数据流一致。
7. 键盘快捷键：标准设计工具键位，且正确过滤了 INPUT/TEXTAREA 焦点。
⚠️ 需要关注的
| # | 问题 | 严重度 | 详情 |
|---|------|--------|------|
| Q1 | App.tsx 仍然是 god component | 中 | 398 行，承载 toolbar + canvas wiring + patch panel + AI panel wiring + keyboard handler + 全部状态管理。需拆分。 |
| Q2 | useEditorStore 是纯 React hook，非全局 store | 中 | 当前只在 App.tsx 用，但如果子组件需要直接访问 store（如键盘快捷键组件），就需要 props drilling 或 context。 |
| Q3 | Inspector InspectorFields 每次选择变化时重建本地 state | 低 | 因为没有 key prop 强制重挂载（上个版本有，这版删了），切换选择后 textDraft/classNameDraft 可能不同步。 |
| Q4 | CanvasView 多选拖拽的 delta 模式有累积漂移风险 | 低 | 每次 mousemove 都重置 startMouseX/Y，但 moveSelectedBy 内部 round 后丢失了小数，长距离拖拽可能产生 1px 漂移。 |
| Q5 | AI refactor 是纯关键词匹配 | 低（预期内） | generateAiProposals 无 LLM，是 MVP 占位，README 已标注。合理。 |
| Q6 | App.css 仍未清理 | 极低 | Vite 模板残留 |
---
四、PRD Feature 达成率（更新后）
| PRD Feature | Sprint 1 | 现在 | 增量 | 缺失项 |
|-------------|----------|------|------|--------|
| F1 AI Generation | 0% | 25% 🟡 | +25% | 有: 本地提案策略 + 面板 UI + apply/revert。缺: 真实 LLM 集成、prompt→page 全页生成 |
| F2 Canvas Editing | ~30% | 45% 🟡 | +15% | 有: select/drag/move/多选/键盘微调/delete。缺: resize 手柄、分组、图层排序、image/card/form 节点 |
| F3 Inspector | ~25% | 35% 🟡 | +10% | 有: text/className/x/y/w/h + 多选批量编辑。缺: layout/spacing/typography/color/border/radius/shadow |
| F4 Code Sync | ~20% | 35% 🟡 | +15% | 有: 字符串生成 + marker patch + hash 校验 + 结构验证。缺: AST writeback、code→canvas 解析 |
| F5 Safety | ~30% | 55% 🟢 | +25% | 有: baseline/rollback + AI rationale + diff + revert + hash 冲突检测 + 状态验证。缺: 降级建议、schema validation |
| Layers/Tree | ~20% | 25% 🟡 | +5% | 有: 扁平列表 + 多选高亮。缺: 树形层级、拖拽排序、可见性/锁定 |
| Undo/Redo | ~50% | 95% ✅ | +45% | 完整实现 + HISTORY_LIMIT。仅缺: future 栈也应限制长度 |
| Keyboard Shortcuts | 0% | 90% ✅ | +90% | ⌘A/Delete/⌘Z/⌘⇧Z/方向键/Shift+方向键/Esc 全部实现 |
| Testing | 0% | 30% 🟡 | +30% | 有: 5 个 code-sync 测试。缺: store 测试、组件测试、E2E |
| State Validation | 0% | 80% 🟢 | +80% | 完整的 validateSyncState + 状态栏展示 errors/warnings |
*综合 MVP 进度: 约 45-50%*（上次 25-30%），从不可运行到功能初具雏形，进步显著。
---
五、更新后的产品优化方案
阶段 A — 代码质量加固（~1 周）
已无阻塞项，聚焦内部质量：
| 编号 | 任务 | 优先级 | 说明 |
|------|------|--------|------|
| A1 | App.tsx 拆分 — 提取 Toolbar.tsx、CodePreviewPanel.tsx、PatchPanel.tsx、KeyboardHandler.ts | P0 | 398 行 god component 已影响可维护性 |
| A2 | EditorStore → Context/zustand — 将状态提升为全局可访问 | P1 | 避免 props drilling |
| A3 | InspectorFields 选择同步修复 — 添加 key 或 useEffect 同步 draft | P0 | 切换选择后 draft 不同步 bug |
| A4 | 删除 App.css | P2 | 清理模板残留 |
| A5 | Store 单元测试 — 覆盖 applyCommand 所有 command 分支 | P0 | 核心逻辑需要测试保障 |
| A6 | future 栈也应限制长度 — 与 past 栈一致使用 HISTORY_LIMIT | P2 | 防止极端情况内存膨胀 |
阶段 B — 画布能力增强（~2 周）
PRD F2 的核心缺口：
| 编号 | 任务 | 优先级 |
|------|------|--------|
| B1 | Resize 手柄 — 8 方向拖拽调整尺寸 | P0 |
| B2 | 节点类型扩展 — image、card、form + 对应渲染/添加逻辑 | P0 |
| B3 | Snap-to-grid — 18px 对齐（匹配现有 dot pattern） | P1 |
| B4 | 分组/取消分组 — Group 容器节点 + children 层级 | P1 |
| B5 | 图层拖拽排序 — rootIds 顺序调整 | P1 |
| B6 | 图层可见性/锁定 — eye/lock toggle | P2 |
| B7 | 框选(marquee select) — 画布空白区域拖拽框选 | P1 |
阶段 C — Inspector 属性完善（~1-2 周）
PRD F3 的核心缺口：
| 编号 | 任务 | 优先级 |
|------|------|--------|
| C1 | EditorNode.style 扩展 — Record<string, string> 承载所有 CSS 属性 | P0 |
| C2 | Layout section — display / flexDirection / alignItems / justifyContent / gap | P0 |
| C3 | Spacing section — padding / margin（四方向） | P0 |
| C4 | Typography section — fontSize / fontWeight / lineHeight / textAlign / color | P1 |
| C5 | Visual section — backgroundColor / border / borderRadius / boxShadow | P1 |
| C6 | 颜色选择器 — 引入 react-colorful（~2KB） | P1 |
阶段 D — AST 引擎（~2-3 周）
PRD F4 的核心缺口，也是产品差异化关键：
| 编号 | 任务 | 优先级 |
|------|------|--------|
| D1 | 安装 AST 工具链 — @babel/parser + recast + jscodeshift | P0 |
| D2 | Canvas→Code AST writeback — 替换字符串拼接方案 | P0 |
| D3 | Code→Canvas 解析 — TSX 源码 → 节点树 + 样式投影 | P0 |
| D4 | Diff 引擎升级 — 行级语义 diff（当前只是逐行字符串比较） | P1 |
| D5 | Preview Runtime 实现 — iframe + Vite HMR 沙箱，替换空壳 stub | P1 |
| D6 | Design Token 层 — Tailwind theme 映射 | P2 |
阶段 E — AI 集成升级（~1-2 周）
| 编号 | 任务 | 优先级 |
|------|------|--------|
| E1 | LLM API 对接 — 替换关键词匹配为真实 AI 调用 | P0 |
| E2 | Prompt→Page 全页生成 — 空画布 + prompt → 初始节点树 | P0 |
| E3 | Schema Validation — LLM 输出结构校验（Zod/AJV） | P1 |
| E4 | 降级建议 — 不支持的语法 → suggested patch（而非静默忽略） | P1 |
| E5 | AI 侧边抽屉 — 当前是右侧固定面板，PRD 要求 side drawer 可收起 | P2 |
阶段 F — 稳定化（~1 周）
| 编号 | 任务 | 优先级 |
|------|------|--------|
| F1 | 组件测试 — InspectorPanel / CanvasView / LayersPanel | P0 |
| F2 | E2E 测试 — Playwright 覆盖核心 flow | P1 |
| F3 | 大节点树性能 — 虚拟化渲染（50+ 节点场景） | P2 |
| F4 | 无障碍 — 焦点管理 + aria 属性 | P2 |
| F5 | 初始化 git — 建立版本管理 | P0 |
---
六、优先级排序建议
立即（本周）: A1 + A3 + A5 + F5 → 代码质量 + 测试 + 版本管理
下一周:       B1 + B2 + C1 → 画布核心能力 + 节点模型扩展
第 3 周:      D1 + D2 → AST 引擎（产品差异化核心）
第 4 周:      E1 + E2 → 真实 AI 集成
第 5 周:      F1 + F2 → 测试覆盖 + 稳定化
---
七、关键风险提醒
1. App.tsx 膨胀速度：从 248→398 行（每个 Sprint +~50 行），不拆分的话下两个 Sprint 将超过 600 行，进入"改一个功能碎一片"的危险区。建议 A1 最优先。
2. AST 引擎 vs 当前 marker-patch 并存策略：当前 marker-patch 已经相当成熟（hash + 验证 + force），不建议删除。应做为 AST 引擎的 fallback 路径，降低 AST 引擎上线风险。
3. AI 从占位到真实 LLM 的跨度较大：当前 generateAiProposals 返回固定模式。接入真实 LLM 后需要考虑延迟（loading 状态）、流式输出、错误处理、成本控制（token 预算），建议先做好 API 抽象层。
需要我着手执行其中某个阶段吗？

阶段梳理（含完成标记）
- 阶段 A（代码质量）
  - ✅ A1 App.tsx 拆分
  - ✅ A3 Inspector 同步修复
  - ✅ A4 删除 App.css
  - ✅ A5 Store 单测补全
  - ✅ A2 Store 全局化、A6 future 栈限长
- 阶段 B（画布能力）
  - ✅ B1 8 向 resize
  - ✅ B2 image/card/form 节点扩展
  - ⏳ B3 Snap-to-grid、B4 分组、B5 图层排序、B6 锁定可见性、B7 框选
- 阶段 C（Inspector）
  - ✅ C1 EditorNode.style 扩展
  - ✅ C2/C3/C4/C5/C6（布局/间距/文字/视觉/颜色选择器）
- 阶段 D（AST）
  - ✅ D1 工具链集成
  - ✅ D2 Canvas→Code AST writeback（AST 优先，marker 回退）
  - ⏳ D3 Code→Canvas、D4 语义 diff、D5 preview runtime、D6 token 层
- 阶段 E（AI）
  - ✅ E1 真实 API 集成
  - ✅ E2 Prompt→Page 全页生成
  - ✅ E3 schema 校验、E4 降级建议、E5 可收起抽屉
- 阶段 F（稳定化）
  - ✅ F5 Git 初始化/版本管理
  - ✅ F1 组件测试、F2 E2E、F3 性能、F4 无障碍
最新完成提交（节选）
- `aa0ef80`：A2/A6（Store 全局化 + 历史栈限长）
- `3dfd57c`：C2~C6（Inspector 布局/间距/文字/视觉/颜色）
- `213e56b`：E3~E5（Schema 校验 + 降级建议 + AI 抽屉）
- `3c46e58`：F1（组件测试）
- `7a23d28`：F2（Playwright E2E）
- `e201355`：F3/F4 核心（画布虚拟化 + 基础 ARIA）
- `14b1160`：F4 增强（Layers/Toolbar 键盘与焦点语义）
- `90cadf1`：F3/F4 回归测试补充
给多 Agent 协同的建议拆分
1. Agent-A（画布交互）：B3 + B7 + B5
2. Agent-B（Inspector 体系）：C2 + C3 -> C4 + C5 -> C6
3. Agent-C（AST 深化）：D3 -> D4 + D5 -> D6
4. Agent-D（AI 稳定化）：E3 -> E4 -> E5
5. Agent-E（质量保障）：并行推进 F1，最后集中 F2/F3/F4
