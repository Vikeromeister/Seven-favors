# SPEC — Default Coin Toss Starter, Easy/Medium/Hard AI Labels & Online Two-Player Mode

## Root Cause / Objective
The pre-game setup currently defaults the Round 1 starting player to `You` (`startingPlayerPref = 1`), labels AI difficulties as `Casual`/`Tactical`/`Master`, and only supports local single-player matches against the AI. We must make `Random` (Coin toss) the default starting player selection, rename the AI difficulty labels across the UI and docs to `Easy`, `Medium`, and `Hard`, and add a zero-backend **Online Two-Player Mode** over WebRTC DataChannels (PeerJS with room codes, shareable `?room=` invite links, host-authoritative hidden-information sanitization, perspective-flipped board rendering, and optional TURN configuration guidance).

## File Map
| Path | Operation | Purpose |
|---|---|---|
| `docs/src/net-config.js` | Create | Pure JS WebRTC/PeerJS signaling, room prefix, timeout/heartbeat, and STUN/optional-TURN configuration. |
| `docs/src/net.js` | Create | DOM-safe WebRTC P2P session manager (lazy CDN PeerJS loader in browser, injectable `PeerClass` for Node tests, 6-char room codes, heartbeat, single-guest guard). |
| `docs/src/game.js` | Modify | Export `buildPlayerView(viewerSeat)` and `applyPlayerView(view)` for sanitized multiplayer state projection without breaking existing exports/tests. |
| `docs/index.html` | Modify | Set `#starter-random-button` selected by default, rename AI buttons/badge to `Easy`/`Medium`/`Hard`, add Single Player vs Online 2P setup controls (Host room lobby + Join code input), and add `#disconnect-modal`. |
| `docs/src/styles.css` | Modify | Replace hardcoded `data-stack^="1-"`/`"2-"` badge selectors with `.stack-bottom`/`.stack-top`, style Online 2P lobby/join controls (`user-select: text` on room codes/inputs), and keep `.mode-selection-card` compact within `1760×900`. |
| `docs/src/ui.js` | Modify | Default `startingPlayerPref = 'random'`, update `DIFF_LABELS` to `Easy`/`Medium`/`Hard`, generalize seat perspective (`localSeat` / `oppSeat()`), and wire full Online 2P lobby, serialized turn queue, interactive offers, tie-round/rematch ready handshake, and disconnect recovery. |
| `tests/net.test.js` | Create | Zero-dependency `node:test` suite verifying room codes, mock PeerJS host/guest handshake, `room_full` rejection, `buildPlayerView` hidden-info masking, and full 8-turn + tie-round sync. |
| `tests/ui.test.js` | Modify | Add contract tests verifying default `Random` starter, `Easy`/`Medium`/`Hard` labels, `.stack-bottom`/`.stack-top` CSS, and Online 2P markup/wiring. |
| `AGENTS.md` | Modify | Document `Easy`/`Medium`/`Hard` labels, `Random` default starter, `net.js`/`net-config.js`, and Online Two-Player architecture. |
| `README.md` | Modify | Document Online Two-Player Mode, room codes/invite links, updated difficulty names, and optional TURN setup. |

---

## Technical Blueprint

### 1. User Setup Guide (What You Need to Set Up)

#### 1.1 Zero Mandatory Setup (Works Out-of-the-Box)
- **Nothing is required from you to make Online Two-Player Mode work.**
- By default, `docs/src/net.js` establishes an encrypted browser-to-browser **WebRTC DataChannel** using the free public **PeerJS Cloud** signaling broker (`wss://0.peerjs.com:443`) paired with public **Google & Cloudflare STUN** servers.
-PeerJS (`1.5.4`) is lazy-loaded from jsDelivr (with automatic fallback to unpkg) **only** when a player enters Online Mode, keeping Single Player vs AI 100% offline-capable and `npm test` 100% zero-dependency.
- **How two players connect:**
  1. **Host (Player 1):** Selects **Online 2P → Host Game**, leaves or adjusts Starting Player (defaults to **Random / Coin toss**), clicks **Create Room**, and shares either the **6-character Room Code** (e.g. `K7M4P9`) or clicks **Copy Invite Link** (`https://<your-site>/?room=K7M4P9`).
  2. **Guest (Player 2):** Opens the invite link (which auto-selects Online Join and pre-fills the code) or enters the 6-character code under **Online 2P → Join Game** and clicks **Join Room**. The match launches automatically on both screens.

