# Handoff: Trivia — Player Onboarding + Gameplay Redesign

## Overview
A modernized, mobile-first player experience for the live trivia app, plus a **new first-run onboarding flow**. It covers the full player journey: **onboarding (welcome → how-it-works → access code → name) → lobby → live question → final scores**. The visual direction is playful/high-energy ("game night" hype) built on the app's existing neon-on-near-black theme.

The chosen direction (approved by the client) is **"1b" onboarding + "1d" gameplay**, assembled as one connected flow. The design file also contains earlier exploration turns (three onboarding directions, standalone gameplay/results) for reference only — **implement the built-out flow (turn 2 / option `2a`)**.

## About the Design Files
The file in this bundle (`Trivia Redesign.dc.html`) is a **design reference created in HTML** — a prototype demonstrating intended look, layout, copy, and interaction. It is **not production code to copy directly**. It uses a lightweight internal templating runtime and is not React.

Your task: **recreate these designs in the existing codebase** (`@workspace/trivia-game`, a Vite + React + TypeScript app using Tailwind v4 + shadcn/ui, Manrope font, wouter routing, framer-motion). Map each redesigned screen onto the existing pages and reuse the app's established components, tokens, and patterns:

- `src/pages/Gate.tsx` → replace/extend with the **onboarding flow** (welcome, how-it-works, code, name steps)
- `src/pages/Lobby.tsx` → restyle to the new lobby
- `src/pages/GamePlay.tsx` → restyle the question/answer UI
- `src/pages/Results.tsx` → restyle the final-scores leaderboard

Keep all existing data fetching, auth, sockets, and API hooks (`@workspace/api-client-react`) intact — this is a **UI/UX refresh**, not a rewrite of behavior.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, and interactions are specified below. Recreate pixel-close using the codebase's existing Tailwind tokens and shadcn components. Where the prototype uses raw hex, prefer the equivalent existing CSS variable token (see Design Tokens → mapping).

## Design Tokens

The app already defines these in `src/index.css` (HSL custom properties consumed by Tailwind v4 `@theme`). **Reuse them** rather than hardcoding hex.

| Role | CSS token | HSL | Hex (as used in prototype) |
|---|---|---|---|
| Background | `--background` | `220 60% 5%` | ~`#050b14` |
| Card | `--card` | `220 50% 8%` | ~`#0a121e` |
| Border | `--border` / `--card-border` | `220 40% 15%` | ~`#172336` |
| Primary (hot pink) | `--primary` | `330 100% 50%` | `#ff0080` (title glow variant `#ff0f8a`) |
| Secondary (neon cyan) | `--secondary` | `188 100% 50%` | `#00ddff` |
| Accent (electric yellow) | `--accent` | `54 100% 50%` | `#ffe500` |
| Muted text | `--muted-foreground` | `220 20% 70%` | ~`#a3aec2` |

Additional colors used in the playful direction (introduce as needed, ideally as new tokens):
- Purple avatar/3rd place: `#8b5cf6` (foreground `#a78bfa`)
- Green avatar: `#22c55e`
- Orange avatar: `#f97316`
- Playful onboarding backdrop gradient: `linear-gradient(165deg,#2a0a3d 0%,#12061f 55%,#0a0510 100%)`
- Playful subtext on purple bg: `#c7b8e0` / `#b7a8d0` / `#8b7ea3`

**Typography** — `Manrope` (already loaded via `@font-face` in `src/index.css`; weights 300/400/500/600/700/800).

**Spacing / radius**
- Card radius: `16–20px` (onboarding cards `16–18px`, buttons `14–18px`)
- Buttons: height `52–58px`, full-width, bold (800), slight letter-spacing on hero CTAs (`.06em`)
- Screen padding: `22px` horizontal
- Answer rows: padding `15px 16px`, radius `14px`, gap `10–11px`

**Shadows / glows**
- CTA glow: `0 10px 30px rgba(<accentcolor>,.4)` (yellow/pink/cyan variants)
- Neon title: `text-shadow: 0 0 30px rgba(0,221,255,.6)` (cyan word), `0 0 34px rgba(255,0,128,.55)` (pink)
- Correct answer card: `box-shadow: 0 0 22px rgba(0,221,255,.2)`
- Ambient blobs: radial-gradient circles, `filter: blur(22px)`, low-opacity pink (top-left) + cyan (bottom-right)

**Motion** (tasteful — subtle only)
- `pulse` keyframe (opacity 1↔.45, ~1.6–2s) for the "live" dot and the "tap your answer" hint
- `glow` keyframe (opacity .55↔.95, 2s) for the question progress bar fill
- Step/screen transitions: fade + small slide (framer-motion `initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}`), ~300–400ms

## Screens / Views

