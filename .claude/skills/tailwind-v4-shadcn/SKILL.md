# Tailwind v4 + shadcn/ui Styling Patterns

**Source**: Adapted from [secondsky/claude-skills](https://github.com/secondsky/claude-skills) `tailwind-v4-shadcn` skill
**Status**: Active

## Project-Specific Setup

This project uses Tailwind v4 with:
- `@tailwindcss/vite` plugin (NOT PostCSS)
- `@custom-variant dark (&:where(.dark, .dark *))` for class-based dark mode
- oklch color values in CSS variables (`:root` and `.dark` blocks in `src/index.css`)
- `@theme inline` maps CSS variables to Tailwind utilities
- No `tailwind.config.ts` (v4 CSS-first configuration)

## Critical Rules

### Dark Mode with `@custom-variant dark`

The `@custom-variant dark` directive in `index.css` makes all `dark:` utilities respond to the `.dark` class on `<html>` instead of `@media (prefers-color-scheme: dark)`. **This is required** because ThemeContext toggles `.dark` on `<html>`.

**Paired `dark:` variants work correctly**: Tailwind v4 places variant utilities (like `dark:bg-green-900/30`) after base utilities (like `bg-green-100`) in the generated CSS. Since `:where()` gives zero additional specificity, source order determines the winner — and the `dark:` variant comes last, so it wins in dark mode.

```tsx
/* WORKS — dark variant appears after base in CSS output, wins in dark mode */
<span className="bg-green-100 dark:bg-green-900/30">Ready</span>
```

The risk arises when **two different base utilities** compete on the same property without proper pairing:

### How to Handle Light-Only Backgrounds

**WRONG** — dark variant may lose to base utility:
```tsx
<div className="bg-green-50/50 dark:bg-card">  {/* bg-green-50/50 may override dark:bg-card */}
```

**CORRECT** — use semantic tokens that auto-switch:
```tsx
<div className="bg-card">  {/* Uses --color-card, auto-switches light/dark */}
```

**CORRECT** — separate concerns, no conflicting bg classes:
```tsx
<div className={`bg-card ${isReady ? 'border-green-300 dark:border-green-800/50' : 'border-border'}`}>
```

**CORRECT** — define a semantic variable if you need different backgrounds:
```css
:root { --color-success-bg: oklch(0.96 0.02 155 / 0.5); }
.dark { --color-success-bg: oklch(0.20 0.02 155 / 0.15); }
@theme inline { --color-success-bg: var(--color-success-bg); }
```
```tsx
<div className="bg-success-bg">  {/* Auto-switches */}
```

### Use Semantic Color Tokens

Prefer CSS variable-backed utilities (`bg-card`, `bg-primary`, `text-foreground`, `border-border`) over raw Tailwind colors (`bg-green-50`, `text-gray-500`). Semantic tokens auto-switch in dark mode without `dark:` variants.

```tsx
/* WRONG — requires dark: variant, risks specificity issues */
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">

/* CORRECT — auto-switches via CSS variables */
<div className="bg-card text-card-foreground">
```

### When Raw Colors Are Safe

Raw Tailwind colors (e.g., `text-green-600 dark:text-green-400`) are fine when:
1. They're used on elements WITHOUT a conflicting base utility on the same property
2. They're paired with a `dark:` variant (both applied, no base conflict)
3. They're icon/text accent colors (not backgrounds competing with semantic tokens)

```tsx
/* SAFE — no conflicting base bg, dark variant pairs with light */
<Icon className="text-green-600 dark:text-green-400" />

/* SAFE — border colors with explicit dark pairing */
<div className="border-green-300 dark:border-green-800/50">

/* UNSAFE — bg-green-50/50 conflicts with dark:bg-card */
<div className="bg-green-50/50 dark:bg-card">
```

### Never Do

1. **Put `:root` or `.dark` inside `@layer base`**
2. **Use `.dark { @theme { } }`** — v4 doesn't support nested @theme
3. **Double-wrap colors**: `hsl(var(--background))` — just use `var(--background)`
4. **Use `@apply`** — deprecated in v4
5. **Use `tailwind.config.ts`** — v4 uses CSS-first configuration
6. **Assume `dark:` overrides base utilities** — specificity is equal with `:where()`

## Available Semantic Tokens (this project)

Defined in `src/index.css` via `:root` / `.dark` + `@theme inline`:

| Token | Utility | Usage |
|-------|---------|-------|
| `--color-background` | `bg-background` | Page background |
| `--color-foreground` | `text-foreground` | Default text |
| `--color-card` | `bg-card` | Card backgrounds |
| `--color-card-foreground` | `text-card-foreground` | Card text |
| `--color-primary` | `bg-primary` | Primary actions |
| `--color-muted` | `bg-muted` | Muted backgrounds |
| `--color-muted-foreground` | `text-muted-foreground` | Secondary text |
| `--color-border` | `border-border` | Default borders |
| `--color-destructive` | `bg-destructive` | Error/danger |

## Debugging

If a `dark:` class isn't taking effect:
1. Verify `@custom-variant dark (&:where(.dark, .dark *))` is in `index.css` — without it, `dark:` uses media query only
2. Check for two conflicting base utilities on the same CSS property (e.g., `bg-green-50/50` AND `dark:bg-card`)
3. Use browser DevTools to inspect which class wins (check source order)
4. Prefer semantic tokens that auto-switch over `dark:` overrides
5. If you must override, use `!important` modifier: `dark:!bg-card`
