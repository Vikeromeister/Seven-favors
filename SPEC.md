# SPEC — Multi-Round Tie Continuation, New Game Confirmation & Selectable Starting Player

## Root Cause / Objective
We must preserve Geisha favor states (`state.geishalove`) across tied 8-turn rounds (`state.winner === 0`) so subsequent rounds launch upon user approval with alternating starting players until a winner is decided, while guarding `#restart-button` with an in-stage confirmation modal during active matches. Additionally, before starting a new game on `#mode-selection-screen`, the user must be able to select the Round 1 starting player (`You`, `Computer`, or `Random`) alongside AI difficulty, with Round 1 kicking off AI opening turns cleanly when Player `2` starts and Round 2+ deterministically alternating from the prior round's concrete starter.

## File Map
| Path | Operation | Purpose |
|---|---|---|
| `docs/src/game.js` | Modify | Track `round`, `roundStarter`, and `priorGeishaLove`; preserve `geishalove` on ties; add `resolveStarter()`, `resetGame(startingPlayer = 1)`, `startGame(startingPlayer = 1)`, and `startNextRound()`; expose `priorOwner`, `round`, and `roundStarter`. |
| `docs/src/ai.js` | Modify | Make `evaluateCardUtility()` and `scoreBoardState()` account for preserved `state.geishalove` in Round 2+. |
| `docs/index.html` | Modify | Add `#round-badge` in `.top-bar`, `#confirm-modal` inside `#stage`, and selectable difficulty + starting-player groups (`You`, `Computer`, `Random`) + `#start-game-button` inside `#mode-selection-screen`. |
| `docs/src/styles.css` | Modify | Layer `.result-panel` (`100`), `.top-bar` (`110`), `.mode-selection-screen` (`120`), and `.confirm-modal` (`130`); style `.confirm-modal`, `.result-sub`, `.setup-buttons`, `.setup-button` (`.selected`), and `.start-game-btn`. |
| `docs/src/ui.js` | Modify | Render preserved favor markers, manage `startingPlayerPref` & `updateSetupSelectionUI()`, unify Round 1 and Round 2+ AI opening-turn sequencing via `kickoffRound()`, show next-starter info on tie panels, and guard restarts with `#confirm-modal`. |
| `tests/game.test.js` | Modify | Add unit tests for multi-round ties, preserved `geishalove`, `startGame(1 | 2 | 'random')`, full 8-turn round when Player 2 starts, and alternating starters across rounds. |
| `tests/ai.test.js` | Modify | Add unit tests verifying AI decisions and responses respect preserved `geishalove` in Round 2+. |
| `tests/simulation.test.js` | Modify | Extend headless multi-game and multi-round tie simulations across `1`, `2`, and `'random'` initial starters until a decisive winner is reached. |
| `AGENTS.md` | Modify | Document `startGame(startingPlayer)`, `startNextRound()`, pre-game starter selection, multi-round tie continuation, and the New Game confirmation modal. |
| `README.md` | Modify | Document pre-game starting player selection, alternating round starters, multi-round tie rules, and New Game confirmation. |

---

## Technical Blueprint

### 1. Rules, Selectable Starter & Multi-Round State (`docs/src/game.js`)

#### 1.1 State Additions
Extend `state` with `round`, `roundStarter`, and `priorGeishaLove`:
```js
export const state = {
  deck: [],
  round: 1,
  roundStarter: 1,
  currentPlayer: 1,
  turnsTaken: 0,
  players: { /* unchanged */ },
  geishagifts: [null, Array(8).fill(0), Array(8).fill(0)],
  secretCard: [null, null, null],
  geishalove: Array(8).fill(0),
  priorGeishaLove: Array(8).fill(0),
  scores: [0, 0, 0],
  geishaCount: [0, 0, 0],
  gameOver: false,
  winner: 0,
  message: ''
};
```

