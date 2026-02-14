# Opencode Canvas — 开发路线图

> 基于 `PRODUCT_ARCHITECTURE_v2.0.md` 和 `PRODUCT_PRD_v1.0.md`
> 更新日期：2026-02-14
> Phase 顺序：G'(MCP核心) → H'(实时渲染) → I'(画布增强) → J'(组件) → K'(Cmd+K) → L'(文件+变量) → M'(CLI)

---

## 已完成

### Phase A-F（基础编辑器）✅

基础编辑器、代码同步、AI 集成、测试稳定化。94 测试通过。

### Phase G1/G2（无限画布）✅

无限画布 Pan/Zoom + 世界坐标系重构 + 视口管理。

### Phase G'（MCP Server 核心 + WebSocket 桥接）✅

| 编号 | 任务 | 状态 |
|------|------|------|
| G'1 | 项目结构重组：`shared/` + `server/` + tsconfig | ✅ |
| G'2 | MCP Server 入口：stdio transport + WS server | ✅ |
| G'3 | StateManager：applyCommand + history + undo/redo | ✅ |
| G'4 | WSBridge：双向消息协议 + 连接管理 | ✅ |
| G'5 | `batch_design` MCP tool：增删改 + 原子事务 | ✅ |
| G'6 | MCP Resources：canvas://state, canvas://selection, canvas://tree | ✅ |
| G'7 | 浏览器端 WS Client：WsClient + useWsSync + WsSyncBridge | ✅ |
| G'8 | 集成测试：16 tests (StateManager + WSBridge + E2E) | ✅ |
| G'9 | `query_layout` + `generate_code` MCP tools | ✅ |

当前测试：**110 tests passing**，build clean，lint clean。

---

## 待开发

### Phase H' — 真实组件渲染（~1.5 周）

> 核心目标：Sandpack 沙箱渲染 AI 生成的 React 代码，实现双模式切换

| 编号 | 任务 | 优先级 | 预估 | 依赖 | 详细描述 |
|------|------|--------|------|------|----------|
| H'1 | Sandpack LivePreview 组件 | P0 | 1d | 无 | 安装 `@codesandbox/sandpack-react`，创建 `LivePreview.tsx` 组件，在 iframe 沙箱中运行真实 React+Tailwind 代码 |
| H'2 | 代码生成器增强 | P0 | 2d | 无 | 增强 `EditorState → React 组件文件` 的生成能力，输出完整的多文件结构（App.tsx + 子组件），支持 Tailwind class 和交互逻辑 |
| H'3 | WS `code:update` → Sandpack 热重载 | P0 | 1d | G'7, H'1 | 处理 WebSocket `code:update` 消息，将 `{ files: Record<string, string> }` 推送到 Sandpack Provider 实现热重载 |
| H'4 | 双模式 UI：Preview / Layout Tab 切换 | P0 | 1d | H'1 | 顶部 Tab 切换 Preview（Sandpack 渲染真实组件）和 Layout（画布节点拖拽）模式，共享 EditorState，切换无数据丢失 |
| H'5 | Vite proxy 配置优化 | P1 | 0.5d | G'4 | 开发环境 WS 代理完善（已有基础，需验证 Sandpack 场景） |
| H'6 | `get_screenshot` MCP tool | P1 | 1d | G'7 | 通过 WS 向浏览器请求截图（`request:screenshot` → `response:screenshot`），返回 base64 dataURL 给 Claude Code |

**验收标准**：
- [ ] Claude Code 对话生成的 React 代码在 Sandpack 中实时渲染
- [ ] Preview 模式下可看到真实的按钮交互、Tailwind 样式
- [ ] Layout 模式下可拖拽节点
- [ ] 两种模式无缝切换，状态不丢失

---

### Phase I' — 画布引擎增强（~1.5 周）

> 核心目标：Frame 容器 + Flexbox 自动布局

| 编号 | 任务 | 优先级 | 预估 | 依赖 | 详细描述 |
|------|------|--------|------|------|----------|
| I'1 | Frame 容器子节点渲染 | P0 | 2d | 已有基础 | Frame 类型节点可包含子节点，子节点在 Frame 内部渲染，支持拖入/移出 Frame |
| I'2 | Yoga Flexbox 布局引擎集成 | P0 | 2d | I'1 | 使用 `yoga-layout` v3.2.1 计算 Frame 内子节点的 Flexbox 布局（direction/align/justify/gap/padding），Frame 外仍为绝对定位 |
| I'3 | 布局属性面板 | P1 | 1.5d | I'2 | Inspector 面板增加 Flexbox 属性编辑：flexDirection、alignItems、justifyContent、gap、padding，实时预览 |
| I'4 | 适应视图快捷键 | P2 | 0.5d | 已有基础 | `Cmd+1` 适应全部节点、`Cmd+2` 适应选区、`Cmd+0` 缩放 100% |
| I'5 | 小地图 | P2 | 1d | 已有基础 | 右下角缩略图显示当前视口在整个画布中的位置，可点击跳转 |