#### 1.2 GitHub Pages Deployment Check (1 Minute)
1. In your GitHub repository, open **Settings → Pages**.
2. Set **Source** to **Deploy from a branch**, select your main branch and the **`/docs`** folder, and click **Save**.
3. Ensure **Enforce HTTPS** is checked (required by modern browsers for `navigator.clipboard` one-click Copy Invite Link and secure `wss://` signaling).

#### 1.3 Optional Setup: Free TURN Relay for Strict Firewalls / Symmetric Cellular NATs
Direct WebRTC P2P + STUN connects ~85% of internet pairs directly. If two players are on strict symmetric NATs (e.g., certain mobile 4G/5G networks or corporate firewalls) and see *"Connection timed out"*, you can add a free TURN relay in 2 minutes:
1. Create a free account at **Metered OpenRelay** (`https://www.metered.ca/tools/openrelay/`) or **Cloudflare Realtime TURN** and copy your TURN `urls`, `username`, and `credential`.
2. Open `docs/src/net-config.js` and append those TURN entries inside `NET_CONFIG.peerOptions.config.iceServers` (an inline commented template is already provided in `docs/src/net-config.js`). Commit and push to GitHub Pages.
*(Note: Because `docs/` is a static client-side site, only place free-tier / rate-limited TURN credentials in `net-config.js`.)*

---

### 2. Network Configuration & P2P Session Engine (`docs/src/net-config.js` & `docs/src/net.js`)

#### 2.1 `docs/src/net-config.js`
```js
export const NET_CONFIG = {
  roomPrefix: 'seven-favors-v1-',
  connectTimeoutMs: 12000,
  pingIntervalMs: 15000,
  cdnUrls: [
    'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js',
    'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'
  ],
  peerOptions: {
    debug: 0,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
        // Optional TURN server for strict mobile / corporate symmetric NATs:
        // {
        //   urls: 'turn:standard.relay.metered.ca:443?transport=tcp',
        //   username: 'YOUR_TURN_USERNAME',
        //   credential: 'YOUR_TURN_PASSWORD'
        // }
      ]
    }
  }
};
```

#### 2.2 `docs/src/net.js` Signatures & Behavior
- **Constants & Pure Helpers:**
  - `export const ROOM_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';` (32 unambiguous chars; omits `0`, `O`, `1`, `I`).
  - `export const ROOM_CODE_LEN = 6;`
  - `export function normalizeRoomCode(input)`: `String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ROOM_CODE_LEN)`.
  - `export function isValidRoomCode(code)`: `/^[A-Z0-9]{6}$/.test(code)`.
  - `export function generateRoomCode(rng = Math.random)`: picks 6 characters from `ROOM_ALPHABET`.
  - `export function peerIdForRoom(code)`: `${NET_CONFIG.roomPrefix}${normalizeRoomCode(code)}`.
- **Lazy Browser Script Loader (`ensurePeerClass(PeerClass)`):**
  - If `PeerClass` is provided (e.g. in `tests/net.test.js`), return `PeerClass`.
  - If `globalThis.Peer` exists, return `globalThis.Peer`.
  - Otherwise iterate `NET_CONFIG.cdnUrls`, injecting `<script src="..." async></script>` into `document.head` and resolving `globalThis.Peer` once loaded; throw `new Error('Could not load networking library. Check your internet connection.')` if all URLs fail.
