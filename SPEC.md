# SPEC — Online Two Player Stabilization & Reconnect, Strict Win Condition, Lobby Reset & Persistent View Board Toggle

## Root Cause / Objective
Online matches frequently froze or dropped after `secret` or `tradeoff` because Host sent `remote_secret`/`remote_tradeoff` followed ~550ms later by `turn_commit` while Guest registered `waitForNetSignal('turn_commit')` *after* its own ~550ms card flight (dropping early `turn_commit` packets, wedging `turnQueue` because `rejectAllNetSignals()` never rejected pending promises, and stalling Web Animations in background tabs), while `computeEndgame()` erroneously fell back to `scores[1] > scores[2]` when neither player met a victory threshold, `showModeSelection()` left `#host-lobby-box` open with a dead room code after abandoning an online match, and the offer `View Board` button blocked the board and jumped positions when activated. We will rename `Online 2P` to `Online Two Player` with clear 1P/2P SVG icons, harden WebRTC/turn synchronization with atomic single-message non-interactive turns, background-safe animations, automatic + manual match reconnection (`match_sync`), reset abandoned Host lobbies back to the `Create Room` state, enforce the strict 4+ Geishas / 11+ Charm Points victory rule, and move `View Board` to a single non-blocking persistent toggle spot for effortless repeated clicking.

## File Map
| Path | Operation | Purpose |
|---|---|---|
| `docs/src/game.js` | Modify | Remove high-score fallback tiebreaker in `computeEndgame()` so `winner` is non-zero strictly when a player reaches `11+` Charm Points or `4+` Geishas (`11+` points beats `4+` geishas; otherwise `winner = 0`). |
| `docs/src/fx.js` | Modify | Fast-forward `wait()` and `flyCard()` when `document.visibilityState === 'hidden'`, guard `rectOf()` against null/zero-rect elements, and attach a hard completion safety timer to `flyCard()` so backgrounded tabs never hang turn execution. |
| `docs/src/net-config.js` | Modify | Tighten `pingIntervalMs` to `5000` ms to keep UDP NAT bindings alive and add `pongTimeoutMs: 16000` ms for stale DataChannel detection. |
| `docs/src/net.js` | Modify | Add per-session `clientId`, signaling `peer.reconnect()` recovery, heartbeat timeout detection, `onConnectionLost` vs intentional `onPeerLeft`, Guest reconnection acceptance on Host (`onGuestReconnected`), and `session.reconnect()`. |
| `docs/index.html` | Modify | Rename `Online 2P` to `Online Two Player`, add `#icon-single-player` & `#icon-two-player` SVG symbols and button icons, and add `#disconnect-reconnect-button` inside `#disconnect-modal`. |
| `docs/src/styles.css` | Modify | Style `.mode-btn-icon` on mode buttons, move `#peek-restore-button` to the non-blocking right-board corridor (`left: 1468px; top: 426px`), keep fixed geometry across states, and style secondary/closed vs active peek states. |
| `docs/src/ui.js` | Modify | Make `#peek-restore-button` a persistent in-place `View Board` / `Show Offer` toggle (removing the inline button from `#offer-tray`), reset Host/Join lobby UI in `showModeSelection()`, eliminate two-message `secret`/`tradeoff` races via atomic `remote_turn`, fix signal/offer promise cancellation, and wire auto + manual `Reconnect` with sanitized `match_sync`. |
| `tests/game.test.js` | Modify | Add unit tests verifying unequal scores below `< 11` pts and `< 4` geishas yield `winner === 0` (continuing to next round), while `4+` geishas and `11+` points trigger victory properly. |
| `tests/simulation.test.js` | Modify | Raise multi-round cap to `25` and assert every decisive match winner satisfies `score >= 11 \|\| geishaCount >= 4`. |
| `tests/net.test.js` | Modify | Add unit tests covering unexpected disconnect (`onConnectionLost`), Guest/Host `reconnect()` (including half-open socket replacement via `clientId`), and `pongTimeoutMs` detection while preserving `room_full` rejection for 3rd players. |
| `tests/ui.test.js` | Modify | Verify `Online Two Player` label, 1P/2P button icons, `#disconnect-reconnect-button`, `resetOnlineLobbyUI`, atomic `remote_turn` + `match_sync`, and persistent non-blocking `#peek-restore-button`. |
| `AGENTS.md` | Modify | Update architecture documentation for strict victory condition, `Online Two Player`, reconnection protocol, and persistent `View Board` button. |
| `README.md` | Modify | Update rules section (removing high-score fallback tiebreaker), `Online Two Player` button labels, and reconnection notes. |

---

## Technical Blueprint

### 1. Strict Victory Condition (`docs/src/game.js`)

In `docs/src/game.js`, replace lines 303–336 (`computeEndgame` win check and `finishGame`) so a game **only** ends with a winner when at least one player controls **4+ Geishas** or **11+ Charm Points** (with 11+ Charm Points taking precedence when one player has 4+ Geishas and the other has 11+ Charm Points):

