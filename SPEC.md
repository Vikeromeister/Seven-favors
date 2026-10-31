# SPEC — Temporary "View Board" Peek Button for Offer & End-of-Round Popups

## Root Cause / Objective
Interactive pop-up overlays—specifically `#offer-tray` during an AI Gift or Competition offer (`pendingOffer.interactive === true`) and `#result-panel` after a round ends (`Game.state.gameOver && resultReady`)—dim, blur, and obscure the central character columns and move history rail when the player wants to inspect board state. We must add a **View Board** button to both pop-up windows that temporarily hides the active overlay (supporting both **press-and-hold** to peek and **click/keyboard toggle** with a top-center **Show Offer / Show Summary** restore pill) so the unobstructed, full-brightness board, secret slot, and move history rail can be observed at any time.

## File Map
| Path | Operation | Purpose |
|---|---|---|
| `docs/index.html` | Modify | Add `#peek-restore-button` inside `#stage` and `#icon-eye` / `#icon-eye-off` SVG symbols in `<defs>`. |
| `docs/src/styles.css` | Modify | Style `.peek-trigger-btn`, `.tray-peek-btn`, `.result-actions`, `.result-peek-btn`, `.peek-restore-btn`, and `.stage.is-peeking` overlay-hiding & board un-dimming rules; scope `.offer-tray .tray-head > .icon`. |
| `docs/src/ui.js` | Modify | Add hybrid hold-to-peek + click-latch state machine (`peekState`), render **View Board** buttons in interactive `#offer-tray` and `#result-panel`, wire pointer/keyboard/reset handlers, and guard hidden overlay actions via `inert` + state checks. |
| `tests/ui.test.js` | Create | Add zero-dependency `node:test` static contract tests verifying HTML IDs/icons, CSS `.is-peeking` & icon specificity rules, and `ui.js` peek state wiring. |
| `AGENTS.md` | Modify | Document the temporary **View Board** peek mechanic on AI offers and round-end result panels. |
| `README.md` | Modify | Document the **View Board** feature under Features. |

---

## Technical Blueprint

### 1. HTML Markup & SVG Sprite (`docs/index.html`)

#### 1.1 Stage Restore Pill (`#peek-restore-button`)
Insert `#peek-restore-button` inside `#stage` immediately after `<section id="result-panel" class="result-panel hidden"></section>` (line 70):
```html
      <section id="result-panel" class="result-panel hidden"></section>
      <button id="peek-restore-button" class="primary peek-restore-btn hidden" type="button"></button>
```

#### 1.2 Eye & Eye-Off Icons (`<defs>`)
Insert `#icon-eye` and `#icon-eye-off` inside `<defs>` immediately after `#icon-restart` (line 141):
```html
      <symbol id="icon-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></symbol>
      <symbol id="icon-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-6.4 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.4 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="2" y1="2" x2="22" y2="22"/></symbol>
```

---

### 2. Styling & Layering (`docs/src/styles.css`)

#### 2.1 Board Un-Dimming During Peek
Right after `.board-row.offer-active .board` (lines 144–146), restore full brightness when `#stage.is-peeking` is active:
```css
.board-row.offer-active .board {
  filter: brightness(0.55);
}

.stage.is-peeking .board-row.offer-active .board {
  filter: none;
}
```

#### 2.2 Offer Tray Icon Scoping & `.tray-peek-btn`
1. Add `transition: opacity 0.15s ease;` to `.offer-tray` (around line 563).
2. Scope `.offer-tray .tray-head .icon` (line 577) to direct child `.offer-tray .tray-head > .icon` so the eye icon inside `.tray-peek-btn` is not forced to `40px` `--offer-color`:
```css
.offer-tray .tray-head > .icon {
  width: 40px;
  height: 40px;
  color: var(--offer-color);
}
```
3. Add shared `.peek-trigger-btn` and `.tray-peek-btn` rules right after `.offer-tray .chosen-2` (around line 619):
```css
.peek-trigger-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}

.tray-peek-btn {
  margin-top: 8px;
  padding: 7px 12px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transform: translateY(0);
  transition: background 0.15s, border-color 0.15s, transform 0.15s;
}

.tray-peek-btn .icon {
  width: 16px;
  height: 16px;
  color: var(--accent);
}

.tray-peek-btn:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(244, 211, 94, 0.55);
  transform: translateY(-1px);
}
```