- **Session Factory `export function createNetSession(handlers = {}, options = {})`:**
  - `handlers`: `{ onGuestJoined, onJoinedHost, onMessage, onPeerLeft, onError }`
  - `options`: `{ PeerClass = null, connectTimeoutMs = NET_CONFIG.connectTimeoutMs, pingIntervalMs = NET_CONFIG.pingIntervalMs }`
  - Methods:
    1. `async hostRoom(preferredCode = null)`:
       - Resolves `PeerCtor = await ensurePeerClass(options.PeerClass)`.
       - Attempts up to 3 codes (`preferredCode` first if valid, else `generateRoomCode()`).
       - Creates `new PeerCtor(peerIdForRoom(code), NET_CONFIG.peerOptions)`.
       - If `peer.on('error', err)` fires `err.type === 'unavailable-id'` before `open`, destroys peer and retries next generated code (unless `preferredCode` was explicitly requested, in which case rejects).
       - Resolves `{ roomCode: code }` on `peer.on('open')`.
       - On `peer.on('connection', conn)`:
         - If `activeConn` is already open or handshake-pending, waits for `conn.on('open')` to send `{ v: 1, type: 'room_full' }` and closes `conn` without disturbing `activeConn`.
         - Otherwise binds `activeConn = conn`: handles `{ v: 1, type: 'ping' }` -> replies `{ v: 1, type: 'pong' }`; on first `{ v: 1, type: 'hello' }`, starts `pingIntervalMs` heartbeat and invokes `handlers.onGuestJoined?.({ roomCode: code })`; forwards gameplay messages to `handlers.onMessage?.(msg)`; on `{ v: 1, type: 'peer_left' }` or `conn` `close`/`error` (when not locally closed), cleans up and fires `handlers.onPeerLeft?.()`.
    2. `async joinRoom(rawCode)`:
       - Validates `const code = normalizeRoomCode(rawCode)`; rejects if `!isValidRoomCode(code)` with `'Please enter a 6-character room code.'`.
       - Resolves `PeerCtor = await ensurePeerClass(options.PeerClass)`.
       - Opens anonymous `new PeerCtor(undefined, NET_CONFIG.peerOptions)` within `connectTimeoutMs`.
       - Calls `peer.connect(peerIdForRoom(code), { reliable: true, serialization: 'json' })`.
       - Maps `err.type === 'peer-unavailable'` to `'Room not found. Check the 6-character code and ensure the host has the room open.'`.
       - If `{ type: 'room_full' }` arrives before/after open, closes and rejects with `'That room already has two players.'`.
       - On `conn.on('open')`, starts heartbeat, sends `{ v: 1, type: 'hello' }`, fires `handlers.onJoinedHost?.({ roomCode: code })`, and resolves `{ roomCode: code }`.
    3. `send(payload)`: if `activeConn?.open`, calls `activeConn.send({ v: 1, ...payload })` and returns `true`; else `false`.
    4. `isConnected()`: `Boolean(activeConn && activeConn.open)`.
    5. `getRole()`: `'host' | 'guest' | null`.
    6. `getRoomCode()`: `roomCode`.
    7. `close(notifyPeer = false)`: sets `closedByUs = true` first (preventing re-entrant `onPeerLeft`), optionally sends `{ v: 1, type: 'peer_left' }`, clears timers, closes `activeConn`, and calls `peer.destroy()`.

---

### 3. Sanitized State Projection in `docs/src/game.js`

Append two pure functions to `docs/src/game.js` (leaving all existing functions and default arguments unchanged):

```js
/**
 * Builds a JSON-serializable state snapshot for `viewerSeat` (1 or 2) with
 * hidden information masked: deck contents and opponent hand cards are replaced
 * by counts, and the opponent's secret card is masked as `0` until `gameOver`.
 * @param {1 | 2} viewerSeat
 */
export function buildPlayerView(viewerSeat) {
  const seat = viewerSeat === 2 ? 2 : 1;
  const opp = other(seat);
  const oppSecretRaw = state.secretCard[opp];
  const oppSecretMasked = state.gameOver
    ? oppSecretRaw
    : (oppSecretRaw !== null ? 0 : null);

  return {
    viewerSeat: seat,
    round: state.round,
    roundStarter: state.roundStarter,
    currentPlayer: state.currentPlayer,
    turnsTaken: state.turnsTaken,
    deckCount: state.deck.length,
    myHand: [...state.players[seat].hand],
    oppHandCount: state.players[opp].hand.length,
    actions: {
      1: { ...state.players[1].actions },
      2: { ...state.players[2].actions }
    },
    geishagifts: [
      null,
      [...state.geishagifts[1]],
      [...state.geishagifts[2]]
    ],
    secretCard: seat === 1
      ? [null, state.secretCard[1], oppSecretMasked]
      : [null, oppSecretMasked, state.secretCard[2]],
    geishalove: [...state.geishalove],
    priorGeishaLove: [...state.priorGeishaLove],
    scores: [...state.scores],
    geishaCount: [...state.geishaCount],
    gameOver: state.gameOver,
    winner: state.winner,
    message: state.message
  };
}

/**
 * Applies a `buildPlayerView` snapshot onto local `state` for client rendering.
 * @param {ReturnType<typeof buildPlayerView>} view
 */
export function applyPlayerView(view) {
  const seat = view.viewerSeat === 2 ? 2 : 1;
  const opp = other(seat);
  state.round = view.round;
  state.roundStarter = view.roundStarter;
  state.currentPlayer = view.currentPlayer;
  state.turnsTaken = view.turnsTaken;
  state.deck = Array(view.deckCount).fill(0);
  state.players[seat].hand = [...view.myHand];
  state.players[opp].hand = Array(view.oppHandCount).fill(0);
  state.players[1].actions = { ...view.actions[1] };
  state.players[2].actions = { ...view.actions[2] };
  state.geishagifts = [
    null,
    [...view.geishagifts[1]],
    [...view.geishagifts[2]]
  ];
  state.secretCard = [null, view.secretCard[1], view.secretCard[2]];
  state.geishalove = [...view.geishalove];
  state.priorGeishaLove = [...view.priorGeishaLove];
  state.scores = [...view.scores];
  state.geishaCount = [...view.geishaCount];
  state.gameOver = Boolean(view.gameOver);
  state.winner = view.winner;
  state.message = view.message || '';
}
```