#### 1.2 Starter Resolution, Shared Deal Helper, `resetGame`, `startGame`, and `startNextRound`
Accept `startingPlayer` (`1 | 2 | 'random'`, defaulting to `1`) in `resetGame` and `startGame`. Resolve `'random'` once in `resetGame` into concrete `1` or `2` stored in `state.roundStarter` so `startNextRound()` always alternates via `other(state.roundStarter)`:
```js
function recomputeScoresFromLove() {
  state.scores = [0, 0, 0];
  state.geishaCount = [0, 0, 0];
  for (let i = 1; i <= 7; i++) {
    if (state.geishalove[i] === 1) {
      state.scores[1] += CARD_VALUES[i];
      state.geishaCount[1] += 1;
    } else if (state.geishalove[i] === 2) {
      state.scores[2] += CARD_VALUES[i];
      state.geishaCount[2] += 1;
    }
  }
}

/**
 * @param {1 | 2 | 'random'} [startingPlayer=1]
 * @returns {1 | 2}
 */
function resolveStarter(startingPlayer = 1) {
  if (startingPlayer === 1 || startingPlayer === 2) {
    return startingPlayer;
  }
  if (startingPlayer === 'random') {
    return Math.random() < 0.5 ? 1 : 2;
  }
  return 1;
}

function dealRound(starter) {
  state.deck = shuffle(INITIAL_DECK);
  state.roundStarter = starter;
  state.currentPlayer = starter;
  state.turnsTaken = 0;
  state.players[1].hand = state.deck.slice(0, 6);
  state.players[2].hand = state.deck.slice(6, 12);
  state.deck = state.deck.slice(12);
  sortHand(state.players[1].hand);
  sortHand(state.players[2].hand);
  state.players[1].actions = { secret: true, tradeoff: true, gift: true, competition: true };
  state.players[2].actions = { secret: true, tradeoff: true, gift: true, competition: true };
  state.geishagifts = [null, Array(8).fill(0), Array(8).fill(0)];
  state.secretCard = [null, null, null];
  state.gameOver = false;
  state.winner = 0;
}

export function resetGame(startingPlayer = 1) {
  const starter = resolveStarter(startingPlayer);
  state.round = 1;
  dealRound(starter);
  state.geishalove = Array(8).fill(0);
  state.priorGeishaLove = Array(8).fill(0);
  state.scores = [0, 0, 0];
  state.geishaCount = [0, 0, 0];
  state.message = `The game has started. Player ${starter} goes first.`;
}

export function startNextRound() {
  if (!state.gameOver || state.winner !== 0) {
    return false;
  }
  const preservedLove = [...state.geishalove];
  const nextStarter = other(state.roundStarter);
  state.round += 1;
  dealRound(nextStarter);
  state.geishalove = preservedLove;
  state.priorGeishaLove = [...preservedLove];
  recomputeScoresFromLove();
  state.message = `Round ${state.round} has started. Player ${state.currentPlayer} goes first.`;
  drawCard(state.currentPlayer);
  return true;
}

export function startGame(startingPlayer = 1) {
  resetGame(startingPlayer);
  drawCard(state.currentPlayer);
}
```