```js
  const p1Points = state.scores[1] >= 11;
  const p2Points = state.scores[2] >= 11;
  const p1Geishas = state.geishaCount[1] >= 4;
  const p2Geishas = state.geishaCount[2] >= 4;

  // Victory requires 11+ Charm Points OR 4+ Geishas.
  // If one player achieves 11+ Charm Points and the other achieves 4+ Geishas,
  // the player with 11+ Charm Points wins. Otherwise, no one wins and play
  // continues to the next round (winner = 0).
  if (p1Points && !p2Points) {
    state.winner = 1;
  } else if (p2Points && !p1Points) {
    state.winner = 2;
  } else if (p1Geishas && !p2Geishas) {
    state.winner = 1;
  } else if (p2Geishas && !p1Geishas) {
    state.winner = 2;
  } else {
    state.winner = 0;
  }
}

function finishGame() {
  computeEndgame();
  state.gameOver = true;
  if (state.winner === 0) {
    state.message = `No winner in Round ${state.round} — advancing to next round!`;
  } else {
    state.message = `Game over! Player ${state.winner} wins.`;
  }
}
```
*(Note: Because total Charm Points across all 7 characters is $2+2+2+3+3+4+5 = 21 < 22$ and total characters is $7 < 8$, `p1Points && p2Points` and `p1Geishas && p2Geishas` are mathematically impossible.)*

---

### 2. Background-Tab Safe Animations (`docs/src/fx.js`)

Browsers pause Web Animations API `.finished` promises indefinitely in hidden tabs (`document.visibilityState === 'hidden'`), which stalls `playOnlineLocalTurn` / `handleActionIntent`. Replace `docs/src/fx.js` with:

```js
export const motion = {
  factor: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.01 : 1
};

function isHiddenDoc() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

export function wait(ms) {
  if (isHiddenDoc()) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms * motion.factor));
}

export function rectOf(el) {
  if (!el) return new DOMRect(0, 0, 80, 160);
  return el.getBoundingClientRect();
}

export function flyCard({ from, to, frontSrc = null, backSrc, startFaceUp, endFaceUp,
                          duration = 550, delay = 0, keep = false }) {
  const layer = document.getElementById('fx-layer');
  const card = document.createElement('div');
  card.className = 'fx-card';
  const fw = from.width || 80;
  const fh = from.height || 160;
  const tw = to.width || fw;
  const th = to.height || fh;
  Object.assign(card.style, {
    left: `${from.left}px`, top: `${from.top}px`,
    width: `${fw}px`, height: `${fh}px`
  });
  const inner = document.createElement('div');
  inner.className = 'fx-inner';
  const front = document.createElement('div');
  front.className = 'fx-face fx-front';
  if (frontSrc) front.style.backgroundImage = `url('${frontSrc}')`;
  const back = document.createElement('div');
  back.className = 'fx-face fx-back';
  back.style.backgroundImage = `url('${backSrc}')`;
  inner.append(front, back);
  card.append(inner);
  layer.append(card);

  const r0 = startFaceUp ? 0 : 180;
  const r1 = endFaceUp ? 0 : 180;

  if (isHiddenDoc()) {
    if (keep) {
      Object.assign(card.style, {
        left: `${to.left}px`, top: `${to.top}px`,
        width: `${tw}px`, height: `${th}px`
      });
      inner.style.transform = `rotateY(${r1}deg)`;
    } else {
      card.remove();
    }
    return Promise.resolve(card);
  }

  const dx = to.left - from.left;
  const dy = to.top - from.top;
  const sx = tw / fw;
  const sy = th / fh;
  const dur = Math.max(1, duration * motion.factor);
  const del = delay * motion.factor;
  const opts = {
    duration: dur,
    delay: del,
    easing: 'cubic-bezier(.2,.7,.2,1)',
    fill: 'forwards'
  };
  const move = card.animate([
    { transform: 'translate(0px, 0px) scale(1, 1)' },
    { transform: `translate(${dx / 2}px, ${dy / 2 - 30}px) scale(${((1 + sx) / 2) * 1.08}, ${((1 + sy) / 2) * 1.08})`, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }
  ], opts);
  const flip = inner.animate([
    { transform: `rotateY(${r0}deg)` },
    { transform: `rotateY(${r1}deg)` }
  ], opts);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(safetyTimer);
      if (!keep) card.remove();
      resolve(card);
    };
    const safetyTimer = setTimeout(() => {
      try { move.finish(); } catch (_) {}
      try { flip.finish(); } catch (_) {}
      finish();
    }, dur + del + 350);
    Promise.all([move.finished, flip.finished]).then(finish, finish);
  });
}

export function clearFx() {
  document.getElementById('fx-layer')?.replaceChildren();
}
```

---

### 3. Network Heartbeat, Signaling Recovery & Reconnection (`docs/src/net-config.js` & `docs/src/net.js`)

#### 3.1 `docs/src/net-config.js`
- Set `pingIntervalMs: 5000` and add `pongTimeoutMs: 16000`.

#### 3.2 `docs/src/net.js`
Update `createNetSession(handlers = {}, options = {})`:
- **Options:**
  - `connectTimeoutMs = options.connectTimeoutMs ?? NET_CONFIG.connectTimeoutMs`
  - `pingIntervalMs = options.pingIntervalMs ?? NET_CONFIG.pingIntervalMs`
  - `pongTimeoutMs = options.pongTimeoutMs ?? NET_CONFIG.pongTimeoutMs`
  - `clientId = options.clientId || generateClientId()` (12-char alphanumeric ID)