---

### 4. HTML Markup Updates (`docs/index.html`)

1. **Top bar badge (line 20):** Change initial text from `Tactical AI` to `Medium AI`:
   ```html
   <span id="difficulty-badge" class="badge">Medium AI</span>
   ```
2. **Mode Selection Card (`#mode-selection-screen`, lines 73–114):**
   Replace the setup controls inside `.mode-selection-card` with:
   ```html
          <h1>Seven Favors</h1>
          <p class="subtitle">A tactical duel of secret gifts, shrewd trades, and contested favor.</p>

          <p class="mode-desc">Game mode:</p>
          <div id="game-mode-buttons" class="setup-buttons two-col" role="group" aria-label="Game mode">
            <button id="mode-ai-button" class="setup-button selected" type="button" data-mode="ai" aria-pressed="true">
              <strong>Single Player</strong>
              <span>Play vs Computer</span>
            </button>
            <button id="mode-online-button" class="setup-button" type="button" data-mode="online" aria-pressed="false">
              <strong>Online 2P</strong>
              <span>Play over the internet</span>
            </button>
          </div>

          <div id="ai-setup-section">
            <p class="mode-desc">AI difficulty:</p>
            <div id="difficulty-buttons" class="setup-buttons" role="group" aria-label="AI difficulty">
              <button id="ai-easy-button" class="setup-button" type="button" data-diff="easy" aria-pressed="false">
                <strong>Easy</strong>
                <span>Relaxed play</span>
              </button>
              <button id="ai-medium-button" class="setup-button selected" type="button" data-diff="medium" aria-pressed="true">
                <strong>Medium</strong>
                <span>Balanced tactics</span>
              </button>
              <button id="ai-hard-button" class="setup-button" type="button" data-diff="hard" aria-pressed="false">
                <strong>Hard</strong>
                <span>Optimal minimax</span>
              </button>
            </div>
          </div>

          <div id="starter-setup-section">
            <p class="mode-desc">Starting player:</p>
            <div id="starter-buttons" class="setup-buttons" role="group" aria-label="Starting player">
              <button id="starter-human-button" class="setup-button" type="button" data-starter="1" aria-pressed="false">
                <strong id="starter-p1-title">You</strong>
                <span id="starter-p1-sub">You go first</span>
              </button>
              <button id="starter-ai-button" class="setup-button" type="button" data-starter="2" aria-pressed="false">
                <strong id="starter-p2-title">Computer</strong>
                <span id="starter-p2-sub">AI goes first</span>
              </button>
              <button id="starter-random-button" class="setup-button selected" type="button" data-starter="random" aria-pressed="true">
                <strong>Random</strong>
                <span>Coin toss</span>
              </button>
            </div>
          </div>

          <button id="start-game-button" class="primary start-game-btn" type="button">Start Game</button>

          <div id="online-setup-section" class="online-setup hidden">
            <div id="online-role-tabs" class="online-role-tabs" role="group" aria-label="Online role">
              <button id="online-tab-host" class="role-tab-btn selected" type="button" data-online-tab="host" aria-pressed="true">Host Game</button>
              <button id="online-tab-join" class="role-tab-btn" type="button" data-online-tab="join" aria-pressed="false">Join Game</button>
            </div>

            <div id="online-host-panel">
              <button id="create-room-button" class="primary start-game-btn" type="button">Create Room</button>
              <div id="host-lobby-box" class="lobby-box hidden">
                <div class="lobby-label">Share Room Code</div>
                <div id="lobby-room-code" class="room-code-value">------</div>
                <div class="lobby-copy-row">
                  <button id="copy-code-button" class="secondary lobby-copy-btn" type="button">Copy Code</button>
                  <button id="copy-link-button" class="secondary lobby-copy-btn" type="button">Copy Invite Link</button>
                </div>
                <p id="host-lobby-status" class="online-status">Waiting for opponent to join…</p>
                <button id="cancel-room-button" class="secondary lobby-cancel-btn" type="button">Cancel Room</button>
              </div>
            </div>

            <div id="online-join-panel" class="hidden">
              <label class="mode-desc join-label" for="join-code-input">Enter 6-character room code:</label>
              <input id="join-code-input" class="room-code-input" type="text" maxlength="6" placeholder="K7M4P9" autocomplete="off" autocapitalize="characters" spellcheck="false" />
              <p id="join-status-msg" class="online-status hidden"></p>
              <button id="join-room-button" class="primary start-game-btn" type="button">Join Room</button>
              <button id="cancel-join-button" class="secondary lobby-cancel-btn hidden" type="button">Cancel</button>
            </div>
          </div>

          <p class="disclaimer">Inspired by the core tabletop game mechanics designed by Kota Nakayama. <em>Hanamikoji</em> is a registered trademark of EmperorS4 and Taiwan Boardgame Design. All code and visual assets in this project are independent and created for non-commercial educational purposes.</p>
   ```
