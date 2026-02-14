# Opencode Canvas — 产品架构设计 v2.0

> **核心愿景**：Claude Code 终端对话 → MCP Server → 浏览器实时渲染真实 React 组件 → 画布上可视化拖拽调整 + 对话修改
> 撰写日期：2026-02-14
> 基于：PRD v1.0 + 用户愿景修正
> 当前状态：Phase G1/G2 完成（无限画布），94 测试通过

---

## 一、产品重定位

### 1.1 与 PRD v1.0 的核心差异

PRD v1.0 将 Opencode Canvas 定位为**独立的设计工具**（类 Figma/Pencil），MCP Server 排在 Phase I（第 5-6 周）。

**用户的实际愿景完全不同**：

| 维度 | PRD v1.0（旧） | v2.0（新） |
|------|---------------|-----------|
| **入口** | 浏览器中独立编辑器 | Claude Code 终端对话 |
| **AI 角色** | 辅助面板（浏览器内调 LLM API） | 核心驱动（MCP Server 是管道） |
| **渲染** | 画布节点 → HTML 字符串 → iframe | 双模式：真实 React 组件渲染 + 画布节点模式 |
| **编辑方式** | 鼠标拖拽为主 | 对话修改为主 + 画布拖拽为辅 |
| **MCP Server** | Phase I，可选功能 | **核心基础设施**，第一优先级 |
| **实时性** | 无（手动刷新 iframe） | WebSocket 实时推送 |

### 1.2 用户工作流

```
用户在 Claude Code 终端输入: "创建一个登录页面，包含邮箱和密码输入框"
    │
    ▼
Claude Code → 调用 MCP Tool: batch_design({ operations: [...] })
    │
    ▼
MCP Server 接收操作 → 更新内部状态 → WebSocket 推送到浏览器
    │
    ▼
浏览器接收更新 → 双模式渲染:
  ├─ 模式A（默认）: Sandpack 沙箱中渲染真实 React 组件
  └─ 模式B（布局）: 画布节点模式，可视化拖拽调整位置/尺寸
    │
    ▼
用户在画布上拖拽调整 → WebSocket 回传变更 → MCP Resource 更新
    │
    ▼
Claude Code 读取 canvas://state → 感知用户调整 → 继续对话优化
```

---

## 二、系统架构

### 2.1 整体架构图

```
┌──────────────────────────────────────────────────────────────────┐
│                    Claude Code / opencode                        │
│                  （用户终端对话入口）                               │
└────────────────────────┬─────────────────────────────────────────┘
                         │ stdio (MCP 协议)
┌────────────────────────▼─────────────────────────────────────────┐
│                   MCP Server (Node.js)                           │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────────┐│
│  │ MCP Tools   │  │ MCP Resources│  │ State Manager            ││
│  │             │  │              │  │                          ││
│  │ batch_design│  │ canvas://    │  │ EditorState (in-memory)  ││
│  │ screenshot  │  │   state      │  │ ComponentRegistry        ││
│  │ query_layout│  │   selection  │  │ History (undo/redo)      ││
│  │ gen_code    │  │   variables  │  │                          ││
│  │ import_code │  │   components │  │ applyCommand() 纯函数     ││
│  └──────┬──────┘  └──────────────┘  └────────────┬─────────────┘│
│         │                                         │              │
│         └─────────────┬───────────────────────────┘              │
│                       │                                          │
│              ┌────────▼────────┐                                 │
│              │ WebSocket Server│ (ws, 同进程)                     │
│              │ port: 3100      │                                 │
│              └────────┬────────┘                                 │
└───────────────────────┼──────────────────────────────────────────┘
                        │ ws://localhost:3100
┌───────────────────────▼──────────────────────────────────────────┐
│                Browser (Vite SPA)                                │
│                                                                  │
│  ┌───────────────────┐  ┌───────────────────────────────────────┐│
│  │ WebSocket Client  │  │ 渲染引擎（双模式）                      ││
│  │                   │  │                                       ││
│  │ connect()         │  │ 模式A: Sandpack Preview               ││
│  │ onStateUpdate()   │  │   → 真实 React 组件在沙箱中运行         ││
│  │ sendUserEdit()    │  │   → Tailwind / CSS 正常工作            ││
│  │                   │  │                                       ││
│  └───────┬───────────┘  │ 模式B: Canvas Node View               ││
│          │              │   → 抽象节点在画布上渲染                  ││
│          │              │   → 支持拖拽/缩放/选择                   ││
│          │              │   → 无限画布 + Flexbox 布局              ││
│          │              └───────────────────────────────────────┘│
│          │                                                       │
│  ┌───────▼───────────────────────────────────────────────────────┐│
│  │ EditorStore (React Context + applyCommand)                   ││
│  │ → 接收 WS 状态更新 → 驱动渲染                                  ││
│  │ → 捕获用户编辑 → 通过 WS 回传                                   ││
│  └───────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 通信协议

#### Claude Code ↔ MCP Server (stdio)

标准 MCP 协议，通过 stdio 传输。Claude Code 作为 MCP Client，MCP Server 通过 `@modelcontextprotocol/sdk` 实现。

```jsonc
// Claude Code → MCP Server (Tool Call)
{
  "method": "tools/call",
  "params": {
    "name": "batch_design",
    "arguments": {
      "operations": [
        { "op": "add", "node": { "type": "frame", "name": "LoginPage", ... } },
        { "op": "add", "node": { "type": "text", "name": "Title", "text": "Welcome", ... } }
      ]
    }
  }
}

