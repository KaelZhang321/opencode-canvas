# Opencode Canvas — 产品优化 PRD v1.0

> 对标产品：[Pencil](https://docs.pencil.dev) — AI-native, developer-first vector design tool
> 撰写日期：2026-02-14
> 当前版本：Sprint 4 complete (~50% MVP)
> 目标：全面复刻 Pencil 核心能力，构建 AI-native 可视化前端编辑器

---

## 一、产品定位对比

| 维度 | Pencil | Opencode Canvas（当前） | 差距 |
|------|--------|------------------------|------|
| 核心理念 | AI-native vector design tool，本地运行，IDE 集成 | AI 辅助前端画布原型 | 缺少 IDE 集成、本地优先架构 |
| 画布引擎 | 无限画布 + Flexbox 布局引擎 | 有限画布，无布局引擎 | 🔴 核心缺口 |
| 组件系统 | 可复用组件 + 实例覆写 + Slot | 仅扁平节点 | 🔴 核心缺口 |
| AI 集成 | MCP Server + Cmd+K + Batch 生成 | 本地 LLM 调用 + AI 面板 | 🟡 架构差异大 |
| 代码同步 | 双向（Design↔Code）+ 多框架 | 单向生成 + marker patch | 🟡 需升级为双向 |
| 数据格式 | .pen (JSON, Git-friendly) | 内存状态，无持久化 | 🔴 核心缺口 |
| 开发工具 | CLI + 无头模式 + Agent 配置 | 无 | 🔴 核心缺口 |
| 设计系统 | 变量引擎 + 主题（Light/Dark） | Design Token 层（基础） | 🟡 需增强 |
| 导入能力 | Figma 导入 + 代码导入 | TSX 解析导入（基础） | 🟡 需增强 |

---

## 二、Pencil 完整功能清单与对标分析

### 2.1 编辑器与画布 (Editor & Canvas)

| # | Pencil 功能 | 描述 | OC 现状 | 差距 | 优先级 |
|---|-------------|------|---------|------|--------|
| EC-1 | 无限画布 | Pan (拖拽平移) + Zoom (缩放) + 小地图 | ❌ 固定尺寸画布 | 🔴 | P0 |
| EC-2 | Flexbox 布局引擎 | 节点间自动排版，direction/align/justify/gap | ❌ 仅绝对定位 | 🔴 | P0 |
| EC-3 | Frame 容器 | 顶层设计容器，定义导出/代码生成边界 | ❌ | 🔴 | P0 |
| EC-4 | Group 分组 | 视觉分组，可嵌套 | ❌ | 🟡 | P1 |
| EC-5 | 矢量图元 | Rect / Ellipse / Line / Polygon / Path | 仅 Rect (div) | 🟡 | P1 |
| EC-6 | 文本引擎 | Auto-grow / Fixed 两种模式，富文本 | 仅 plain text | 🟡 | P1 |
| EC-7 | 图层面板 | 树形层级 + 拖拽排序 + 可见性/锁定 | 扁平列表 + 基础排序 | 🟡 | P1 |
| EC-8 | 属性面板 | 全 CSS 属性编辑 + 布局属性 | 基础属性 + 样式面板 | 🟢 | P2 |
| EC-9 | 对齐/分布工具 | 选中多个元素后对齐/等距分布 | ❌ | 🟡 | P2 |
| EC-10 | 标尺与参考线 | 辅助精确定位 | 仅 snap-to-grid | 🟢 | P2 |

### 2.2 组件系统 (Component System)

| # | Pencil 功能 | 描述 | OC 现状 | 差距 | 优先级 |
|---|-------------|------|---------|------|--------|
| CS-1 | 可复用组件 | `reusable: true` 标记，可创建实例 | ❌ | 🔴 | P0 |
| CS-2 | 组件实例 | 从主组件创建实例，保持同步 | ❌ | 🔴 | P0 |
| CS-3 | 实例覆写 | 覆写实例的文本/样式/子节点，不影响主组件 | ❌ | 🔴 | P0 |
| CS-4 | 组件 Slot | 占位区域，实例可插入自定义内容 | ❌ | 🟡 | P1 |
| CS-5 | 深层覆写路径 | `button/label` 形式的嵌套覆写寻址 | ❌ | 🟡 | P1 |
| CS-6 | 组件库面板 | 浏览/搜索/拖拽放置组件 | ❌ | 🟡 | P1 |

### 2.3 AI 与 MCP 集成 (AI & MCP Integration)

| # | Pencil 功能 | 描述 | OC 现状 | 差距 | 优先级 |
|---|-------------|------|---------|------|--------|
| AI-1 | MCP Server | 本地暴露设计工具 API，IDE/Agent 可调用 | ❌ | 🔴 | P0 |
| AI-2 | batch_design | 批量创建/修改设计元素的 MCP tool | ❌ | 🔴 | P0 |
| AI-3 | get_screenshot | 截图当前画布状态的 MCP tool | ❌ | 🟡 | P1 |
| AI-4 | query_layout | 查询布局信息的 MCP tool | ❌ | 🟡 | P1 |
| AI-5 | Cmd+K 命令面板 | 自然语言输入，直接操作画布 | ❌ | 🔴 | P0 |
| AI-6 | 上下文感知 | AI 读取当前变量/组件/选区作为上下文 | 部分（选区感知） | 🟡 | P1 |
| AI-7 | 批量生成 | 一次 prompt 生成整个页面/多个组件 | 有 Prompt→Page | 🟢 | P2 |

### 2.4 设计 ↔ 代码同步 (Design ↔ Code Sync)

| # | Pencil 功能 | 描述 | OC 现状 | 差距 | 优先级 |
|---|-------------|------|---------|------|--------|
| DC-1 | 多框架代码生成 | React / Next.js / Vue / Svelte | 仅 React TSX 字符串 | 🟡 | P1 |
| DC-2 | 多样式方案 | Tailwind / CSS Modules / Inline | 仅 Tailwind | 🟢 | P2 |
| DC-3 | 代码导入/重建 | 导入 .tsx → 视觉重建为设计稿 | 有 parseSourceToState（基础） | 🟡 | P1 |
| DC-4 | 双向变量同步 | CSS Vars ↔ Pencil Vars 实时同步 | ❌ | 🟡 | P1 |
| DC-5 | Figma 导入 | 复制粘贴 Figma Frame/Token → Pencil | ❌ | 🟡 | P2 |
| DC-6 | 代码预览 | 实时预览生成的代码效果 | 有 iframe preview | 🟢 | 已有 |

### 2.5 数据模型 (.pen 格式)

| # | Pencil 功能 | 描述 | OC 现状 | 差距 | 优先级 |
|---|-------------|------|---------|------|--------|
| DM-1 | .pen 文件格式 | JSON-based，Git-friendly | 仅内存状态 | 🔴 | P0 |
| DM-2 | TypeScript Schema | 强类型设计数据模型 | EditorNode 类型（基础） | 🟡 | P1 |
| DM-3 | 主题引擎 | Light/Dark 条件变量 | Design Token 层（基础） | 🟡 | P1 |
| DM-4 | 项目文件管理 | 打开/保存/最近文件 | ❌ | 🔴 | P0 |

### 2.6 CLI 与开发工具

| # | Pencil 功能 | 描述 | OC 现状 | 差距 | 优先级 |
|---|-------------|------|---------|------|--------|
| DT-1 | CLI 工具 | `pencil` 命令行，启动/管理项目 | ❌ | 🟡 | P1 |
| DT-2 | 无头模式 | Headless 运行，用于 CI/Agent 管道 | ❌ | 🟡 | P2 |
| DT-3 | Agent 配置 | JSON 配置文件，定义 AI Agent 的工作流 | ❌ | 🟡 | P2 |

---

## 三、核心交互设计规格

### 3.1 Cmd+K 命令面板

**Pencil 行为**：全局快捷键 `Cmd+K` 唤出浮层输入框，支持自然语言指令。

**交互流程**：
1. 用户按 `Cmd+K` → 画布中央弹出命令输入框（类 Spotlight 风格）
2. 用户输入自然语言（如"创建一个登录表单"、"把背景改成蓝色"）
3. 系统将指令 + 当前上下文（选区、变量、组件树）发送给 AI
4. AI 返回操作指令 → 系统执行 → 画布实时更新
5. 操作进入 undo 栈，可撤销

**设计要点**：
- 输入框支持历史记录（↑/↓ 翻阅）
- 实时显示"正在思考…"状态
- 结果可预览，确认后应用
- 支持模糊匹配内置命令（如"align left"直接调用对齐工具）

### 3.2 无限画布

**交互设计**：
- **平移**：Space + 拖拽 / 中键拖拽 / 触控板双指滑动
- **缩放**：Cmd + 滚轮 / 触控板捏合 / 快捷键 `Cmd+-`/`Cmd+=`/`Cmd+0`
- **适应视图**：`Cmd+1` 适应全部 / `Cmd+2` 适应选区
- **小地图**：右下角缩略图，显示当前视口位置
- **坐标系**：世界坐标 vs 屏幕坐标转换，所有节点位置使用世界坐标

### 3.3 Design↔Code 工作流

| 工作流 | 方向 | 触发方式 | 描述 |
|--------|------|----------|------|
| Text→Design | 文本 → 画布 | Cmd+K / AI 面板 | 自然语言描述生成设计元素 |
| Design→Code | 画布 → 代码 | 选中 Frame → "Generate Code" | 将设计稿导出为 React/Vue/Svelte 代码 |
| Code→Design | 代码 → 画布 | Import .tsx | 导入现有代码重建为可视化设计 |
| Var Sync | 双向 | 自动 | CSS 变量 ↔ 设计变量实时双向同步 |

### 3.4 组件工作流

1. **创建组件**：选中元素 → 右键 → "Create Component" → 元素变为主组件（绿色边框）
2. **创建实例**：从组件库拖拽 / 复制组件 → 生成实例（紫色菱形标记）
3. **覆写实例**：直接编辑实例属性 → 属性标记为"已覆写"（加粗/不同颜色）
4. **重置覆写**：右键实例属性 → "Reset to Main" → 恢复跟随主组件
5. **更新主组件**：编辑主组件 → 所有未覆写的实例自动同步

---

## 四、技术架构决策

### 4.1 数据模型 (.ocanvas 格式)

选择 JSON-based 文件格式（类比 Pencil 的 .pen），命名为 `.ocanvas`：

```typescript
interface OCanvasFile {
  version: "1.0";
  meta: {
    name: string;
    createdAt: string;
    updatedAt: string;
    canvasSize: { width: number; height: number } | "infinite";
  };
  // 节点树
  nodes: Record<string, OCanvasNode>;
  rootIds: string[];
  // 组件注册表
  components: Record<string, ComponentDefinition>;
  // 设计变量
  variables: Record<string, VariableDefinition>;
  // 主题
  themes: Record<string, ThemeDefinition>;
}

interface OCanvasNode {
  id: string;
  type: "frame" | "group" | "rect" | "ellipse" | "text" | "line" | "path" | "image" | "component" | "instance";
  name: string;
  // 布局
  layout: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    // Flexbox
    display?: "flex" | "block";
    flexDirection?: "row" | "column";
    alignItems?: string;
    justifyContent?: string;
    gap?: number;
    padding?: [number, number, number, number];
  };
  // 样式
  style: Record<string, string | number>;
  // 子节点
  children?: string[];
  // 文本内容
  text?: string;
  // 组件关联
  componentId?: string;        // 实例引用的主组件 ID
  overrides?: Record<string, any>; // 实例覆写
  slots?: Record<string, string[]>; // Slot 内容
  // 元数据
  visible: boolean;
  locked: boolean;
}
```

### 4.2 MCP Server 架构

```
┌───────────────────────────────────┐
│  IDE (VS Code / Cursor / OC CLI)  │
│         MCP Client                │
└───────────┬───────────────────────┘
            │ stdio / SSE
┌───────────▼───────────────────────┐
│      Opencode Canvas MCP Server   │
│                                   │
│  Tools:                           │
│  ├─ batch_design(operations[])    │
│  ├─ get_screenshot(frameId?)      │
│  ├─ query_layout(selector)        │
│  ├─ get_variables()               │
│  ├─ get_components()              │
│  ├─ generate_code(frameId, opts)  │
│  └─ import_code(source, format)   │
│                                   │
│  Resources:                       │
│  ├─ canvas://current-state        │
│  ├─ canvas://selection            │
│  └─ canvas://variables            │
└───────────┬───────────────────────┘
            │ IPC / WebSocket
┌───────────▼───────────────────────┐
│    Opencode Canvas Editor (Web)   │
│    React + Vite + Canvas Engine   │
└───────────────────────────────────┘
```

### 4.3 Flexbox 布局引擎

不使用浏览器原生 Flexbox（避免 DOM 耦合），实现独立的 Flexbox 布局计算引擎：

- 基于 [Yoga](https://github.com/nicklockwood/yoga-layout) 或自研轻量 Flexbox 解算器
- 输入：节点树 + 布局属性 → 输出：每个节点的绝对坐标
- 支持属性：`flexDirection`, `alignItems`, `justifyContent`, `gap`, `padding`, `margin`, `flexGrow`, `flexShrink`, `flexBasis`
- 混合模式：Frame 内 Flexbox 自动布局，Frame 外绝对定位

### 4.4 组件系统

```
ComponentDefinition
├─ id: string
├─ name: string
├─ rootNodeId: string          // 主组件的根节点
├─ defaultOverrides: {}        // 默认属性
└─ slots: SlotDefinition[]     // 可插入区域

Instance (OCanvasNode where type="instance")
├─ componentId → ComponentDefinition.id
├─ overrides: {
│    "label": { text: "Custom" },           // 直接子节点覆写
│    "button/icon": { visible: false }      // 深层路径覆写
│  }
└─ slotContent: {
     "actions": ["node-id-1", "node-id-2"]  // Slot 填充
   }
```

---

## 五、分阶段实施路线图

### Phase G — 画布引擎重构（~2 周）

> 核心目标：从有限画布升级为无限画布 + Flexbox 布局

| 编号 | 任务 | 优先级 | 预估 | 依赖 |
|------|------|--------|------|------|
| G1 | 无限画布 — Pan/Zoom 变换矩阵 | P0 | 3d | 无 |
| G2 | 坐标系统重构 — 世界坐标 ↔ 屏幕坐标 | P0 | 2d | G1 |
| G3 | Frame 容器节点类型 | P0 | 2d | G2 |
| G4 | Flexbox 布局引擎集成（Yoga WASM 或自研） | P0 | 3d | G3 |
| G5 | 布局属性面板（flexDirection/align/justify/gap） | P1 | 2d | G4 |
| G6 | 小地图组件 | P2 | 1d | G1 |
| G7 | 适应视图快捷键（Cmd+1/2/0） | P2 | 0.5d | G1 |

**验收标准**：
- [ ] 画布可无限平移缩放，节点坐标正确
- [ ] Frame 内子节点自动按 Flexbox 排列
- [ ] 拖入/移出 Frame 时布局自动切换（absolute ↔ flex）
- [ ] 现有 80+ 测试不回归

### Phase H — 组件系统（~2 周）

> 核心目标：实现可复用组件 + 实例 + 覆写

| 编号 | 任务 | 优先级 | 预估 | 依赖 |
|------|------|--------|------|------|
| H1 | ComponentDefinition 数据模型 + Store 扩展 | P0 | 2d | G3 |
| H2 | 创建组件（选中 → 转为主组件） | P0 | 1d | H1 |
| H3 | 创建实例（拖拽/复制） | P0 | 2d | H2 |
| H4 | 实例覆写系统（属性级 diff） | P0 | 3d | H3 |
| H5 | 深层覆写路径寻址 | P1 | 2d | H4 |
| H6 | 组件 Slot 机制 | P1 | 2d | H4 |
| H7 | 组件库面板 UI | P1 | 1d | H2 |
| H8 | 主组件编辑 → 实例同步 | P0 | 2d | H4 |

**验收标准**：
- [ ] 可将任意节点树转为组件，生成实例
- [ ] 实例覆写文本/样式后，主组件更新不覆盖已覆写属性
- [ ] 深层路径（如 `card/header/title`）可正确寻址覆写
- [ ] 组件库面板展示所有已注册组件

### Phase I — MCP Server（~2 周）

> 核心目标：暴露 MCP 协议接口，支持 IDE/Agent 外部操控画布

| 编号 | 任务 | 优先级 | 预估 | 依赖 |
|------|------|--------|------|------|
| I1 | MCP Server 骨架（@modelcontextprotocol/sdk） | P0 | 2d | 无 |
| I2 | `batch_design` tool — 批量增删改节点 | P0 | 2d | I1 |
| I3 | `get_screenshot` tool — html2canvas 截图 | P1 | 1d | I1 |
| I4 | `query_layout` tool — 查询节点布局信息 | P1 | 1d | I1 |
| I5 | `get_variables` / `get_components` resource | P1 | 1d | I1 |
| I6 | `generate_code` tool — 按框架/样式生成代码 | P0 | 2d | I1 + DC-1 |
| I7 | `import_code` tool — 导入代码重建设计 | P1 | 1d | I1 |
| I8 | Editor ↔ MCP IPC 通道（WebSocket） | P0 | 2d | I1 |
| I9 | VS Code / Cursor 集成测试 | P1 | 1d | I8 |

**验收标准**：
- [ ] `npx @opencode/canvas-mcp` 可启动 MCP Server
- [ ] Claude/Cursor 通过 MCP 可创建节点、修改样式、获取截图
- [ ] batch_design 支持原子事务（全部成功或全部回滚）

### Phase J — Cmd+K 命令面板 + AI 增强（~1.5 周）

> 核心目标：Cmd+K 自然语言操作画布

| 编号 | 任务 | 优先级 | 预估 | 依赖 |
|------|------|--------|------|------|
| J1 | 命令面板 UI 组件（Spotlight 风格浮层） | P0 | 1d | 无 |
| J2 | 快捷键绑定 Cmd+K | P0 | 0.5d | J1 |
| J3 | 上下文收集器（选区/变量/组件树/画布状态） | P0 | 1d | H1 |
| J4 | 自然语言 → 操作指令 AI 管线 | P0 | 2d | J3 |
| J5 | 操作预览 + 确认/取消 | P1 | 1d | J4 |
| J6 | 内置命令模糊匹配（align/distribute/rename 等） | P1 | 1d | J1 |
| J7 | 命令历史记录 | P2 | 0.5d | J1 |

**验收标准**：
- [ ] Cmd+K 弹出命令面板，输入自然语言可操作画布
- [ ] 操作结果可 undo
- [ ] 识别内置命令（如"align left"直接调用对齐而非走 AI）

### Phase K — 文件格式 + 多框架代码生成（~1.5 周）

> 核心目标：.ocanvas 持久化 + 多框架输出

| 编号 | 任务 | 优先级 | 预估 | 依赖 |
|------|------|--------|------|------|
| K1 | .ocanvas 文件格式规范（JSON Schema） | P0 | 1d | H1 |
| K2 | 保存/打开/最近文件管理 | P0 | 2d | K1 |
| K3 | 自动保存 + 脏标记 | P1 | 1d | K2 |
| K4 | Vue 代码生成器 | P1 | 2d | 无 |
| K5 | Svelte 代码生成器 | P1 | 2d | 无 |
| K6 | CSS Modules 样式方案 | P2 | 1d | 无 |
| K7 | Figma 剪贴板导入（JSON → OCanvasNode） | P2 | 2d | K1 |

**验收标准**：
- [ ] 画布状态可保存为 .ocanvas 文件，重新打开后完全恢复
- [ ] 同一设计可导出 React、Vue、Svelte 三种代码
- [ ] .ocanvas 文件 Git diff 可读

### Phase L — 变量系统增强 + 主题（~1 周）

> 核心目标：完整的设计变量系统 + 双向同步

| 编号 | 任务 | 优先级 | 预估 | 依赖 |
|------|------|--------|------|------|
| L1 | VariableDefinition 数据模型（颜色/尺寸/字体） | P0 | 1d | K1 |
| L2 | 变量面板 UI（CRUD + 分组） | P1 | 1d | L1 |
| L3 | 属性面板绑定变量（而非硬编码值） | P1 | 2d | L1 |
| L4 | CSS Var ↔ Design Var 双向同步 | P1 | 2d | L1 |
| L5 | 主题引擎（Light/Dark 条件变量） | P1 | 1d | L1 |
| L6 | 主题预览切换（画布实时切换 Light/Dark） | P2 | 1d | L5 |

**验收标准**：
- [ ] 定义变量后，修改变量值 → 所有引用处实时更新
- [ ] 切换主题 → 画布实时反映 Light/Dark 变化
- [ ] 导出代码中变量映射为 CSS custom properties

### Phase M — CLI 与开发工具（~1 周）

| 编号 | 任务 | 优先级 | 预估 | 依赖 |
|------|------|--------|------|------|
| M1 | `ocanvas` CLI 骨架（commander.js） | P1 | 1d | 无 |
| M2 | `ocanvas dev` — 启动编辑器 + MCP Server | P1 | 1d | I1 |
| M3 | `ocanvas export` — 命令行导出代码 | P1 | 1d | K4/K5 |
| M4 | `ocanvas import` — 命令行导入代码/Figma | P2 | 1d | K7 |
| M5 | Agent 配置文件格式 | P2 | 1d | I1 |

---

## 六、优先级排序（推荐执行顺序）

```
第 1 周:  G1 + G2 + G3         画布引擎基础（无限画布 + Frame）
第 2 周:  G4 + G5              Flexbox 布局引擎
第 3 周:  H1 + H2 + H3 + H4   组件系统核心
第 4 周:  H5 + H6 + H7 + H8   组件系统完善
第 5 周:  I1 + I2 + I8         MCP Server 核心
第 6 周:  I3-I7 + I9           MCP 工具完善 + 集成测试
第 7 周:  J1-J5                Cmd+K 命令面板
第 8 周:  K1 + K2 + K4 + K5   文件格式 + 多框架生成
第 9 周:  L1-L5                变量系统 + 主题
第 10 周: M1-M3 + 收尾         CLI + 稳定化
```

---

## 七、关键技术风险与缓解

| # | 风险 | 影响 | 缓解策略 |
|---|------|------|----------|
| R1 | Flexbox 引擎复杂度 | 自研可能耗时远超预期 | 优先评估 Yoga WASM 集成可行性，仅在不可行时自研 |
| R2 | 组件覆写系统的深层路径 | 嵌套组件的覆写合并算法复杂 | 参考 Figma/Pencil 的覆写模型，限制嵌套深度（建议 max=5） |
| R3 | MCP 协议兼容性 | MCP 规范仍在演进 | 使用官方 @modelcontextprotocol/sdk，跟踪 spec 变化 |
| R4 | 无限画布性能 | 大量节点时渲染性能下降 | 已有虚拟化基础（F3），扩展为视口裁剪 + 层级 LOD |
| R5 | 多框架代码质量 | 不同框架的惯用写法差异大 | 每个框架独立的 CodeGen 模板，不做通用抽象 |
| R6 | 现有架构兼容性 | 无限画布需重构坐标系 | G2 优先完成坐标系统，所有后续功能基于新坐标系开发 |

---

## 八、成功指标

| 指标 | 目标 | 测量方式 |
|------|------|----------|
| Pencil 功能覆盖率 | ≥ 85% 核心功能 | 本文档 功能清单打勾比 |
| MCP 工具可用率 | 6/6 核心 tools 可用 | Claude/Cursor 集成测试通过 |
| 代码生成框架数 | ≥ 3（React/Vue/Svelte） | 单元测试覆盖 |
| .ocanvas 文件可靠性 | 保存→打开 零数据丢失 | 往返测试（save→load→compare） |
| 组件系统 | 支持 3 层嵌套覆写 | 集成测试 |
| 画布性能 | 500 节点 60fps | Lighthouse / 性能 trace |
| 测试覆盖率 | ≥ 70% 行覆盖 | Vitest coverage report |

---

## 九、与现有 editProject.md 的关系

本 PRD 是 editProject.md 阶段 A-F 之后的**全新规划**，对应阶段 G-M。

- **阶段 A-F**（已完成）：基础编辑器、代码同步、AI 集成、测试稳定化
- **阶段 G-M**（本 PRD）：无限画布、组件系统、MCP、Cmd+K、文件格式、CLI

已完成的 Sprint 1-4 + 阶段 A-F 的所有成果作为本 PRD 的基础设施。

---

## 附录 A：Pencil 功能来源映射

| 功能域 | docs.pencil.dev 页面 | 本 PRD 对应编号 |
|--------|---------------------|----------------|
| Editor Basics | /docs/editor | EC-1 ~ EC-10 |
| Components | /docs/components | CS-1 ~ CS-6 |
| MCP Integration | /docs/mcp | AI-1 ~ AI-7 |
| Code Generation | /docs/code | DC-1 ~ DC-6 |
| Data Format | /docs/format | DM-1 ~ DM-4 |
| CLI | /docs/cli | DT-1 ~ DT-3 |
| Variables & Themes | /docs/variables | L1 ~ L6 |

## 附录 B：矢量图元扩展方案（EC-5）

| 图元 | OCanvasNode.type | 特有属性 |
|------|------------------|----------|
| 矩形 | `rect` | borderRadius |
| 椭圆 | `ellipse` | 无额外属性 |
| 线段 | `line` | startPoint, endPoint, strokeWidth |
| 多边形 | `polygon` | points[], fillRule |
| 路径 | `path` | d (SVG path data), fillRule |
| 图片 | `image` | src, objectFit |
| 文本 | `text` | content, fontSize, fontWeight, textAlign, autoGrow |