#### 1.3 Preserving `geishalove` in `computeEndgame()` & Summary Exports
Snapshot `priorGeishaLove` before applying secret cards and update `geishalove[i]` only where one player strictly leads in `geishagifts` (leaving tied gifts unchanged so Round 2+ retains prior favors):
```js
export function computeEndgame() {
  state.priorGeishaLove = [...state.geishalove];
  if (state.secretCard[1] !== null) {
    state.geishagifts[1][state.secretCard[1]] += 1;
  }
  if (state.secretCard[2] !== null) {
    state.geishagifts[2][state.secretCard[2]] += 1;
  }
  for (let i = 1; i <= 7; i++) {
    if (state.geishagifts[1][i] > state.geishagifts[2][i]) {
      state.geishalove[i] = 1;
    } else if (state.geishagifts[2][i] > state.geishagifts[1][i]) {
      state.geishalove[i] = 2;
    }
    // Equal gifts: state.geishalove[i] stays unchanged (0 in Round 1, or preserved owner in Round 2+)
  }
  recomputeScoresFromLove();

  const p1Points = state.scores[1] >= 11;
  const p2Points = state.scores[2] >= 11;
  const p1Geishas = state.geishaCount[1] >= 4;
  const p2Geishas = state.geishaCount[2] >= 4;

  if (p1Points && !p2Points) {
    state.winner = 1;
  } else if (p2Points && !p1Points) {
    state.winner = 2;
  } else if (p1Geishas && !p2Geishas) {
    state.winner = 1;
  } else if (p2Geishas && !p1Geishas) {
    state.winner = 2;
  } else if (state.scores[1] > state.scores[2]) {
    state.winner = 1;
  } else if (state.scores[2] > state.scores[1]) {
    state.winner = 2;
  } else {
    state.winner = 0;
  }
}

function finishGame() {
  computeEndgame();
  state.gameOver = true;
  if (state.winner === 0) {
    state.message = `Round ${state.round} ended in a tie!`;
  } else {
    state.message = `Game over! Player ${state.winner} wins.`;
  }
}
```
Update `getGeishaRows()` and `getResultSummary()`:
- In `getGeishaRows()`, include `priorOwner: state.priorGeishaLove[cardId]`.
- In `getResultSummary()`, include `round: state.round` and `roundStarter: state.roundStarter`:
```js
export function getResultSummary() {
  return {
    player1: {
      score: state.scores[1],
      geishaCount: state.geishaCount[1],
      secretCard: state.secretCard[1]
    },
    player2: {
      score: state.scores[2],
      geishaCount: state.geishaCount[2],
      secretCard: state.secretCard[2]
    },
    winner: state.winner,
    round: state.round,
    roundStarter: state.roundStarter
  };
}
```

---

### 2. AI Carryover Awareness (`docs/src/ai.js`)

#### 2.1 `evaluateCardUtility(player, state)`
Account for current ownership (`state.geishalove?.[g] ?? 0`), since holding a Geisha already requires only tying (`Math.ceil(val / 2)`) to retain her:
```js
function evaluateCardUtility(player, state) {
  const opp = other(player);
  const utilities = {};

  for (let g = 1; g <= 7; g++) {
    const val = cardValue(g);
    const myGifts = state.geishagifts[player][g];
    const oppGifts = state.geishagifts[opp][g];
    const currentOwner = state.geishalove?.[g] ?? 0;
    const neededToWin = currentOwner === player ? Math.ceil(val / 2) : Math.floor(val / 2) + 1;
    const neededForOpp = currentOwner === opp ? Math.ceil(val / 2) : Math.floor(val / 2) + 1;

    if (myGifts >= neededToWin) {
      utilities[g] = 0;
    } else if (oppGifts >= neededForOpp) {
      utilities[g] = 0;
    } else {
      const margin = myGifts - oppGifts;
      let weight = val * 2;
      if (myGifts + 1 >= neededToWin) {
        weight += val * 3;
      }
      if (margin < 0 || (margin === 0 && currentOwner === opp)) {
        weight += val;
      }
      utilities[g] = weight;
    }
  }

  return utilities;
}
```

#### 2.2 `scoreBoardState(player, giftsP1, giftsP2, secretP1, secretP2, geishaLove = null)`
When `myCount === oppCount`, fall back to `geishaLove?.[g] ?? 0` and pass `state.geishalove` at all 6 call sites in `docs/src/ai.js`.

---

### 3. HTML Markup (`docs/index.html`)

#### 3.1 Top Bar `#round-badge` & Stage `#confirm-modal`
1. `#round-badge` inside `<header class="top-bar">` right before `#turn-badge`:
```html
        <header class="top-bar">
          <span id="round-badge" class="badge">Round 1</span>
          <span id="turn-badge" class="badge">Turn 1 / 8</span>
          <span id="difficulty-badge" class="badge">Tactical AI</span>
          <button id="restart-button" class="icon-btn" type="button" data-tip="New game" aria-label="New game">
            <svg class="icon" aria-hidden="true"><use href="#icon-restart"/></svg>
          </button>
        </header>
```