#### 2.3 Result Panel Fade, `.is-peeking` Hiding & `#peek-restore-button`
1. Add `transition: opacity 0.15s ease;` to `.result-panel` (lines 774–778), and add `.stage.is-peeking` + `.peek-restore-btn` rules right after `.result-panel`:
```css
.result-panel {
  z-index: 100;
  background: rgba(6, 12, 22, 0.55);
  backdrop-filter: blur(4px);
  transition: opacity 0.15s ease;
}

.stage.is-peeking .offer-tray,
.stage.is-peeking .result-panel {
  opacity: 0;
  pointer-events: none;
}

.peek-restore-btn {
  position: absolute;
  top: 10px;
  left: 50%;
  translate: -50% 0;
  z-index: 115;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 20px;
  border-radius: 9999px;
  border: none;
  font-size: 0.92rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 0 0 3px rgba(244, 211, 94, 0.32), 0 10px 24px rgba(0, 0, 0, 0.55);
  transform: translateY(0);
  transition: transform 0.15s, filter 0.15s;
}

.peek-restore-btn .icon {
  width: 18px;
  height: 18px;
}

.peek-restore-btn:hover {
  transform: translateY(-1px);
  filter: brightness(1.08);
}

.peek-restore-btn.holding {
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .offer-tray,
  .result-panel {
    transition: none;
  }
}
```
*(Z-index hierarchy: `.offer-tray` `20` < `.result-panel` `100` < `.top-bar` `110` < `.peek-restore-btn` `115` < `.mode-selection-screen` `120` < `.confirm-modal` `130`. Positioned at `top: 10px; left: 50%` on the `1760×900` stage, `#peek-restore-button` sits cleanly in the empty center of the top header strip with 300px+ horizontal clearance from both `.top-bar` badges and `#restart-button`, covering zero cards, stacks, secrets, piles, or history popouts.)*

#### 2.4 Result Card Action Row (`.result-actions` & `.result-peek-btn`)
Right after `.restart-result-btn:hover` (around line 925), add:
```css
.result-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 14px;
}

.result-peek-btn {
  padding: 14px 24px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
}

.result-peek-btn .icon {
  width: 20px;
  height: 20px;
  color: var(--accent);
}
```

---

### 3. UI State & Interaction Blueprint (`docs/src/ui.js`)

#### 3.1 DOM Reference & Peek State Variables
1. Add `peekRestoreButton: document.getElementById('peek-restore-button')` to `els` (around line 71).
2. Add constant `const PEEK_HOLD_MS = 220;` and module state variables alongside `gameStarted` (around line 102):
```js
let peekState = 'closed';          // 'closed' | 'holding' | 'latched'
let peekDownAt = 0;
let peekPointerId = null;
let suppressTriggerClickUntil = 0; // blocks synthetic click after pointerup on .peek-trigger-btn
```