- **Internal Session State:**
  - `let peer = null;`, `let activeConn = null;`, `let role = null;`, `let roomCode = null;`
  - `let closedByUs = false;`, `let peerLeftIntentionally = false;`
  - `let hasHadGuest = false;`, `let guestClientId = null;`
  - `let pingTimer = null;`, `let reconnectSignalingTimer = null;`, `let lastRxAt = 0;`
- **Heartbeat & Timeout (`startHeartbeat()`):**
  - Sets `lastRxAt = Date.now()`.
  - `pingTimer = setInterval(...)` every `pingIntervalMs` (calling `pingTimer.unref?.()`):
    - If `activeConn && activeConn.open`:
      - If `Date.now() - lastRxAt > pongTimeoutMs`:
        - Closes `activeConn` and invokes `handleUnexpectedDisconnect('heartbeat_timeout')`.
        - Returns.
      - Sends `{ v: 1, type: 'ping' }`.
- **Signaling Auto-Reconnect (`attachSignalingRecovery(p)`):**
  - On `p.on('disconnected', ...)`: if `!closedByUs && peer === p && !p.destroyed`, clears any prior `reconnectSignalingTimer` and schedules `reconnectSignalingTimer = setTimeout(() => { if (!closedByUs && peer === p && p.disconnected && !p.destroyed) { try { p.reconnect(); } catch (_) {} } }, 1000)` (`reconnectSignalingTimer.unref?.()`).
- **Disconnect Routing:**
  - `handleIntentionalPeerLeft()`: sets `peerLeftIntentionally = true`, stops heartbeat, closes `activeConn` (`activeConn = null`), and calls `handlers.onPeerLeft?.()`.
  - `handleUnexpectedDisconnect(reason)`: if `closedByUs || peerLeftIntentionally` return; stops heartbeat; if `activeConn` exists, closes it and sets `activeConn = null`; if `handlers.onConnectionLost` is provided, calls `handlers.onConnectionLost({ roomCode, role, reason })`, **otherwise** falls back to `handlers.onPeerLeft?.()` (preserving backward compatibility with callers that only register `onPeerLeft`).
  - Note on `p.on('close')`:
    - Only triggers `handleUnexpectedDisconnect('peer_closed')` if `peer === p && !closedByUs && (!activeConn || !activeConn.open)`.
- **Host `peer.on('connection', conn)` Reconnection & `room_full` Guard:**
  - Listen for `conn.on('data', data)` (with an 8s un-greeted cleanup timer `handshakeTimer`, `.unref?.()`):
    - On first `data?.type === 'hello'`:
      - Clear `handshakeTimer`.
      - Let `incomingClientId = typeof data.clientId === 'string' ? data.clientId : null`.
      - Let `isSameGuestReconnecting = Boolean(hasHadGuest && guestClientId && incomingClientId === guestClientId)`.
      - **Occupied Room Check:** If `activeConn && activeConn.open && !isSameGuestReconnecting`:
        - Send `{ v: 1, type: 'room_full' }` and close `conn` after 100ms without disturbing `activeConn`. Return.
      - **Replace Stale Connection (if `activeConn` was half-open for same guest):**
        - If `activeConn && activeConn !== conn`:
          - Detach by setting `const stale = activeConn; activeConn = null; try { stale.close(); } catch (_) {}`.
      - Bind `const isResume = hasHadGuest;`:
        - `hasHadGuest = true;`
        - `guestClientId = incomingClientId;`
        - `peerLeftIntentionally = false;`
        - `activeConn = conn;`
        - `greeted = true;`
        - `startHeartbeat();`
        - Send `{ v: 1, type: 'welcome', resumed: isResume }`.
        - If `isResume && handlers.onGuestReconnected`: call `handlers.onGuestReconnected({ roomCode })`; else call `handlers.onGuestJoined?.({ roomCode })`.
    - For subsequent packets when `greeted && activeConn === conn`: update `lastRxAt = Date.now()` and call `handleConnData(data)`.
- **Guest `connectGuestToHost(p, code)` helper (shared by `joinRoom` and `reconnect`):**
  - Connects `p.connect(peerIdForRoom(code), { reliable: true, serialization: 'json' })`.
  - Sends `{ v: 1, type: 'hello', clientId }`.
  - On `data?.type === 'welcome'`: starts heartbeat (`lastRxAt = Date.now()`), sets `peerLeftIntentionally = false`, calls `handlers.onJoinedHost?.({ roomCode: code, resumed: Boolean(data.resumed) })`, and resolves `{ roomCode: code, resumed: Boolean(data.resumed) }`.
  - On `data?.type === 'room_full'`: rejects with `new Error('That room already has two players.')` (without destroying `peer` if called from `reconnect()`, or cleaning up if called from `joinRoom`).
