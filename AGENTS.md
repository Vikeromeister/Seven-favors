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
│   ├── net.test.js             # Online WebRTC/PeerJS sessions, room codes & state sync tests
│   ├── ui.test.js              # UI contracts (peek, default random starter, diff labels, online 2P)
│   ├── ui_integrity.test.js    # Element definition & HTML ID integrity tests
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
│       ├── ai.js               # Multi-difficulty AI engine (Easy, Medium, Hard)
│       ├── fx.js               # DOM-only Web Animations API helpers (card flights & flips)
│       ├── net-config.js       # WebRTC signaling, STUN/TURN ICE servers & timeout config
│       ├── net.js              # PeerJS P2P DataChannel session manager (lazy loader, room codes)
│       ├── ui.js               # Single-player & Online 2P UI rendering, turn sequencing & history rail
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
   - Exports `state`, `resetGame(startingPlayer = 1)`, `startGame(startingPlayer = 1)`, `startNextRound`, `drawCard`, `performSecret`, `performTradeoff`, `performGift`, `performCompetition`, `getGeishaRows`, `getResultSummary`, `buildPlayerView`, and `applyPlayerView`.
   - **1-Based Indexing Convention:** Players are indexed `1` (Human / Host) and `2` (AI / Guest), and Character/Card types are indexed `1` through `7`. Index `0` in arrays is unused padding.
   - **Selectable Starting Player:** `resetGame` and `startGame` accept `1`, `2`, or `'random'` (resolving `'random'` once into concrete `1` or `2` stored in `state.roundStarter`, defaulting to `'random'`). `getResultSummary()` exposes `round` and `roundStarter`.
   - **Sanitized State Projections (`buildPlayerView` / `applyPlayerView`):** Produces sanitized state views masking deck contents, opponent's hand cards, and opponent's secret card (masked as `0` until `gameOver`) for secure online multiplayer transmission and synchronization.
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
     - `easy` (Easy): Random action selection, simple greedy response to offers.
     - `medium` (Medium): Evaluates card utility based on contested characters, discards dead cards with Tradeoff, keeps decisive cards with Secret, and balances pairs.
     - `hard` (Hard): Card counting, minimax partition for Competition, maximin evaluation for Gift offers, and win condition / threat evaluation.
   - Takes preserved `state.geishalove` into account during Round 2+ heuristic and minimax evaluations.

3. **`docs/src/fx.js` (Animation Helpers)**
   - DOM-only presentation helpers used by `ui.js` (`flyCard`, `wait`, `rectOf`, `clearFx`, `motion`).
   - Animates 3D card flights and flips in `#fx-layer` (outside `#stage` so `position: fixed` viewport coordinates are unaffected by stage transforms) while respecting `prefers-reduced-motion`.

4. **`docs/src/net-config.js` & `docs/src/net.js` (P2P Networking & WebRTC DataChannels)**
   - Zero-dependency configuration and session manager for peer-to-peer browser connectivity via PeerJS.
   - Generates and normalizes 6-character room codes (`ROOM_ALPHABET`), manages peer IDs with `roomPrefix`, handles host/join handshakes (`hello` / `welcome` / `room_full`), and runs periodic ping/pong heartbeats.
   - Lazy-loads PeerJS from CDN on demand (leaving offline Single Player 100% offline-capable and tests dependency-free with injectable mock peers).

5. **`docs/src/ui.js` (Presentation, Interaction, Turn Sequencing & Online Multiplayer)**
   - Single-player and Online 2P presentation layer managing UI state (`gameMode`, `localSeat`, `aiDifficulty`, `startingPlayerPref`, `pendingAction`, `pendingOffer`, `history`, `animating`, `hiddenDraw`, `revealDone`, `resultReady`, `gameToken`, `currentScale`, `gameStarted`, `netSession`) and re-rendering via `render()`.
   - Pre-game setup screen lets the player choose between Single Player (`Easy`, `Medium`, `Hard`) and Online 2P (`Host Room` with 6-char code & `?room=` link, or `Join Room`), with Round 1 starting player defaulting to `Random` (Coin toss).
   - Symmetrically renders the board from the local player's perspective (`localSeat` / `oppSeat()`), placing the local player at the bottom with blue accents and the opponent at the top with red accents.
   - Manages serialized turn queue (`enqueueNetTurn`) and out-of-band signals for smooth online animations across browsers with differing `prefers-reduced-motion` settings.
   - Scales the fixed `1760×900` `#stage` via `--stage-scale` (`fitStage()`) so the interface fills the viewport without scrolling.
   - Renders a left-hand move history rail colour-coded by actor (**blue** = player, **red** = opponent/computer), newest move on top, with hover popouts showing card destinations.
   - Competition selection displays `1` and `2` pair badges on selected cards; endgame reveal animates secret cards onto stacks and shows `▼ You` / `▲ AI` (or `▲ Opp`) favor markers and the result summary.
   - **Round Continuation & Online Ready Handshake:** Tie rounds and rematches support a mutual ready handshake between players before the host initiates the next round. Disconnects trigger a recovery modal (`#disconnect-modal`).
   - **View Board Peek Mode:** Interactive pop-up overlays (AI/opponent Gift/Competition offer tray and the end-of-round result panel) include a **View Board** button supporting both press-and-hold to peek and click/keyboard toggle (`#peek-restore-button`) so the player can inspect un-dimmed character columns, secret slots, and the move history rail at any time without accidental input.

6. **`docs/src/styles.css` (Styling & Layout)**
   - Fixed-stage `1760×900` grid layout scaled by `--stage-scale`, zero page scrolling (`overflow: hidden`).
   - CSS variables for theme colors, player/opponent accents (`--player-color`, `--ai-color`), card aspect ratio (`--card-ar`), and component heights.
   - Perspective-safe stack badge alignment (`.stack-bottom` / `.stack-top`) and responsive setup card with selectable room codes (`user-select: text`).

---

## Key Conventions & Gotchas

- **Keep `game.js` and `ai.js` DOM-Free:** Zero DOM or window dependencies. All game rule mutations happen in `game.js`; all tactical evaluations happen in `ai.js`; DOM updates and animations stay in `ui.js` and `fx.js`.
- **Strict Input Validation:** All player action functions validate unique indices and bounds before mutating hand or state.
- **Card ID to Asset Alignment:** IDs `1..7` align with values `[2, 2, 2, 3, 3, 4, 5]` and their corresponding `gift_*_Xpts.png` and `woman_*_Xpts.png` filenames.
- **Language:** All UI text, tooltips, and labels are standardized in English.
- **Attribution & Trademark:** When referencing the inspiration, cite Kota Nakayama and acknowledge EmperorS4 / Taiwan Boardgame Design's trademark rights.
