---
name: frontend-dev
description: Frontend development guidelines for Draft Room. React 19 + TypeScript + TanStack Query + Tailwind v4 + shadcn/ui patterns.
---

# Frontend Development Guidelines

## When to Use

Creating or modifying React components, pages, hooks, modals, forms, or any code in `src/`.

---

## Quick Start Checklists

### New Component

- [ ] Named export (not default)
- [ ] Import with `@/` path alias
- [ ] Use `cn()` from `@/lib/utils` for conditional classes
- [ ] Use `class-variance-authority` for variants (see `src/components/ui/Button.tsx`)
- [ ] Wrap in `<ErrorBoundary>` if it is a route in `App.tsx`
- [ ] Mobile: `whitespace-nowrap` on button text to prevent wrapping

### New Hook

- [ ] Naming: `use<Entity>` for queries, `useCreate<Entity>`/`useUpdate<Entity>`/`useDelete<Entity>` for mutations
- [ ] Wrap Supabase queries as TanStack Query hooks (`useQuery`/`useMutation`)
- [ ] Default `staleTime` is 5 min (from `QueryClient` in `App.tsx`) — only override if needed
- [ ] Invalidate specific query keys: `['league', leagueId]` not `['league']`
- [ ] Pass `leagueId` through mutation inputs for targeted invalidation in `onSuccess`
- [ ] `console.error` with context objects: `{ leagueId, captainId, playerId, error }`

### New Modal

- [ ] Use `useModalFocus` hook from `@/hooks/useModalFocus`
- [ ] Provides: ESC key close, click-outside close, scroll lock, focus trap, ARIA `role="dialog"` + `aria-modal`
- [ ] Has `enabled` option for conditionally-rendered modals (e.g., `SpreadsheetImportModal`)
- [ ] Apply `{...overlayProps}` to overlay div
- [ ] Existing modals: `PlayerProfileModal`, `SpreadsheetImportModal`, `EditProfileModal`, `ExpandedPoolModal`

### New Route

- [ ] Add to `App.tsx` wrapped in `<ErrorBoundary>`
- [ ] Protected routes: `<ProtectedRoute>` wrapper (requires Supabase auth)
- [ ] Token-based routes: no auth wrapper
- [ ] Use `React.lazy` + `Suspense` for the page component:
  ```tsx
  const Page = lazy(() => import('@/pages/Page').then(m => ({ default: m.Page })))
  ```

---

## React 19 Patterns

- Do NOT mutate refs during render — use `useEffect` instead
- Prefer derived values over `useState` + sync `useEffect` when state can be computed from props/other state
- Use lazy initializers: `useState(() => fn())` when reading from external sources (localStorage, modules)
- Use `aria-live="polite"` and `role="status"` on dynamic content for screen readers (timers, countdowns)

## TanStack Query

- `QueryClient` in `App.tsx` sets global defaults: `staleTime: 5 * 60 * 1000` (5 min), `retry: 1`
- Hooks that need different staleTime override it (e.g., `30 * 1000` for player profiles, custom fields)
- Do NOT add `staleTime` to new hooks unless they need a non-default value
- `useLeague` selects explicit columns (not `*`) — when adding DB columns, update the select in `src/hooks/useLeagues.ts`
- Invalidate specific keys in `onSuccess`: `['league', leagueId]` not `['league']`
- Access `variables` in `onSuccess` for data not returned by the mutation: `onSuccess: (result, variables) => { ... }`

## Tailwind v4 + shadcn/ui

- CSS variables defined in `src/index.css`
- Components use `class-variance-authority` for variants
- Use `cn()` from `@/lib/utils` for conditional classNames (merges Tailwind classes correctly)
- Dark mode: toggle via `ThemeContext`, uses `.dark` class on `<html>`

## Forms

- React Hook Form + Zod validation
- Use `.trim()` on Zod string fields that shouldn't allow whitespace-only values
- Example patterns: `src/pages/league/NewLeague.tsx`, `src/components/league/LeagueSettings.tsx`

## Button Component

- `Button` accepts `loading` boolean — shows `Loader2` spinner and auto-disables
- Use this for ALL async actions instead of text-based indicators ("Saving..." text → spinner + "Save")
- Located at `src/components/ui/Button.tsx`

## Toast Notifications

- Use `useToast()` hook from `@/components/ui/Toast`
- `addToast(message, type)` where type is `'success' | 'error' | 'info'`

## Lazy Loading

- `ManageLeague` uses `React.lazy` + `Suspense` for 5 tab components
- Each tab loads on demand, wrapped in `<Suspense fallback={<TabSkeleton />}>`
- Follow this pattern for large feature components

## PlayerPool

- Accepts optional `search`/`onSearchChange`/`sortBy`/`onSortChange` for controlled mode
- `DraftBoard` lifts state so inline and expanded modal pools share search/sort state
- `SortOption` type is exported from `PlayerPool.tsx`
- Keyboard nav: Arrow keys navigate list, Enter confirms pick, Escape clears selection
- List container: `tabIndex={0}`, `role="listbox"`, inline buttons: `tabIndex={-1}`

## DraftBoard Prop Threading

- `DraftBoard` receives props from 3 callers: `DraftView`, `CaptainView`, `SpectatorView`
- Adding new props requires updating all 3 callers
- All destructure from `useDraft()` hook

## Notification Permission

- `DraftBoard` shows a dismissible banner asking captains to enable notifications
- Uses user gesture (banner button click), NOT auto-request on mount
- Banner only appears when `Notification.permission === 'default'`
- Dismissed state is session-scoped (React state, not persisted)

## Structured Error Logging

- All `console.error` calls include context objects for debugging:
  ```typescript
  console.error('Pick failed:', { leagueId: league.id, captainId, playerId, error })
  ```

## Spreadsheet Import/Export

- Uses `exceljs` + `file-saver`
- Import: `SpreadsheetImportModal` component (parsing in `useSpreadsheetImport.ts`)
- Export: `exportPlayersToSpreadsheet()` in `src/lib/exportPlayers.ts`
- Draft results: `exportDraftResults()` in `src/lib/exportDraftResults.ts`
- Template: `downloadPlayerTemplate()` in `src/lib/generateTemplate.ts`
- Pattern: ExcelJS `Workbook` API + `saveAs()`

## Celebration Replay

- `Summary.tsx` uses `sessionStorage` with key `celebrated-{id}` to prevent confetti/sound replaying on page reload
- New celebration effects should follow this pattern

## Two-Phase Position Updates

- Tables with unique constraints on position columns (`captains.draft_position`, `captain_draft_queues.position`) use two-phase updates with `Promise.all`:
  1. Set all positions to negative temps: `-(i + 1)`
  2. Set all positions to final values: `i`
- Both phases run in parallel within each phase
- See `useReorderCaptains` and `useMoveInQueue` in `src/hooks/useDraftQueue.ts`