2. `#confirm-modal` inside `#stage` immediately after `#mode-selection-screen`:
```html
      <div id="confirm-modal" class="confirm-modal hidden" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
        <div class="confirm-modal-card">
          <h2 id="confirm-modal-title">End Current Game?</h2>
          <p class="confirm-modal-desc">Starting a new game will end the current game. Are you sure?</p>
          <div class="confirm-modal-actions">
            <button id="confirm-cancel-button" class="modal-btn secondary" type="button">Cancel</button>
            <button id="confirm-accept-button" class="modal-btn danger" type="button">Yes, New Game</button>
          </div>
        </div>
      </div>
```

#### 3.2 Pre-Game Setup Screen (`#mode-selection-screen`)
Replace `#mode-selection-screen` (lines 72–93) with two symmetric 3-option toggle groups (`#difficulty-buttons` and `#starter-buttons`) plus `#start-game-button`:
```html
      <div id="mode-selection-screen" class="mode-selection-screen">
        <div class="mode-selection-card">
          <h1>Seven Favors</h1>
          <p class="subtitle">A tactical duel of secret gifts, shrewd trades, and contested favor.</p>

          <p class="mode-desc">Choose your opponent:</p>
          <div id="difficulty-buttons" class="setup-buttons" role="group" aria-label="AI difficulty">
            <button id="ai-casual-button" class="setup-button" type="button" data-diff="easy" aria-pressed="false">
              <strong>Casual</strong>
              <span>Easy / Relaxed</span>
            </button>
            <button id="ai-tactical-button" class="setup-button selected" type="button" data-diff="medium" aria-pressed="true">
              <strong>Tactical</strong>
              <span>Medium / Balanced</span>
            </button>
            <button id="ai-master-button" class="setup-button" type="button" data-diff="hard" aria-pressed="false">
              <strong>Master</strong>
              <span>Hard / Minimax</span>
            </button>
          </div>

          <p class="mode-desc">Starting player:</p>
          <div id="starter-buttons" class="setup-buttons" role="group" aria-label="Starting player">
            <button id="starter-human-button" class="setup-button selected" type="button" data-starter="1" aria-pressed="true">
              <strong>You</strong>
              <span>You go first</span>
            </button>
            <button id="starter-ai-button" class="setup-button" type="button" data-starter="2" aria-pressed="false">
              <strong>Computer</strong>
              <span>AI goes first</span>
            </button>
            <button id="starter-random-button" class="setup-button" type="button" data-starter="random" aria-pressed="false">
              <strong>Random</strong>
              <span>Coin toss</span>
            </button>
          </div>

          <button id="start-game-button" class="primary start-game-btn" type="button">Start Game</button>

          <p class="disclaimer">Inspired by the core tabletop game mechanics designed by Kota Nakayama. <em>Hanamikoji</em> is a registered trademark of EmperorS4 and Taiwan Boardgame Design. All code and visual assets in this project are independent and created for non-commercial educational purposes.</p>
        </div>
      </div>
```

---

### 4. Stage Layering, Modal & Pre-Game Setup Styling (`docs/src/styles.css`)

#### 4.1 Top Bar & Overlay Stacking + `.confirm-modal`
Maintain overlay stacking order: `.result-panel` (`z-index: 100`), `.top-bar` (`z-index: 110`), `.mode-selection-screen` (`z-index: 120`), and `.confirm-modal` (`z-index: 130`).

#### 4.2 Tie Subtitle (`.result-sub`) & Pre-Game Setup Controls
1. Add `.result-sub` right after `.result-winner` (around line 866):
```css
.result-sub {
  margin: -12px 0 20px 0;
  font-size: 0.95rem;
  color: var(--text-muted);
}
```