// MCP Server → Claude Code (Resource Read)
{
  "method": "resources/read",
  "params": { "uri": "canvas://state" }
}
// Response: 当前画布完整状态的 JSON
```

#### MCP Server ↔ Browser (WebSocket)

自定义协议，双向通信。

```typescript
// === Server → Browser 消息 ===

interface WSMessage {
  type: string
  payload: unknown
  timestamp: number
}

// 完整状态同步（连接建立时 / 大批量操作后）
{ type: "state:full", payload: EditorState }

// 增量状态更新（单个操作）
{ type: "state:patch", payload: { command: EditorCommand, result: EditorState } }

// 代码更新（Sandpack 模式）
{ type: "code:update", payload: { files: Record<string, string> } }

// 截图请求（MCP get_screenshot tool 触发）
{ type: "request:screenshot", payload: { requestId: string, frameId?: string } }

// === Browser → Server 消息 ===

// 用户拖拽/缩放节点
{ type: "user:edit", payload: { command: EditorCommand } }

// 截图响应
{ type: "response:screenshot", payload: { requestId: string, dataUrl: string } }

// 用户选择变更
{ type: "user:selection", payload: { selectedIds: string[] } }
```

### 2.3 状态管理架构

**核心原则：MCP Server 是状态权威来源（Single Source of Truth）**

```
状态流向:

  Claude Code 对话                    用户画布拖拽
       │                                  │
       ▼                                  ▼
  MCP Tool Call                    WS user:edit 消息
       │                                  │
       └──────────┬───────────────────────┘
                  ▼
        MCP Server State Manager
        ┌─────────────────────┐
        │ applyCommand(state, │
        │   command)          │
        │ → newState          │
        │ → push to history   │
        │ → broadcast via WS  │
        └─────────────────────┘
                  │
                  ▼
          Browser receives update
          → EditorStore.setState()
          → React re-render
```

**关键决策**：

1. **`applyCommand` 纯函数共享**：浏览器和 MCP Server 使用同一个 `applyCommand` 函数（通过 npm workspace 或直接复制）。这保证状态变换逻辑一致。

2. **乐观更新**：用户在画布上拖拽时，浏览器立即应用变更（乐观更新），同时通过 WS 发送到 Server。Server 确认后广播最终状态。如果冲突，Server 状态覆盖浏览器状态。

3. **Undo/Redo 在 Server 端**：历史栈维护在 MCP Server 中，确保 Claude Code 的操作和用户的画布操作共享同一个 undo 栈。浏览器可以发送 `undo`/`redo` 命令到 Server。

---

## 三、双模式渲染

### 3.1 模式 A：真实 React 组件渲染（默认模式）

**目的**：展示 AI 生成的 React 代码的真实运行效果。

**技术方案：Sandpack**

使用 CodeSandbox 的 Sandpack 作为沙箱渲染引擎。它在 iframe 中运行完整的 bundler，支持 JSX/TSX、Tailwind CSS、npm 依赖。

```tsx
// Browser: LivePreview.tsx
import { SandpackProvider, SandpackPreview } from "@codesandbox/sandpack-react"