- **`async reconnect()` Method Returned by `createNetSession`:**
  - If `closedByUs || !role || !roomCode`: throw `new Error('No active online session to reconnect.')`.
  - `peerLeftIntentionally = false;`
  - **If `role === 'host'`:**
    - If `peer && !peer.destroyed`:
      - If `peer.disconnected`: call `peer.reconnect()` and await `'open'` (with `connectTimeoutMs` fallback to re-creating peer via `hostRoom(roomCode, { keepGuestState: true })`).
      - Return `{ roomCode, connected: isConnected() }`.
    - Else: call `await hostRoom(roomCode, { keepGuestState: true })` (which preserves `hasHadGuest` and `guestClientId` so when Guest reconnects, `onGuestReconnected` fires!).
    - Return `{ roomCode, connected: isConnected() }`.
  - **If `role === 'guest'`:**
    - Stop heartbeat; if `activeConn`, close it and set `activeConn = null`.
    - Ensure `peer` is open on signaling server: if `!peer || peer.destroyed` or `peer.disconnected` (attempting `peer.reconnect()`, falling back to creating `new PeerCtor(undefined, NET_CONFIG.peerOptions)` and awaiting `'open'`).
    - Return `await connectGuestToHost(peer, roomCode)` within `connectTimeoutMs`.
- Export `getClientId: () => clientId` and `reconnect` alongside existing session methods (`hostRoom`, `joinRoom`, `send`, `isConnected`, `getRole`, `getRoomCode`, `close`).

---

### 4. HTML Markup & SVG Icons (`docs/index.html`)

1. **Mode Selection Buttons (`#game-mode-buttons`, lines 79–88):**
   Rename `Online 2P` to `Online Two Player` and add `<svg class="mode-btn-icon" aria-hidden="true">` icons to both buttons:
   ```html
          <div id="game-mode-buttons" class="setup-buttons two-col" role="group" aria-label="Game mode">
            <button id="mode-ai-button" class="setup-button mode-choice-btn selected" type="button" data-mode="ai" aria-pressed="true">
              <svg class="mode-btn-icon" aria-hidden="true"><use href="#icon-single-player"/></svg>
              <strong>Single Player</strong>
              <span>Play vs Computer</span>
            </button>
            <button id="mode-online-button" class="setup-button mode-choice-btn" type="button" data-mode="online" aria-pressed="false">
              <svg class="mode-btn-icon" aria-hidden="true"><use href="#icon-two-player"/></svg>
              <strong>Online Two Player</strong>
              <span>Play over the internet</span>
            </button>
          </div>
   ```
2. **Disconnect / Reconnect Modal (`#disconnect-modal`, lines 172–180):**
   Add `#disconnect-reconnect-button` alongside `#disconnect-ok-button`:
   ```html
      <div id="disconnect-modal" class="confirm-modal hidden" role="dialog" aria-modal="true" aria-labelledby="disconnect-modal-title">
        <div class="confirm-modal-card">
          <h2 id="disconnect-modal-title">Connection Lost</h2>
          <p id="disconnect-modal-desc" class="confirm-modal-desc">Connection to opponent was interrupted.</p>
          <div class="confirm-modal-actions">
            <button id="disconnect-reconnect-button" class="modal-btn primary" type="button">Reconnect</button>
            <button id="disconnect-ok-button" class="modal-btn secondary" type="button">Back to Menu</button>
          </div>
        </div>
      </div>
   ```
3. **SVG `<defs>` Symbols (inside `<svg><defs>`, before `</defs>`):**
   Add clear 1-player and 2-player symbols:
   ```html
      <symbol id="icon-single-player" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="8" r="4"/><path d="M5 20a7 7 0 0 1 14 0"/></symbol>
      <symbol id="icon-two-player" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="16.5" cy="9" r="3"/><path d="M16.5 14.5a5.5 5.5 0 0 1 5 5.5"/></symbol>
   ```

---

### 5. Styling Updates (`docs/src/styles.css`)

1. **Mode Button Icons (`.mode-btn-icon`):**
   ```css
   .mode-btn-icon {
     width: 28px;
     height: 28px;
     margin-bottom: 4px;
     color: var(--text-muted);
     transition: color 0.15s, transform 0.15s;
   }

   .setup-button:hover .mode-btn-icon {
     color: var(--text);
   }

   .setup-button.selected .mode-btn-icon {
     color: var(--accent);
   }
   ```
2. **Non-Blocking Persistent `#peek-restore-button` (`.peek-restore-btn`):**
   On the `1760×900` `#stage`:
   - `.geisha-grid` occupies `x = 441..1295px, y = 206..646px`.
   - `#offer-tray` (without the inline button) occupies `x ≈ 618..1257px, y ≈ 313..539px`.
   - `.result-card` occupies `x ≈ 519..1241px`.
   - `.pile-column` cards occupy `x = 1640..1715px`.
   - Therefore **`left: 1468px; top: 426px; translate: -50% -50%;`** sits right in the `345px`-wide open felt corridor between the 7th Character column and the Deck/Discard piles, vertically aligned with `#offer-tray`, blocking **nothing** on the board and never moving a pixel when clicked!
   Update `.peek-restore-btn` in `docs/src/styles.css` (replacing lines 828–860):
   ```css
   .peek-restore-btn {
     position: absolute;
     top: 426px;
     left: 1468px;
     translate: -50% -50%;
     z-index: 115;
     min-width: 172px;
     display: inline-flex;
     align-items: center;
     justify-content: center;
     gap: 8px;
     padding: 11px 20px;
     border-radius: 9999px;
     border: 1.5px solid rgba(244, 211, 94, 0.55);
     font-size: 0.92rem;
     font-weight: 800;
     cursor: pointer;
     touch-action: manipulation;
     user-select: none;
     -webkit-user-select: none;
     box-shadow: 0 0 0 3px rgba(244, 211, 94, 0.22), 0 12px 28px rgba(0, 0, 0, 0.6);
     transform: translateY(0);
     transition: transform 0.15s, filter 0.15s, background 0.15s, color 0.15s;
   }

   .peek-restore-btn.peek-closed {
     background: rgba(15, 23, 42, 0.94);
     color: var(--text);
   }

   .peek-restore-btn.peek-closed .icon {
     color: var(--accent);
   }

   .peek-restore-btn .icon {
     width: 18px;
     height: 18px;
     flex-shrink: 0;
   }

   .peek-restore-btn:hover {
     transform: translateY(-1px);
     filter: brightness(1.08);
   }
   ```
   *(Remove `.peek-restore-btn.holding { pointer-events: none; }` so pointer events and cursor stay steady in-place during rapid clicks.)*