#### 3.2 Peek State Machine Helpers
Place right below `closeConfirmModal()` (and update `openConfirmModal()` to call `stopPeek(false)` before showing `#confirm-modal`):
```js
function openConfirmModal() {
  stopPeek(false);
  els.confirmModal.classList.remove('hidden');
  els.confirmCancelButton.focus();
}

function canPeekBoard() {
  return Boolean(
    (pendingOffer && pendingOffer.interactive) ||
    (Game.state.gameOver && resultReady)
  );
}

function activePeekTrigger() {
  if (Game.state.gameOver && resultReady) {
    return els.resultPanel.querySelector('.peek-trigger-btn');
  }
  if (pendingOffer && pendingOffer.interactive) {
    return els.offerTray.querySelector('.peek-trigger-btn');
  }
  return null;
}

function updatePeekUI() {
  const active = peekState !== 'closed' && canPeekBoard();
  els.stage.classList.toggle('is-peeking', active);

  const latched = peekState === 'latched' && active;
  els.offerTray.inert = latched;
  els.resultPanel.inert = latched;

  if (!active) {
    els.peekRestoreButton.classList.add('hidden');
    els.peekRestoreButton.classList.remove('holding');
    return;
  }

  const targetName = Game.state.gameOver && resultReady ? 'Summary' : 'Offer';
  const label = peekState === 'holding'
    ? 'Viewing Board — Release to Return'
    : `Show ${targetName}`;
  els.peekRestoreButton.innerHTML = `${iconSvg('eye-off')}<span>${label}</span>`;
  els.peekRestoreButton.setAttribute('aria-label', `Show ${targetName.toLowerCase()}`);
  els.peekRestoreButton.classList.toggle('holding', peekState === 'holding');
  els.peekRestoreButton.classList.remove('hidden');
}

function beginPeekHold(pointerId) {
  peekState = 'holding';
  peekDownAt = performance.now();
  peekPointerId = pointerId;
  updatePeekUI();
}

function latchPeek() {
  peekState = 'latched';
  peekPointerId = null;
  updatePeekUI();
  els.peekRestoreButton.focus({ preventScroll: true });
}

function stopPeek(restoreFocus = false) {
  const wasOpen = peekState !== 'closed';
  peekState = 'closed';
  peekPointerId = null;
  updatePeekUI();
  if (wasOpen && restoreFocus) {
    const trigger = activePeekTrigger();
    if (trigger) trigger.focus({ preventScroll: true });
  }
}

function handlePeekPointerEnd(e) {
  if (peekState !== 'holding') return;
  if (peekPointerId !== null && e.pointerId !== peekPointerId) return;

  suppressTriggerClickUntil = performance.now() + 300;
  const heldMs = performance.now() - peekDownAt;
  peekPointerId = null;

  if (e.type === 'pointercancel' || !canPeekBoard() || isConfirmModalOpen()) {
    stopPeek(false);
    return;
  }

  if (heldMs >= PEEK_HOLD_MS) {
    stopPeek(false);
  } else {
    latchPeek();
  }
}
```

#### 3.3 Render Offer Tray & Result Panel Trigger Buttons
1. In `renderOfferTray()` (lines 409–413), append `.tray-peek-btn` inside `if (pendingOffer.interactive)`:
```js
  if (pendingOffer.interactive) {
    const label = document.createElement('span');
    label.textContent = pendingOffer.kind === 'gift' ? 'Pick a card' : 'Pick a pair';
    head.appendChild(label);

    const peekBtn = document.createElement('button');
    peekBtn.type = 'button';
    peekBtn.className = 'peek-trigger-btn tray-peek-btn';
    peekBtn.dataset.tip = 'Hold or click to view the board';
    peekBtn.setAttribute('aria-label', 'View board');
    peekBtn.innerHTML = `${iconSvg('eye')}<span>View Board</span>`;
    head.appendChild(peekBtn);
  }
```

2. In `buildResultPanel()` (lines 524–536), place `.result-peek-btn` beside `actionBtn` inside `.result-actions`, guarding `actionBtn` clicks while peeking:
```js
  const actionsRow = document.createElement('div');
  actionsRow.className = 'result-actions';

  const peekBtn = document.createElement('button');
  peekBtn.className = 'secondary restart-result-btn peek-trigger-btn result-peek-btn';
  peekBtn.type = 'button';
  peekBtn.dataset.tip = 'Hold or click to view the board';
  peekBtn.setAttribute('aria-label', 'View board');
  peekBtn.innerHTML = `${iconSvg('eye')}<span>View Board</span>`;

  const actionBtn = document.createElement('button');
  actionBtn.className = 'primary restart-result-btn';
  actionBtn.type = 'button';
  if (isTie) {
    actionBtn.textContent = `Start Round ${result.round + 1}`;
    actionBtn.addEventListener('click', () => {
      if (peekState !== 'closed') return;
      beginNextRound();
    });
  } else {
    actionBtn.textContent = 'Play Again';
    actionBtn.addEventListener('click', () => {
      if (peekState !== 'closed') return;
      showModeSelection();
    });
  }

  actionsRow.append(peekBtn, actionBtn);
  card.appendChild(actionsRow);
  els.resultPanel.replaceChildren(card);
```

