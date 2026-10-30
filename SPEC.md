# SPEC — Multi-Round Tie Continuation & New Game Confirmation Modal

## Root Cause / Objective
Currently, `computeEndgame()` wipes `state.geishalove` on every round evaluation and `ui.js` treats a tied 8-turn round (`state.winner === 0`) as a terminal `"Game Over"` screen offering `"Play Again"`, while `#restart-button` immediately resets the match without confirmation. We must preserve Geisha favor states (`state.geishalove`) across tied rounds so subsequent rounds can be launched upon user approval (without offering a brand-new game on the tie result panel) until a round produces a winner, and guard `#restart-button` with an in-stage confirmation modal whenever a game is in progress.

## File Map
| Path | Operation | Purpose |
|---|---|---|
| `docs/src/game.js` | Modify | Track `round`, `roundStarter`, and `priorGeishaLove`; preserve `geishalove` on tie in `computeEndgame()`; add `startNextRound()`; expose `priorOwner` and `round`. |
| `docs/src/ai.js` | Modify | Make `evaluateCardUtility()` and `scoreBoardState()` account for preserved `state.geishalove` in Round 2+. |
| `docs/index.html` | Modify | Add `#round-badge` in `.top-bar` and `#confirm-modal` dialog inside `#stage`. |
| `docs/src/styles.css` | Modify | Layer `.top-bar` (`z-index: 110`), `.mode-selection-screen` (`z-index: 120`), and `.confirm-modal` (`z-index: 130`); style the confirmation dialog. |
| `docs/src/ui.js` | Modify | Render preserved favor markers during play, show approval-only `"Start Round N"` panel on ties, manage `gameStarted` & `#confirm-modal`, and sequence `beginNextRound()`. |
| `tests/game.test.js` | Modify | Add unit tests for multi-round ties, preserved `geishalove`, alternating round starter, and `startNextRound()` guards. |
| `tests/ai.test.js` | Modify | Add unit tests verifying AI decisions and responses respect preserved `geishalove` in Round 2+. |
| `tests/simulation.test.js` | Modify | Add headless multi-round tie-continuation simulation test until a winner is decided. |
| `AGENTS.md` | Modify | Document `startNextRound()`, multi-round tie continuation, and the New Game confirmation modal. |
| `README.md` | Modify | Document multi-round tie rules (preserved character favors until a round has a winner). |

---

## Technical Blueprint

### 1. Rules & Multi-Round State (`docs/src/game.js`)

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

#### 1.2 Shared Deal Helper, `resetGame()`, and `startNextRound()`
Extract dealing/hand/action reset into an internal helper so `resetGame()` and `startNextRound()` stay DRY:
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