interface LivePreviewProps {
  files: Record<string, string>  // 从 WS 接收的文件内容
  activeFile?: string
}

export function LivePreview({ files, activeFile }: LivePreviewProps) {
  return (
    <SandpackProvider
      template="react-ts"
      files={files}
      options={{
        activeFile: activeFile ?? "/App.tsx",
        externalResources: ["https://cdn.tailwindcss.com"],
        autorun: true,
        autoReload: true,
      }}
    >
      <SandpackPreview
        showOpenInCodeSandbox={false}
        showRefreshButton={true}
        style={{ height: "100%", width: "100%" }}
      />
    </SandpackProvider>
  )
}
```

**代码生成流程**：
1. MCP Tool `batch_design` 收到操作 → 更新 EditorState
2. State Manager 调用 `generateReactCode(state)` → 生成 `App.tsx` + 组件文件
3. WebSocket 推送 `{ type: "code:update", payload: { files: { "/App.tsx": "...", ... } } }`
4. 浏览器 Sandpack 接收新文件 → 自动热重载预览

**何时使用**：
- 用户通过对话让 AI 生成页面/组件时
- 需要看到真实的交互效果（按钮点击、表单验证等）
- 需要验证 Tailwind 样式是否正确

### 3.2 模式 B：画布节点模式（布局模式）

**目的**：可视化地拖拽调整布局结构，类似 Figma 的设计视图。

**技术方案：现有 CanvasView（已完成）**

沿用已实现的无限画布引擎（CSS transform pan/zoom），扩展为支持：
- Frame 容器内 Flexbox 自动布局（Yoga engine）
- 节点拖入/拖出 Frame
- 多选 + 对齐/分布工具

**何时使用**：
- 用户需要调整页面整体布局
- 拖拽元素改变层级关系
- 调整 Flexbox 属性（gap、direction、align 等）

### 3.3 模式切换

```
┌──────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────────────┐  │
│  │ 🖥 Preview   │  │ 📐 Layout            │  │  ← 顶部 Tab 切换
│  │  (模式A)     │  │  (模式B)             │  │
│  └──────────────┘  └──────────────────────┘  │
│                                              │
│  ┌──────────────────────────────────────────┐│
│  │                                          ││
│  │   当前模式的渲染内容                       ││
│  │                                          ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

两个模式共享同一个 EditorState，切换时无需重新加载数据：
- 模式 A（Preview）：从 EditorState → 生成代码 → Sandpack 渲染
- 模式 B（Layout）：从 EditorState → 直接在画布上渲染节点

---

## 四、MCP Server 详细设计

### 4.1 项目结构

```
opencode-canvas/
├── src/                          # 浏览器端 (Vite SPA)
│   ├── core/
│   │   ├── editor-store/         # 共享: types.ts, commands
│   │   ├── canvas-renderer/      # 模式B: 画布渲染
│   │   ├── code-sync/            # 代码生成
│   │   └── preview-runtime/      # 模式A: Sandpack 集成
│   ├── features/
│   └── App.tsx
│
├── server/                       # MCP Server (Node.js)
│   ├── index.ts                  # 入口: stdio transport + WS server
│   ├── state-manager.ts          # 状态管理 (applyCommand + history)
│   ├── ws-bridge.ts              # WebSocket 桥接
│   ├── tools/                    # MCP Tools
│   │   ├── batch-design.ts
│   │   ├── get-screenshot.ts
│   │   ├── query-layout.ts
│   │   ├── generate-code.ts
│   │   └── import-code.ts
│   ├── resources/                # MCP Resources
│   │   ├── canvas-state.ts
│   │   ├── canvas-selection.ts
│   │   └── canvas-variables.ts
│   └── codegen/                  # 代码生成（Server 端）
│       ├── react-generator.ts
│       └── component-renderer.ts
│
├── shared/                       # 浏览器 + Server 共享代码
│   ├── types.ts                  # EditorNode, EditorState, etc.
│   ├── commands.ts               # EditorCommand 类型 + applyCommand 纯函数
│   └── protocol.ts               # WebSocket 消息类型定义
│
├── package.json
├── tsconfig.json
├── tsconfig.server.json          # Server 端 TS 配置
└── vite.config.ts
```