### 1. Onboarding (NEW) — replaces/precedes `Gate.tsx`
A 4-step first-run flow inside a mobile viewport. Top bar shows a **back chevron** (hidden on step 1) and a **progress indicator**: the active step is a wide yellow pill (`24×8px`, radius 4, yellow glow), inactive steps are `8×8px` dots at `rgba(255,255,255,.22)`. Backdrop: the playful purple gradient with blurred pink/cyan blobs. Content is vertically centered.

- **Step 1 — Welcome**
  - Pill eyebrow "TONIGHT ONLY" — 800/10px, letter-spacing `.2em`, dark text on solid `#ffe500`, radius 20, padding `8px 12px`, left-aligned.
  - Headline "GAME\nNIGHT" — 800/56px, line-height .9, letter-spacing `-.03em`. "GAME" white; "NIGHT" cyan with glow.
  - Body "Big questions. Bigger bragging rights. Let's find out who's actually smart." — 500/16px, color `#c7b8e0`.
  - CTA "Let's go →" — yellow, dark text, height 58, radius 18.
- **Step 2 — How it works ("Here's the deal")**
  - H2 800/30px white.
  - Three rows, each a rounded (16) `rgba(255,255,255,.05)` card with an **8px colored left bar** (row 1 pink, row 2 cyan, row 3 yellow): title (800/16 white) + subtitle (500/13 `#b7a8d0`).
    - "1 · Enter the code" / "Your host shares it at the door."
    - "2 · Grab a name" / "Make it one they'll fear."
    - "3 · Go fast" / "Speed = bonus points."
  - CTA "Got it →" — pink, white text.
- **Step 3 — Access code ("Magic word?")**
  - H2 800/32px + body "Punch in tonight's access code."
  - Large centered input: height 70, uppercase, 800/30px, letter-spacing `.16em`, dark translucent bg `rgba(0,0,0,.35)`, **2px cyan border**, radius 18, subtle cyan glow. Placeholder "CODE".
  - CTA "Check it →" — cyan, dark text.
  - *Wire to existing `POST /api/auth/verify` (see `Gate.tsx handleCodeSubmit`).* 
- **Step 4 — Name + avatar ("You're in!")**
  - H2 + body "Pick a color and a name."
  - Row of 4 color swatches (`46×46`, radius 16): pink (selected → `box-shadow: 0 0 0 3px #ffe500` ring), cyan, purple, green.
  - Name input: height 60, centered, 800/22px, `rgba(0,0,0,.35)` bg, 2px `rgba(255,255,255,.2)` border, radius 18. Placeholder "YOUR NAME".
  - CTA "Enter the lobby →" — yellow, dark text.
  - *Wire to existing `POST /api/auth/login` (see `Gate.tsx handleNameSubmit`); on success route to `/lobby`.*

### 2. Lobby — restyle `Lobby.tsx`
- Header: "THE LOBBY" 800/30px white; subline "Playing as **Alex**" (name in cyan 800).
- Stat strip: three equal rounded (14) `rgba(255,255,255,.05)` chips — value (800/20, colored: cyan/yellow/pink) over label (600/9, `.14em`, muted). Labels: LIVE, PLAYERS, TOP.
- Live game card: radius 20, padding 18, pink-tinted gradient bg `linear-gradient(160deg,rgba(255,0,128,.16),rgba(255,0,128,.04))` with `1.5px rgba(255,0,128,.4)` border.
  - "● LIVE NOW" — 800/10, `.18em`, `#ff5aa8`, with pulsing pink dot.
  - Title "80s Movie Trivia" 800/24 white.
  - Meta: "12 questions" (600/13 `#c7b8e0`) · MEDIUM difficulty chip (yellow-tinted, radius 8).
  - Overlapping avatar stack (5 circles `30px`, `-8px` overlap, `2px #1a0728` border) ending in a "+8" chip.
  - CTA "JOIN GAME →" — yellow, dark text, height 54, radius 16.
- *Reuse existing `useListGames`, `ActiveGameCard`, `useJoinGame` logic; this is styling only.*

### 3. Gameplay — restyle `GamePlay.tsx`
- Top row: "QUESTION 4 / 12" (700/10, `.24em`, muted) left; score pill "★ 230" right (800/14, dark text on yellow, radius 20, glow).
- Progress bar: 6px track `rgba(255,255,255,.1)`, fill 62% width, gradient `linear-gradient(90deg,#ff0080,#ffe500)`, `glow` animation.
- Category/points chips row: "GEOGRAPHY" (cyan-tinted) + "10 PTS" (yellow-tinted) — 700/10, `.12em`, radius 8, 1px tinted border.
- Question: H2 800/22px, line-height 1.22, white, letter-spacing `-.01em`.
- Answer choices (vertical, gap 10):
  - **Default (unanswered):** clickable, `rgba(255,255,255,.04)` bg, `1px rgba(255,255,255,.12)` border, radius 14; leading letter badge (`30px` circle, 1.5px muted border) + label (600/15).
  - **Correct (after answer):** cyan border + `rgba(0,221,255,.15)` bg + cyan glow; badge solid cyan with dark text; trailing "✓".
  - **Wrong (the one you picked, if wrong):** pink border + `rgba(255,0,128,.15)` bg; badge solid pink; trailing "✗".
  - **Dimmed (other wrong options):** `opacity:.45`.