**验收标准**：
- [ ] Frame 内子节点按 Flexbox 自动排列
- [ ] 拖入/移出 Frame 时布局正确切换（absolute ↔ flex）
- [ ] 布局属性面板可调整 direction/align/justify/gap

---

### Phase J' — 组件系统（~2 周）

> 核心目标：可复用组件 + 实例 + 覆写系统

| 编号 | 任务 | 优先级 | 预估 | 依赖 | 详细描述 |
|------|------|--------|------|------|----------|
| J'1 | ComponentDefinition 数据模型 + Store 扩展 | P0 | 2d | 无 | 定义 `ComponentDefinition`（id, name, rootNodeId, defaultOverrides, slots），扩展 EditorState 和 Store |
| J'2 | 创建组件 | P0 | 1d | J'1 | 选中节点 → 右键 "Create Component" → 节点标记为主组件（绿色边框），注册到 ComponentRegistry |
| J'3 | 创建实例 | P0 | 2d | J'2 | 从组件库拖拽或复制主组件 → 生成实例节点（type="instance"），保持与主组件同步 |
| J'4 | 实例覆写系统 | P0 | 3d | J'3 | 实例可覆写文本/样式/子节点属性（属性级 diff），覆写属性标记为"已覆写"，支持"Reset to Main"重置 |
| J'5 | 深层覆写 + Slot + 组件库 + 同步 | P1 | 4d | J'4 | 深层覆写路径寻址（如 `button/label`）、组件 Slot 机制、组件库面板 UI、主组件编辑后实例自动同步 |

**验收标准**：
- [ ] 可将任意节点树转为组件，生成实例
- [ ] 实例覆写文本/样式后，主组件更新不覆盖已覆写属性
- [ ] 深层路径（如 `card/header/title`）可正确寻址覆写
- [ ] 组件库面板展示所有已注册组件

---

### Phase K' — Cmd+K 命令面板 + AI 增强（~1.5 周）

> 核心目标：自然语言操作画布，AI 管道通过 MCP 调用

| 编号 | 任务 | 优先级 | 预估 | 依赖 | 详细描述 |
|------|------|--------|------|------|----------|
| K'1 | Cmd+K 命令面板 UI | P0 | 1d | 无 | Spotlight 风格浮层，`Cmd+K` 唤出，支持输入框 + 历史记录（↑/↓）+ "正在思考…" 状态 |
| K'2 | 上下文收集器 | P0 | 1d | 无 | 收集当前选区、设计变量、组件树、画布状态作为 AI 上下文 |
| K'3 | 命令 → MCP Tool 调用 | P0 | 2d | G' | 用户自然语言输入 → 通过 MCP 协议调用 `batch_design` 等工具操作画布（不直接调 LLM API） |
| K'4 | 操作预览 + 确认/取消 | P1 | 1d | K'3 | AI 返回操作指令后先预览效果，用户确认后应用，取消则回滚 |
| K'5 | 内置命令模糊匹配 | P1 | 1d | K'1 | 识别内置命令（如 "align left" 直接调用对齐工具），不走 AI 管道，提升响应速度 |

**验收标准**：
- [ ] Cmd+K 弹出命令面板，输入自然语言可操作画布
- [ ] 操作结果可 undo
- [ ] 识别内置命令（如 "align left" 直接调用而非走 AI）

---

### Phase L' — 文件格式 + 变量系统（~1.5 周）

> 核心目标：.ocanvas 持久化 + 设计变量 + 主题

| 编号 | 任务 | 优先级 | 预估 | 依赖 | 详细描述 |
|------|------|--------|------|------|----------|
| L'1 | .ocanvas 文件格式规范 | P0 | 1d | J' | JSON-based 文件格式定义（JSON Schema），Git-friendly，包含节点树、组件注册表、变量、主题 |
| L'2 | 保存/打开/最近文件管理 | P0 | 2d | L'1 | 文件保存（Cmd+S）、打开（Cmd+O）、最近文件列表 |
| L'3 | 自动保存 + 脏标记 | P1 | 1d | L'2 | 修改后自动保存（debounce），标题栏显示未保存标记 |
| L'4 | VariableDefinition 数据模型 | P0 | 1d | L'1 | 设计变量数据模型（颜色/尺寸/字体），变量面板 UI（CRUD + 分组） |
| L'5 | 属性面板绑定变量 | P1 | 2d | L'4 | 属性面板支持绑定设计变量（而非硬编码值），修改变量 → 所有引用处实时更新 |
| L'6 | CSS Var ↔ Design Var 双向同步 | P1 | 2d | L'4 | CSS custom property 与设计变量双向同步 |
| L'7 | 主题引擎 | P1 | 1d | L'4 | Light/Dark 条件变量 + 主题预览切换 |
| L'8 | 多框架代码生成 | P1 | 2d | 无 | Vue、Svelte 代码生成器（当前仅支持 React） |
| L'9 | CSS Modules 样式方案 | P2 | 1d | 无 | 生成代码支持 CSS Modules 作为样式方案选项 |

