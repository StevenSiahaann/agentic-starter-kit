---
trigger: glob
globs: "**/*.tsx, **/*.jsx, **/*.css, **/*.scss, **/*.html, **/*.vue, **/*.svelte"
---

# UI/UX Engineering Standard: Human-Centric Tactile Design

> **Status:** MANDATORY DESIGN STANDARD  
> **Target:** Frontend Applications, Component Libraries, Design Systems, and Figma Synchronization.

---

## 1. Anti-Glassmorphism Manifesto

Many AI-generated interfaces look soulless, suffer from poor legibility, and lack visual hierarchy due to excessive translucent blur effects. This standard strictly forbids those clichés.

### Prohibited Design Patterns
- **Never use `backdrop-filter: blur()` or Tailwind `backdrop-blur-*` utility classes**.
- **Never use low-opacity translucent backgrounds (10–30% opacity)** that degrade text contrast.
- **Never use generic AI neon gradients** (unmotivated purple-to-cyan-to-pink glows without semantic meaning).
- **Never render thin white/gray typography over semi-transparent surfaces**.

### Mandatory Solid Surface Layering
1. **Pure Opacity Surfaces**: Every container (Card, Modal, Sidebar, Navbar, Popover) MUST use a 100% opaque solid background fill.
2. **Physical-Weight Color Palette**:
   * Primary Canvas: *Deep Obsidian* (`#0B0F19`) in dark mode or *Warm Editorial Canvas* (`#F8FAFC`) in light mode.
   * Card & Elevated Surface: *Navy Slate* (`#161F30`) or *Crisp Solid White* (`#FFFFFF`).
   * Structural Border: Crisp 1px solid stroke (`#243047` dark mode, `#E2E8F0` light mode).
3. **Accessibility Contrast (WCAG 2.1 AA)**: All body and interactive text MUST maintain a contrast ratio of at least **4.5:1** against its solid background surface.

---

## 2. Tactile Physics & Micro-Interactions

Interactive elements must feel physically grounded when hovered, pressed, or focused.

### Tactile Button & Card Mechanics
- **Solid Hard Shadow**: Use crisp, zero-blur offset shadows rather than diffuse drop shadows:
  ```css
  /* Standard Tactile Button Shadow */
  box-shadow: 0 2px 0 0 #000000;
  ```
- **Press-Down Physics**: On `:active`, elements translate downward proportionally as the shadow collapses:
  ```css
  button:hover {
    transform: translateY(-1px);
    box-shadow: 0 3px 0 0 #000000;
  }
  button:active {
    transform: translateY(2px);
    box-shadow: 0 0 0 0 #000000;
  }
  ```
- **Natural Spring Timing**: Constrain micro-interaction transitions between **120ms and 200ms** using a natural spring curve (`cubic-bezier(0.16, 1, 0.3, 1)`). Avoid stiff linear transitions.

---

## 3. Radial & Ergonomic Navigation Pattern

For mobile thumb-zone actions or desktop power-user contextual shortcuts, implement the **Radial Menu Pattern**:

### Fitts's Law Ergonomics
* Menu items radiate from the trigger origin at an equidistant radius ($r = 80\text{px}\text{–}120\text{px}$), minimizing cursor/thumb travel time.
* Constrain angular spread between $45^\circ$ and $90^\circ$ when anchored near screen corners.
* Every radial menu item MUST provide:
  - A high-contrast vector icon.
  - A solid-background text tooltip label.
  - Full keyboard accessibility: openable via shortcut (`Space` / `Enter`), navigable via arrow keys (`ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`), and dismissible via `Escape`.

---

## 4. Figma Design Token Synchronization

Maintain a strict 1:1 mapping between Figma design tokens and frontend CSS/Tailwind variables:

| Figma Token Name | Tailwind / CSS Variable | Dark Theme Value | Light Theme Value |
| :--- | :--- | :--- | :--- |
| `surface.canvas` | `bg-surface-canvas` | `#0B0F19` | `#F8FAFC` |
| `surface.card` | `bg-surface-card` | `#161F30` | `#FFFFFF` |
| `surface.elevated`| `bg-surface-elevated` | `#1E293B` | `#F1F5F9` |
| `border.subtle` | `border-subtle` | `#243047` | `#E2E8F0` |
| `border.strong` | `border-strong` | `#334155` | `#94A3B8` |
| `action.primary` | `bg-action-primary` | `#F97316` (Amber) | `#EA580C` |
| `text.primary` | `text-primary` | `#F9FAFB` | `#0F172A` |
| `text.muted` | `text-muted` | `#64748B` | `#64748B` |

### Component Variants via CVA (Class Variance Authority)
Build all reusable UI primitives using headless accessible foundations (Radix UI / React Aria) paired with CVA:
```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center font-bold text-sm rounded-sm transition-all duration-150 border border-transparent disabled:opacity-50 disabled:pointer-events-none active:translate-y-[2px]',
  {
    variants: {
      variant: {
        primary: 'bg-action-primary text-black hover:bg-orange-600 shadow-[0_2px_0_#000] active:shadow-none',
        secondary: 'bg-surface-card text-text-primary border-border-subtle hover:border-border-strong shadow-[0_2px_0_#000] active:shadow-none',
        destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-[0_2px_0_#000] active:shadow-none',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-5 text-sm',
        lg: 'h-12 px-7 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);
```