---

### 6. UI, Persistent Peek Toggle, Lobby Reset & Online Synchronization (`docs/src/ui.js`)

#### 6.1 Element References (`els`)
Add to `const els = { ... }` in `docs/src/ui.js`:
```js
  disconnectModalTitle: document.getElementById('disconnect-modal-title'),
  disconnectReconnectButton: document.getElementById('disconnect-reconnect-button'),
```

#### 6.2 Persistent In-Place `View Board` / `Show Offer` Toggle
1. Replace `let suppressTriggerClickUntil = 0;` with `let suppressNextPeekClick = false;`.
2. In `renderOfferTray()` (lines 620–640):
   - Keep the status label (`Pick a card`, `Pick a pair`, or `Opponent choosing…`) inside `.tray-head`, and **remove** the inline `peekBtn` creation inside `.tray-head` so `#offer-tray` never embeds a disappearing button over the board.
3. Update `activePeekTrigger()`:
   ```js
   function activePeekTrigger() {
     if (!els.peekRestoreButton.classList.contains('hidden')) {
       return els.peekRestoreButton;
     }
     if (Game.state.gameOver && resultReady) {
       return els.resultPanel.querySelector('.peek-trigger-btn');
     }
     return null;
   }
   ```
4. Update `updatePeekUI()` so `#peek-restore-button` is visible **whenever `canPeekBoard()` is true** (both `closed` and `holding`/`latched`), staying in the exact same spot (`1468px, 426px`):
   ```js
   function updatePeekUI() {
     const available = canPeekBoard();
     const active = peekState !== 'closed' && available;
     els.stage.classList.toggle('is-peeking', active);

     const latched = peekState === 'latched' && active;
     els.offerTray.inert = latched;
     els.resultPanel.inert = latched;

     if (!available) {
       els.peekRestoreButton.classList.add('hidden');
       els.peekRestoreButton.classList.remove('holding', 'peek-closed');
       return;
     }

     const targetName = Game.state.gameOver && resultReady ? 'Summary' : 'Offer';
     if (!active) {
       els.peekRestoreButton.innerHTML = `${iconSvg('eye')}<span>View Board</span>`;
       els.peekRestoreButton.setAttribute('aria-label', 'View board');
       els.peekRestoreButton.classList.add('peek-closed');
       els.peekRestoreButton.classList.remove('holding');
       els.peekRestoreButton.classList.remove('hidden');
       return;
     }

     const label = peekState === 'holding' ? 'Release to Return' : `Show ${targetName}`;
     els.peekRestoreButton.innerHTML = `${iconSvg('eye-off')}<span>${label}</span>`;
     els.peekRestoreButton.setAttribute('aria-label', `Show ${targetName.toLowerCase()}`);
     els.peekRestoreButton.classList.remove('peek-closed');
     els.peekRestoreButton.classList.toggle('holding', peekState === 'holding');
     els.peekRestoreButton.classList.remove('hidden');
   }
   ```
5. Update pointer/click handlers on `#peek-restore-button` and `.peek-trigger-btn` (inside `.result-actions`) for instant repeated clicking + press-and-hold:
   - In `handlePeekPointerEnd(e)`:
     - Set `suppressNextPeekClick = true;` (replacing `suppressTriggerClickUntil`).
     - If `heldMs >= PEEK_HOLD_MS`: `stopPeek(false);` else `latchPeek();`.
   - On `els.stage` `pointerdown`:
     - Match `const btn = e.target.closest('.peek-trigger-btn, #peek-restore-button');`
     - `suppressNextPeekClick = false;`
     - Only call `beginPeekHold(e.pointerId)` when `peekState === 'closed'`.
   - On `els.stage` `click` (for `.peek-trigger-btn` inside `#result-panel`):
     - If `suppressNextPeekClick` -> `suppressNextPeekClick = false; return;`, else `latchPeek()`.
   - On `els.peekRestoreButton` `click`:
     ```js
     els.peekRestoreButton.addEventListener('click', () => {
       if (suppressNextPeekClick) {
         suppressNextPeekClick = false;
         return;
       }
       if (!canPeekBoard() || isConfirmModalOpen() || isDisconnectModalOpen()) return;
       if (peekState === 'closed') {
         latchPeek();
       } else {
         stopPeek(true);
       }
     });
     ```

