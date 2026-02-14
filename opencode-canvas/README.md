# Opencode Canvas (P1 MVP+)

An AI-assisted frontend canvas prototype with:

- visual node editing (layers/canvas/inspector)
- undo/redo command history
- generated code preview from canvas state
- marker-based patch apply to target TSX source

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS v4

## Run

```bash
npm install
npm run dev
```

## Build & Lint

```bash
npm run build
npm run lint
npm run test
```

## Implemented Features

- Command system: `select/move/update/add/remove`
- History: `undo/redo`
- Inspector fields: `text/className/x/y/width/height`
- Real drag move on canvas
- Baseline snapshot + rollback
- Patch panel: apply marker patch + export patched source

P1 additions:

- Multi-select in canvas and layers (Cmd/Ctrl/Shift additive select)
- Batch inspector updates for selected nodes
- Keyboard shortcuts for select/delete/undo/redo/nudge
- Marker hash validation with optional force patch

P2 additions:

- Patch marker structure validation (single START/END, ordering checks)
- Marker hash conflict detection with explicit reason + force override
- Store-level node/patch sanitization constraints
- Unit tests for `code-sync` marker patch flow (Vitest)

Sprint3 additions:

- AI refactor panel with prompt history and proposal generation
- Proposal preview + apply + revert last AI apply
- Proposal applies to current selection with existing rollback chain

Sprint4 additions:

- State validation summary in status bar (`errors` / `warnings`)
- Store history cap (`HISTORY_LIMIT`) to avoid unbounded memory growth
- Expanded tests for sync-state validation

D3-D6 additions:

- D3 `Code -> Canvas` parsing via `parseSourceToState()` from TSX source
- D4 semantic diff summary (`added/removed/moved/resized/text/style`)
- D5 iframe preview runtime panel using generated sandbox document
- D6 design token layer (`TokenTheme` + `TokenPreset`) mapped to Tailwind utility classes and CSS variables

## Keyboard Shortcuts

- `Cmd/Ctrl + A`: select all nodes
- `Delete/Backspace`: delete selected nodes
- `Cmd/Ctrl + Z`: undo
- `Cmd/Ctrl + Shift + Z`: redo
- `Arrow keys`: move selected nodes by 1px
- `Shift + Arrow keys`: move selected nodes by 10px
- `Esc`: clear selection

## Marker-based Patch Protocol

Patch target source must include markers:

```tsx
/* OCODE-CANVAS-START hash:<checksum> */
...generated block...
/* OCODE-CANVAS-END */
```

Patch behavior:

- If markers exist and are valid: replace only content between markers.
- If markers are missing/invalid: patch fails with explicit reason.
- If marker hash mismatches block content, patch is rejected unless `force` is enabled.

## Key Files

- `src/core/editor-store/store.ts` - command + history state
- `src/core/canvas-renderer/CanvasView.tsx` - draggable canvas
- `src/core/inspector/InspectorPanel.tsx` - controlled field editing
- `src/features/ai/AIRefactorPanel.tsx` - AI prompt/proposal/apply/revert UI
- `src/core/ai/refactor.ts` - local AI proposal strategy
- `src/core/code-sync/index.ts` - generated source, diff preview, marker patch
- `src/App.tsx` - wiring for baseline/patch/apply/export UX

## Sprint Completion Snapshot

- Sprint1: UI skeleton, editor layout, command store
- Sprint2: visual editing + sync preview + patch pipeline
- Sprint3: AI local proposal flow + apply/revert
- Sprint4: stabilization guards, validation visibility, tests
