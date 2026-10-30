# AGENTS.md

This file provides guidance for AI coding agents working in the **Seven Favors** (formerly *Hanamikoji_web*) repository.

## Project Overview

**Seven Favors** is a browser-based single-player implementation of the two-player card game mechanic inspired by Kota Nakayama's design, built with vanilla HTML, CSS, and ES Modules (no bundler or external runtime dependencies). Players compete against an AI engine with 3 distinct difficulty modes on a fixed 1760×900 scaled stage with Web Animations API card flights and a colour-coded move history rail.

The live application lives entirely under `docs/` for direct GitHub Pages deployment.

---

## Repository Structure

```text
.
├── package.json                # Project root manifest (type: module, test & start scripts)
├── README.md                   # Project overview, rules, running guide, and legal disclaimer
├── art/                        # Reference artwork sprite sheets (cards1.png, cards2.png)
├── tools/
│   └── slice_cards.py          # Dev-only Pillow script to slice art/ sheets into docs/assets/*.png
├── tests/                      # Automated unit and simulation test suite (Node built-in test runner)
│   ├── game.test.js            # Rules, card deck, action validation & scoring tests
│   ├── ai.test.js              # AI decision-making & response tests across 3 difficulties
│   └── simulation.test.js      # Headless multi-game AI vs AI simulation runs
├── docs/                       # Static web application root (GitHub Pages root)
│   ├── index.html              # Entry HTML page (lang="en"): stage, SVG sprite, fx layer
│   ├── assets/                 # Sliced card & character PNG artwork
│   │   ├── background_card.png
│   │   ├── gift_*_Xpts.png     # Item/gift card images (IDs 1..7)
│   │   └── woman_*_Xpts.png    # Character images (IDs 1..7)
│   └── src/
│       ├── main.js             # Entry point: boots the UI on DOMContentLoaded
│       ├── game.js             # Pure game state, rules, turn progression, and scoring
│       ├── ai.js               # Multi-difficulty AI engine (Casual, Tactical, Master)
│       ├── fx.js               # DOM-only Web Animations API helpers (card flights & flips)
│       ├── ui.js               # Single-player UI rendering, async turn sequencing & history rail
│       └── styles.css          # 1760×900 scaled stage layout, theming, tooltips, and animations
```

---

## Running & Testing Locally

Because the app uses native ES modules (`<script type="module" src="src/main.js">`), `docs/index.html` must be served over HTTP rather than opened via `file://`.

### Start a Local Dev Server

```bash
npm start
# or
npx serve docs
# or
python3 -m http.server 8000 --directory docs
```

### Regenerating Card Artwork

If reference sheets in `art/` change, slice them into `docs/assets/` using Pillow:

```bash
python3 tools/slice_cards.py
```

### Running Tests

Automated tests use Node.js's built-in test runner (`node:test`) with zero external dependencies:

```bash
npm test
```

---

## Architecture & Module Responsibilities

1. **`docs/src/game.js` (State & Rules Engine)**
   - Exports `state`, `resetGame`, `startGame`, `startNextRound`, `drawCard`, `performSecret`, `performTradeoff`, `performGift`, `performCompetition`, `getGeishaRows`, and `getResultSummary`.
   - **1-Based Indexing Convention:** Players are indexed `1` (Human) and `2` (AI), and Character/Card types are indexed `1` through `7`. Index `0` in arrays is unused padding.
   - **Card & Deck Definitions:**
     - ID 1: Burger (Value: 2, 2 cards in deck)
     - ID 2: Chips (Value: 2, 2 cards in deck)
     - ID 3: Fidget Spinner (Value: 2, 2 cards in deck)
     - ID 4: Cardigan (Value: 3, 3 cards in deck)
     - ID 5: Sunglasses (Value: 3, 3 cards in deck)
     - ID 6: Concert Ticket (Value: 4, 4 cards in deck)
     - ID 7: Smartphone (Value: 5, 5 cards in deck)
     - Deck contains exactly 21 cards.
   - **Actions (1 each per player per round):**
     - `secret` (1 card): Hidden until `computeEndgame()`.
     - `tradeoff` (2 cards): Permanently discarded from the game.
     - `gift` (3 cards): Opponent picks 1 card; active player receives 2.
     - `competition` (4 cards): Split into Pair 1 (`[0, 1]`) and Pair 2 (`[2, 3]`); opponent picks 1 pair, active player receives the other.
   - **Endgame & Scoring Rules (`computeEndgame()`):**
     - Evaluated after 8 total turns (4 per player).
     - **Precedence Rule:** If one player achieves 11+ Charm Points and the other achieves 4+ Characters, the player with 11+ Charm Points wins.
     - Otherwise, achieving 4+ Characters wins.
     - If neither reaches the threshold, tiebreaker falls back to highest charm points or tie (`0`).
     - **Multi-Round Tie Continuation:** If a round ends in a tie (`winner === 0`), `state.geishalove` is preserved. `startNextRound()` resets the deck, hands, and actions while keeping character favor states and alternating the starting player (`roundStarter`). Additional rounds continue until a player wins.