### 4.2 MCP Tools 定义

```typescript
// server/tools/batch-design.ts
import { z } from "zod"

export const batchDesignSchema = z.object({
  operations: z.array(z.discriminatedUnion("op", [
    z.object({
      op: z.literal("add"),
      node: z.object({
        type: z.enum(["frame", "text", "button", "image", "card", "form"]),
        name: z.string(),
        x: z.number().default(0),
        y: z.number().default(0),
        width: z.number().default(200),
        height: z.number().default(100),
        text: z.string().optional(),
        className: z.string().optional(),
        style: z.record(z.string()).optional(),
        parentId: z.string().optional(),
      }),
    }),
    z.object({
      op: z.literal("update"),
      nodeId: z.string(),
      changes: z.record(z.unknown()),
    }),
    z.object({
      op: z.literal("delete"),
      nodeId: z.string(),
    }),
    z.object({
      op: z.literal("move"),
      nodeId: z.string(),
      x: z.number(),
      y: z.number(),
    }),
    z.object({
      op: z.literal("resize"),
      nodeId: z.string(),
      width: z.number(),
      height: z.number(),
    }),
    z.object({
      op: z.literal("reparent"),
      nodeId: z.string(),
      newParentId: z.string().nullable(),
    }),
  ])),
  // 事务语义：全部成功或全部回滚
  atomic: z.boolean().default(true),
})
```

### 4.3 MCP Tools 完整清单

| Tool | 描述 | 输入 | 输出 | 优先级 |
|------|------|------|------|--------|
| `batch_design` | 批量增删改节点 | operations[] + atomic | 操作结果摘要 | P0 |
| `get_screenshot` | 截取画布/组件截图 | frameId?, format? | base64 data URL | P1 |
| `query_layout` | 查询节点布局信息 | selector (id/name/type) | 节点位置/尺寸/层级 | P1 |
| `generate_code` | 生成指定框架代码 | frameId, framework, style | 代码字符串 | P0 |
| `import_code` | 导入代码重建画布 | source, format | 导入结果 | P1 |
| `set_variables` | 设置设计变量 | variables[] | 更新结果 | P2 |
| `get_components` | 获取组件注册表 | filter? | 组件列表 | P2 |

### 4.4 MCP Resources 完整清单

| Resource URI | 描述 | 返回内容 |
|-------------|------|----------|
| `canvas://state` | 完整画布状态 | EditorState JSON |
| `canvas://selection` | 当前选中节点 | 选中节点详细信息 |
| `canvas://variables` | 设计变量 | 变量定义列表 |
| `canvas://components` | 组件注册表 | 组件定义列表 |
| `canvas://tree` | 节点树概览 | 简化的层级结构（name + type） |

### 4.5 MCP Server 入口实现概要