3. **Disconnect Modal (`#disconnect-modal`):** Place inside `#stage` immediately after `#confirm-modal`:
   ```html
      <div id="disconnect-modal" class="confirm-modal hidden" role="dialog" aria-modal="true" aria-labelledby="disconnect-modal-title">
        <div class="confirm-modal-card">
          <h2 id="disconnect-modal-title">Opponent Disconnected</h2>
          <p id="disconnect-modal-desc" class="confirm-modal-desc">Your opponent left the match or lost connection.</p>
          <div class="confirm-modal-actions">
            <button id="disconnect-ok-button" class="modal-btn primary" type="button">Back to Menu</button>
          </div>
        </div>
      </div>
   ```

---

### 5. Styling Updates (`docs/src/styles.css`)

1. **Perspective-Safe Stack Count Badges (lines 193–199):**
   Replace `.gift-stack[data-stack^="1-"] .stack-count` and `.gift-stack[data-stack^="2-"] .stack-count` with:
   ```css
   .gift-stack.stack-bottom .stack-count {
     top: 2px;
   }

   .gift-stack.stack-top .stack-count {
     bottom: 2px;
   }
   ```
2. **Compact Setup Card & Online Lobby Styles (around lines 1035–1141):**
   - Adjust `.mode-selection-card` padding to `24px 32px` (`max-width: 600px`) and margins (`.subtitle` `margin-bottom: 14px`, `.setup-buttons` `margin-bottom: 14px`, `.disclaimer` `margin-top: 16px`) so all setup views fit comfortably inside `900px` stage height with generous vertical clearance.
   - Add `.setup-buttons.two-col { grid-template-columns: repeat(2, 1fr); }`.
   - Style `.online-role-tabs` (2-column pill switcher), `.role-tab-btn` / `.role-tab-btn.selected`, `.lobby-box` (rounded dark panel with dashed accent border), `.room-code-value` (`font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 2rem; font-weight: 800; letter-spacing: 0.22em; color: var(--accent); user-select: text; -webkit-user-select: text;`), `.lobby-copy-row` + `.lobby-copy-btn`, `.room-code-input` (`width: 100%; text-align: center; text-transform: uppercase; letter-spacing: 0.2em; font-size: 1.35rem; font-weight: 800; padding: 10px 14px; border-radius: 12px; background: rgba(8, 16, 30, 0.8); color: var(--text); border: 1.5px solid rgba(255, 255, 255, 0.18); user-select: text; -webkit-user-select: text;`), `.lobby-cancel-btn`, and `.online-status` (with `.online-status.error { color: var(--danger); }`).

---

### 6. UI Perspective & Online Multiplayer Orchestration (`docs/src/ui.js`)

#### 6.1 Constants & Seat Helpers
- Change `DIFF_LABELS`:
  ```js
  const DIFF_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  ```
- Change default starting player preference:
  ```js
  let startingPlayerPref = 'random'; // 1 | 2 | 'random'
  ```