**验收标准**：
- [ ] 画布状态可保存为 .ocanvas 文件，重新打开后完全恢复
- [ ] 定义变量后，修改变量值 → 所有引用处实时更新
- [ ] 切换主题 → 画布实时反映 Light/Dark 变化
- [ ] 导出代码中变量映射为 CSS custom properties

---

### Phase M' — CLI + 收尾（~1 周）

> 核心目标：命令行工具 + 项目稳定化

| 编号 | 任务 | 优先级 | 预估 | 依赖 | 详细描述 |
|------|------|--------|------|------|----------|
| M'1 | `ocanvas` CLI 骨架 | P1 | 1d | 无 | 使用 commander.js 构建 CLI 工具，npm global install 可用 |
| M'2 | `ocanvas dev` 命令 | P1 | 1d | G' | 一键启动编辑器 (Vite dev server) + MCP Server |
| M'3 | `ocanvas export` 命令 | P1 | 1d | L'8 | 命令行导出 .ocanvas → React/Vue/Svelte 代码 |
| M'4 | `ocanvas import` 命令 | P2 | 1d | 无 | 命令行导入 .tsx / Figma 剪贴板 JSON → .ocanvas |
| M'5 | Agent 配置文件 | P2 | 1d | G' | JSON 配置文件定义 AI Agent 工作流（工具链、上下文范围等） |
| M'6 | 无头模式 | P2 | 1d | M'2 | Headless 运行模式，用于 CI/Agent 管道，无需浏览器 |
| M'7 | 性能优化 + 稳定化 | P0 | 2d | 全部 | 500 节点 60fps 性能目标、增量代码生成、Sandpack 预初始化、全面回归测试 |

**验收标准**：
- [ ] `npx ocanvas dev` 一键启动完整开发环境
- [ ] `npx ocanvas export ./my-design.ocanvas --framework react` 输出可用代码
- [ ] 500 节点场景下画布保持 60fps

---

## 时间线总览

```
Phase G' (MCP 核心)     ████████████████████  ✅ 已完成
Phase H' (实时渲染)     ░░░░░░░░░░░░░░░      ~1.5 周
Phase I' (画布增强)     ░░░░░░░░░░░░░░░      ~1.5 周
Phase J' (组件系统)     ░░░░░░░░░░░░░░░░░░░░  ~2 周
Phase K' (Cmd+K)        ░░░░░░░░░░░░░░░      ~1.5 周
Phase L' (文件+变量)    ░░░░░░░░░░░░░░░      ~1.5 周
Phase M' (CLI+收尾)     ░░░░░░░░░░           ~1 周
                        ─────────────────────────────
                        总计约 9 周
```

## 技术栈

| 类别 | 技术 | 备注 |
|------|------|------|
| 前端框架 | React 19 + Vite 7 + Tailwind CSS 4 | 已安装 |
| 类型系统 | TypeScript (strict, verbatimModuleSyntax) | 已配置 |
| 布局引擎 | yoga-layout v3.2.1 | 已安装 |
| MCP SDK | @modelcontextprotocol/sdk | 已安装 |
| WebSocket | ws | 已安装 |
| 沙箱渲染 | @codesandbox/sandpack-react | Phase H' 安装 |
| 测试 | Vitest + jsdom | 已配置 |
| CLI | commander.js | Phase M' 安装 |

## 关键技术风险

| 风险 | 影响 | 缓解策略 |
|------|------|----------|
| Sandpack 冷启动慢（2-3 秒） | 首次渲染延迟 | 预初始化 Provider，增量文件替换 |
| 状态冲突（AI + 用户同时编辑） | 数据不一致 | Server 串行队列处理，最后写入者覆盖 |
| 组件覆写路径复杂度 | 嵌套合并算法复杂 | 限制嵌套深度 max=5，参考 Figma 模型 |
| 大量节点代码生成性能 | 生成延迟 | 增量生成：只重新生成变更的组件 |
| MCP SDK 版本演进 | API 变化 | 锁定版本，跟踪 changelog |
