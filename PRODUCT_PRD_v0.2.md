# Opencode Canvas PRD v0.2

## 1. Product Overview

- Product name: Opencode Canvas
- Goal: close the loop from AI frontend generation to visual editing and safe code synchronization.
- Positioning: IDE/local-first prototype design tool for engineers.

## 2. Problem Statement

- AI code generation is fast, but visual iteration usually falls back to manual code edits.
- Design tools and code tools are split, causing handoff loss and repeated changes.
- Teams need a maintainable, reviewable path from visual changes to real code.

## 3. Target Users

- Primary: independent developers, frontend engineers, technical PMs.
- Secondary: designers with component-level engineering awareness.

## 4. MVP Scope (P0)

In scope:

- React + TypeScript + Tailwind + Vite only.
- Prompt-based page generation and selected-node local regeneration.
- Visual canvas editing: select, move, resize, text edit, layer reorder.
- Inspector editing: layout, spacing, typography, color, border, radius, shadow.
- Code synchronization with controlled AST subset.
- Diff preview, undo/redo, rollback.

Out of scope:

- Realtime multiplayer collaboration.
- Full motion timeline system.
- Multi-framework export.
- Enterprise RBAC and organization management.

## 5. Core Requirements

### F1 AI Generation

- Generate an initial page from prompt.
- Support selected-node refinement by natural language.

### F2 Canvas Editing

- Frame, text, image, button, card, form as base objects.
- Selection, drag, resize, grouping, reorder.

### F3 Inspector

- Bi-directional binding with selected node properties.

### F4 Code Sync

- Canvas -> Code: AST-based writeback, no string replacement.
- Code -> Canvas: parse and refresh tree + core style projection.

### F5 Safety

- AI changes must expose rationale + diff + rollback.
- Unsupported syntax must degrade to suggested patch.

## 6. Technical Strategy

- Architecture: AST-first.
- Parser/transform: `@babel/parser` + `recast` + `jscodeshift`.
- State model: flattened node map (`NodeMap + rootIds + selection`).
- Preview runtime: Vite HMR sandbox.
- Design token layer: lightweight variables aligned with Tailwind theme.

## 7. Information Architecture

- Left: layers/tree panel.
- Center: canvas editor.
- Right: inspector panel.
- Bottom: code preview + diff + diagnostics.
- Side drawer: AI prompt panel and history.

## 8. Key Flows

- Flow A: prompt -> page -> visual edits -> diff review -> preview.
- Flow B: import code -> parse -> edit on canvas -> writeback.
- Flow C: select node -> AI local refactor -> compare -> apply/revert.

## 9. Milestones

- M1 (2 weeks): skeleton UI + tree + readonly code mapping.
- M2 (2-3 weeks): inspector + canvas edits + writeback.
- M3 (2 weeks): AI local regeneration + diff/rollback.
- M4 (1-2 weeks): stabilization + performance + alpha tests.

## 10. Success Metrics

- Initial usable page generation success >= 70%.
- Canvas-to-code writeback success >= 95% on sample suite.
- Build-pass rate after writeback >= 90%.
- End-to-end task completion in <= 15 minutes.

## 11. Risks and Mitigation

- Risk: non-lossy writeback on complex code.
  - Mitigation: controlled syntax subset + patch fallback.
- Risk: canvas/code drift.
  - Mitigation: AST as source of truth.
- Risk: unstable LLM output.
  - Mitigation: schema validation + mandatory diff review.

## 12. Decisions Confirmed

- Tailwind-only for MVP styling path.
- P0 focuses on page editing before component platform scope.
- Implementation starts from Sprint 1 with P0-only boundaries.
