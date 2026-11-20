# Seedup design system (v2)

The locked rules every screen follows. A change to a token, a component or a rule here is a change to the whole site:
edit this file first, then the code. Tokens live in `app/globals.css` (`@theme` and the dark blocks); shared classes
live in its `@layer components`. v2 (2026-11-18) is the full redesign in [docs/archive/redesign-plan.md](docs/archive/redesign-plan.md),
modelled on the feel of Manyfast, Linear and Toss: near-monochrome, the real product as the picture, calm motion.

## 1. What the product has to feel like

Seedup turns what developers actually wrote into a PRD a coding agent can build. The interface proves that claim with
the real thing: real quotes, real counts, a real PRD. It is a precise instrument, calm and fast, never decorated.

- **Show, never describe.** A section earns its place with the product at work (the PRD trace, the map, the terminal),
  not a paragraph about it. On the intro site the product sits in a `.frame`, like a window.
- **Every number is counted and dated.** No invented metric, no AI score shown as evidence, no made-up testimonial.
- **One job per screen.** The landing's job is "make a PRD from my idea"; subscribing is the second action.
- **Two places, two shells.** The intro site (signed out: `/`, `/about`, `/product/*`, `/guide`, public pages) has a
  top bar and a large footer. The app (signed in) has a left sidebar and no marketing footer.

## 2. Tokens

### Colour (dark by default, light through the header switch; the reader's choice is remembered)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `surface` | #ffffff | #0f1012 | page (light mode is plain white: elements sit on the page, not on a grey backdrop) |
| `white` | #ffffff | #17181b | card and frame surface (flips in dark) |
| `surface-low` / `-mid` / `-high` | #f4f4f6 / #eeeef1 / #e6e6ea | #1c1d21 / #232429 / #2c2d33 | tracks, hovers, selected rows |
| `ink` | #121214 | #ececef | text, headings |
| `tertiary` | #4b4b53 | #b9bdc6 | body copy |
| `muted` | #6c6c74 | #9096a0 | captions, meta |
| `outline-soft` / `-strong` | #e6e6ea / #cfcfd5 | #2a2b30 / #43444c | hairlines / field edges, hypotheses |
| `seed` | #127a4c | #3ecf8e | the one accent: primary action, evidence, "passed" |
| `seed-soft` | #ecf7f1 | #0f241a | evidence highlight, selected |
| `on-seed` | #ffffff | #04140c | text on a seed fill |
| `seed-deep` / `on-deep` | #0f6640 / #fff | #17402e / #fff | one large green band per page at most |
| `glow` | seed at 10% | seed at 12% | the soft light behind an intro hero or frame, never behind text alone |

Contrast, checked: `seed` on white 5.4:1 and white on `seed` the same; dark `seed` on the dark page 9.5:1, `on-seed`
on dark `seed` 9.5:1. Email templates and `global-error.tsx` cannot read tokens and repeat the light `seed` hex.
| `term-*` | #0d0e10 / #e7e7ea / #8b8b94 / #7fd1a6 | same | the terminal, dark in both themes |

Rules: no colour literal outside the token block. Green is never decoration: it marks evidence, a pass, or the primary
action, and the glow. Accent stays under about 5% of a viewport. Dark mode is designed, not inverted: every screen is
checked in both. Dark is a deep grey, not black: layers read apart by their hairlines (1.3:1 or more against
the page) and the brightest text stays near 15:1, not 19:1, to avoid glare. The app sidebar sits on the panel colour.

### Type

Pretendard Variable for everything; Geist Mono for code, commands, ids that are code (`F-01`, `R-02`) and the intro
site's section labels.

| Role | Class | Size | Weight | Line height | Tracking |
| --- | --- | --- | --- | --- | --- |
| Display | `.t-display` | clamp(40px, 5.2vw, 76px) | 700 | 1.05 | -0.045em |
| Section | `.t-section` | clamp(30px, 3.4vw, 48px) | 700 | 1.12 | -0.04em |
| Page title (app) | `.page-intro-title` | 28px | 700 | 1.25 | -0.025em |
| Title | | 20px | 600 | 1.4 | -0.01em |
| Body | `.t-lead` / | 17px | 400 | 1.7 | 0 |
| Small | | 15px | 400 | 1.6 | 0 |
| Caption | | 13px | 400 | 1.5 | 0 |
| Site label | `.site-label` | 13px mono | 500 | 1 | 0 |

Three weights only: 400, 600, 700 (500 only for the mono label). Headings use `text-wrap: balance`, body
`text-wrap: pretty`. Korean keeps `word-break: keep-all`. No text under 12px; functional text never under 13px on a phone.

### Space, size, shape

- Container: app screens `max-width: 1440px`, intro site `1280px`, gutters 20 / 24 / 32px (phone / tablet / desktop).
  Reading width 680px. Wide screens should not leave a large empty middle: widen the grid, do not centre a narrow column.