2. Update `.mode-selection-card` and replace `.difficulty-buttons` / `.diff-button` rules (lines 920–982) with unified setup option rules fitting cleanly inside the `900px` stage height:
```css
.mode-selection-card {
  max-width: 580px;
  width: 100%;
  padding: 32px 36px;
  background: rgba(24, 40, 66, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  text-align: center;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
}

.mode-selection-card h1 {
  margin: 0 0 6px 0;
  font-size: 2.2rem;
  color: var(--accent);
}

.subtitle {
  color: var(--text-muted);
  margin-top: 0;
  margin-bottom: 20px;
  font-size: 0.95rem;
}

.mode-desc {
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--text-muted);
  margin: 0 0 10px 0;
}

.setup-buttons {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 18px;
}

.setup-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  transform: translateY(0);
  transition: transform 0.15s, background 0.15s, border-color 0.15s, box-shadow 0.15s;
}

.setup-button:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.11);
}

.setup-button.selected {
  background: rgba(244, 211, 94, 0.16);
  border-color: var(--accent);
  box-shadow: 0 0 0 1px rgba(244, 211, 94, 0.35), 0 8px 20px rgba(0, 0, 0, 0.28);
}

.setup-button strong {
  font-size: 0.95rem;
  color: var(--text);
}

.setup-button.selected strong {
  color: var(--accent);
}

.setup-button span {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.setup-button.selected span {
  color: var(--text);
}

.start-game-btn {
  width: 100%;
  margin-top: 4px;
  padding: 14px 28px;
  font-size: 1.05rem;
  font-weight: 800;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  transform: translateY(0);
  transition: transform 0.15s, filter 0.15s;
}

.start-game-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.08);
}
```
*(Keep `.primary` and `.secondary` intact as they style `.start-game-btn`, `.restart-result-btn`, and `.modal-btn.secondary`.)*

---

### 5. UI Presentation, Pre-Game Setup, Confirmation Flow & Turn Sequencing (`docs/src/ui.js`)

#### 5.1 DOM Refs, Module State & Setup Helpers
Extend `els` with setup controls:
```js
  modeSelectionScreen: document.getElementById('mode-selection-screen'),
  difficultyButtons: document.getElementById('difficulty-buttons'),
  aiCasualButton: document.getElementById('ai-casual-button'),
  aiTacticalButton: document.getElementById('ai-tactical-button'),
  aiMasterButton: document.getElementById('ai-master-button'),
  starterButtons: document.getElementById('starter-buttons'),
  starterHumanButton: document.getElementById('starter-human-button'),
  starterAiButton: document.getElementById('starter-ai-button'),
  starterRandomButton: document.getElementById('starter-random-button'),
  startGameButton: document.getElementById('start-game-button'),
  roundBadge: document.getElementById('round-badge'),
  confirmModal: document.getElementById('confirm-modal'),
  confirmCancelButton: document.getElementById('confirm-cancel-button'),
  confirmAcceptButton: document.getElementById('confirm-accept-button')
```

Add `startingPlayerPref` alongside `aiDifficulty` and `gameStarted`:
```js
let aiDifficulty = 'medium';
let startingPlayerPref = HUMAN; // 1 (HUMAN) | 2 (AI_PLAYER) | 'random'
```

Add `updateSetupSelectionUI()` alongside the confirmation modal helpers:
```js
function updateSetupSelectionUI() {
  els.difficultyButtons.querySelectorAll('[data-diff]').forEach((btn) => {
    const active = btn.dataset.diff === aiDifficulty;
    btn.classList.toggle('selected', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  els.starterButtons.querySelectorAll('[data-starter]').forEach((btn) => {
    const val = btn.dataset.starter === 'random' ? 'random' : Number(btn.dataset.starter);
    const active = val === startingPlayerPref;
    btn.classList.toggle('selected', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}
```

#### 5.2 Top Bar & Board Favor Markers
Keep `els.roundBadge.textContent = \`Round ${Game.state.round}\`` in `updateTopBar()` and `const displayedOwner = Game.state.gameOver && !revealDone ? row.priorOwner : row.owner;` in `buildBoard()`.

#### 5.3 Tie Round Approval & Next-Starter Subtitle (`buildResultPanel()`)
In `buildResultPanel()`, display who goes first in the upcoming round when `isTie` is `true` (while still offering only `Start Round ${result.round + 1}` on tie rounds):
```js
  const nextStarter = Game.other(result.roundStarter);
  const nextStarterNote = isTie
    ? `<p class="result-sub">${nextStarter === HUMAN ? 'You go' : 'Computer goes'} first in Round ${result.round + 1}.</p>`
    : '';

  const card = document.createElement('div');
  card.className = 'result-card';
  card.innerHTML = `
    <h2>${headingText}</h2>
    <div class="result-winner">${winnerText}</div>
    ${nextStarterNote}
    <div class="result-stats">
      ...