```typescript
// server/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { WebSocketServer } from "ws"
import { StateManager } from "./state-manager.js"
import { WSBridge } from "./ws-bridge.js"

// 1. 共享状态管理器
const stateManager = new StateManager()

// 2. WebSocket Server (for Browser)
const WS_PORT = 3100
const wss = new WebSocketServer({ port: WS_PORT })
const wsBridge = new WSBridge(wss, stateManager)

// 3. MCP Server (for Claude Code)
const mcpServer = new McpServer({
  name: "opencode-canvas",
  version: "1.0.0",
})

// 4. 注册 Tools
mcpServer.registerTool("batch_design", {
  title: "Batch Design Operations",
  description: "Create, update, delete, move, or resize design nodes on the canvas.",
  inputSchema: batchDesignSchema,
}, async (args) => {
  const result = stateManager.applyBatch(args.operations, args.atomic)
  wsBridge.broadcastStateUpdate(result.state, result.commands)
  return { content: [{ type: "text", text: result.summary }] }
})

// 5. 注册 Resources
mcpServer.resource("canvas-state", "canvas://state", async () => ({
  contents: [{
    uri: "canvas://state",
    mimeType: "application/json",
    text: JSON.stringify(stateManager.getState()),
  }],
}))

// 6. 启动 stdio transport
const transport = new StdioServerTransport()
await mcpServer.connect(transport)

console.error(`[opencode-canvas] MCP Server running (stdio)`)
console.error(`[opencode-canvas] WebSocket bridge on ws://localhost:${WS_PORT}`)
```

---

## 五、实施路线图（重新排序）

### 总览

```
原 PRD v1.0 顺序:  G(画布) → H(组件) → I(MCP) → J(Cmd+K) → K(文件) → L(变量) → M(CLI)
v2.0 新顺序:       G'(MCP核心) → H'(实时渲染) → I'(画布增强) → J'(组件) → K'(Cmd+K) → L'(文件+变量) → M'(CLI)
```

### Phase G' — MCP Server 核心 + WebSocket 桥接（~2 周）

> **核心目标**：建立 Claude Code → MCP Server → 浏览器的实时管道

| 编号 | 任务 | 优先级 | 预估 | 依赖 |
|------|------|--------|------|------|
| G'1 | 项目结构重组：创建 `server/`、`shared/`，提取共享类型 | P0 | 1d | 无 |
| G'2 | MCP Server 骨架：`@modelcontextprotocol/sdk` + stdio transport | P0 | 1d | G'1 |
| G'3 | StateManager：基于现有 `applyCommand` 的服务端状态管理 | P0 | 1.5d | G'1 |
| G'4 | WebSocket Bridge：`ws` 库，双向消息协议，连接管理 | P0 | 1.5d | G'3 |
| G'5 | `batch_design` tool：完整的增删改操作 + 原子事务 | P0 | 2d | G'3 |
| G'6 | `canvas://state` + `canvas://selection` resources | P0 | 1d | G'3 |
| G'7 | 浏览器端 WS Client：连接、接收状态、发送编辑 | P0 | 1.5d | G'4 |
| G'8 | 集成测试：Claude Code → batch_design → 浏览器显示 | P0 | 1d | G'5+G'7 |
| G'9 | `query_layout` + `generate_code` tools | P1 | 1.5d | G'5 |

**验收标准**：
- [ ] `npx tsx server/index.ts` 启动 MCP Server + WS Bridge
- [ ] Claude Code 中配置 MCP Server 后，调用 `batch_design` 可在浏览器中看到节点出现
- [ ] 浏览器拖拽节点 → Server 状态更新 → Claude Code 通过 `canvas://state` 可读取最新位置
- [ ] undo/redo 在 Server 端正常工作

### Phase H' — 真实组件渲染（~1.5 周）

> **核心目标**：Sandpack 沙箱渲染 AI 生成的 React 代码

| 编号 | 任务 | 优先级 | 预估 | 依赖 |
|------|------|--------|------|------|
| H'1 | 安装 Sandpack，创建 LivePreview 组件 | P0 | 1d | 无 |
| H'2 | 代码生成器增强：EditorState → 完整的 React 组件文件 | P0 | 2d | 无 |
| H'3 | WS `code:update` 消息处理 → Sandpack 热重载 | P0 | 1d | G'7 + H'1 |
| H'4 | 双模式 UI：Preview / Layout 标签切换 | P0 | 1d | H'1 |
| H'5 | Vite proxy 配置 (开发环境 WS 代理) | P1 | 0.5d | G'4 |
| H'6 | 截图工具：`get_screenshot` 通过 WS 请求浏览器截图 | P1 | 1d | G'7 |

**验收标准**：
- [ ] Claude Code 对话生成的 React 代码在 Sandpack 中实时渲染
- [ ] Preview 模式下可看到真实的按钮交互、Tailwind 样式
- [ ] Layout 模式下可拖拽节点
- [ ] 两种模式无缝切换，状态不丢失