- The app sidebar folds to a 64px icon rail and back, pushing the page (the PRD workspace starts folded).
- Section rhythm (`.section`, `.section-wide`): 128px and 168px between sections on desktop, 88px and 112px on phones.
- Controls: 44 to 48px tall on the intro site, 36 to 40px in the app (44px hit area on phones).
- Radius: 8px controls, 12px cards and rows, 16px frames and large panels. One radius per nesting level.
- One containment layer: never a card inside a card. Inside a card, separate with hairlines.
- Depth: in light mode a card is a hairline plus at most `shadow-sm`; in dark mode a hairline plus a 1px top
  highlight (`inset 0 1px 0 rgb(255 255 255 / 0.04)`), never a drop shadow.

## 3. Components

- **Primary action** `.btn` (seed fill). One per view. Secondary is `.btn-quiet` (outlined) or a plain text link.
- **Text link** `.link-seed`: seed text, underline on hover.
- **Card** `.card`: white surface, `outline-soft` hairline, 12px radius.
- **Frame** `.frame`: the product shown on the intro site. 16px radius, hairline, a thin title bar
  (`.frame-bar`) with the screen's name, and the `glow` behind it. Only real components or real data go inside.
- **Site label** `.site-label`: one English word in mono above an intro-site section heading (Signal, Evidence, Spec,
  Agent). Intro site only, never in the app.
- **Tabs** `.tabs` / `.tab`; **segmented switch** `.seg`; **keyboard hint** `.kbd`.
- **Terminal** `.terminal`: one frame per page, real commands only.
- **Evidence quote**: left rule in `seed`, the quote in the source language (`lang="en"`), source and date under it as
  separate parts.
- **Hypothesis**: dashed `outline-strong` border, label "가설" / "hypothesis". Never green.
- **App shell** (signed in): left sidebar 240px with three groups (리서치: 인사이트, 아티클, 트렌드; 기획: PRD, 아이디어 검증, MCP 연동;
  내 작업: 북마크, 레포 분석) under 홈, the page header
  (title, one line, actions on the right), then the work. Phones get a drawer and a bottom bar.

## 4. Motion

- Only `transform`, `opacity` and `filter: blur` animate; 200 to 600ms, `cubic-bezier(0.2, 0, 0, 1)`. No bounce.
- Scroll reveal `.reveal`: from 12px lower, 0 opacity and 6px blur to rest, once, when it enters the viewport.
- Content is visible without JavaScript; motion only adds to it (`.reveal` runs on a CSS scroll timeline, so a browser
  without one, or a reader asking for less motion, sees the content at rest).
- Anything that advances by itself starts only when visible, pauses on hover and focus, has a visible pause button,
  and does not move at all under `prefers-reduced-motion: reduce`.
- Focus rings appear instantly: 2px `ink` outline, 2px offset.

## 5. Copy

- Plain, specific, in the product's own nouns. No buzzwords, no "Get started / Learn more" as a second action, no em
  dashes.
- No tracked capitals; no middle-dot meta strings; no arrows glued to link text. The only label above a heading is the
  intro site's `.site-label`.
- A hero is a headline, one sentence and its actions. About 80 words at most on any one screen.
- Korean first, English through `translator(lang)`; both say the same thing.

## 6. Page anatomy

- **Landing** (`/`, signed out): centred hero (headline, sentence, the one idea box, matches open under it); a band
  of real quotes drifting past (pausable); dated counts; the four steps as one scroll story with the real PRD demo
  pinned beside them; three principles; the track record; the weekly issue with subscribe; one closing button back
  to the idea box; the large footer. Each thing appears once: the about page does not repeat the steps or principles.
- **About, product pages**: the Toss layout, a small label column on the left and the content on the right.
- **App screens**: inside the app shell, in the one 1440px frame (`.page-shell`; the scrollbar's room is always kept,
  so pages never shift sideways). List and start screens: the page header runs full width first (title, then the date
  or one line, numbers, tabs), then the work in `.page-split` with an optional 320px `.page-side` column that starts
  below the header. Wide tables and grids skip the side column. Detail screens follow the same rule: a back link, the
  title block full width, then the content and its properties side by side in the same `.page-split`. Side columns are flat (no card), groups split by a hairline.
  Start screens (`/prd`, `/prd/new` with no idea yet) are the one exception: a single centred box with its title,
  like the landing hero, and the list of verified problems under it in the same centred width.

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

## 8. MCP surfaces (confirmed by the planning session, 2026-11-20)

Seedup also shows up inside other tools, through MCP. Three surfaces, and which rules hold on each:

| Surface | Where | Rules |
| --- | --- | --- |
| `/agents` | Seedup's own app | Sections 1 to 7, like any app screen |
| Tool text results | Every MCP client (Claude Code, Codex, Cursor, …), read by the agent and often shown to the person | 8.1, 8.2 |
| MCP Apps card (`lib/mcp/apps.ts`) | Hosts that render apps (Claude web and desktop, VS Code) | 8.2, 8.3 |