3. Sync peek state at the end of `render()` (around line 580):
```js
function render() {
  updateTopBar();
  buildOpponentZone();
  buildBoard();
  buildPiles();
  buildPlayerZone();
  updateActionBar();
  renderOfferTray();
  buildResultPanel();
  if (!canPeekBoard() && peekState !== 'closed') {
    stopPeek(false);
  } else {
    updatePeekUI();
  }
}
```

#### 3.4 Resets, Guards & Event Listeners
1. Guard `resolveOfferChoice(choice)` (line 630):
```js
function resolveOfferChoice(choice) {
  if (!pendingOffer?.interactive || !pendingOffer.resolve || peekState !== 'closed') return;
  stopPeek(false);
  const resolve = pendingOffer.resolve;
  pendingOffer.interactive = false;
  pendingOffer.resolve = null;
  resolve(choice);
}
```
2. Call `stopPeek(false)` inside `resetUIState()` (line 1117), and inside the `catch (err)` error-recovery blocks in `confirmSelection()` (line 621) and `kickoffRound()` (line 1140).
3. In `startApp()` (around lines 1235–1265):
   - Guard `els.offerTray` click listener with `if (!pendingOffer?.interactive || peekState !== 'closed') return;`.
   - Wire delegated `.peek-trigger-btn` pointer/keyboard listeners, `window` pointer-end/blur listeners, `els.peekRestoreButton` click listener, and `document` `keydown` (`Escape` / `Space`) handling:
```js
  els.stage.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.peek-trigger-btn');
    if (!btn) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!canPeekBoard() || isConfirmModalOpen()) return;
    beginPeekHold(e.pointerId);
  });

  els.stage.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.peek-trigger-btn')) {
      e.preventDefault();
    }
  });

  els.stage.addEventListener('click', (e) => {
    const btn = e.target.closest('.peek-trigger-btn');
    if (!btn) return;
    if (performance.now() < suppressTriggerClickUntil) return;
    if (!canPeekBoard() || isConfirmModalOpen()) return;
    latchPeek();
  });

  window.addEventListener('pointerup', handlePeekPointerEnd);
  window.addEventListener('pointercancel', handlePeekPointerEnd);
  window.addEventListener('blur', () => {
    if (peekState === 'holding') stopPeek(false);
  });

  els.peekRestoreButton.addEventListener('click', () => stopPeek(true));
```
   - Update `document.addEventListener('keydown', ...)` to handle active peek state right after the `modeSelectionScreen` check:
```js
    if (peekState !== 'closed') {
      if (e.key === 'Escape') {
        e.preventDefault();
        stopPeek(true);
      } else if (e.key === ' ' && e.target !== els.peekRestoreButton) {
        e.preventDefault();
        stopPeek(true);
      }
      return;
    }
```

---

### 4. Automated Contract Tests (`tests/ui.test.js`)
Create `tests/ui.test.js` using `node:test`, `node:assert/strict`, and `node:fs` to verify:
1. `docs/index.html` contains `id="peek-restore-button"`, `id="icon-eye"`, and `id="icon-eye-off"`.
2. `docs/src/styles.css` defines `.stage.is-peeking .offer-tray`, `.stage.is-peeking .result-panel`, `.stage.is-peeking .board-row.offer-active .board`, `.peek-restore-btn`, `.tray-peek-btn`, `.result-peek-btn`, and scopes `.offer-tray .tray-head > .icon` (not unscoped `.offer-tray .tray-head .icon`).
3. `docs/src/ui.js` defines `canPeekBoard`, `beginPeekHold`, `latchPeek`, `stopPeek`, `handlePeekPointerEnd`, renders `.tray-peek-btn` and `.result-peek-btn`, and resets peek state in `resetUIState`.