- Add online/perspective state:
  ```js
  let setupMode = 'ai';       // 'ai' | 'online'
  let onlineTab = 'host';     // 'host' | 'join'
  let onlineBusy = false;     // true while creating/joining a room
  let gameMode = 'ai';        // 'ai' | 'online'
  let localSeat = 1;          // 1 (AI mode or Online Host) | 2 (Online Guest)
  let netSession = null;
  let onlineRoomCode = null;
  let localReadyNext = false;
  let remoteReadyNext = false;
  let pendingSignals = new Map(); // type -> resolve[]
  let turnQueue = Promise.resolve();
  ```
- Define perspective helpers used everywhere in `ui.js` (replacing hardcoded `HUMAN` / `AI_PLAYER` for DOM zones, stacks, colors, history, secret slots, and result panels, while `AI_PLAYER = 2` remains used exclusively for `AI.*` calls in `gameMode === 'ai'`):
  ```js
  const oppSeat = () => Game.other(localSeat);
  const oppName = () => (gameMode === 'online' ? 'Opponent' : 'Computer');
  const oppFavorTag = () => (gameMode === 'online' ? '▲ Opp' : '▲ AI');
  ```
  - `handEl(player, index)`: `(player === localSeat ? els.handList : els.opponentHandList).querySelector(...)`
  - `stackTargetRects`: `const top = player === localSeat ? r.top + off : r.bottom - h - off;`
  - `buildGiftStack(player, cardId)`: adds `stack-bottom` when `player === localSeat` else `stack-top`; sets `c.style.top` when `player === localSeat` else `c.style.bottom`.
  - `buildBoard()`: `topStack = buildGiftStack(oppSeat(), row.id)`, `bottomStack = buildGiftStack(localSeat, row.id)`; favor marker uses `displayedOwner === localSeat ? 'favor-p1' : 'favor-p2'` and `displayedOwner === localSeat ? '▼ You' : oppFavorTag()`.
  - `updateTopBar()`:
    - `#opponent-secret` `data-tip`: `gameMode === 'online' ? "Opponent's secret" : "Computer's secret"`.
    - `#opponent-actions` `aria-label`: `${oppName()} actions remaining`.
    - `#difficulty-badge`: `gameMode === 'online' ? `Online · ${onlineRoomCode || ''}` : `${DIFF_LABELS[aiDifficulty]} AI``.
    - `#turn-badge`: in `gameMode === 'online'` (when `!Game.state.gameOver`), `Turn ${t} / 8 · ${Game.state.currentPlayer === localSeat ? 'Your Turn' : "Opponent's Turn"}`; in `ai` mode, `Turn ${t} / 8`.
    - Active glow: `els.playerZone` active when `currentPlayer === localSeat`, `els.opponentZone` active when `currentPlayer === oppSeat()`.
  - `renderOfferTray()`:
    - `--offer-color`: `pendingOffer.offerer === localSeat ? 'var(--player-color)' : 'var(--ai-color)'`.
    - Chosen outline class: `chosen-${receiver === localSeat ? 1 : 2}` (so blue always means local player, red always means opponent).
    - When `gameMode === 'online' && !pendingOffer.interactive && pendingOffer.revealed && pendingOffer.chosen === null`, `.tray-head` renders `<span>Opponent choosing…</span>` plus the `.tray-peek-btn` **View Board** button (`canPeekBoard()` returns `true` for this waiting state as well).
  - `buildHistoryItem(e, isNew)`:
    - `const isMe = e.player === localSeat;`
    - `who = isMe ? 'You' : oppName()`; `li` uses `isMe ? 'by-player' : 'by-ai'`.
    - Mini card outline class maps `c.to === localSeat ? 'to-1' : c.to === oppSeat() ? 'to-2' : 'to-' + c.to`.
  - `animateDraw(player, prevHand, token)`:
    - `frontSrc: player === localSeat ? cardFront(now[index]) : null`
    - `endFaceUp: player === localSeat`
  - `animateReveal(token)`:
    - Iterates `[localSeat, oppSeat()]`, checks `if (!card) return null;`, and reveals `oppSecret` in `history` for `h.player === oppSeat()`.
  - `buildResultPanel()`:
    - Left column (`You`) displays `localSeat === 1 ? result.player1 : result.player2`; right column (`oppName()`) displays `localSeat === 1 ? result.player2 : result.player1`.
    - Winner text: `result.winner === localSeat ? '🏆 You won!' : (gameMode === 'online' ? '⚔️ Opponent won!' : '🤖 Computer won!')`.
    - Tie starter note: `nextStarter === localSeat ? 'You go' : `${oppName()} goes``.
    - In `gameMode === 'online'`:
      - If `isTie`: primary button is `Start Round ${result.round + 1}` (when clicked, sets `localReadyNext = true`, sends `{ type: 'ready_next', kind: 'next_round' }`, updates button label to `Waiting for opponent…`, and once both `localReadyNext && remoteReadyNext` on Host, Host calls `beginOnlineNextRound()`). Also includes `Leave Room` secondary button.
      - If `!isTie`: primary button is `Rematch` (same mutual-ready handshake using `kind: 'rematch'`; once both ready, Host starts a fresh Game 1 with `startingPlayerPref` and broadcasts `round_start`), alongside `View Board` and `Leave Room` (`handleLeaveOnline()`).