#### 6.3 Result Panel No-Winner Wording (`buildResultPanel()`)
Update lines 715–720 of `docs/src/ui.js` so rounds ending with `winner === 0` (including e.g. `9 pts` vs `6 pts` where neither hit `11+` pts or `4+` Geishas) read accurately:
```js
  const headingText = isTie
    ? `Round ${result.round} — No Winner Yet`
    : (result.round > 1 ? `Game Over · Round ${result.round}` : 'Game Over');

  let winnerText = '🤝 Neither player reached 4 Geishas or 11 Charm Points. Favors carry over!';
```

#### 6.4 Reset Abandoned Online Host/Join Lobby (`resetOnlineLobbyUI()`)
Add `resetOnlineLobbyUI()` in `docs/src/ui.js` and call it inside `showModeSelection()` after closing `netSession`:
```js
function resetOnlineLobbyUI() {
  onlineBusy = false;
  onlineRoomCode = null;
  els.lobbyRoomCode.textContent = '------';
  els.hostLobbyBox.classList.add('hidden');
  els.createRoomButton.classList.remove('hidden');
  els.createRoomButton.disabled = false;
  els.hostLobbyStatus.textContent = 'Waiting for opponent to join…';
  els.hostLobbyStatus.classList.remove('error');

  els.joinStatusMsg.textContent = '';
  els.joinStatusMsg.classList.add('hidden');
  els.joinStatusMsg.classList.remove('error');
  els.joinRoomButton.disabled = false;
  els.cancelJoinButton.classList.add('hidden');
}
```
Also in `els.onlineRoleTabs` click listener: if switching away from `'host'` while `!gameStarted && netSession`, call `handleCancelRoomClick()` so an orphaned lobby room is closed cleanly.
Because `setupMode` (`'online'`) and `onlineTab` (`'host'`) remain preserved when Host abandons an online game, `showModeSelection()` routes Host directly to **Online Two Player → Host Game** with `#host-lobby-box` hidden and the **`Create Room`** button enabled and visible!

#### 6.5 Lock-Free Online Turn Protocol & Reconnection (`docs/src/ui.js`)

1. **Persistent Tab `clientId`:**
   ```js
   function getOrCreateClientId() {
     try {
       let id = sessionStorage.getItem('seven-favors-client-id');
       if (!id) {
         id = Array.from({ length: 12 }, () => Net.ROOM_ALPHABET[Math.floor(Math.random() * Net.ROOM_ALPHABET.length)]).join('');
         sessionStorage.setItem('seven-favors-client-id', id);
       }
       return id;
     } catch (_) {
       return undefined;
     }
   }
   ```
   Pass `{ clientId: getOrCreateClientId() }` as second argument `options` to `Net.createNetSession(handlers, options)` in both `handleCreateRoomClick` and `handleJoinRoomClick`.

2. **Buffered & Rejectable Signal Promises (`pendingSignals` + `earlySignals`):**
   Replace `waitForNetSignal`, `resolveNetSignal`, `rejectAllNetSignals`, and `awaitHumanChoice` so:
   - `earlySignals = new Map()` buffers any signal (`turn_commit`, `offer_response`, `offer_choice`) that arrives *before* `waitForNetSignal(type)` is called; `waitForNetSignal(type)` immediately resolves from `earlySignals` if queued!
   - `pendingSignals` stores `{ resolve, reject }`; `rejectAllNetSignals()` rejects every pending entry with `Object.assign(new Error('Net signal aborted'), { abort: true })`, clears `earlySignals`, and resets `turnQueue = Promise.resolve()`.
   - `awaitHumanChoice()` attaches `pendingOffer.cancel = () => reject(Object.assign(new Error('Offer aborted'), { abort: true }))`; `resetUIState()` and `abortInFlightOnlineTurn()` invoke `pendingOffer?.cancel?.()` before setting `pendingOffer = null` so `turnQueue` can **never** deadlock!

3. **Atomic Non-Interactive Turns (`remote_turn` & Immediate `turn_commit`):**
   - **Host (`localSeat === 1`) playing `secret` or `tradeoff` in `playOnlineLocalTurn`:**
     - Capture `prevNext = Game.getHand(2)` and DOM `from`/`to` rects, hide selected card(s) in DOM.
     - Mutate `Game.performSecret(1, idx)` / `Game.performTradeoff(1, sel)` **immediately** and send ONE single atomic packet:
       `netSession.send({ type: 'remote_turn', action: 'secret' | 'tradeoff', selected, view: Game.buildPlayerView(2) });`
     - Run `await Fx.flyCard(...)`, `pushHistory(...)`, and `await afterCommit(prevNext, token)`.
   - **Guest (`localSeat === 2`) handling `remote_turn` (`handleRemoteTurn(msg)` via `enqueueNetTurn`):**
     - Animates `Fx.flyCard` for `msg.action` (`'secret'` or `'tradeoff'`), captures `prevNext = Game.getHand(2)`, applies `Game.applyPlayerView(msg.view)` directly from `msg.view` (**zero `waitForNetSignal` call!**), pushes history, and runs `await afterCommit(prevNext, token)`.
     - *(Keep `remote_secret` / `remote_tradeoff` fallback or route entirely through `remote_turn`.)*
   - **Host handling Guest's `action_intent` (`handleActionIntent(msg)`):**
     - Capture `prevNext = Game.getHand(2)` and DOM `from`/`to` rects, hide selected card(s).
     - Execute `const ok = action === 'secret' ? Game.performSecret(2, idx) : Game.performTradeoff(2, sel)`.
     - If `!ok`: send `{ type: 'match_sync', view: Game.buildPlayerView(2), history: buildSanitizedHistoryFor(2) }`, `render()`, and return.
     - **Immediately** send `netSession.send({ type: 'turn_commit', view: Game.buildPlayerView(2) })` **before** `await Fx.flyCard(...)` so Guest never waits on Host's animation!
     - Run `await Fx.flyCard(...)`, `pushHistory(...)`, and `await afterCommit(prevNext, token)`.

