# Navigation Loading Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a circular loading indicator during authenticated route navigation and real asynchronous form or action work.

**Architecture:** Use the Next.js route-group `loading.tsx` convention for page transitions and add pending feedback to the existing shared Button and mutation controls. Keep local-only interactions free of false loading feedback.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-navigation-loading-design.md`

## Global Constraints

- Do not add dependencies.
- Keep local menus/dialog toggles free of loading indicators.
- Preserve existing action results, toasts, permissions, and navigation behavior.
- Make loading feedback accessible and circular.

## Review Focus

- Already-prefetched route navigation may complete before a fallback is visible; it must not leave a stale loader. Verify route loading stays within Next.js Suspense behavior via production build.
- Explicit action loading must only affect the buttons marked loading and must not disable unrelated local controls. Test that non-loading Buttons keep their normal markup; existing form components retain their own pending state.
- Existing asynchronous action errors must remain visible and end loading feedback. Test the shared loading prop and inspect each existing `finally`/toast completion path.
- Login and other auth forms must retain their existing pending feedback through their own pending state and spinner; the shared Button stays server-compatible and uses only its explicit loading prop.
- Reduced-motion preferences should not make the indicator inaccessible; use a visible status label in addition to animation.

---

### Task 1: Add route, form, and mutation loading feedback

**Files:**
- Create: `src/app/(app)/loading.tsx`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/app/(app)/quotations/[id]/actions.tsx`
- Modify: `src/app/(app)/customers/row-actions.tsx`
- Modify: `src/app/(app)/products/row-actions.tsx`
- Test: `tests/loading-ui.test.ts`

**Interfaces:**
- `Button` gains optional `loading?: boolean`; when true, it renders a spinner, sets `aria-busy`, and disables itself. It remains usable from Server Components.
- The route fallback renders a `role="status"` circular indicator labelled “Loading page”.

- [ ] **Step 1: Write failing tests**

Add Vitest server-render tests that assert:
- The route fallback renders an accessible status element with a circular spinner.
- A Button with `loading` renders its spinner and `aria-busy="true"`.
- A regular Button does not render loading status and is not disabled.

- [ ] **Step 2: Verify the tests fail**

Run: `npx vitest run tests/loading-ui.test.tsx`
Expected: FAIL because the loading route and `loading` Button behavior do not exist yet.

- [ ] **Step 3: Implement the route and shared Button behavior**

Create `(app)/loading.tsx` with a centered, non-blocking accessible spinner. Update `Button` to render its spinner from the explicit `loading` prop; existing forms already provide their pending state and spinner.

- [ ] **Step 4: Wire existing async mutations**

Pass the `loading` prop from the quotation actions’ existing `busy` state to mutation buttons. For customer and product archive/restore menu actions, show a Sonner loading toast and resolve it to the existing success/error result.

- [ ] **Step 5: Run verification**

Run:
- `npx vitest run tests/loading-ui.test.ts`
- `npm run typecheck`
- `npx eslint 'src/app/(app)/loading.tsx' src/components/ui/button.tsx 'src/app/(app)/quotations/[id]/actions.tsx' 'src/app/(app)/customers/row-actions.tsx' 'src/app/(app)/products/row-actions.tsx' tests/loading-ui.test.ts`
- `npm run build`

Expected: focused tests, typecheck, focused lint, and production build pass; route output remains intact.
