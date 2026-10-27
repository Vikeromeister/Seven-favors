# AGENTS.md

This file provides guidance for AI coding agents working in the **Seven Favors** (formerly *Hanamikoji_web*) repository.

## Project Overview

**Seven Favors** is a browser-based implementation of the two-player card game mechanic inspired by Kota Nakayama's design, built with vanilla HTML, CSS, and ES Modules (no bundler or external runtime dependencies). It supports both single-player (vs. AI with 3 distinct difficulty modes) and local pass-and-play multiplayer modes with privacy transitions.

The live application lives entirely under `docs/` for direct GitHub Pages deployment.

---

## Repository Structure

```text
.
├── package.json                # Project root manifest (type: module, test & start scripts)
├── README.md                   # Project overview, rules, running guide, and legal disclaimer
├── tests/                      # Automated unit and simulation test suite (Node built-in test runner)
│   ├── game.test.js            # Rules, card deck, action validation & scoring tests
│   ├── ai.test.js              # AI decision-making & response tests across 3 difficulties
│   └── simulation.test.js      # Headless multi-game AI vs AI simulation runs
├── docs/                       # Static web application root (GitHub Pages root)
│   ├── index.html              # Entry HTML page (lang="en")
│   ├── assets/                 # Modern card & character PNG artwork
│   │   ├── background_card.png
│   │   ├── gift_*_Xpts.png     # Item/gift card images (IDs 1..7)
│   │   └── woman_*_Xpts.png    # Character images (IDs 1..7)
│   └── src/
│       ├── main.js             # Entry point: boots the UI on DOMContentLoaded
│       ├── game.js             # Pure game state, rules, turn progression, and scoring
│       ├── ai.js               # Multi-difficulty AI engine (Casual, Tactical, Master)
│       ├── ui.js               # DOM rendering, event listeners, pairing preview, and transitions
│       └── styles.css          # Layout, theming, card sizing, favor badges, and responsive rules
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

### Running Tests

Automated tests use Node.js's built-in test runner (`node:test`) with zero external dependencies:

```bash
npm test
```

---

## Architecture & Module Responsibilities

1. **`docs/src/game.js` (State & Rules Engine)**
   - Exports `state`, `resetGame`, `startGame`, `drawCard`, `performSecret`, `performTradeoff`, `performGift`, `performCompetition`, `getGeishaRows`, and `getResultSummary`.
   - **1-Based Indexing Convention:** Players are indexed `1` and `2`, and Character/Card types are indexed `1` through `7`. Index `0` in arrays is unused padding.
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

2. **`docs/src/ai.js` (Artificial Intelligence Engine)**
   - Pure, DOM-free AI decision engine supporting 3 difficulties:
     - `easy` (Casual): Random action selection, simple greedy response to offers.
     - `medium` (Tactical): Evaluates card utility based on contested characters, discards dead cards with Tradeoff, keeps decisive cards with Secret, and balances pairs.
     - `hard` (Master): Card counting, minimax partition for Competition, maximin evaluation for Gift offers, and win condition / threat evaluation.

3. **`docs/src/ui.js` (Presentation, Interaction & Transitions)**
   - Manages UI state (`pendingAction`, `offerChoices`, `transition`, `gameMode`, `aiDifficulty`) and re-renders via `render()`.
   - Competition UI displays explicit `Pair 1` and `Pair 2` tags directly on cards in hand during selection.
   - Character columns display dynamic visual favor markers (`▲ Favors AI / P2`, `● Neutral`, `▼ Favors P1`).
   - Handles pass-and-play privacy transitions and game over result breakdown.

4. **`docs/src/styles.css` (Styling & Layout)**
   - Flexible responsive layout without overflow clipping.
   - CSS variables for theme colors and character accents.

---

## Key Conventions & Gotchas

- **Keep `game.js` and `ai.js` DOM-Free:** Zero DOM or window dependencies. All game rule mutations happen in `game.js`; all tactical evaluations happen in `ai.js`; DOM updates stay in `ui.js`.
- **Strict Input Validation:** All player action functions validate unique indices and bounds before mutating hand or state.
- **Card ID to Asset Alignment:** IDs `1..7` align with values `[2, 2, 2, 3, 3, 4, 5]` and their corresponding `gift_*_Xpts.png` and `woman_*_Xpts.png` filenames.
- **Language:** All UI text, prompts, and status messages are standardized in English.
- **Attribution & Trademark:** When referencing the inspiration, cite Kota Nakayama and acknowledge EmperorS4 / Taiwan Boardgame Design's trademark rights.