4. **Disconnect Modal Modes, Auto-Reconnect & `match_sync` Recovery:**
   - Helper `abortInFlightOnlineTurn()`:
     ```js
     function abortInFlightOnlineTurn() {
       gameToken += 1;
       stopPeek(false);
       Fx.clearFx();
       pendingOffer?.cancel?.();
       pendingOffer = null;
       pendingAction = null;
       hiddenDraw = null;
       animating = false;
       rejectAllNetSignals();
       if (Game.state.gameOver) {
         revealDone = true;
         resultReady = true;
       }
     }
     ```
   - Helper `buildSanitizedHistoryFor(viewerSeat)`:
     Maps `history` so opponent `tradeoff` cards are always `card: null`, and opponent `secret` card is `card: null` unless `Game.state.gameOver` (in which case `Game.state.secretCard[entry.player]`).
   - Helper `mergeSyncedHistory(remoteHistory)`:
     Preserves Guest's own known `tradeoff` / `secret` card IDs from local `history` (matched by `id`) while adopting authoritative remote order/entries.
   - **Intentional Leave (`onPeerLeft` -> `handleNetPeerLeft`):**
     - If `(gameStarted || Game.state.gameOver) && gameMode === 'online'`:
       - `gameStarted = false;`
       - `abortInFlightOnlineTurn();`
       - Close `netSession` (`netSession.close(false); netSession = null;`).
       - Open `#disconnect-modal` with `canReconnect = false`:
         - Title: `'Opponent Left'`
         - Desc: `'Your opponent left the match.'`
         - `#disconnect-reconnect-button` hidden; `#disconnect-ok-button` styled `.primary`.
   - **Unexpected Connection Drop (`onConnectionLost` -> `handleNetConnectionLost`):**
     - If `(gameStarted || (Game.state.gameOver && resultReady)) && gameMode === 'online'`:
       - `abortInFlightOnlineTurn();`
       - `localReadyNext = false; remoteReadyNext = false;`
       - `render();`
       - If `localSeat === 1` (Host):
         - Open `#disconnect-modal` with `canReconnect = true`:
           - Title: `'Connection Lost'`
           - Desc: `` `Lost connection to opponent. Waiting for opponent to reconnect to room ${onlineRoomCode}…` ``
           - `#disconnect-reconnect-button` visible (`'Refresh Room'`), `#disconnect-ok-button` visible (`'Back to Menu'`).
         - Automatically trigger silent `netSession.reconnect().catch(() => {})` on Host so signaling registration stays live if Host's own network blipped.
       - If `localSeat === 2` (Guest):
         - Open `#disconnect-modal` with `canReconnect = true`:
           - Title: `'Connection Lost'`
           - Desc: `'Connection interrupted. Attempting to reconnect…'`
         - Automatically run one reconnect attempt (`attemptOnlineReconnect({ auto: true })`) after 600ms; if that fails, enable `#disconnect-reconnect-button` (`'Reconnect'`) with message `` `Could not reconnect automatically. Check your connection and click Reconnect to rejoin room ${onlineRoomCode}.` ``.
   - **Manual Reconnect Button (`#disconnect-reconnect-button` -> `attemptOnlineReconnect({ auto: false })`):**
     - Disables `#disconnect-reconnect-button`, sets text `'Reconnecting…'`, calls `await netSession.reconnect()`.
     - On Guest: upon success, updates status to `'Connected! Restoring match state…'` (and sends `{ type: 'request_sync' }` as backup in case `match_sync` raced).
     - On Host: upon success, updates status to `` `Room ${onlineRoomCode} active. Waiting for opponent to reconnect…` ``.
     - On error: re-enables `#disconnect-reconnect-button` (`'Reconnect'`) and shows `err.message` in `#disconnect-modal-desc`.
   - **Reconnection Handshake (`onGuestReconnected` on Host & `match_sync` on Guest):**
     - On Host `handleNetGuestReconnected()` (and on receiving `{ type: 'request_sync' }`):
       - `abortInFlightOnlineTurn();`
       - `localReadyNext = false; remoteReadyNext = false;`
       - Sends `{ type: 'match_sync', round: Game.state.round, view: Game.buildPlayerView(2), history: buildSanitizedHistoryFor(2) }`.
       - `closeDisconnectModal();`
       - `render();`
     - On Guest receiving `{ type: 'match_sync' }` in `handleNetMessage`:
       - `gameMode = 'online'; localSeat = 2;`
       - `abortInFlightOnlineTurn();`
       - `Game.applyPlayerView(msg.view);`
       - `gameStarted = !Game.state.gameOver || Game.state.winner === 0;`
       - `revealDone = Boolean(Game.state.gameOver);`
       - `resultReady = Boolean(Game.state.gameOver);`
       - `localReadyNext = false; remoteReadyNext = false;`
       - `mergeSyncedHistory(msg.history || []);`
       - `els.modeSelectionScreen.classList.add('hidden');`
       - `closeDisconnectModal();`
       - `renderHistory(false);`
       - `render();`