```

#### 5.4 Lifecycle, `kickoffRound()`, `showModeSelection()`, `startNewGame()`, `beginNextRound()`, and Listeners
1. Extract `kickoffRound()` so both Round 1 (`startNewGame()`) and Round 2+ (`beginNextRound()`) lock input (`animating = true`) and sequence `playAITurn(token)` whenever `Game.state.currentPlayer === AI_PLAYER`:
```js
async function kickoffRound() {
  renderHistory(false);

  if (Game.state.currentPlayer === AI_PLAYER) {
    animating = true;
    render();
    const token = gameToken;
    try {
      await Fx.wait(500);
      if (token !== gameToken) return;
      await playAITurn(token);
    } catch (err) {
      console.error(err);
      Fx.clearFx();
      pendingOffer = null;
      animating = false;
      render();
    }
  } else {
    render();
  }
}

function showModeSelection() {
  gameStarted = false;
  closeConfirmModal();
  resetUIState();
  Game.resetGame();
  updateSetupSelectionUI();
  els.modeSelectionScreen.classList.remove('hidden');
  renderHistory(false);
  render();
}

async function startNewGame() {
  closeConfirmModal();
  resetUIState();
  gameStarted = true;
  els.modeSelectionScreen.classList.add('hidden');
  Game.startGame(startingPlayerPref);
  await kickoffRound();
}

async function beginNextRound() {
  if (!Game.state.gameOver || Game.state.winner !== 0) return;
  closeConfirmModal();
  resetUIState();
  gameStarted = true;
  Game.startNextRound();
  await kickoffRound();
}
```

2. In `startApp()`, replace the three direct `ai*Button` `startNewGame(...)` listeners with group selection listeners + `#start-game-button`:
```js
  els.difficultyButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-diff]');
    if (!btn) return;
    aiDifficulty = btn.dataset.diff;
    updateSetupSelectionUI();
  });

  els.starterButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-starter]');
    if (!btn) return;
    const raw = btn.dataset.starter;
    startingPlayerPref = raw === 'random' ? 'random' : Number(raw);
    updateSetupSelectionUI();
  });

  els.startGameButton.addEventListener('click', () => startNewGame());
```

---

## Edge Cases
1. **Order-Independent Pre-Game Configuration**: Separating difficulty and starting-player toggles from `#start-game-button` prevents accidentally launching the match before selecting the starting player regardless of click order, and preserves the user's preferred difficulty and starter when returning via `"Play Again"` or `"Yes, New Game"`.
2. **`Random` Starter Must Alternate Deterministically in Round 2+**: `resolveStarter('random')` resolves to concrete `1` or `2` once in `resetGame()` and stores it in `state.roundStarter`. Subsequent calls to `startNextRound()` compute `other(state.roundStarter)` rather than re-rolling randomness, guaranteeing strict alternation (`1 -> 2 -> 1` or `2 -> 1 -> 2`) across tied rounds while keeping `startingPlayerPref === 'random'` in `ui.js` for the next new game.
3. **AI Opening Turn on Round 1 (`startingPlayer === 2` or `'random' -> 2`)**: `els.modeSelectionScreen.classList.add('hidden')` runs *before* `kickoffRound()` calls `render()` and `playAITurn(token)`, ensuring the stage is visible, `animating = true` locks human hand/action controls during the `500ms` lead-in, and card flights measure accurate viewport rects.
4. **Human Responding to AI Turn 1 Gift/Competition Offer**: When AI opens Round 1 with `gift` or `competition`, `awaitHumanChoice()` sets `pendingOffer.interactive = true`; `els.offerTray`'s click listener checks `pendingOffer?.interactive` (not `animating`), so the human can choose their card/pair normally before drawing their 7th card via `afterCommit` -> `animateDraw(HUMAN, prevNext, token)`.
5. **Premature Favor Marker Flip & Equal Gifts in Round 2+**: `row.priorOwner` holds Round 1's markers during `animateReveal()` (`Game.state.gameOver && !revealDone`), and equal `geishagifts` in `computeEndgame()` preserve prior `state.geishalove[i]` ownership.
6. **New Game Clicked During AI's Opening Turn, Mid-Offer, or Tie Screen**: `gameStarted = true` is set before `await kickoffRound()` and stays `true` across tied rounds; clicking `#restart-button` opens `#confirm-modal`, and confirming increments `gameToken` + calls `Fx.clearFx()` to abort any in-flight async turn cleanly while `keydown` traps `Escape` when the modal is open.
7. **Backwards Compatibility with Existing Tests**: Defaulting `startingPlayer = 1` in `resetGame()` and `startGame()` keeps all existing parameterless calls in `tests/` passing unchanged.