### Phase I' — 画布引擎增强（~1.5 周）

> **核心目标**：完善画布交互能力

| 编号 | 任务 | 优先级 | 预估 | 依赖 |
|------|------|--------|------|------|
| I'1 | Frame 容器子节点渲染（原 G3） | P0 | 2d | 已有基础 |
| I'2 | Yoga Flexbox 布局引擎集成（原 G4） | P0 | 2d | I'1 |
| I'3 | 布局属性面板（原 G5） | P1 | 1.5d | I'2 |
| I'4 | 适应视图快捷键 Cmd+1/2/0（原 G7） | P2 | 0.5d | 已有基础 |
| I'5 | 小地图（原 G6） | P2 | 1d | 已有基础 |

**验收标准**：
- [ ] Frame 内子节点按 Flexbox 自动排列
- [ ] 拖入/移出 Frame 时布局正确切换
- [ ] 布局属性面板可调整 direction/align/justify/gap

### Phase J' — 组件系统（~2 周）

> 沿用 PRD v1.0 Phase H 的设计，不变

| 编号 | 对应旧编号 | 任务 | 优先级 | 预估 |
|------|-----------|------|--------|------|
| J'1 | H1 | ComponentDefinition 数据模型 + Store 扩展 | P0 | 2d |
| J'2 | H2 | 创建组件（选中 → 转为主组件） | P0 | 1d |
| J'3 | H3 | 创建实例（拖拽/复制） | P0 | 2d |
| J'4 | H4 | 实例覆写系统（属性级 diff） | P0 | 3d |
| J'5 | H5-H8 | 深层覆写 + Slot + 组件库 + 同步 | P1 | 4d |

### Phase K' — Cmd+K + AI 增强（~1.5 周）

> 沿用 PRD v1.0 Phase J，但 AI 管道改为通过 MCP

| 编号 | 任务 | 优先级 | 预估 |
|------|------|--------|------|
| K'1 | Cmd+K 命令面板 UI (Spotlight 风格) | P0 | 1d |
| K'2 | 上下文收集器（选区/变量/组件树） | P0 | 1d |
| K'3 | 命令 → MCP Tool 调用（而非直接调 LLM） | P0 | 2d |
| K'4 | 操作预览 + 确认/取消 | P1 | 1d |
| K'5 | 内置命令模糊匹配 | P1 | 1d |

### Phase L' — 文件格式 + 变量系统（~1.5 周）

> 合并 PRD v1.0 Phase K + L

### Phase M' — CLI + 收尾（~1 周）

> 沿用 PRD v1.0 Phase M

---

## 六、优先级执行时间线

```
第 1 周:  G'1-G'4   MCP Server 骨架 + WS 桥接 + 状态管理
第 2 周:  G'5-G'9   MCP Tools + 浏览器 WS Client + 集成测试
第 3 周:  H'1-H'4   Sandpack 渲染 + 双模式切换
第 4 周:  H'5-H'6 + I'1-I'2   Vite 配置 + Frame + Yoga
第 5 周:  I'3-I'5 + J'1-J'2   布局面板 + 组件系统开始
第 6 周:  J'3-J'5              组件系统完善
第 7 周:  K'1-K'5              Cmd+K 命令面板
第 8 周:  L'                   文件格式 + 变量
第 9 周:  M' + 收尾             CLI + 稳定化
```

---

## 七、新增依赖

| 包名 | 用途 | 安装位置 |
|------|------|----------|
| `@modelcontextprotocol/sdk` | MCP Server SDK | server/ |
| `zod` | Tool 输入 schema 定义 | server/ |
| `ws` | WebSocket server | server/ |
| `@codesandbox/sandpack-react` | 沙箱 React 渲染 | 浏览器 |
| `tsx` | 运行 Server 端 TypeScript | dev dependency |

已有依赖（继续使用）：
- `yoga-layout` v3.2.1 — Flexbox 计算
- `react` 19, `vite` 7, `tailwindcss` 4 — 前端基础

