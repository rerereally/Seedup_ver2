# Seedup design system

The locked rules every screen follows. A change to a token, a component or a rule here is a change to the whole site:
edit this file first, then the code. Tokens live in `app/globals.css` (`@theme` and the dark blocks); shared classes
live in its `@layer components`.

## 1. What the product has to feel like

Seedup turns what developers actually wrote into a PRD a coding agent can build. The interface proves that claim with
the real thing: real quotes, real counts, a real PRD. It is a precise instrument, calm and fast, never decorated.

- **Show, never describe.** A section earns its place with the product at work (the PRD graph, the map, the terminal),
  not a paragraph about it.
- **Every number is counted and dated.** No invented metric, no AI score shown as evidence. A figure that moves carries
  the date it was counted.
- **One job per screen.** The landing's job is "make a PRD from my idea"; subscribing is the second action.

## 2. Tokens

### Colour (light / dark)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `surface` | #fafafa | #111113 | page |
| `white` | #ffffff | #1b1b1e | card surface (flips in dark) |
| `surface-low` / `-mid` / `-high` | #f4f4f5 / #efeff1 / #e8e8eb | #202024 / #26262b / #303036 | tracks, hovers, selected rows |
| `ink` | #151517 | #f2f2f4 | text, headings |
| `tertiary` | #52525b | #c2c2c8 | body copy |
| `muted` | #6b6b72 | #9a9aa2 | captions, meta |
| `outline-soft` / `-strong` | #e4e4e7 / #c4c4ca | #2c2c31 / #46464d | hairlines / field edges, hypotheses |
| `seed` | #1f6b4a | #4caf80 | the one accent: primary action, evidence, "passed" |
| `seed-soft` | #eef6f1 | #15251d | evidence highlight, selected |
| `on-seed` | #ffffff | #0c1f15 | text on a seed fill |
| `seed-deep` / `on-deep` | #1f6b4a / #fff | #1b4a35 / #fff | one large green band per page at most |
| `term-bg` / `term-ink` / `term-muted` / `term-seed` | #111214 / #e7e7ea / #8b8b94 / #7fd1a6 | same | the terminal, dark in both themes |

Rules: no colour literal outside the token block. Green is never decoration: it marks evidence, a pass, or the primary
action. Accent stays under about 5% of a viewport.

### Type

Pretendard Variable for everything; Geist Mono only for code, commands and ids that are code (`F-01`, `R-02`).

| Role | Size | Weight | Line height | Tracking |
| --- | --- | --- | --- | --- |
| Display (`.t-display`) | clamp(40px, 4.6vw, 64px) | 700 | 1.08 | -0.04em |
| Section (`.t-section`) | clamp(30px, 3.2vw, 46px) | 700 | 1.15 | -0.035em |
| Title | 20px | 600 | 1.4 | -0.01em |
| Body | 17px | 400 | 1.7 | 0 |
| Small | 15px | 400 | 1.6 | 0 |
| Caption | 13px | 400 | 1.5 | 0 |

Three weights only: 400, 600, 700. Headings use `text-wrap: balance`, body `text-wrap: pretty`. Korean keeps
`word-break: keep-all`. No text under 12px; functional text never under 13px on a phone.

### Space, size, shape

- Container: `max-width: 1200px`, gutters 20 / 24 / 32px (phone / tablet / desktop). Grows only in gutters past 1440.
- Section rhythm (`.section`, `.section-wide`): 128px and 168px between sections on desktop, 88px and 112px on phones.
  Never every gap the same.
- Controls: 44 to 52px tall on marketing pages, 40px in app screens (44px hit area on phones).
- Radius: 10px controls, 16px cards, 24px large panels and bands. One radius per nesting level.
- One containment layer: never a card inside a card. Inside a card, separate with hairlines.

## 3. Components

- **Primary action** `.btn` (seed fill). One per view. Secondary is `.btn-quiet` (outlined) or a plain text link.
- **Text link** `.link-seed`: seed text, underline on hover. No arrow glued to the text.
- **Card** `.card`: white surface, `outline-soft` hairline, 16px radius.
- **Tabs** `.tabs` / `.tab`; **segmented switch** `.seg`.
- **Terminal** `.terminal`: one frame per page, real commands only.
- **Evidence quote**: left rule in `seed`, the quote in the source language (`lang="en"`), source and date under it as
  separate parts (no `A · B · C` strings).
- **Hypothesis**: dashed `outline-strong` border, label "가설" / "hypothesis". Never green.

## 4. Motion

- Only `transform` and `opacity` animate; 160 to 240ms, `cubic-bezier(0.2, 0, 0, 1)`. No bounce.
- Content is visible without JavaScript; motion only adds to it.
- Anything that advances by itself (the landing demo) starts only when visible, pauses on hover and focus, has a visible
  pause button, and does not move at all under `prefers-reduced-motion: reduce`.
- Focus rings appear instantly: 2px `ink` outline, 2px offset.

## 5. Copy

- Plain, specific, in the product's own nouns. No buzzwords, no "Get started / Learn more" as a second action, no em
  dashes.
- No eyebrow above a heading; no tracked capitals; no middle-dot meta strings; no arrows glued to link text.
- A hero is a headline, one sentence and its actions. About 80 words at most on any one screen.
- Korean first, English through `translator(lang)`; both say the same thing.

## 6. Page anatomy

- **Landing** (`/`, signed out): hero with the idea box and the live PRD demo; the map of today's problems; the track
  record; the agent hand-off; the weekly issue with subscribe; the idea box again.
- **Home** (`/`, signed in): planned in M3.
- **App screens**: the page title and one line, then the work. Navigation: 오늘의 신호, 읽을 글, PRD, 내 저장소, 탐색.

## 7. The 100-point scorecard

A screen ships when every line holds. Each failed line costs its points.

| Points | Check |
| --- | --- |
| 20 | Hallmark `sloplint --render`: 0 FAIL; every REFLEX fixed or waived with a reason |
| 15 | Works at 375, 768, 1280 and 1920px, light and dark, with no horizontal scroll and nothing clipped |
| 15 | A first-time visitor can say what the screen is for and do its one job without help (fresh-eye review) |
| 10 | Keyboard only: every action reachable, visible focus, logical order |
| 10 | Real data only; every moving number dated |
| 10 | No link, field or handler lost (`sloplint --kept`) |
| 10 | Motion rules in section 4 hold, including reduced motion and no-JS |
| 10 | Lint, type check, tests and production build pass |