---

## Execution Checklist
- [x] Step 1: Update `docs/src/game.js` with `round`, `roundStarter`, `priorGeishaLove`, `recomputeScoresFromLove`, `dealRound`, `startNextRound`, `computeEndgame` preserving `geishalove` on gift ties, `getGeishaRows`, and `getResultSummary`.
- [x] Step 2: Update `docs/src/ai.js` so `evaluateCardUtility` and `scoreBoardState` incorporate `state.geishalove` carryover ownership across all 6 call sites.
- [x] Step 3: Update `docs/index.html` to add `#round-badge` in `.top-bar` and `#confirm-modal` inside `#stage`.
- [x] Step 4: Update `docs/src/styles.css` to set overlay stacking order (`.result-panel` 100, `.top-bar` 110, `.mode-selection-screen` 120, `.confirm-modal` 130) and style `.confirm-modal`.
- [x] Step 5: Update `docs/src/ui.js` with `gameStarted`, modal helpers, `updateTopBar`, `buildBoard` using `priorOwner` before `revealDone`, `buildResultPanel` tie-approval vs game-over branching, `afterCommit`, `beginNextRound`, `handleRestartClick`, and modal/keyboard listeners.
- [x] Step 6: Expand `tests/game.test.js`, `tests/ai.test.js`, and `tests/simulation.test.js` for multi-round ties, preserved `geishalove`, `startNextRound()` guards, and AI carryover evaluation.
- [x] Step 7: Update `AGENTS.md` and `README.md` to document multi-round tie continuation and the New Game confirmation modal.
- [x] Step 8: Verify baseline tests and syntax checks pass.
- [x] Step 9: Update `docs/src/game.js` per §1.2 and §1.3 to add `resolveStarter()`, parameterize `resetGame(startingPlayer = 1)` and `startGame(startingPlayer = 1)`, and include `roundStarter` in `getResultSummary()`.
- [x] Step 10: Update `docs/index.html` per §3.2 to replace `#mode-selection-screen` inner controls with `#difficulty-buttons`, `#starter-buttons` (`You`, `Computer`, `Random`), and `#start-game-button`.
- [x] Step 11: Update `docs/src/styles.css` per §4.2 to add `.result-sub` and replace `.difficulty-buttons` / `.diff-button` with `.setup-buttons`, `.setup-button` (`.selected`), and `.start-game-btn`.
- [x] Step 12: Update `docs/src/ui.js` per §5.1, §5.3, and §5.4 to add setup DOM refs (`difficultyButtons`, `starterButtons`, `starter*Button`, `startGameButton`), `startingPlayerPref`, `updateSetupSelectionUI()`, next-starter tie subtitle in `buildResultPanel()`, shared `kickoffRound()` for `startNewGame()` and `beginNextRound()`, and setup click listeners in `startApp()`.
- [x] Step 13: Expand `tests/game.test.js` and `tests/simulation.test.js` to test `startGame(1)`, `startGame(2)`, `startGame('random')`, full 8-turn completion when Player 2 starts Round 1, and deterministic multi-round starter alternation (`2 -> 1 -> 2` and `'random'` carryover).
- [x] Step 14: Update `AGENTS.md` and `README.md` to document selectable starting players before starting a new game and alternating starters across subsequent rounds.
- [x] Step 15: Run `node --check docs/src/game.js docs/src/ai.js docs/src/ui.js docs/src/fx.js` and `npm test` to verify zero syntax errors and 100% passing unit and simulation tests.