#### 6.2 Online Turn Protocol & Concurrency Queue
- **Signal Helpers (`waitForNetSignal(type)` / `resolveNetSignal(type, msg)` / `rejectAllNetSignals()`):**
  - `waitForNetSignal(type)` returns a `Promise` registered **before** calling `netSession.send(...)` so fast/0ms responses are never missed; `rejectAllNetSignals()` rejects all pending waiters on disconnect/reset.
- **Turn Serialization (`enqueueNetTurn(fn)`):**
  - Chains turn-initiating events (`round_start`, `remote_secret`, `remote_tradeoff`, `offer_made`, `action_intent`, `offer_intent`) onto `turnQueue = turnQueue.then(fn, fn)` so a fast (`prefers-reduced-motion`) peer can never overlap animations on a normal-motion peer.
  - Resolution signals (`turn_commit`, `offer_response`, `offer_choice`) bypass `turnQueue` and immediately resolve the active `waitForNetSignal` promise.
- **Local Turn Execution (`confirmSelection()`):**
  - Branches cleanly: `if (gameMode === 'online') await playOnlineLocalTurn(type, [...selected]); else await playHumanTurn(type, [...selected]);`.
  - **Host (`localSeat === 1`):**
    - `secret`: sends `{ type: 'remote_secret', selected: [idx] }`, flies card to `#player-secret`, calls `Game.performSecret(1, idx)`, sends `{ type: 'turn_commit', view: Game.buildPlayerView(2) }`, pushes history, runs `afterCommit`.
    - `tradeoff`: sends `{ type: 'remote_tradeoff', selected: sel }`, flies cards to `#discard-pile`, calls `Game.performTradeoff(1, sel)`, sends `{ type: 'turn_commit', view: Game.buildPlayerView(2) }`, pushes history, runs `afterCommit`.
    - `gift` / `competition`: arms `waitForNetSignal('offer_response')`, sends `{ type: 'offer_made', kind: type, selected: sel, cards }`, flies cards to `#offer-tray`, awaits `{ choice }`, validates `choice`, highlights & runs `distributeOffer`, calls `Game.performGift(1, sel, choice)` / `Game.performCompetition(1, sel, choice + 1)`, sends `{ type: 'turn_commit', view: Game.buildPlayerView(2) }`, pushes history, runs `afterCommit`.
  - **Guest (`localSeat === 2`):**
    - `secret` / `tradeoff`: arms `waitForNetSignal('turn_commit')`, sends `{ type: 'action_intent', action: type, selected: sel }`, flies local card(s), awaits `{ view }`, captures `prevNext = Game.getHand(1)`, calls `Game.applyPlayerView(view)`, pushes history, runs `afterCommit`.
    - `gift` / `competition`: arms `waitForNetSignal('offer_choice')` and `waitForNetSignal('turn_commit')`, sends `{ type: 'offer_intent', kind: type, selected: sel }`, flies local cards to `#offer-tray`, awaits `{ choice }`, highlights & runs `distributeOffer`, awaits `{ view }`, captures `prevNext = Game.getHand(1)`, calls `Game.applyPlayerView(view)`, pushes history, runs `afterCommit`.
- **URL Invite Auto-Join (`startApp()`):**
  - Checks `new URLSearchParams(window.location.search).get('room')`. If valid, sets `setupMode = 'online'`, `onlineTab = 'join'`, populates `#join-code-input`, calls `updateSetupSelectionUI()`, and strips `?room=` via `window.history.replaceState({}, '', window.location.pathname)`.

