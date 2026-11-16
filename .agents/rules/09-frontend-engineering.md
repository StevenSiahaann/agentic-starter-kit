---
trigger: glob
globs: "**/*.tsx, **/*.jsx, **/components/**, **/hooks/**, **/pages/**, **/app/**"
---

# Frontend Engineering Standards: State Architecture, Accessibility, & Performance

> **Status:** MANDATORY FRONTEND STANDARD  
> **Target:** All UI Components, Forms, Client Hooks, and Frontend API Integrations.

---

## 1. The State Triad: Strict Separation of State Layers

Never dump all application state into a single global store (such as Redux or Zustand). Partition state strictly by ownership:

### A. Server State (Remote API Data)
- **Managed By**: **TanStack Query (React Query) / SWR**.
- **Responsibilities**:
  - Handles caching, *stale-while-revalidate*, background refetching, request deduplication, retry backoff, and optimistic mutations.
  - **Strictly Forbidden**: Fetching API data inside `useEffect` and copying it manually into Zustand or Redux (`useEffect` + `setStoreData`).

### B. URL Query State (Single Source of Truth for Navigation & Filters)
- **Managed By**: URL Search Parameters (via `nuqs` or router search params).
- **Responsibilities**:
  - Search queries, category filters, sort order, active tab, and pagination cursors **MUST live in the URL**.
  - Rationale: Enables deep-linking, browser back/forward history, bookmarking, and shareable URLs that restore exact view state on refresh.

### C. Client UI State (Ephemeral Local UI State)
- **Managed By**: **Zustand** (or scoped React Context).
- **Responsibilities**:
  - Strictly for pure client-side UI state unrelated to server persistence (e.g., sidebar collapsed/expanded, active modal ID, theme preference).

---

## 2. Form Management & Schema Validation

Unvalidated forms are a primary source of frontend bugs and malformed API payloads.

### Form Engineering Rules:
1. **React Hook Form (RHF)**: Use `react-hook-form` with uncontrolled inputs to maintain 60 FPS typing performance without full-tree re-renders on every keystroke.
2. **Zod Schema Resolver**: Validate all forms using Zod (`@hookform/resolvers/zod`). Align client schemas 1:1 with backend Command DTOs.
3. **Accessible Error Binding**:
   - Every invalid field MUST set `aria-invalid="true"`.
   - Every inline error message MUST be linked to its input via `aria-describedby="<field>-error"`.

---

## 3. Granular Error Boundaries & Fault Isolation

Never allow an unhandled runtime error in a single card, chart, or widget to crash the entire page (*White Screen of Death*).

### Error Boundary Rules:
- Wrap independent UI sections (feeds, analytics widgets, sidebars) in granular `<ErrorBoundary>` components.
- When a widget crashes:
  1. Render a solid, layout-preserving fallback card only for that widget.
  2. Keep the rest of the page interactive.
  3. Provide a tactile *"Retry"* button that resets the error boundary and re-triggers the query.
  4. Report the error stack trace and `trace_id` to Sentry / OpenTelemetry Browser SDK.

---

## 4. Loading Patterns & Zero Cumulative Layout Shift (CLS $< 0.1$)

- **No Full-Page Spinners**: Full-screen loading spinners disorient users and degrade perceived performance.
- **Structural Skeleton Placeholders**: Render skeleton placeholders that match the exact geometry, padding, and dimensions of the loaded content.
- **Prevent Layout Shifts (CLS $< 0.1$)**:
  - Always declare explicit dimensions, `aspect-ratio` (`aspect-video`, `aspect-square`), or `min-h-[...]` on asynchronous media and card containers so surrounding layout never jumps when data resolves.

---

## 5. Accessibility (a11y — WCAG 2.1 AA Compliance)

All interfaces must be fully operable by assistive technologies and keyboard-only users:
1. **Semantic HTML**: Never bind click handlers to non-interactive elements (`<div onClick={...}>`). Use semantic `<button type="button">`, `<nav>`, `<main>`, `<section>`, `<header>`.
2. **Full Keyboard Navigation**:
   - All buttons, menus, dialogs, and radial menus must support `Tab`, `Shift+Tab`, `Enter`, `Space`, and `Escape`.
3. **Focus Trap & Focus Restoration**:
   - When a Modal Dialog opens: Trap keyboard focus inside the dialog so background elements cannot be tabbed.
   - When the Modal Dialog closes: Automatically restore focus to the trigger element that opened it.
4. **Headless Accessible Primitives**: Build interactive overlays on verified primitives (Radix UI / React Aria).

---

## 6. Core Web Vitals & Rendering Performance

- **Largest Contentful Paint (LCP $\le 2.5\text{s}$)**:
  - Preload critical fonts with `font-display: swap`.
  - Serve hero images in `.webp` or `.avif` with explicit `width`/`height` and `fetchpriority="high"`.
- **Interaction to Next Paint (INP $\le 200\text{ms}$)**:
  - Use `useDeferredValue` or `useTransition` for expensive live filtering or large list updates to keep the main thread responsive.
- **Code Splitting**:
  - Lazy-load heavy below-the-fold modules (Charting libraries, Rich Text Editors, PDF viewers) via `React.lazy()` or `next/dynamic`.

---

## 7. Behavioral Component Testing (React Testing Library)

- Test **user-visible behavior**, never internal component state or CSS class names.
- **Use Accessible Role Queries**:
  ```typescript
  // CORRECT: Query by accessible role and label perceived by the user
  const submitBtn = screen.getByRole('button', { name: /confirm order/i });
  expect(submitBtn).toBeEnabled();

  // WRONG: Fragile implementation-detail selector
  const submitBtn = container.querySelector('.btn-primary-orange');
  ```