The text result is the product; the card only adds to it. Every result must be complete and correct for a host that
shows no card.

### 8.1 Tool text results

- **First line is the outcome**, in the product's nouns: `F-03 Reminder schedule [todo]`, `Recorded decision <id> for <key>.`,
  `Connected owner/repo to prd:<id>.` Never a greeting or a restated question.
- **Order:** outcome line, then the locked goal (project tools only, `goalSummary`, four lines at most), then the body,
  then one `Next:` line naming the exact call to make (`Next: get_next_task {"project":"prd:…"}`).
- **Short by default.** Status and progress tools stay near 1,500 characters; the full record comes only from the tools
  that exist to return it (`get_project_memory`, `get_my_prd`). Memory carried on other responses is the last few
  entries (plan 3-11).
- **Language.** Instructions to the agent are in English, so every client reads them the same way. Text the agent should
  show the person word for word goes in a quoted block in the PRD's language (`spec.lang`).
- **Asking the person.** One fixed block, so every agent recognises it:
  ```
  ASK USER (in the terminal, before acting):
  <the question, one sentence>
  Options: <a> / <b>
  After the answer: record_decision {"approval":"대화에서 승인" | "대화에서 거절", …}
  ```
- **Errors** set `isError: true`. The first line says what was wrong, the second how to fix it. An error never echoes a
  value that looked like a secret.
- **Ids are code:** `F-03`, `R-02`, `G-1`, `H-2`, `E-4`, short SHAs. Numbers are counted, never estimated.
- **Never claim more than was checked.** A feature is "verified" only with a verdict and a token (8.2). An agent's own
  report reads as "reported by the agent".

### 8.2 Status marks

Two mark sets appear in the same responses, so each mark always carries its word; an emoji is never the only signal.

| Set | Marks | Text and card |
| --- | --- | --- |
| Feature verification (plan 3-4) | 🟢 `supervisor_verified` · 🔵 `local_checked` · ⚪ `self_reported` | "🟢 감독관 검증 / supervisor verified", "🔵 로컬 확인 / local check", "⚪ 자가 보고 / self-reported". Only 🟢 may use `seed` |
| Success criterion (plan 2-3) | `met` · `partial` · `open` | "met / 충족", "partial / 일부", "open / 미착수". In text, `goalSummary` prefixes 🟢 / 🟡 / ⚪ |

Green means a server check passed: never for a self-report, a local check or a draft.

### 8.3 MCP Apps card

- **Tokens mirror section 2.** The card cannot read `app/globals.css`, so it repeats the hexes, like the email
  templates do: `surface`/`white`, `ink`, `tertiary`, `muted`, `outline-soft`, `surface-low`, `seed`, `seed-soft`,
  `on-seed`, light and dark. Today's card uses its own near-matches; align them when the card is next touched.
- **Type:** 400 / 600 / 700 only (today's 650 becomes 600). 13px minimum, ids in mono. The host forbids outside
  origins, so Pretendard is used only if installed; the system stack is the fallback.
- **Shape:** the host draws the frame, so the card has no outer card; rows split by hairlines. 8px radius on buttons
  and tags. Lays out from 360px wide with no horizontal scroll.
- **Actions:** one primary button per card (seed fill), the rest quiet. A button sends a tool call through the host or
  opens a Seedup page; nothing opens by itself.
- **Safety:** server text goes in through `textContent` only (quotes come from the web); no outside origins.
- **Which tools get a card.** Today: `search_opportunities`, `generate_verified_prd`, `get_build_checklist`,
  `get_next_task`, `mark_feature_done`, `update_feature_status`. Next, in this order: `get_next_task` shows the goal
  block and the person's setup tasks (`humanTasks`) first; `resume_project` as a project card (goal, criteria
  progress, repository, active features); `verify_feature` (stage 2) with each criterion's verdict and the 8.2 mark;
  `record_decision` when it returns an ASK USER block. Text only: `check_env`, `save_handoff`, `get_project_memory`,
  `connect_repo`.

### 8.4 Before an MCP change ships

- The text result alone does the job (read it with the card off).
- The first line is the outcome; one `Next:` line; the length budget in 8.1 holds.
- Every status mark carries its word; green only for a server-checked pass.
- No secret, key value or file content in a response or in stored memory.
- The card works at 360px, light and dark, keyboard only.
- `tests/mcp.test.ts` and the tool's own test cover the new text.

### 8.5 Open for the planning session

- **A warning colour.** The card already uses `warn` (#9a5b00 / #f0b75a) for blocked and needs-recheck, and drift
  warnings (plan 3-6) will need it on `/supervisor`. Section 2 has no such token: add a `warn` / `warn-soft` pair, or
  show warnings with `outline-strong` and words only.
- **⚪ means two things** (self-reported, and criterion not started). Keep both with their words (8.2), or swap one.
- **Agent-facing English.** Tool text is English today; confirm that, or move to the PRD's language throughout.