---

## Edge Cases
1. **Race Between Host Card Flight and `turn_commit` (Root Cause of Secret/Discard Freezes):** Combining Host's `secret` and `tradeoff` into a single `remote_turn` message carrying `view` eliminates the two-message race entirely, while early-signal buffering in `waitForNetSignal` guarantees `offer_response`, `offer_choice`, and `turn_commit` can never be dropped even under extreme jitter or `prefers-reduced-motion` asymmetry.
2. **Backgrounded Browser Tabs Pausing Web Animations:** Fast-forwarding `Fx.flyCard` and `Fx.wait` when `document.visibilityState === 'hidden'` plus a `dur + del + 350ms` safety timer ensures a minimized/tabbed-out Host or Guest never blocks turn resolution.
3. **Mid-Offer Disconnects Without State Corruption:** Because `Game.state` only mutates atomically on completed actions, aborting uncommitted UI animations/offers on disconnect and projecting Host's `Game.buildPlayerView(2)` via `match_sync` cleanly restores all offered cards back to the active player's hand at the exact turn boundary with zero card loss or duplication.
4. **Half-Open NAT Ghost Sockets Blocking Reconnect:** Matching `clientId` inside Host's `hello` handler allows a reconnecting Guest to replace their own stale half-open `activeConn` immediately instead of being falsely rejected with `room_full`, while genuine 3rd players with a different `clientId` are still rejected with `room_full`.
5. **Guest Rejoining From Fresh Tab With Room Code:** Once Host's old `activeConn` closes (`!activeConn || !activeConn.open`) while `hasHadGuest === true`, a Guest re-entering the 6-character code from **Join Game** is accepted via `onGuestReconnected` and receives `match_sync` to resume the active match seamlessly.
6. **Rapid Repeated Clicks on `View Board`:** Tracking `suppressNextPeekClick` (cleared immediately after consuming a pointer gesture's synthetic click or on the next `pointerdown`) instead of a 300ms suppression timer lets players click `#peek-restore-button` at any speed in the exact same screen coordinates while preserving press-and-hold peek and keyboard `Enter`/`Space`/`Escape` accessibility.
7. **Unequal Scores Below Win Thresholds (`10 pts` vs `6 pts`, `< 4` Geishas):** Removing the `scores[1] > scores[2]` fallback in `computeEndgame()` ensures rounds with unowned/tied characters where neither player reached `11+` Charm Points or `4+` Geishas always yield `winner === 0` and advance to Round `N + 1` with `geishalove` preserved.

---

## Execution Checklist
- [x] Step 1: Update `docs/src/game.js` (`computeEndgame` and `finishGame`) to enforce the strict victory rule (win only on `11+` Charm Points or `4+` Geishas, with `11+` points taking precedence; otherwise `winner = 0`).
- [x] Step 2: Update `docs/src/fx.js` to guard `rectOf()` and prevent hidden-tab / mid-flight Web Animations stalls via `visibilityState` fast-forwarding and a safety completion timer.
- [x] Step 3: Update `docs/src/net-config.js` (`pingIntervalMs: 5000`, `pongTimeoutMs: 16000`) and `docs/src/net.js` to add `clientId`, signaling `peer.reconnect()` recovery, heartbeat timeout detection, `onConnectionLost` vs `onPeerLeft`, Host `onGuestReconnected` acceptance, and `session.reconnect()`.
- [x] Step 4: Update `docs/index.html` to rename `Online 2P` to `Online Two Player`, add `#icon-single-player` and `#icon-two-player` SVG icons to the mode buttons, and add `#disconnect-reconnect-button` to `#disconnect-modal`.
- [x] Step 5: Update `docs/src/styles.css` to style `.mode-btn-icon` and position `#peek-restore-button` in the non-blocking right-board corridor (`left: 1468px; top: 426px`) with fixed geometry across `View Board` and `Show Offer`/`Show Summary` states.
- [x] Step 6: Update `docs/src/ui.js` to wire the persistent in-place `#peek-restore-button` toggle (removing the inline `#offer-tray` peek button), reset abandoned Host/Join lobbies via `resetOnlineLobbyUI()`, fix signal/offer cancellation, implement atomic `remote_turn` + immediate `turn_commit`, and wire auto + manual reconnection (`match_sync`).
- [x] Step 7: Update `tests/game.test.js`, `tests/simulation.test.js`, `tests/net.test.js`, and `tests/ui.test.js` to verify the strict win condition, reconnection & timeout flows, lobby reset, renamed button + icons, and persistent `View Board` toggle.
- [x] Step 8: Update `AGENTS.md` and `README.md` to reflect `Online Two Player`, strict victory rules, match reconnection, and the persistent non-blocking `View Board` button, then run `node --check docs/src/game.js docs/src/ai.js docs/src/ui.js docs/src/fx.js docs/src/net.js docs/src/net-config.js` and `npm test`.