2. **`docs/src/ai.js` (Artificial Intelligence Engine)**
   - Pure, DOM-free AI decision engine supporting 3 difficulties:
     - `easy` (Casual): Random action selection, simple greedy response to offers.
     - `medium` (Tactical): Evaluates card utility based on contested characters, discards dead cards with Tradeoff, keeps decisive cards with Secret, and balances pairs.
     - `hard` (Master): Card counting, minimax partition for Competition, maximin evaluation for Gift offers, and win condition / threat evaluation.
   - Takes preserved `state.geishalove` into account during Round 2+ heuristic and minimax evaluations.

3. **`docs/src/fx.js` (Animation Helpers)**
   - DOM-only presentation helpers used by `ui.js` (`flyCard`, `wait`, `rectOf`, `clearFx`, `motion`).
   - Animates 3D card flights and flips in `#fx-layer` (outside `#stage` so `position: fixed` viewport coordinates are unaffected by stage transforms) while respecting `prefers-reduced-motion`.

4. **`docs/src/ui.js` (Presentation, Interaction & Turn Sequencing)**
   - Single-player presentation layer managing UI state (`aiDifficulty`, `pendingAction`, `pendingOffer`, `history`, `animating`, `hiddenDraw`, `revealDone`, `resultReady`, `gameToken`, `currentScale`, `gameStarted`) and re-rendering via `render()`.
   - Scales the fixed `1760×900` `#stage` via `--stage-scale` (`fitStage()`) so the interface fills the viewport without scrolling.
   - Renders a left-hand move history rail colour-coded by actor (**blue** = player, **red** = computer), newest move on top, with hover popouts showing card destinations.
   - Competition selection displays `1` and `2` pair badges on selected cards; endgame reveal animates secret cards onto stacks and shows `▼ You` / `▲ AI` favor markers and the result summary.
   - **Round Continuation & Confirmation:** Tie rounds display a "Start Round N" approval button on the result panel (does not offer a fresh restart). Clicking the New Game button at any point during an ongoing match displays an in-stage confirmation modal asking if the user is sure.

5. **`docs/src/styles.css` (Styling & Layout)**
   - Fixed-stage `1760×900` grid layout scaled by `--stage-scale`, zero page scrolling (`overflow: hidden`).
   - CSS variables for theme colors, player/AI accents (`--player-color`, `--ai-color`), card aspect ratio (`--card-ar`), and component heights.

---

## Key Conventions & Gotchas

- **Keep `game.js` and `ai.js` DOM-Free:** Zero DOM or window dependencies. All game rule mutations happen in `game.js`; all tactical evaluations happen in `ai.js`; DOM updates and animations stay in `ui.js` and `fx.js`.
- **Strict Input Validation:** All player action functions validate unique indices and bounds before mutating hand or state.
- **Card ID to Asset Alignment:** IDs `1..7` align with values `[2, 2, 2, 3, 3, 4, 5]` and their corresponding `gift_*_Xpts.png` and `woman_*_Xpts.png` filenames.
- **Language:** All UI text, tooltips, and labels are standardized in English.
- **Attribution & Trademark:** When referencing the inspiration, cite Kota Nakayama and acknowledge EmperorS4 / Taiwan Boardgame Design's trademark rights.