---

## Edge Cases
1. **Strict Hidden-Information Isolation (Anti-Cheat):** Guest never receives `state.deck`, Host's hand card IDs, Host's discarded `tradeoff` card IDs, or Host's `secretCard[1]` before `gameOver`. Host authoritatively validates all Guest `selected` indices and `choice` bounds against `Game.state` before mutating state.
2. **Perspective Symmetry on Guest (`localSeat === 2`):** Generalizing `localSeat`/`oppSeat()` and `.stack-bottom`/`.stack-top` ensures Guest sees their own hand, secret peek, blue `--player-color` accents, `▼ You` favor badges, and bottom gift stacks identically to Host, with zero inverted stack-count badges or swapped result columns.
3. **`prefers-reduced-motion` Mismatch Between Browsers:** Separating out-of-band signal resolution (`turn_commit`, `offer_response`, `offer_choice`) from the FIFO `turnQueue` prevents overlapping card flights if one player has reduced motion (10ms animations) and acts again while the other player's 550ms draw animation is still finishing, without ever deadlocking.
4. **Fast Offer Clicks While Cards Are Still Flying to Tray:** Arming `waitForNetSignal` *before* `netSession.send(...)` guarantees that if the remote player picks a Gift/Competition option before local cards finish landing in `#offer-tray`, the choice is buffered in memory and applied seamlessly right after reveal.
5. **Stack Offset Accuracy Before `applyPlayerView`:** Both Host and Guest run `distributeOffer(assign)` *before* `Game.performGift`/`Game.performCompetition` or `Game.applyPlayerView(view)` increments `state.geishagifts`, ensuring cards land at the exact top of existing stacks without off-by-one `STACK_OFFSET` jumps.
6. **Offline Single-Player Resilience:** Lazy-loading PeerJS only when `hostRoom()` or `joinRoom()` is called ensures Single Player vs AI boots and plays 100% offline with zero startup CDN requests, and displays a friendly inline status error if Online Mode is used while offline.
7. **Mid-Turn Disconnects, Room Collisions & 3rd-Player Intrusions:** `createNetSession` retries room code generation on `unavailable-id`, rejects any 3rd connection with `room_full` without disrupting an active match, runs a 15s ping/pong keepalive, and cleanly aborts pending animations/offers into `#disconnect-modal` if the remote peer drops or leaves.

---

## Execution Checklist
- [x] Step 1: Create `docs/src/net-config.js` and `docs/src/net.js` implementing room code utilities, lazy CDN PeerJS loading (`PeerClass` injectable), host/join session management, `room_full` protection, and ping/pong keepalive.
- [x] Step 2: Update `docs/src/game.js` to export `buildPlayerView(viewerSeat)` and `applyPlayerView(view)` while preserving all existing exports and default behaviors.
- [x] Step 3: Update `docs/index.html` to default `#starter-random-button` as selected, rename AI difficulties to `Easy`/`Medium`/`Hard`, add Single Player vs Online 2P setup UI (Host lobby + Join input), and add `#disconnect-modal`.
- [x] Step 4: Update `docs/src/styles.css` to replace `data-stack` prefix selectors with `.stack-bottom`/`.stack-top` and style the Online 2P setup tabs, room code display/input (`user-select: text`), and compact `.mode-selection-card` layout.
- [x] Step 5: Update `docs/src/ui.js` to set `startingPlayerPref = 'random'`, rename `DIFF_LABELS` to `Easy`/`Medium`/`Hard`, generalize `localSeat`/`oppSeat()` rendering & animations, and implement Online 2P lobby, `?room=` invite handling, serialized turn protocol, tie/rematch ready handshake, and disconnect modal handling.
- [x] Step 6: Create `tests/net.test.js` and update `tests/ui.test.js` to test mock P2P sessions, hidden-information masking, full 8-turn + tie-round sync, default `Random` starter, `Easy`/`Medium`/`Hard` labels, and Online 2P UI contracts.
- [x] Step 7: Update `AGENTS.md` and `README.md` to reflect `Easy`/`Medium`/`Hard` AI names, default Coin Toss starter, Online Two-Player Mode usage, and optional TURN server setup.
- [x] Step 8: Run `node --check docs/src/game.js docs/src/ai.js docs/src/ui.js docs/src/fx.js docs/src/net.js docs/src/net-config.js` and `npm test` to verify zero syntax errors and 100% passing tests.