---

## Edge Cases
1. **No DOM Destruction Mid-Press**: Toggling peek via `updatePeekUI()` mutates CSS classes (`.is-peeking`, `.hidden`, `.holding`) and `.inert` rather than calling `render()` / `replaceChildren()`, preventing the pressed `<button>` from being detached between `pointerdown` and `pointerup`.
2. **Both Hold-to-Peek and Click-to-Toggle Work Seamlessly**: Holding `>= 220ms` hides the window immediately on `pointerdown` and restores it immediately on `pointerup` anywhere on `window`; a quick click/tap (`< 220ms`) or keyboard `Enter`/`Space` latches peek mode open until the user clicks `#peek-restore-button` or presses `Escape`/`Space`/`Enter`.
3. **Synthetic Click Suppression After Hold or Tap**: Setting `suppressTriggerClickUntil = performance.now() + 300` in `handlePeekPointerEnd` prevents mouse/touch synthetic `click` events from double-toggling after `pointerup`, while still allowing genuine keyboard `click` events (which have no `pointerdown`/`pointerup`) to call `latchPeek()`.
4. **No Accidental Invisible Clicks or Tab Focus**: Setting `inert = true` on `els.offerTray` and `els.resultPanel` when latched—combined with `pointer-events: none` and `peekState !== 'closed'` guards in `resolveOfferChoice`, `els.offerTray` click, and `result-actions` buttons—prevents accidentally picking an offer or restarting via mouse or keyboard while the window is hidden.
5. **Hovering Secret Slot & Move History While Peeking**: Because `.stage.is-peeking .result-panel` and `.stage.is-peeking .offer-tray` apply `opacity: 0; pointer-events: none;`, the user can freely hover `#player-secret` (to peek at their own secret card) and `.history-item` (to inspect past moves in `.history-pop`) while observing the un-dimmed, un-blurred board.
6. **Non-Interactive AI Response Animations Excluded**: During the human's own Gift/Competition turn (`pendingOffer.interactive === false`), `canPeekBoard()` is `false` and `.tray-peek-btn` is not rendered, avoiding a momentary button during automatic `700ms` AI selection flights.
7. **Window Blur / Pointer Cancel / Modal Interruptions**: `pointercancel`, `window` `blur` during `'holding'`, `openConfirmModal()`, and `resetUIState()` all call `stopPeek(false)` so peek mode can never become stuck across Alt-Tab, touch cancellation, New Game confirmation, or round transitions.

---

## Execution Checklist
- [x] Step 1: Update `docs/index.html` to add `#peek-restore-button` inside `#stage` and `#icon-eye` / `#icon-eye-off` `<symbol>` definitions in `<defs>`.
- [x] Step 2: Update `docs/src/styles.css` to add `.stage.is-peeking` un-dimming and fade-out rules, scope `.offer-tray .tray-head > .icon`, and style `.peek-trigger-btn`, `.tray-peek-btn`, `.result-actions`, `.result-peek-btn`, and `.peek-restore-btn`.
- [x] Step 3: Update `docs/src/ui.js` to add `peekRestoreButton` ref, hybrid hold/latch peek helpers, **View Board** trigger buttons in `renderOfferTray()` and `buildResultPanel()`, state guards/resets, and pointer/keyboard listeners in `startApp()`.
- [x] Step 4: Create `tests/ui.test.js` with static contract assertions for the peek markup, CSS selectors, and `ui.js` wiring.
- [x] Step 5: Update `AGENTS.md` and `README.md` to document the temporary **View Board** peek button on AI offers and round-end summary screens.
- [x] Step 6: Run `node --check docs/src/game.js docs/src/ai.js docs/src/ui.js docs/src/fx.js` and `npm test` to verify zero syntax errors and 100% passing tests.