- Footer: before answering, pulsing hint "Tap your answer — the clock's ticking" (500/12 muted). After answering, CTA "SEE RESULTS →" (yellow) — in production this advances to the next question; final question → results.
- *Reuse existing `useSubmitAnswer`, feedback + stats logic. Sample question in the mock: "Which river is traditionally considered the longest in the world?" → correct "The Nile".*

### 4. Final Scores — restyle `Results.tsx`
Clean ranked leaderboard (intentionally **not** a chunky podium).
- Header: eyebrow "FINAL SCORES" (600/10, `.28em`, muted); title "80s Movie Trivia" 800/26 white; subline "12 questions · 6 players" (500/13 muted).
- Single rounded (16) list, rows separated by 1px gaps (`rgba(255,255,255,.06)` container showing through):
  - **Rank 1 (winner):** pink wash `linear-gradient(120deg,rgba(255,0,128,.16),rgba(255,0,128,.03))`, larger 36px pink avatar, name 800/16 white, score 800/17 white, rank numeral in `#ff5aa8`.
  - **Ranks 2–3, 5:** `rgba(15,10,22,.6)` bg, 32px avatar, name 700/15, score 700/15 muted, rank numeral muted.
  - **"You" row:** subtle highlight `rgba(255,255,255,.04)` + `inset 2px 0 0 #ffe500` left edge bar; rank numeral, name, and score in yellow (800).
  - All scores use `font-variant-numeric: tabular-nums`.
  - Sample data: 1 Alex 340, 2 Jamie 290, 3 Sam 255, 4 **You** 210, 5 Riley 195.
- Footer actions: "Play again" (flex-1, yellow, dark text, height 52, radius 14) + "Share" (92px wide, `rgba(255,255,255,.07)` bg, `1px rgba(255,255,255,.14)` border).

## Interactions & Behavior
- **Onboarding nav:** Next advances step; back chevron decrements (hidden on step 1). Advancing past step 4 routes to the lobby.
- **Answer selection:** first tap locks the answer, reveals correct/incorrect coloring, dims other options, swaps the hint for the advance CTA. (In production, gate on server feedback via `useSubmitAnswer`.)
- **Results "Play again":** returns to lobby/onboarding start.
- **Responsive:** designed mobile-first (~320–360px wide). On desktop, center the column at a comfortable max-width and keep the same vertical layout (the current app already renders players on phones and hosts on desktop).
- Keep existing loading/error/toast handling from each page.

## State Management
Onboarding step state is local UI state (`step: 0–3`, selected avatar, code, name). All game/lobby/results data continues to come from the existing hooks:
- `useListGames`, `useJoinGame`, `useListGameParticipants`
- `useGetGame`, `useListGameQuestions`, `useSubmitAnswer`, `useListUserAnswers`
- auth via `useAuth()` (`loginUser`, `logout`)
No new data-fetching requirements are introduced by the redesign.

## Assets
- **Font:** Manrope (already bundled in the app under `/fonts/manrope-*.otf`). The prototype loads it from Google Fonts for portability — use the local bundle in production.
- **Icons:** the prototype uses text glyphs (‹ ✓ ✗ ★ ●) for portability. In production, use the existing **lucide-react** icons already imported across the pages (e.g. `ChevronLeft`, `CheckCircle2`, `XCircle`, `Star`, `Radio`).
- No image assets are required.

## Screenshots
Reference renders of the built-out flow (option `2a`), in `screens/`:
1. `01-onboarding-welcome.png` — Step 1, welcome/hero
2. `02-onboarding-how-it-works.png` — Step 2, "Here's the deal"
3. `03-onboarding-code.png` — Step 3, access code
4. `04-onboarding-name.png` — Step 4, name + avatar
5. `05-lobby.png` — Lobby with live game card
6. `06-gameplay-question.png` — Question, unanswered
7. `07-gameplay-answer-reveal.png` — Answer selected (correct reveal + dimmed options)
8. `08-final-scores.png` — Final scores leaderboard

## Files
- `Trivia Redesign.dc.html` — the design prototype. Implement **option `2a`** (turn 2: the connected built-out flow). Earlier turn (`1a/1b/1c/1d/1e`) is exploration/reference only.
- `screens/` — reference screenshots (see above).