---

## 八、技术风险与缓解

| # | 风险 | 影响 | 缓解策略 |
|---|------|------|----------|
| R1 | Sandpack 冷启动慢 | 首次渲染延迟 2-3 秒 | 预初始化 Sandpack Provider，代码更新时只替换文件 |
| R2 | stdio MCP + WS 同进程并发 | 消息阻塞 | Node.js 事件循环天然异步，stdio 和 WS 不互相阻塞 |
| R3 | 状态冲突（Claude 和用户同时编辑） | 数据不一致 | Server 串行处理所有操作（队列），最后写入者覆盖 |
| R4 | Sandpack iframe 与画布的交互 | 无法拖拽 Preview 中的元素 | Preview 只读；Layout 模式负责拖拽。切换模式而非在 Preview 中编辑 |
| R5 | MCP SDK 版本演进 | API 变化 | 锁定 SDK 版本，跟踪 changelog |
| R6 | 大量节点时代码生成性能 | 生成延迟 | 增量生成：只重新生成变更的组件 |

---

## 九、与 PRD v1.0 的映射关系

| PRD v1.0 Phase | v2.0 Phase | 状态 |
|---------------|-----------|------|
| G1/G2 无限画布 | — | ✅ 已完成 |
| G3 Frame 容器 | I'1 | 待实施 |
| G4 Yoga 布局 | I'2 | 待实施 |
| G5 布局面板 | I'3 | 待实施 |
| G6 小地图 | I'5 | 待实施 |
| G7 适应视图 | I'4 | 待实施 |
| H1-H8 组件系统 | J'1-J'5 | 待实施 |
| **I1-I9 MCP Server** | **G'1-G'9** | **⬆️ 提升至最高优先级** |
| J1-J7 Cmd+K | K'1-K'5 | 待实施 |
| K1-K7 文件格式 | L' | 待实施 |
| L1-L6 变量系统 | L' | 待实施 |
| M1-M5 CLI | M' | 待实施 |

**新增（PRD v1.0 未涵盖）**：
- G'4 WebSocket Bridge — 核心新增
- G'7 浏览器端 WS Client — 核心新增
- H'1-H'4 Sandpack 实时渲染 — 核心新增
- H'5 Vite proxy — 核心新增

---

## 十、成功指标（更新）

| 指标 | 目标 | 测量方式 |
|------|------|----------|
| 端到端延迟 | Claude Code 对话 → 浏览器渲染 < 2 秒 | 计时器 |
| MCP Tool 可用率 | batch_design + generate_code + query_layout | Claude Code 集成测试 |
| 双模式渲染 | Preview + Layout 无缝切换 | 手动测试 |
| 双向同步 | 画布编辑 → MCP Resource 可读 | 自动化测试 |
| Sandpack 渲染 | 支持 Tailwind + 常见 React 模式 | 渲染测试集 |
| 现有测试 | 不回归 (≥94 tests passing) | CI |

---

## 附录 A：Claude Code MCP 配置示例

用户在 Claude Code 的 MCP 配置中添加 Opencode Canvas：

```jsonc
// ~/.claude/mcp_servers.json
{
  "opencode-canvas": {
    "command": "npx",
    "args": ["tsx", "/path/to/opencode-canvas/server/index.ts"],
    "env": {}
  }
}
```

配置后，Claude Code 对话中即可使用：
- "帮我创建一个登录页面" → Claude 调用 `batch_design`
- "把标题改成蓝色" → Claude 调用 `batch_design` (update)
- "截图看看效果" → Claude 调用 `get_screenshot`
- "帮我看看当前画布上有什么" → Claude 读取 `canvas://state`

## 附录 B：开发运行方式

```bash
# 终端 1: 启动浏览器 (Vite dev server)
npm run dev
# → http://localhost:5173

# 终端 2: 由 Claude Code 自动管理
# Claude Code 启动时自动运行 MCP Server (stdio)
# MCP Server 内部启动 WS Bridge (ws://localhost:3100)

# Vite 配置代理:
# /ws → ws://localhost:3100 (开发环境无需跨域)
```