export function resetGame() {
  state.round = 1;
  dealRound(1);
  state.geishalove = Array(8).fill(0);
  state.priorGeishaLove = Array(8).fill(0);
  state.scores = [0, 0, 0];
  state.geishaCount = [0, 0, 0];
  state.message = 'The game has started. Player 1 goes first.';
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
```

#### 1.3 Preserving `geishalove` in `computeEndgame()` & Summary Exports
Do **not** zero out `state.geishalove` in `computeEndgame()`. Snapshot `priorGeishaLove` first so the UI can hold pre-reveal favor markers while secret cards are in flight, then update `geishalove[i]` only where one player strictly leads in `geishagifts`:
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
- In `getGeishaRows()`, add `priorOwner: state.priorGeishaLove[cardId]` to each returned row object.
- In `getResultSummary()`, add `round: state.round` to the returned summary object.

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
When `myCount === oppCount`, fall back to `geishaLove?.[g] ?? 0`:
```js
function scoreBoardState(player, giftsP1, giftsP2, secretP1, secretP2, geishaLove = null) {
  const opp = other(player);
  const myGifts = player === 1 ? giftsP1 : giftsP2;
  const oppGifts = player === 1 ? giftsP2 : giftsP1;

  let myScore = 0;
  let oppScore = 0;
  let myGeishas = 0;
  let oppGeishas = 0;

  for (let g = 1; g <= 7; g++) {
    const val = cardValue(g);
    const myCount = myGifts[g] + (player === 1 && secretP1 === g ? 1 : (player === 2 && secretP2 === g ? 1 : 0));
    const oppCount = oppGifts[g] + (opp === 1 && secretP1 === g ? 1 : (opp === 2 && secretP2 === g ? 1 : 0));

    let owner = 0;
    if (myCount > oppCount) {
      owner = player;
    } else if (oppCount > myCount) {
      owner = opp;
    } else if (geishaLove) {
      owner = geishaLove[g] || 0;
    }

    if (owner === player) {
      myScore += val;
      myGeishas += 1;
    } else if (owner === opp) {
      oppScore += val;
      oppGeishas += 1;
    }
  }
  // Win condition checks unchanged...
```
Pass `state.geishalove` as the 6th argument at all 6 call sites of `scoreBoardState` (`chooseAIAction` Gift loop, `chooseAIAction` Competition 2× branches, `chooseAIGiftResponse`, and `chooseAICompetitionResponse` 2× branches).

---

### 3. HTML Markup (`docs/index.html`)

1. Add `#round-badge` inside `<header class="top-bar">` right before `#turn-badge`:
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

2. Add `#confirm-modal` inside `#stage` immediately after `#mode-selection-screen`:
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

---

### 4. Stage Layering & Modal Styling (`docs/src/styles.css`)

1. Update `.top-bar` so `#restart-button` stays clickable even when `#result-panel` (`z-index: 100`) is displayed on a tie round, while remaining beneath `.mode-selection-screen` (`z-index: 120`) and `.confirm-modal` (`z-index: 130`):
```css
.top-bar {
  position: relative;
  z-index: 110;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px;
}
```
*(Note: `.table` has `position: relative` without `z-index`, so `.top-bar` participates directly in `.stage`'s stacking context.)*

2. Separate overlay z-indexes and add `.confirm-modal` styles:
```css
.result-panel,
.mode-selection-screen,
.confirm-modal {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: 20px;
}

.result-panel {
  z-index: 100;
  background: rgba(6, 12, 22, 0.55);
  backdrop-filter: blur(4px);
}

.mode-selection-screen {
  z-index: 120;
  background: rgba(6, 12, 22, 0.96);
  backdrop-filter: blur(8px);
  padding: 24px;
}

.confirm-modal {
  z-index: 130;
  background: rgba(6, 12, 22, 0.72);
  backdrop-filter: blur(4px);
}

.confirm-modal-card {
  max-width: 460px;
  width: 100%;
  padding: 28px 32px;
  border-radius: 20px;
  background: rgba(15, 23, 42, 0.98);
  border: 2px solid rgba(217, 108, 111, 0.5);
  text-align: center;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.65);
}

.confirm-modal-card h2 {
  margin: 0 0 12px 0;
  font-size: 1.6rem;
  color: var(--accent);
}

.confirm-modal-desc {
  margin: 0 0 24px 0;
  font-size: 1rem;
  line-height: 1.45;
  color: var(--text);
}

.confirm-modal-actions {
  display: flex;
  justify-content: center;
  gap: 14px;
}

.modal-btn {
  padding: 12px 24px;
  font-size: 1rem;
  font-weight: 700;
  border-radius: 12px;
  cursor: pointer;
  transform: translateY(0);
  transition: transform 0.15s, filter 0.15s;
}

.modal-btn:hover {
  transform: translateY(-2px);
  filter: brightness(1.08);
}

.modal-btn.danger {
  background: linear-gradient(135deg, #ef4444, #b91c1c);
  color: #fff;
  border: none;
}
```
Remove the duplicate `.mode-selection-screen` background block or merge cleanly so `z-index: 120` is not overridden later in `styles.css`.

---

### 5. UI Presentation, Confirmation Flow & Next-Round Sequencing (`docs/src/ui.js`)

#### 5.1 DOM Refs & State
Add to `els`:
```js
  roundBadge: document.getElementById('round-badge'),
  confirmModal: document.getElementById('confirm-modal'),
  confirmCancelButton: document.getElementById('confirm-cancel-button'),
  confirmAcceptButton: document.getElementById('confirm-accept-button')
```
Add module state variable:
```js
let gameStarted = false;    // true from startNewGame() until a winner's result panel is shown or game is ended
```

Add modal helpers:
```js
function isConfirmModalOpen() {
  return !els.confirmModal.classList.contains('hidden');
}

function openConfirmModal() {
  els.confirmModal.classList.remove('hidden');
  els.confirmCancelButton.focus();
}

function closeConfirmModal() {
  els.confirmModal.classList.add('hidden');
}
```

#### 5.2 Top Bar & Board Favor Markers
In `updateTopBar()`:
```js
function updateTopBar() {
  els.roundBadge.textContent = `Round ${Game.state.round}`;
  els.turnBadge.textContent = `Turn ${Math.min(Game.state.turnsTaken + 1, 8)} / 8`;
  els.difficultyBadge.textContent = `${DIFF_LABELS[aiDifficulty]} AI`;
  els.playerZone.classList.toggle('active', !Game.state.gameOver && Game.state.currentPlayer === HUMAN);
  els.opponentZone.classList.toggle('active', !Game.state.gameOver && Game.state.currentPlayer === AI_PLAYER);
}
```

In `buildBoard()`, render preserved favor markers throughout Round 2+, and hold `row.priorOwner` while secret reveal flights are in mid-air (`Game.state.gameOver && !revealDone`):
```js
    const displayedOwner = Game.state.gameOver && !revealDone ? row.priorOwner : row.owner;
    if (displayedOwner !== 0) {
      const marker = document.createElement('div');
      marker.className = `favor-marker ${displayedOwner === HUMAN ? 'favor-p1' : 'favor-p2'}`;
      marker.textContent = displayedOwner === HUMAN ? '▼ You' : '▲ AI';
      geisha.appendChild(marker);
    }
```

#### 5.3 Tie Round Approval vs Final Game Over (`buildResultPanel()`)
Update `buildResultPanel()` so a tie round **never** offers to start a completely new game and **only** offers an approval button to launch the next round in the same game:
```js
function buildResultPanel() {
  if (!Game.state.gameOver || !resultReady) {
    els.resultPanel.classList.add('hidden');
    els.resultPanel.replaceChildren();
    return;
  }

  els.resultPanel.classList.remove('hidden');
  const result = Game.getResultSummary();
  const isTie = result.winner === 0;

  const p1SecretName = result.player1.secretCard
    ? `${CARD_ICONS[result.player1.secretCard]} ${Game.cardName(result.player1.secretCard)} (${Game.cardValue(result.player1.secretCard)} pts)`
    : 'None';
  const p2SecretName = result.player2.secretCard
    ? `${CARD_ICONS[result.player2.secretCard]} ${Game.cardName(result.player2.secretCard)} (${Game.cardValue(result.player2.secretCard)} pts)`
    : 'None';

  const headingText = isTie
    ? `Round ${result.round} Tied`
    : (result.round > 1 ? `Game Over · Round ${result.round}` : 'Game Over');

  let winnerText = '🤝 Tie round! Geisha favors carry over.';
  if (result.winner === HUMAN) {
    winnerText = '🏆 You won!';
  } else if (result.winner === AI_PLAYER) {
    winnerText = '🤖 Computer won!';
  }

  const card = document.createElement('div');
  card.className = 'result-card';
  card.innerHTML = `
    <h2>${headingText}</h2>
    <div class="result-winner">${winnerText}</div>
    <div class="result-stats">
      <div class="result-col">
        <h3>You</h3>
        <p><strong>Charm Points:</strong> ${result.player1.score}</p>
        <p><strong>Geishas Held:</strong> ${result.player1.geishaCount} / 7</p>
        <p><strong>Revealed Secret:</strong> ${p1SecretName}</p>
      </div>
      <div class="result-col">
        <h3>Computer</h3>
        <p><strong>Charm Points:</strong> ${result.player2.score}</p>
        <p><strong>Geishas Held:</strong> ${result.player2.geishaCount} / 7</p>
        <p><strong>Revealed Secret:</strong> ${p2SecretName}</p>
      </div>
    </div>
  `;

  const actionBtn = document.createElement('button');
  actionBtn.className = 'primary restart-result-btn';
  actionBtn.type = 'button';
  if (isTie) {
    actionBtn.textContent = `Start Round ${result.round + 1}`;
    actionBtn.addEventListener('click', () => beginNextRound());
  } else {
    actionBtn.textContent = 'Play Again';
    actionBtn.addEventListener('click', () => showModeSelection());
  }

  card.appendChild(actionBtn);
  els.resultPanel.replaceChildren(card);
}
```

#### 5.4 Lifecycle, `afterCommit()`, `beginNextRound()`, and Listeners
1. In `afterCommit(prevNext, token)`, inside the `if (Game.state.gameOver)` block when `resultReady = true` is set:
```js
    resultReady = true;
    animating = false;
    if (Game.state.winner !== 0) {
      gameStarted = false;
    }
    render();
    return;
```
*(Note: When `Game.state.winner === 0`, `gameStarted` remains `true` because the multi-round game has not ended.)*

2. Update `showModeSelection()`, `startNewGame(difficulty)`, and add `beginNextRound()` + `handleRestartClick()`:
```js
function showModeSelection() {
  gameStarted = false;
  closeConfirmModal();
  resetUIState();
  Game.resetGame();
  els.modeSelectionScreen.classList.remove('hidden');
  renderHistory(false);
  render();
}

function startNewGame(difficulty) {
  closeConfirmModal();
  resetUIState();
  gameStarted = true;
  aiDifficulty = difficulty;
  els.modeSelectionScreen.classList.add('hidden');
  Game.startGame();
  renderHistory(false);
  render();
}

async function beginNextRound() {
  if (!Game.state.gameOver || Game.state.winner !== 0) return;
  closeConfirmModal();
  resetUIState();
  gameStarted = true;
  Game.startNextRound();
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

function handleRestartClick() {
  if (gameStarted) {
    openConfirmModal();
  } else {
    showModeSelection();
  }
}
```

3. Update `startApp()` event bindings:
- Replace `els.restartButton.addEventListener('click', ...)` with `els.restartButton.addEventListener('click', handleRestartClick);`.
- Wire confirmation modal listeners:
```js
  els.confirmCancelButton.addEventListener('click', closeConfirmModal);
  els.confirmAcceptButton.addEventListener('click', () => showModeSelection());
  els.confirmModal.addEventListener('click', (e) => {
    if (e.target === els.confirmModal) closeConfirmModal();
  });
```
- At the very top of `document.addEventListener('keydown', (e) => { ... })`:
```js
    if (isConfirmModalOpen()) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeConfirmModal();
      }
      return;
    }
```

---

## Edge Cases
1. **Premature Favor Marker Flip During Secret Reveal**: `computeEndgame()` runs synchronously on Turn 8 before `animateReveal()`. In Round 2+, rendering `row.priorOwner` while `Game.state.gameOver && !revealDone` keeps Round 1's preserved markers on screen until the secret cards finish flying onto the gift stacks, then switches to `row.owner` once `revealDone = true`.
2. **Equal Gifts in Round 2+ Must Not Clear Prior Favor**: When `geishagifts[1][i] === geishagifts[2][i]` (including `0 === 0` if all copies of a card were discarded/unplayed), `state.geishalove[i]` must retain its prior round's owner (`1`, `2`, or `0`), never reset to `0`.
3. **Consecutive Ties (Round 2 → Round 3 → …)**: `startNextRound()` increments `state.round` without upper bound and preserves the latest `state.geishalove` each time until `state.winner` is `1` or `2`.
4. **Alternating Round Starter & AI Turn 1**: Even rounds start with `AI_PLAYER` (`state.currentPlayer === 2`), who already drew their 7th card inside `Game.startNextRound()`. `beginNextRound()` must set `animating = true` before `render()` and invoke `playAITurn(token)` with `gameToken` cancellation checks so human input is locked while AI opens the round.
5. **New Game Clicked Mid-Animation / Mid-Offer / On Tie Screen**: Because `gameStarted` stays `true` from `startNewGame()` across turns, animations, secret reveals, and tie-round overlays (only turning `false` once a decisive winner's result panel is shown or the user confirms ending the game), clicking `#restart-button` always opens `#confirm-modal`. Confirming calls `showModeSelection()`, which increments `gameToken` and calls `Fx.clearFx()` to cleanly abort any in-flight async sequence or pending `awaitHumanChoice()` promise.
6. **Keyboard Bleed-Through Under Modal**: Pressing `Escape` or `Enter` while `#confirm-modal` is open must not deselect `pendingAction` or trigger `confirmSelection()` on cards behind the dialog.
7. **History Rail & Discard Pile Reset Each Round**: `resetUIState()` clears `history = []` on `beginNextRound()`, keeping the left rail within the 8-item vertical stage budget and resetting `discardPile` to empty since all 21 item cards are reshuffled back into the deck.
8. **Backwards Compatibility with Existing Tests**: `state.gameOver` remains `true` after 8 turns even when `state.winner === 0`, preserving all assertions in `tests/game.test.js` and `tests/simulation.test.js`.

---

## Execution Checklist
- [x] Step 1: Update `docs/src/game.js` per §1 (`round`, `roundStarter`, `priorGeishaLove`, `recomputeScoresFromLove`, `dealRound`, `resetGame`, `startNextRound`, `computeEndgame` preserving `geishalove` on gift ties, `getGeishaRows`, and `getResultSummary`).
- [x] Step 2: Update `docs/src/ai.js` per §2 so `evaluateCardUtility` and `scoreBoardState` incorporate `state.geishalove` carryover ownership across all 6 call sites.
- [x] Step 3: Update `docs/index.html` per §3 to add `#round-badge` in `.top-bar` and `#confirm-modal` inside `#stage`.
- [x] Step 4: Update `docs/src/styles.css` per §4 to set overlay stacking order (`.result-panel` 100, `.top-bar` 110, `.mode-selection-screen` 120, `.confirm-modal` 130) and style `.confirm-modal`.
- [x] Step 5: Update `docs/src/ui.js` per §5 (`els`, `gameStarted`, modal helpers, `updateTopBar`, `buildBoard` using `priorOwner` before `revealDone`, `buildResultPanel` tie-approval vs game-over branching, `afterCommit`, `showModeSelection`, `startNewGame`, `beginNextRound`, `handleRestartClick`, and modal/keyboard listeners).
- [x] Step 6: Expand `tests/game.test.js`, `tests/ai.test.js`, and `tests/simulation.test.js` to cover multi-round ties (including 3+ rounds until someone wins), preserved `geishalove` on tied gifts, alternating round starters, `startNextRound()` guards, and AI carryover evaluation.
- [x] Step 7: Update `AGENTS.md` and `README.md` to document multi-round tie continuation with preserved character favors and the New Game confirmation modal.
- [x] Step 8: Run `npm test` and `node --check docs/src/game.js docs/src/ai.js docs/src/ui.js docs/src/fx.js` to verify zero syntax errors and 100% passing unit and simulation tests.
