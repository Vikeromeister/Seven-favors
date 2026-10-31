import * as Game from './game.js';
import * as AI from './ai.js';
import * as Fx from './fx.js';
import * as Net from './net.js';

const HUMAN = 1;
const AI_PLAYER = 2;
const STAGE_W = 1760;
const STAGE_H = 900;
const STACK_OFFSET = 8; // === CSS --stack-off
const ACTIONS = ['secret', 'tradeoff', 'gift', 'competition'];
const ACTION_COUNTS = { secret: 1, tradeoff: 2, gift: 3, competition: 4 };
const ACTION_NAMES = { secret: 'Secret', tradeoff: 'Tradeoff', gift: 'Gift', competition: 'Competition' };
const DIFF_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

const ASSET_BASE = 'assets/';

const CARD_IMAGE_FILES = {
  1: 'gift_burger_2pts.png',
  2: 'gift_chips_2pts.png',
  3: 'gift_spinner_2pts.png',
  4: 'gift_cardigan_3pts.png',
  5: 'gift_sunglasses_3pts.png',
  6: 'gift_ticket_4pts.png',
  7: 'gift_phone_5pts.png'
};

const GEISHA_IMAGE_FILES = {
  1: 'woman_burger_2pts.png',
  2: 'woman_chips_2pts.png',
  3: 'woman_spinner_2pts.png',
  4: 'woman_cardigan_3pts.png',
  5: 'woman_sunglasses_3pts.png',
  6: 'woman_ticket_4pts.png',
  7: 'woman_phone_5pts.png'
};

const CARD_ICONS = {
  1: '🍔',
  2: '🍟',
  3: '🪀',
  4: '🧥',
  5: '🕶️',
  6: '🎟️',
  7: '📱'
};

const CARD_BACK = `${ASSET_BASE}background_card.png`;
const cardFront = (id) => `${ASSET_BASE}${CARD_IMAGE_FILES[id]}`;
const geishaFront = (id) => `${ASSET_BASE}${GEISHA_IMAGE_FILES[id]}`;

const els = {
  stage: document.getElementById('stage'),
  historyList: document.getElementById('history-list'),
  roundBadge: document.getElementById('round-badge'),
  turnBadge: document.getElementById('turn-badge'),
  difficultyBadge: document.getElementById('difficulty-badge'),
  restartButton: document.getElementById('restart-button'),
  opponentZone: document.getElementById('opponent-zone'),
  opponentSecret: document.getElementById('opponent-secret'),
  opponentHandList: document.getElementById('opponent-hand-list'),
  opponentActions: document.getElementById('opponent-actions'),
  boardRow: document.getElementById('board-row'),
  boardContainer: document.getElementById('board-container'),
  deckPile: document.getElementById('deck-pile'),
  discardPile: document.getElementById('discard-pile'),
  offerTray: document.getElementById('offer-tray'),
  playerZone: document.getElementById('player-zone'),
  playerSecret: document.getElementById('player-secret'),
  handList: document.getElementById('hand-list'),
  actionBar: document.getElementById('action-bar'),
  confirmButton: document.getElementById('confirm-button'),
  resultPanel: document.getElementById('result-panel'),
  peekRestoreButton: document.getElementById('peek-restore-button'),
  modeSelectionScreen: document.getElementById('mode-selection-screen'),
  gameModeButtons: document.getElementById('game-mode-buttons'),
  modeAiButton: document.getElementById('mode-ai-button'),
  modeOnlineButton: document.getElementById('mode-online-button'),
  aiSetupSection: document.getElementById('ai-setup-section'),
  difficultyButtons: document.getElementById('difficulty-buttons'),
  aiEasyButton: document.getElementById('ai-easy-button'),
  aiMediumButton: document.getElementById('ai-medium-button'),
  aiHardButton: document.getElementById('ai-hard-button'),
  starterSetupSection: document.getElementById('starter-setup-section'),
  starterButtons: document.getElementById('starter-buttons'),
  starterHumanButton: document.getElementById('starter-human-button'),
  starterAiButton: document.getElementById('starter-ai-button'),
  starterRandomButton: document.getElementById('starter-random-button'),
  starterP1Title: document.getElementById('starter-p1-title'),
  starterP1Sub: document.getElementById('starter-p1-sub'),
  starterP2Title: document.getElementById('starter-p2-title'),
  starterP2Sub: document.getElementById('starter-p2-sub'),
  startGameButton: document.getElementById('start-game-button'),
  onlineSetupSection: document.getElementById('online-setup-section'),
  onlineRoleTabs: document.getElementById('online-role-tabs'),
  onlineTabHost: document.getElementById('online-tab-host'),
  onlineTabJoin: document.getElementById('online-tab-join'),
  onlineHostPanel: document.getElementById('online-host-panel'),
  createRoomButton: document.getElementById('create-room-button'),
  hostLobbyBox: document.getElementById('host-lobby-box'),
  lobbyRoomCode: document.getElementById('lobby-room-code'),
  copyCodeButton: document.getElementById('copy-code-button'),
  copyLinkButton: document.getElementById('copy-link-button'),
  hostLobbyStatus: document.getElementById('host-lobby-status'),
  cancelRoomButton: document.getElementById('cancel-room-button'),
  onlineJoinPanel: document.getElementById('online-join-panel'),
  joinCodeInput: document.getElementById('join-code-input'),
  joinStatusMsg: document.getElementById('join-status-msg'),
  joinRoomButton: document.getElementById('join-room-button'),
  cancelJoinButton: document.getElementById('cancel-join-button'),
  confirmModal: document.getElementById('confirm-modal'),
  confirmCancelButton: document.getElementById('confirm-cancel-button'),
  confirmAcceptButton: document.getElementById('confirm-accept-button'),
  disconnectModal: document.getElementById('disconnect-modal'),
  disconnectModalDesc: document.getElementById('disconnect-modal-desc'),
  disconnectOkButton: document.getElementById('disconnect-ok-button')
};

const PEEK_HOLD_MS = 220;

let aiDifficulty = 'medium';
let startingPlayerPref = 'random'; // 1 | 2 | 'random'
let pendingAction = null;   // { type, selected: number[], max }
let pendingOffer = null;    // { kind:'gift'|'competition', offerer:1|2, cards:number[], revealed:boolean,
                            //   interactive:boolean, chosen:number|null, hidden:Set<number>, resolve:Function|null }
let history = [];           // newest first: { id, player, action, cards:[{ card:number|null, to:1|2|'discard'|'secret' }] }
let historySeq = 0;
let animating = false;      // true while flights run or the AI is acting; blocks player input
let hiddenDraw = null;      // { player, index }: hand card hidden while the draw flight runs
let revealDone = false;     // game over: false until the secret-reveal animation finishes
let resultReady = false;    // result panel is visible
let gameToken = 0;          // bumped on new game; async sequences abort when it changes
let currentScale = 1;
let gameStarted = false;    // true from startNewGame() until a winner's result panel is shown or game is ended
let peekState = 'closed';   // 'closed' | 'holding' | 'latched'
let peekDownAt = 0;
let peekPointerId = null;
let suppressTriggerClickUntil = 0; // blocks synthetic click after pointerup on .peek-trigger-btn

// Online 2P State
let setupMode = 'ai';       // 'ai' | 'online'
let onlineTab = 'host';     // 'host' | 'join'
let onlineBusy = false;     // true while creating/joining a room
let gameMode = 'ai';        // 'ai' | 'online'
let localSeat = 1;          // 1 (Host or AI human) | 2 (Guest)
let netSession = null;
let onlineRoomCode = null;
let localReadyNext = false;
let remoteReadyNext = false;
let pendingSignals = new Map(); // type -> resolve[]
let turnQueue = Promise.resolve();

const oppSeat = () => Game.other(localSeat);
const oppName = () => (gameMode === 'online' ? 'Opponent' : 'Computer');
const oppFavorTag = () => (gameMode === 'online' ? '▲ Opp' : '▲ AI');

/* --- Modal Helpers --- */

function isConfirmModalOpen() {
  return !els.confirmModal.classList.contains('hidden');
}

function openConfirmModal() {
  stopPeek(false);
  els.confirmModal.classList.remove('hidden');
  els.confirmCancelButton.focus();
}

function closeConfirmModal() {
  els.confirmModal.classList.add('hidden');
}

function isDisconnectModalOpen() {
  return !els.disconnectModal.classList.contains('hidden');
}

function openDisconnectModal(msg = 'Your opponent left the match or lost connection.') {
  stopPeek(false);
  els.disconnectModalDesc.textContent = msg;
  els.disconnectModal.classList.remove('hidden');
  els.disconnectOkButton.focus();
}

function closeDisconnectModal() {
  els.disconnectModal.classList.add('hidden');
}

function canPeekBoard() {
  return Boolean(
    (pendingOffer && (pendingOffer.interactive || (gameMode === 'online' && pendingOffer.revealed && pendingOffer.chosen === null))) ||
    (Game.state.gameOver && resultReady)
  );
}

function activePeekTrigger() {
  if (Game.state.gameOver && resultReady) {
    return els.resultPanel.querySelector('.peek-trigger-btn');
  }
  if (pendingOffer && (pendingOffer.interactive || (gameMode === 'online' && pendingOffer.revealed && pendingOffer.chosen === null))) {
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

  if (e.type === 'pointercancel' || !canPeekBoard() || isConfirmModalOpen() || isDisconnectModalOpen()) {
    stopPeek(false);
    return;
  }

  if (heldMs >= PEEK_HOLD_MS) {
    stopPeek(false);
  } else {
    latchPeek();
  }
}

function updateSetupSelectionUI() {
  const isOnline = setupMode === 'online';

  els.gameModeButtons.querySelectorAll('[data-mode]').forEach((btn) => {
    const active = btn.dataset.mode === setupMode;
    btn.classList.toggle('selected', active);
    btn.setAttribute('aria-pressed', String(active));
  });

  els.aiSetupSection.classList.toggle('hidden', isOnline);
  els.startGameButton.classList.toggle('hidden', isOnline);
  els.onlineSetupSection.classList.toggle('hidden', !isOnline);

  if (!isOnline) {
    els.starterSetupSection.classList.remove('hidden');
    els.starterP1Title.textContent = 'You';
    els.starterP1Sub.textContent = 'You go first';
    els.starterP2Title.textContent = 'Computer';
    els.starterP2Sub.textContent = 'AI goes first';

    els.difficultyButtons.querySelectorAll('[data-diff]').forEach((btn) => {
      const active = btn.dataset.diff === aiDifficulty;
      btn.classList.toggle('selected', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  } else {
    els.onlineRoleTabs.querySelectorAll('[data-online-tab]').forEach((btn) => {
      const active = btn.dataset.onlineTab === onlineTab;
      btn.classList.toggle('selected', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    const isHost = onlineTab === 'host';
    els.onlineHostPanel.classList.toggle('hidden', !isHost);
    els.onlineJoinPanel.classList.toggle('hidden', isHost);
    els.starterSetupSection.classList.toggle('hidden', !isHost);

    if (isHost) {
      els.starterP1Title.textContent = 'You';
      els.starterP1Sub.textContent = 'Host goes first';
      els.starterP2Title.textContent = 'Opponent';
      els.starterP2Sub.textContent = 'Guest goes first';
    }
  }

  els.starterButtons.querySelectorAll('[data-starter]').forEach((btn) => {
    const val = btn.dataset.starter === 'random' ? 'random' : Number(btn.dataset.starter);
    const active = val === startingPlayerPref;
    btn.classList.toggle('selected', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

/* --- Helpers --- */

function cssNum(name) {
  return parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
}

function iconSvg(name, cls = 'icon') {
  return `<svg class="${cls}" aria-hidden="true"><use href="#icon-${name}"/></svg>`;
}

function makeCard(cardId, h, extraClass = '') {
  const d = document.createElement('div');
  d.className = `card ${cardId == null || cardId === 0 ? 'back' : ''} ${extraClass}`.trim().replace(/\s+/g, ' ');
  if (cardId != null && cardId !== 0) {
    d.style.backgroundImage = `url('${cardFront(cardId)}')`;
  }
  d.style.setProperty('--h', h);
  return d;
}

function makeEmptySlot(h) {
  const d = document.createElement('div');
  d.className = 'card-slot-empty';
  d.style.setProperty('--h', h);
  return d;
}

function handEl(player, index) {
  return (player === localSeat ? els.handList : els.opponentHandList).querySelector(`[data-index="${index}"]`);
}

function findInsertedIndex(prev, now) {
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== now[i]) return i;
  }
  return now.length - 1;
}

function displayedStackCount(player, card) {
  const hideSecret = Game.state.gameOver && !revealDone && Game.state.secretCard[player] === card;
  return Game.state.geishagifts[player][card] - (hideSecret ? 1 : 0);
}

function stackTargetRects(assignments) {
  const s = currentScale;
  const h = cssNum('--h-gift') * s;
  const w = h * cssNum('--card-ar');
  const seen = {};
  return assignments.map(({ player, card }) => {
    const key = `${player}-${card}`;
    seen[key] = (seen[key] ?? -1) + 1;
    const r = els.boardContainer.querySelector(`[data-stack="${key}"]`).getBoundingClientRect();
    const off = STACK_OFFSET * s * (displayedStackCount(player, card) + seen[key]);
    const left = r.left + (r.width - w) / 2;
    const top = player === localSeat ? r.top + off : r.bottom - h - off;
    return new DOMRect(left, top, w, h);
  });
}

function fitStage() {
  currentScale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  els.stage.style.setProperty('--stage-scale', String(currentScale));
}

/* --- Render --- */

function updateTopBar() {
  els.roundBadge.textContent = `Round ${Game.state.round}`;
  if (gameMode === 'online' && !Game.state.gameOver) {
    const turnNum = Math.min(Game.state.turnsTaken + 1, 8);
    const turnOwner = Game.state.currentPlayer === localSeat ? 'Your Turn' : "Opponent's Turn";
    els.turnBadge.textContent = `Turn ${turnNum} / 8 · ${turnOwner}`;
  } else {
    els.turnBadge.textContent = `Turn ${Math.min(Game.state.turnsTaken + 1, 8)} / 8`;
  }

  if (gameMode === 'online') {
    els.difficultyBadge.textContent = `Online · ${onlineRoomCode || ''}`;
  } else {
    els.difficultyBadge.textContent = `${DIFF_LABELS[aiDifficulty]} AI`;
  }

  els.opponentSecret.dataset.tip = gameMode === 'online' ? "Opponent's secret" : "Computer's secret";
  els.opponentActions.setAttribute('aria-label', `${oppName()} actions remaining`);

  els.playerZone.classList.toggle('active', !Game.state.gameOver && Game.state.currentPlayer === localSeat);
  els.opponentZone.classList.toggle('active', !Game.state.gameOver && Game.state.currentPlayer === oppSeat());
}

function buildOpponentZone() {
  const opp = oppSeat();
  const oppSecret = Game.state.secretCard[opp];
  const showSecret = oppSecret !== null && oppSecret !== 0 && !(Game.state.gameOver && revealDone);
  els.opponentSecret.replaceChildren(
    showSecret ? makeCard(null, 'var(--h-opp)') : makeEmptySlot('var(--h-opp)')
  );

  const oppHand = Game.getHand(opp);
  const handNodes = oppHand.map((_, i) => {
    const c = makeCard(null, 'var(--h-opp)');
    c.dataset.index = String(i);
    if (hiddenDraw && hiddenDraw.player === opp && hiddenDraw.index === i) {
      c.style.visibility = 'hidden';
    }
    return c;
  });
  els.opponentHandList.replaceChildren(...handNodes);

  const actionNodes = ACTIONS.map((a) => {
    const span = document.createElement('span');
    if (Game.state.players[opp].actions[a] === false) {
      span.className = 'used';
    }
    span.innerHTML = iconSvg(a);
    return span;
  });
  els.opponentActions.replaceChildren(...actionNodes);
}

function buildGiftStack(player, cardId) {
  const stack = document.createElement('div');
  const isBottom = player === localSeat;
  stack.className = `gift-stack ${isBottom ? 'stack-bottom' : 'stack-top'}`;
  stack.dataset.stack = `${player}-${cardId}`;

  const n = displayedStackCount(player, cardId);
  for (let i = 0; i < n; i++) {
    const c = makeCard(cardId, 'var(--h-gift)');
    if (isBottom) {
      c.style.top = `${i * STACK_OFFSET}px`;
    } else {
      c.style.bottom = `${i * STACK_OFFSET}px`;
    }
    c.style.zIndex = String(i + 1);
    stack.appendChild(c);
  }

  if (n >= 2) {
    const count = document.createElement('div');
    count.className = 'stack-count';
    count.textContent = `×${n}`;
    stack.appendChild(count);
  }

  return stack;
}

function buildBoard() {
  const rows = Game.getGeishaRows();
  const grid = document.createElement('div');
  grid.className = 'geisha-grid';

  rows.forEach((row) => {
    const col = document.createElement('div');
    col.className = 'geisha-column';

    const topStack = buildGiftStack(oppSeat(), row.id);

    const geisha = document.createElement('div');
    geisha.className = 'geisha-card';
    geisha.style.backgroundImage = `url('${geishaFront(row.id)}')`;

    const displayedOwner = Game.state.gameOver && !revealDone ? row.priorOwner : row.owner;
    if (displayedOwner !== 0) {
      const marker = document.createElement('div');
      const isMine = displayedOwner === localSeat;
      marker.className = `favor-marker ${isMine ? 'favor-p1' : 'favor-p2'}`;
      marker.textContent = isMine ? '▼ You' : oppFavorTag();
      geisha.appendChild(marker);
    }

    const bottomStack = buildGiftStack(localSeat, row.id);

    col.append(topStack, geisha, bottomStack);
    grid.appendChild(col);
  });

  els.boardContainer.replaceChildren(grid);
}

function buildPiles() {
  els.deckPile.replaceChildren(
    Game.state.deck.length > 0 ? makeCard(null, 'var(--h-pile)') : makeEmptySlot('var(--h-pile)')
  );

  const discardCount = history.filter((h) => h.action === 'tradeoff').length * 2;
  if (discardCount === 0) {
    els.discardPile.replaceChildren(makeEmptySlot('var(--h-pile)'));
  } else {
    const layers = Math.min(discardCount, 4);
    const backs = [];
    for (let i = 0; i < layers; i++) {
      const c = makeCard(null, 'var(--h-pile)');
      c.style.transform = `translate(${i * 2}px, ${i * 2}px)`;
      backs.push(c);
    }
    els.discardPile.replaceChildren(...backs);
  }
}

function buildPlayerZone() {
  const secret = Game.state.secretCard[localSeat];
  if (secret !== null && secret !== 0 && !(Game.state.gameOver && revealDone)) {
    els.playerSecret.replaceChildren(
      makeCard(null, 'var(--h-hand)'),
      makeCard(secret, 'var(--h-hand)', 'peek')
    );
  } else {
    els.playerSecret.replaceChildren(makeEmptySlot('var(--h-hand)'));
  }

  const hand = Game.getHand(localSeat);
  const selectable = !animating && !pendingOffer && !Game.state.gameOver && Game.state.currentPlayer === localSeat && Boolean(pendingAction);

  const buttons = hand.map((card, index) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'card-button';
    btn.dataset.index = String(index);
    btn.style.backgroundImage = `url('${cardFront(card)}')`;
    btn.setAttribute('aria-label', `${Game.cardName(card)} (${Game.cardValue(card)} pts)`);
    btn.disabled = !selectable;

    if (selectable) {
      btn.classList.add('selectable');
    }

    const selIdx = pendingAction ? pendingAction.selected.indexOf(index) : -1;
    if (selIdx !== -1) {
      btn.classList.add('selected');
      if (pendingAction.type === 'competition') {
        const badge = document.createElement('span');
        badge.className = `pair-badge ${selIdx < 2 ? 'pair-1' : 'pair-2'}`;
        badge.textContent = selIdx < 2 ? '1' : '2';
        btn.appendChild(badge);
      }
    }

    if (hiddenDraw && hiddenDraw.player === localSeat && hiddenDraw.index === index) {
      btn.style.visibility = 'hidden';
    }

    return btn;
  });

  els.handList.replaceChildren(...buttons);
}

function updateActionBar() {
  const canAct = !animating && !pendingOffer && !Game.state.gameOver && Game.state.currentPlayer === localSeat;

  els.actionBar.querySelectorAll('.action-btn').forEach((btn) => {
    if (!btn.dataset.baseTip) {
      btn.dataset.baseTip = btn.dataset.tip || '';
    }
    const pips = btn.querySelector('.pips');
    if (pips && pips.childElementCount === 0) {
      const count = Number(pips.dataset.n || 0);
      for (let i = 0; i < count; i++) {
        pips.appendChild(document.createElement('i'));
      }
    }

    const a = btn.dataset.action;
    const used = Game.state.players[localSeat].actions[a] === false;
    btn.classList.toggle('used', used);
    btn.classList.toggle('armed', pendingAction?.type === a);
    btn.setAttribute('aria-disabled', String(used || !canAct));
    btn.dataset.tip = used ? `${btn.dataset.baseTip} (already used)` : btn.dataset.baseTip;
  });

  const canConfirm = Boolean(canAct && pendingAction && pendingAction.selected.length === pendingAction.max);
  els.confirmButton.setAttribute('aria-disabled', String(!canConfirm));
}

function renderOfferTray() {
  if (!pendingOffer) {
    els.offerTray.classList.add('hidden');
    els.offerTray.replaceChildren();
    els.boardRow.classList.remove('offer-active');
    return;
  }

  els.offerTray.classList.remove('hidden');
  els.boardRow.classList.add('offer-active');
  els.offerTray.style.setProperty(
    '--offer-color',
    pendingOffer.offerer === localSeat ? 'var(--player-color)' : 'var(--ai-color)'
  );

  const receiver = Game.other(pendingOffer.offerer);
  const nodes = [];

  const head = document.createElement('div');
  head.className = 'tray-head';
  head.innerHTML = iconSvg(pendingOffer.kind);
  if (pendingOffer.interactive || (gameMode === 'online' && pendingOffer.revealed && pendingOffer.chosen === null)) {
    const label = document.createElement('span');
    if (pendingOffer.interactive) {
      label.textContent = pendingOffer.kind === 'gift' ? 'Pick a card' : 'Pick a pair';
    } else {
      label.textContent = 'Opponent choosing…';
    }
    head.appendChild(label);

    const peekBtn = document.createElement('button');
    peekBtn.type = 'button';
    peekBtn.className = 'peek-trigger-btn tray-peek-btn';
    peekBtn.dataset.tip = 'Hold or click to view the board';
    peekBtn.setAttribute('aria-label', 'View board');
    peekBtn.innerHTML = `${iconSvg('eye')}<span>View Board</span>`;
    head.appendChild(peekBtn);
  }
  nodes.push(head);

  const buildSlotInner = (k) => (
    pendingOffer.revealed ? makeCard(pendingOffer.cards[k], 'var(--h-tray)') : makeEmptySlot('var(--h-tray)')
  );

  if (pendingOffer.kind === 'gift') {
    for (let k = 0; k < 3; k++) {
      const slot = document.createElement(pendingOffer.interactive ? 'button' : 'div');
      if (pendingOffer.interactive) {
        slot.type = 'button';
        const c = pendingOffer.cards[k];
        slot.setAttribute('aria-label', `${Game.cardName(c)} (${Game.cardValue(c)} pts)`);
      }
      slot.className = 'tray-slot';
      slot.dataset.slot = String(k);
      if (pendingOffer.chosen === k) {
        slot.classList.add(`chosen-${receiver === localSeat ? 1 : 2}`);
      }
      if (pendingOffer.hidden.has(k)) {
        slot.style.visibility = 'hidden';
      }
      slot.appendChild(buildSlotInner(k));
      nodes.push(slot);
    }
  } else {
    for (let p = 0; p < 2; p++) {
      const pair = document.createElement(pendingOffer.interactive ? 'button' : 'div');
      if (pendingOffer.interactive) {
        pair.type = 'button';
        pair.setAttribute('aria-label', `Pair ${p + 1}`);
      }
      pair.className = 'tray-pair';
      pair.dataset.pair = String(p);
      if (pendingOffer.chosen === p) {
        pair.classList.add(`chosen-${receiver === localSeat ? 1 : 2}`);
      }
      for (const k of [p * 2, p * 2 + 1]) {
        const slot = document.createElement('div');
        slot.className = 'tray-slot';
        slot.dataset.slot = String(k);
        if (pendingOffer.hidden.has(k)) {
          slot.style.visibility = 'hidden';
        }
        slot.appendChild(buildSlotInner(k));
        pair.appendChild(slot);
      }
      nodes.push(pair);
    }
  }

  els.offerTray.replaceChildren(...nodes);
}

function buildResultPanel() {
  if (!Game.state.gameOver || !resultReady) {
    els.resultPanel.classList.add('hidden');
    els.resultPanel.replaceChildren();
    return;
  }

  els.resultPanel.classList.remove('hidden');
  const result = Game.getResultSummary();
  const isTie = result.winner === 0;

  const myResult = localSeat === 1 ? result.player1 : result.player2;
  const oppResult = localSeat === 1 ? result.player2 : result.player1;

  const mySecretName = myResult.secretCard
    ? `${CARD_ICONS[myResult.secretCard]} ${Game.cardName(myResult.secretCard)} (${Game.cardValue(myResult.secretCard)} pts)`
    : 'None';
  const oppSecretName = oppResult.secretCard
    ? `${CARD_ICONS[oppResult.secretCard]} ${Game.cardName(oppResult.secretCard)} (${Game.cardValue(oppResult.secretCard)} pts)`
    : 'None';

  const headingText = isTie
    ? `Round ${result.round} Tied`
    : (result.round > 1 ? `Game Over · Round ${result.round}` : 'Game Over');

  let winnerText = '🤝 Tie round! Geisha favors carry over.';
  if (result.winner === localSeat) {
    winnerText = '🏆 You won!';
  } else if (result.winner === oppSeat()) {
    winnerText = gameMode === 'online' ? '⚔️ Opponent won!' : '🤖 Computer won!';
  }

  const nextStarter = Game.other(result.roundStarter);
  const nextStarterName = nextStarter === localSeat ? 'You go' : `${oppName()} goes`;
  const nextStarterNote = isTie
    ? `<p class="result-sub">${nextStarterName} first in Round ${result.round + 1}.</p>`
    : '';

  const card = document.createElement('div');
  card.className = 'result-card';
  card.innerHTML = `
    <h2>${headingText}</h2>
    <div class="result-winner">${winnerText}</div>
    ${nextStarterNote}
    <div class="result-stats">
      <div class="result-col">
        <h3>You</h3>
        <p><strong>Charm Points:</strong> ${myResult.score}</p>
        <p><strong>Geishas Held:</strong> ${myResult.geishaCount} / 7</p>
        <p><strong>Revealed Secret:</strong> ${mySecretName}</p>
      </div>
      <div class="result-col">
        <h3>${oppName()}</h3>
        <p><strong>Charm Points:</strong> ${oppResult.score}</p>
        <p><strong>Geishas Held:</strong> ${oppResult.geishaCount} / 7</p>
        <p><strong>Revealed Secret:</strong> ${oppSecretName}</p>
      </div>
    </div>
  `;

  const actionsRow = document.createElement('div');
  actionsRow.className = 'result-actions';

  const peekBtn = document.createElement('button');
  peekBtn.className = 'secondary restart-result-btn peek-trigger-btn result-peek-btn';
  peekBtn.type = 'button';
  peekBtn.dataset.tip = 'Hold or click to view the board';
  peekBtn.setAttribute('aria-label', 'View board');
  peekBtn.innerHTML = `${iconSvg('eye')}<span>View Board</span>`;

  actionsRow.appendChild(peekBtn);

  if (gameMode === 'online') {
    const actionBtn = document.createElement('button');
    actionBtn.className = 'primary restart-result-btn';
    actionBtn.type = 'button';
    actionBtn.textContent = isTie ? `Start Round ${result.round + 1}` : 'Rematch';

    actionBtn.addEventListener('click', () => {
      if (peekState !== 'closed') return;
      localReadyNext = true;
      actionBtn.textContent = 'Waiting for opponent…';
      actionBtn.disabled = true;
      netSession?.send({ type: 'ready_next', kind: isTie ? 'next_round' : 'rematch' });

      if (remoteReadyNext && localSeat === 1) {
        if (isTie) {
          Game.startNextRound();
          netSession.send({
            type: 'round_start',
            round: Game.state.round,
            starter: Game.state.roundStarter,
            view: Game.buildPlayerView(2)
          });
          beginOnlineNextRound();
        } else {
          Game.startGame(startingPlayerPref);
          netSession.send({
            type: 'round_start',
            round: Game.state.round,
            starter: Game.state.roundStarter,
            view: Game.buildPlayerView(2)
          });
          beginOnlineNextRound();
        }
      }
    });

    const leaveBtn = document.createElement('button');
    leaveBtn.className = 'secondary restart-result-btn';
    leaveBtn.type = 'button';
    leaveBtn.textContent = 'Leave Room';
    leaveBtn.addEventListener('click', () => {
      if (peekState !== 'closed') return;
      handleLeaveOnline();
    });

    actionsRow.append(actionBtn, leaveBtn);
  } else {
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
    actionsRow.appendChild(actionBtn);
  }

  card.appendChild(actionsRow);
  els.resultPanel.replaceChildren(card);
}

function buildHistoryItem(e, isNew) {
  const isMe = e.player === localSeat;
  const who = isMe ? 'You' : oppName();
  const li = document.createElement('li');
  li.className = `history-item ${isMe ? 'by-player' : 'by-ai'}${isNew ? ' enter' : ''}`;
  li.setAttribute('aria-label', `${who}: ${ACTION_NAMES[e.action]}`);
  li.innerHTML = iconSvg(e.action);

  const pop = document.createElement('div');
  pop.className = 'history-pop';

  const header = document.createElement('div');
  header.textContent = `${who} · ${ACTION_NAMES[e.action]}`;

  const row = document.createElement('div');
  row.className = 'history-pop-cards';
  e.cards.forEach((c) => {
    const toCls = c.to === localSeat ? 'to-1' : c.to === oppSeat() ? 'to-2' : `to-${c.to}`;
    row.appendChild(makeCard(c.card, '90px', `mini ${toCls}`));
  });

  pop.append(header, row);
  li.appendChild(pop);
  return li;
}

function renderHistory(animateNewest) {
  els.historyList.replaceChildren(...history.map((e, i) => buildHistoryItem(e, i === 0 && animateNewest)));
}

function pushHistory(entry) {
  history.unshift({ id: ++historySeq, ...entry });
  renderHistory(true);
}

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

/* --- Input --- */

function selectAction(type) {
  if (animating || pendingOffer || Game.state.gameOver || Game.state.currentPlayer !== localSeat) return;
  if (!Game.canUseAction(localSeat, type)) return;
  if (pendingAction?.type === type) {
    pendingAction = null;
    render();
    return;
  }
  const max = ACTION_COUNTS[type];
  pendingAction = {
    type,
    selected: pendingAction ? pendingAction.selected.slice(0, max) : [],
    max
  };
  render();
}

function handleCardClick(index) {
  if (animating || pendingOffer || !pendingAction || Game.state.gameOver || Game.state.currentPlayer !== localSeat) return;
  const existing = pendingAction.selected.indexOf(index);
  if (existing >= 0) {
    pendingAction.selected.splice(existing, 1);
  } else if (pendingAction.selected.length < pendingAction.max) {
    pendingAction.selected.push(index);
  }
  render();
}

async function confirmSelection() {
  if (animating || !pendingAction || pendingAction.selected.length !== pendingAction.max) return;
  const { type, selected } = pendingAction;
  pendingAction = null;
  animating = true;
  updateActionBar();
  try {
    if (gameMode === 'online') {
      await playOnlineLocalTurn(type, [...selected]);
    } else {
      await playHumanTurn(type, [...selected]);
    }
  } catch (err) {
    console.error(err);
    stopPeek(false);
    Fx.clearFx();
    pendingOffer = null;
    animating = false;
    render();
  }
}

function resolveOfferChoice(choice) {
  if (!pendingOffer?.interactive || !pendingOffer.resolve || peekState !== 'closed') return;
  stopPeek(false);
  const resolve = pendingOffer.resolve;
  pendingOffer.interactive = false;
  pendingOffer.resolve = null;
  resolve(choice);
}

function awaitHumanChoice() {
  return new Promise((resolve) => {
    pendingOffer.interactive = true;
    pendingOffer.resolve = resolve;
    renderOfferTray();
  });
}

/* --- Turn Sequences --- */

async function distributeOffer(assign) {
  const { cards } = pendingOffer;
  const receiverFor = (k) => (typeof assign === 'function' ? assign(k) : assign[k]);
  const froms = cards.map((_, k) => els.offerTray.querySelector(`[data-slot="${k}"]`).getBoundingClientRect());
  const targets = stackTargetRects(cards.map((card, k) => ({ player: receiverFor(k), card })));
  pendingOffer.hidden = new Set(cards.map((_, k) => k));
  renderOfferTray();
  els.boardRow.classList.remove('offer-active');
  await Promise.all(cards.map((card, k) => Fx.flyCard({
    from: froms[k],
    to: targets[k],
    frontSrc: cardFront(card),
    backSrc: CARD_BACK,
    startFaceUp: true,
    endFaceUp: true,
    delay: k * 90
  })));
}

async function playHumanTurn(type, selected) {
  const token = gameToken;
  const hand = Game.getHand(HUMAN);
  const prevNext = Game.getHand(AI_PLAYER);

  if (type === 'secret') {
    const idx = selected[0];
    const card = hand[idx];
    const src = handEl(HUMAN, idx);
    const from = Fx.rectOf(src);
    const to = Fx.rectOf(els.playerSecret.firstElementChild);
    src.style.visibility = 'hidden';

    await Fx.flyCard({
      from,
      to,
      frontSrc: cardFront(card),
      backSrc: CARD_BACK,
      startFaceUp: true,
      endFaceUp: false
    });
    if (token !== gameToken) return;

    Game.performSecret(HUMAN, idx);
    pushHistory({ player: HUMAN, action: 'secret', cards: [{ card, to: 'secret' }] });
    await afterCommit(prevNext, token);
    return;
  }

  if (type === 'tradeoff') {
    const sel = [...selected];
    const cards = sel.map((i) => hand[i]);
    const froms = sel.map((i) => Fx.rectOf(handEl(HUMAN, i)));
    const to = Fx.rectOf(els.discardPile);
    sel.forEach((i) => { handEl(HUMAN, i).style.visibility = 'hidden'; });

    await Promise.all(cards.map((card, k) => Fx.flyCard({
      from: froms[k],
      to,
      frontSrc: cardFront(card),
      backSrc: CARD_BACK,
      startFaceUp: true,
      endFaceUp: false,
      delay: k * 120
    })));
    if (token !== gameToken) return;

    Game.performTradeoff(HUMAN, sel);
    pushHistory({
      player: HUMAN,
      action: 'tradeoff',
      cards: cards.map((card) => ({ card, to: 'discard' }))
    });
    await afterCommit(prevNext, token);
    return;
  }

  if (type === 'gift') {
    const sel = [...selected].sort((a, b) => a - b);
    const cards = sel.map((i) => hand[i]);
    pendingOffer = {
      kind: 'gift',
      offerer: HUMAN,
      cards,
      revealed: false,
      interactive: false,
      chosen: null,
      hidden: new Set(),
      resolve: null
    };
    renderOfferTray();

    const froms = sel.map((i) => Fx.rectOf(handEl(HUMAN, i)));
    const tos = cards.map((_, k) => Fx.rectOf(els.offerTray.querySelector(`[data-slot="${k}"]`)));
    sel.forEach((i) => { handEl(HUMAN, i).style.visibility = 'hidden'; });

    const clones = await Promise.all(cards.map((card, k) => Fx.flyCard({
      from: froms[k],
      to: tos[k],
      frontSrc: cardFront(card),
      backSrc: CARD_BACK,
      startFaceUp: true,
      endFaceUp: true,
      delay: k * 90,
      keep: true
    })));
    if (token !== gameToken) return;

    pendingOffer.revealed = true;
    renderOfferTray();
    clones.forEach((c) => c.remove());

    await Fx.wait(700);
    if (token !== gameToken) return;

    const choice = AI.chooseAIGiftResponse(aiDifficulty, AI_PLAYER, Game.state, cards);
    pendingOffer.chosen = choice;
    renderOfferTray();

    await Fx.wait(450);
    if (token !== gameToken) return;

    const assign = cards.map((_, k) => (k === choice ? AI_PLAYER : HUMAN));
    await distributeOffer(assign);
    if (token !== gameToken) return;

    pendingOffer = null;
    Game.performGift(HUMAN, sel, choice);
    pushHistory({
      player: HUMAN,
      action: 'gift',
      cards: cards.map((card, k) => ({ card, to: assign[k] }))
    });
    await afterCommit(prevNext, token);
    return;
  }

  if (type === 'competition') {
    const sel = [...selected];
    const cards = sel.map((i) => hand[i]);
    pendingOffer = {
      kind: 'competition',
      offerer: HUMAN,
      cards,
      revealed: false,
      interactive: false,
      chosen: null,
      hidden: new Set(),
      resolve: null
    };
    renderOfferTray();

    const froms = sel.map((i) => Fx.rectOf(handEl(HUMAN, i)));
    const tos = cards.map((_, k) => Fx.rectOf(els.offerTray.querySelector(`[data-slot="${k}"]`)));
    sel.forEach((i) => { handEl(HUMAN, i).style.visibility = 'hidden'; });

    const clones = await Promise.all(cards.map((card, k) => Fx.flyCard({
      from: froms[k],
      to: tos[k],
      frontSrc: cardFront(card),
      backSrc: CARD_BACK,
      startFaceUp: true,
      endFaceUp: true,
      delay: k * 90,
      keep: true
    })));
    if (token !== gameToken) return;

    pendingOffer.revealed = true;
    renderOfferTray();
    clones.forEach((c) => c.remove());

    await Fx.wait(700);
    if (token !== gameToken) return;

    const aiChoice = AI.chooseAICompetitionResponse(
      aiDifficulty,
      AI_PLAYER,
      Game.state,
      [cards[0], cards[1]],
      [cards[2], cards[3]]
    );
    pendingOffer.chosen = aiChoice - 1;
    renderOfferTray();

    await Fx.wait(450);
    if (token !== gameToken) return;

    const assign = cards.map((_, k) => (Math.floor(k / 2) === aiChoice - 1 ? AI_PLAYER : HUMAN));
    await distributeOffer(assign);
    if (token !== gameToken) return;

    pendingOffer = null;
    Game.performCompetition(HUMAN, sel, aiChoice);
    pushHistory({
      player: HUMAN,
      action: 'competition',
      cards: cards.map((card, k) => ({ card, to: assign[k] }))
    });
    await afterCommit(prevNext, token);
  }
}

async function playAITurn(token) {
  if (token !== gameToken) return;
  const decision = AI.chooseAIAction(aiDifficulty, AI_PLAYER, Game.state);
  if (!decision) {
    animating = false;
    render();
    return;
  }

  const { action, selected } = decision;
  const aiHand = Game.getHand(AI_PLAYER);
  const prevNext = Game.getHand(HUMAN);

  if (action === 'secret') {
    const idx = selected[0];
    const src = handEl(AI_PLAYER, idx);
    const from = Fx.rectOf(src);
    const to = Fx.rectOf(els.opponentSecret.firstElementChild);
    src.style.visibility = 'hidden';

    await Fx.flyCard({
      from,
      to,
      frontSrc: null,
      backSrc: CARD_BACK,
      startFaceUp: false,
      endFaceUp: false
    });
    if (token !== gameToken) return;

    Game.performSecret(AI_PLAYER, idx);
    pushHistory({ player: AI_PLAYER, action: 'secret', cards: [{ card: null, to: 'secret' }] });
    await afterCommit(prevNext, token);
    return;
  }

  if (action === 'tradeoff') {
    const sel = [...selected];
    const froms = sel.map((i) => Fx.rectOf(handEl(AI_PLAYER, i)));
    const to = Fx.rectOf(els.discardPile);
    sel.forEach((i) => { handEl(AI_PLAYER, i).style.visibility = 'hidden'; });

    await Promise.all(sel.map((_, k) => Fx.flyCard({
      from: froms[k],
      to,
      frontSrc: null,
      backSrc: CARD_BACK,
      startFaceUp: false,
      endFaceUp: false,
      delay: k * 120
    })));
    if (token !== gameToken) return;

    Game.performTradeoff(AI_PLAYER, sel);
    pushHistory({
      player: AI_PLAYER,
      action: 'tradeoff',
      cards: sel.map(() => ({ card: null, to: 'discard' }))
    });
    await afterCommit(prevNext, token);
    return;
  }

  if (action === 'gift') {
    const sel = [...selected].sort((a, b) => a - b);
    const cards = sel.map((i) => aiHand[i]);
    pendingOffer = {
      kind: 'gift',
      offerer: AI_PLAYER,
      cards,
      revealed: false,
      interactive: false,
      chosen: null,
      hidden: new Set(),
      resolve: null
    };
    renderOfferTray();

    const froms = sel.map((i) => Fx.rectOf(handEl(AI_PLAYER, i)));
    const tos = cards.map((_, k) => Fx.rectOf(els.offerTray.querySelector(`[data-slot="${k}"]`)));
    sel.forEach((i) => { handEl(AI_PLAYER, i).style.visibility = 'hidden'; });

    const clones = await Promise.all(cards.map((card, k) => Fx.flyCard({
      from: froms[k],
      to: tos[k],
      frontSrc: cardFront(card),
      backSrc: CARD_BACK,
      startFaceUp: false,
      endFaceUp: true,
      delay: k * 90,
      keep: true
    })));
    if (token !== gameToken) return;

    pendingOffer.revealed = true;
    renderOfferTray();
    clones.forEach((c) => c.remove());

    const choice = await awaitHumanChoice();
    if (token !== gameToken) return;

    pendingOffer.chosen = choice;
    renderOfferTray();

    await Fx.wait(250);
    if (token !== gameToken) return;

    const assign = cards.map((_, k) => (k === choice ? HUMAN : AI_PLAYER));
    await distributeOffer(assign);
    if (token !== gameToken) return;

    pendingOffer = null;
    Game.performGift(AI_PLAYER, sel, choice);
    pushHistory({
      player: AI_PLAYER,
      action: 'gift',
      cards: cards.map((card, k) => ({ card, to: assign[k] }))
    });
    await afterCommit(prevNext, token);
    return;
  }

  if (action === 'competition') {
    const sel = [...selected];
    const cards = sel.map((i) => aiHand[i]);
    pendingOffer = {
      kind: 'competition',
      offerer: AI_PLAYER,
      cards,
      revealed: false,
      interactive: false,
      chosen: null,
      hidden: new Set(),
      resolve: null
    };
    renderOfferTray();

    const froms = sel.map((i) => Fx.rectOf(handEl(AI_PLAYER, i)));
    const tos = cards.map((_, k) => Fx.rectOf(els.offerTray.querySelector(`[data-slot="${k}"]`)));
    sel.forEach((i) => { handEl(AI_PLAYER, i).style.visibility = 'hidden'; });

    const clones = await Promise.all(cards.map((card, k) => Fx.flyCard({
      from: froms[k],
      to: tos[k],
      frontSrc: cardFront(card),
      backSrc: CARD_BACK,
      startFaceUp: false,
      endFaceUp: true,
      delay: k * 90,
      keep: true
    })));
    if (token !== gameToken) return;

    pendingOffer.revealed = true;
    renderOfferTray();
    clones.forEach((c) => c.remove());

    const pairIdx = await awaitHumanChoice();
    if (token !== gameToken) return;

    pendingOffer.chosen = pairIdx;
    renderOfferTray();

    await Fx.wait(250);
    if (token !== gameToken) return;

    const assign = cards.map((_, k) => (Math.floor(k / 2) === pairIdx ? HUMAN : AI_PLAYER));
    await distributeOffer(assign);
    if (token !== gameToken) return;

    pendingOffer = null;
    Game.performCompetition(AI_PLAYER, sel, pairIdx + 1);
    pushHistory({
      player: AI_PLAYER,
      action: 'competition',
      cards: cards.map((card, k) => ({ card, to: assign[k] }))
    });
    await afterCommit(prevNext, token);
  }
}

async function afterCommit(prevNext, token) {
  render();
  if (Game.state.gameOver) {
    await animateReveal(token);
    if (token !== gameToken) return;
    revealDone = true;
    render();
    await Fx.wait(700);
    if (token !== gameToken) return;
    resultReady = true;
    animating = false;
    if (Game.state.winner !== 0) {
      gameStarted = false;
    }
    render();
    return;
  }

  const next = Game.state.currentPlayer;
  await animateDraw(next, prevNext, token);
  if (token !== gameToken) return;

  if (gameMode === 'ai') {
    if (next === AI_PLAYER) {
      await Fx.wait(500);
      if (token !== gameToken) return;
      await playAITurn(token);
    } else {
      animating = false;
      render();
    }
  } else {
    animating = false;
    render();
  }
}

async function animateDraw(player, prevHand, token) {
  const now = Game.getHand(player);
  if (now.length <= prevHand.length) return;
  const index = findInsertedIndex(prevHand, now);
  hiddenDraw = { player, index };
  render();
  const deckRect = els.deckPile.getBoundingClientRect();
  await Fx.flyCard({
    from: deckRect,
    to: handEl(player, index).getBoundingClientRect(),
    frontSrc: player === localSeat ? cardFront(now[index]) : null,
    backSrc: CARD_BACK,
    startFaceUp: false,
    endFaceUp: player === localSeat,
    duration: 450
  });
  if (token !== gameToken) return;
  hiddenDraw = null;
  render();
}

async function animateReveal(token) {
  const flights = [localSeat, oppSeat()].map((p, n) => {
    const card = Game.state.secretCard[p];
    if (!card) return null;
    const slotEl = p === localSeat ? els.playerSecret : els.opponentSecret;
    const slotCard = slotEl.querySelector('.card');
    if (!slotCard) return null;
    const from = slotCard.getBoundingClientRect();
    const [to] = stackTargetRects([{ player: p, card }]);
    slotEl.replaceChildren(makeEmptySlot(p === localSeat ? 'var(--h-hand)' : 'var(--h-opp)'));
    return Fx.flyCard({
      from,
      to,
      frontSrc: cardFront(card),
      backSrc: CARD_BACK,
      startFaceUp: false,
      endFaceUp: true,
      duration: 850,
      delay: n * 300
    });
  }).filter(Boolean);

  await Promise.all(flights);
  if (token !== gameToken) return;

  const oppSecretHistory = history.find((h) => h.player === oppSeat() && h.action === 'secret');
  if (oppSecretHistory && Game.state.secretCard[oppSeat()]) {
    oppSecretHistory.cards[0].card = Game.state.secretCard[oppSeat()];
    renderHistory(false);
  }
}

/* --- Online Networking Handlers & Turn Sequences --- */

function waitForNetSignal(type) {
  return new Promise((resolve) => {
    if (!pendingSignals.has(type)) {
      pendingSignals.set(type, []);
    }
    pendingSignals.get(type).push(resolve);
  });
}

function resolveNetSignal(type, msg) {
  const queue = pendingSignals.get(type);
  if (queue && queue.length > 0) {
    const resolve = queue.shift();
    if (queue.length === 0) {
      pendingSignals.delete(type);
    }
    resolve(msg);
    return true;
  }
  return false;
}

function rejectAllNetSignals() {
  pendingSignals.clear();
}

function enqueueNetTurn(fn) {
  turnQueue = turnQueue.then(async () => {
    try {
      await fn();
    } catch (err) {
      console.error('Net turn error:', err);
    }
  });
  return turnQueue;
}

async function playOnlineLocalTurn(type, selected) {
  const token = gameToken;
  const hand = Game.getHand(localSeat);

  if (localSeat === 1) {
    // HOST local turn
    const prevNext = Game.getHand(2);

    if (type === 'secret') {
      const idx = selected[0];
      const card = hand[idx];
      const src = handEl(1, idx);
      const from = Fx.rectOf(src);
      const to = Fx.rectOf(els.playerSecret.firstElementChild);
      src.style.visibility = 'hidden';

      netSession.send({ type: 'remote_secret', selected: [idx] });

      await Fx.flyCard({
        from,
        to,
        frontSrc: cardFront(card),
        backSrc: CARD_BACK,
        startFaceUp: true,
        endFaceUp: false
      });
      if (token !== gameToken) return;

      Game.performSecret(1, idx);
      netSession.send({ type: 'turn_commit', view: Game.buildPlayerView(2) });
      pushHistory({ player: 1, action: 'secret', cards: [{ card, to: 'secret' }] });
      await afterCommit(prevNext, token);
      return;
    }

    if (type === 'tradeoff') {
      const sel = [...selected];
      const cards = sel.map((i) => hand[i]);
      const froms = sel.map((i) => Fx.rectOf(handEl(1, i)));
      const to = Fx.rectOf(els.discardPile);
      sel.forEach((i) => { handEl(1, i).style.visibility = 'hidden'; });

      netSession.send({ type: 'remote_tradeoff', selected: sel });

      await Promise.all(cards.map((card, k) => Fx.flyCard({
        from: froms[k],
        to,
        frontSrc: cardFront(card),
        backSrc: CARD_BACK,
        startFaceUp: true,
        endFaceUp: false,
        delay: k * 120
      })));
      if (token !== gameToken) return;

      Game.performTradeoff(1, sel);
      netSession.send({ type: 'turn_commit', view: Game.buildPlayerView(2) });
      pushHistory({
        player: 1,
        action: 'tradeoff',
        cards: cards.map((card) => ({ card, to: 'discard' }))
      });
      await afterCommit(prevNext, token);
      return;
    }

    if (type === 'gift') {
      const sel = [...selected].sort((a, b) => a - b);
      const cards = sel.map((i) => hand[i]);
      pendingOffer = {
        kind: 'gift',
        offerer: 1,
        cards,
        revealed: false,
        interactive: false,
        chosen: null,
        hidden: new Set(),
        resolve: null
      };
      renderOfferTray();

      const responsePromise = waitForNetSignal('offer_response');
      netSession.send({ type: 'offer_made', kind: 'gift', selected: sel, cards });

      const froms = sel.map((i) => Fx.rectOf(handEl(1, i)));
      const tos = cards.map((_, k) => Fx.rectOf(els.offerTray.querySelector(`[data-slot="${k}"]`)));
      sel.forEach((i) => { handEl(1, i).style.visibility = 'hidden'; });

      const clones = await Promise.all(cards.map((card, k) => Fx.flyCard({
        from: froms[k],
        to: tos[k],
        frontSrc: cardFront(card),
        backSrc: CARD_BACK,
        startFaceUp: true,
        endFaceUp: true,
        delay: k * 90,
        keep: true
      })));
      if (token !== gameToken) return;

      pendingOffer.revealed = true;
      renderOfferTray();
      clones.forEach((c) => c.remove());

      const { choice } = await responsePromise;
      if (token !== gameToken) return;

      pendingOffer.chosen = choice;
      renderOfferTray();

      await Fx.wait(350);
      if (token !== gameToken) return;

      const assign = cards.map((_, k) => (k === choice ? 2 : 1));
      await distributeOffer(assign);
      if (token !== gameToken) return;

      pendingOffer = null;
      Game.performGift(1, sel, choice);
      netSession.send({ type: 'turn_commit', view: Game.buildPlayerView(2) });
      pushHistory({
        player: 1,
        action: 'gift',
        cards: cards.map((card, k) => ({ card, to: assign[k] }))
      });
      await afterCommit(prevNext, token);
      return;
    }

    if (type === 'competition') {
      const sel = [...selected];
      const cards = sel.map((i) => hand[i]);
      pendingOffer = {
        kind: 'competition',
        offerer: 1,
        cards,
        revealed: false,
        interactive: false,
        chosen: null,
        hidden: new Set(),
        resolve: null
      };
      renderOfferTray();

      const responsePromise = waitForNetSignal('offer_response');
      netSession.send({ type: 'offer_made', kind: 'competition', selected: sel, cards });

      const froms = sel.map((i) => Fx.rectOf(handEl(1, i)));
      const tos = cards.map((_, k) => Fx.rectOf(els.offerTray.querySelector(`[data-slot="${k}"]`)));
      sel.forEach((i) => { handEl(1, i).style.visibility = 'hidden'; });

      const clones = await Promise.all(cards.map((card, k) => Fx.flyCard({
        from: froms[k],
        to: tos[k],
        frontSrc: cardFront(card),
        backSrc: CARD_BACK,
        startFaceUp: true,
        endFaceUp: true,
        delay: k * 90,
        keep: true
      })));
      if (token !== gameToken) return;

      pendingOffer.revealed = true;
      renderOfferTray();
      clones.forEach((c) => c.remove());

      const { choice } = await responsePromise;
      if (token !== gameToken) return;

      pendingOffer.chosen = choice;
      renderOfferTray();

      await Fx.wait(350);
      if (token !== gameToken) return;

      const assign = cards.map((_, k) => (Math.floor(k / 2) === choice ? 2 : 1));
      await distributeOffer(assign);
      if (token !== gameToken) return;

      pendingOffer = null;
      Game.performCompetition(1, sel, choice + 1);
      netSession.send({ type: 'turn_commit', view: Game.buildPlayerView(2) });
      pushHistory({
        player: 1,
        action: 'competition',
        cards: cards.map((card, k) => ({ card, to: assign[k] }))
      });
      await afterCommit(prevNext, token);
    }
  } else {
    // GUEST local turn (localSeat === 2)
    if (type === 'secret') {
      const idx = selected[0];
      const card = hand[idx];
      const src = handEl(2, idx);
      const from = Fx.rectOf(src);
      const to = Fx.rectOf(els.playerSecret.firstElementChild);
      src.style.visibility = 'hidden';

      const commitPromise = waitForNetSignal('turn_commit');
      netSession.send({ type: 'action_intent', action: 'secret', selected: [idx] });

      await Fx.flyCard({
        from,
        to,
        frontSrc: cardFront(card),
        backSrc: CARD_BACK,
        startFaceUp: true,
        endFaceUp: false
      });
      if (token !== gameToken) return;

      const commit = await commitPromise;
      if (token !== gameToken) return;

      const prevNext = Game.getHand(1);
      Game.applyPlayerView(commit.view);
      pushHistory({ player: 2, action: 'secret', cards: [{ card, to: 'secret' }] });
      await afterCommit(prevNext, token);
      return;
    }

    if (type === 'tradeoff') {
      const sel = [...selected];
      const cards = sel.map((i) => hand[i]);
      const froms = sel.map((i) => Fx.rectOf(handEl(2, i)));
      const to = Fx.rectOf(els.discardPile);
      sel.forEach((i) => { handEl(2, i).style.visibility = 'hidden'; });

      const commitPromise = waitForNetSignal('turn_commit');
      netSession.send({ type: 'action_intent', action: 'tradeoff', selected: sel });

      await Promise.all(cards.map((card, k) => Fx.flyCard({
        from: froms[k],
        to,
        frontSrc: cardFront(card),
        backSrc: CARD_BACK,
        startFaceUp: true,
        endFaceUp: false,
        delay: k * 120
      })));
      if (token !== gameToken) return;

      const commit = await commitPromise;
      if (token !== gameToken) return;

      const prevNext = Game.getHand(1);
      Game.applyPlayerView(commit.view);
      pushHistory({
        player: 2,
        action: 'tradeoff',
        cards: cards.map((card) => ({ card, to: 'discard' }))
      });
      await afterCommit(prevNext, token);
      return;
    }

    if (type === 'gift') {
      const sel = [...selected].sort((a, b) => a - b);
      const cards = sel.map((i) => hand[i]);
      pendingOffer = {
        kind: 'gift',
        offerer: 2,
        cards,
        revealed: false,
        interactive: false,
        chosen: null,
        hidden: new Set(),
        resolve: null
      };
      renderOfferTray();

      const choicePromise = waitForNetSignal('offer_choice');
      const commitPromise = waitForNetSignal('turn_commit');
      netSession.send({ type: 'offer_intent', kind: 'gift', selected: sel, cards });

      const froms = sel.map((i) => Fx.rectOf(handEl(2, i)));
      const tos = cards.map((_, k) => Fx.rectOf(els.offerTray.querySelector(`[data-slot="${k}"]`)));
      sel.forEach((i) => { handEl(2, i).style.visibility = 'hidden'; });

      const clones = await Promise.all(cards.map((card, k) => Fx.flyCard({
        from: froms[k],
        to: tos[k],
        frontSrc: cardFront(card),
        backSrc: CARD_BACK,
        startFaceUp: true,
        endFaceUp: true,
        delay: k * 90,
        keep: true
      })));
      if (token !== gameToken) return;

      pendingOffer.revealed = true;
      renderOfferTray();
      clones.forEach((c) => c.remove());

      const { choice } = await choicePromise;
      if (token !== gameToken) return;

      pendingOffer.chosen = choice;
      renderOfferTray();

      await Fx.wait(350);
      if (token !== gameToken) return;

      const assign = cards.map((_, k) => (k === choice ? 1 : 2));
      await distributeOffer(assign);
      if (token !== gameToken) return;

      pendingOffer = null;
      const commit = await commitPromise;
      if (token !== gameToken) return;

      const prevNext = Game.getHand(1);
      Game.applyPlayerView(commit.view);
      pushHistory({
        player: 2,
        action: 'gift',
        cards: cards.map((card, k) => ({ card, to: assign[k] }))
      });
      await afterCommit(prevNext, token);
      return;
    }

    if (type === 'competition') {
      const sel = [...selected];
      const cards = sel.map((i) => hand[i]);
      pendingOffer = {
        kind: 'competition',
        offerer: 2,
        cards,
        revealed: false,
        interactive: false,
        chosen: null,
        hidden: new Set(),
        resolve: null
      };
      renderOfferTray();

      const choicePromise = waitForNetSignal('offer_choice');
      const commitPromise = waitForNetSignal('turn_commit');
      netSession.send({ type: 'offer_intent', kind: 'competition', selected: sel, cards });

      const froms = sel.map((i) => Fx.rectOf(handEl(2, i)));
      const tos = cards.map((_, k) => Fx.rectOf(els.offerTray.querySelector(`[data-slot="${k}"]`)));
      sel.forEach((i) => { handEl(2, i).style.visibility = 'hidden'; });

      const clones = await Promise.all(cards.map((card, k) => Fx.flyCard({
        from: froms[k],
        to: tos[k],
        frontSrc: cardFront(card),
        backSrc: CARD_BACK,
        startFaceUp: true,
        endFaceUp: true,
        delay: k * 90,
        keep: true
      })));
      if (token !== gameToken) return;

      pendingOffer.revealed = true;
      renderOfferTray();
      clones.forEach((c) => c.remove());

      const { choice } = await choicePromise;
      if (token !== gameToken) return;

      pendingOffer.chosen = choice;
      renderOfferTray();

      await Fx.wait(350);
      if (token !== gameToken) return;

      const assign = cards.map((_, k) => (Math.floor(k / 2) === choice ? 1 : 2));
      await distributeOffer(assign);
      if (token !== gameToken) return;

      pendingOffer = null;
      const commit = await commitPromise;
      if (token !== gameToken) return;

      const prevNext = Game.getHand(1);
      Game.applyPlayerView(commit.view);
      pushHistory({
        player: 2,
        action: 'competition',
        cards: cards.map((card, k) => ({ card, to: assign[k] }))
      });
      await afterCommit(prevNext, token);
    }
  }
}

async function handleRemoteSecret(msg) {
  const token = gameToken;
  const idx = msg.selected[0];
  const src = handEl(1, idx);
  const from = Fx.rectOf(src);
  const to = Fx.rectOf(els.opponentSecret.firstElementChild);
  src.style.visibility = 'hidden';

  await Fx.flyCard({
    from,
    to,
    frontSrc: null,
    backSrc: CARD_BACK,
    startFaceUp: false,
    endFaceUp: false
  });
  if (token !== gameToken) return;

  const commit = await waitForNetSignal('turn_commit');
  if (token !== gameToken) return;

  const prevNext = Game.getHand(2);
  Game.applyPlayerView(commit.view);
  pushHistory({ player: 1, action: 'secret', cards: [{ card: null, to: 'secret' }] });
  await afterCommit(prevNext, token);
}

async function handleRemoteTradeoff(msg) {
  const token = gameToken;
  const sel = msg.selected;
  const froms = sel.map((i) => Fx.rectOf(handEl(1, i)));
  const to = Fx.rectOf(els.discardPile);
  sel.forEach((i) => { handEl(1, i).style.visibility = 'hidden'; });

  await Promise.all(sel.map((_, k) => Fx.flyCard({
    from: froms[k],
    to,
    frontSrc: null,
    backSrc: CARD_BACK,
    startFaceUp: false,
    endFaceUp: false,
    delay: k * 120
  })));
  if (token !== gameToken) return;

  const commit = await waitForNetSignal('turn_commit');
  if (token !== gameToken) return;

  const prevNext = Game.getHand(2);
  Game.applyPlayerView(commit.view);
  pushHistory({
    player: 1,
    action: 'tradeoff',
    cards: sel.map(() => ({ card: null, to: 'discard' }))
  });
  await afterCommit(prevNext, token);
}

async function handleRemoteOfferMade(msg) {
  const token = gameToken;
  const { kind, selected, cards } = msg;
  pendingOffer = {
    kind,
    offerer: 1,
    cards,
    revealed: false,
    interactive: false,
    chosen: null,
    hidden: new Set(),
    resolve: null
  };
  renderOfferTray();

  const froms = selected.map((i) => Fx.rectOf(handEl(1, i)));
  const tos = cards.map((_, k) => Fx.rectOf(els.offerTray.querySelector(`[data-slot="${k}"]`)));
  selected.forEach((i) => { handEl(1, i).style.visibility = 'hidden'; });

  const clones = await Promise.all(cards.map((card, k) => Fx.flyCard({
    from: froms[k],
    to: tos[k],
    frontSrc: cardFront(card),
    backSrc: CARD_BACK,
    startFaceUp: false,
    endFaceUp: true,
    delay: k * 90,
    keep: true
  })));
  if (token !== gameToken) return;

  pendingOffer.revealed = true;
  renderOfferTray();
  clones.forEach((c) => c.remove());

  const commitPromise = waitForNetSignal('turn_commit');
  const choice = await awaitHumanChoice();
  if (token !== gameToken) return;

  netSession.send({ type: 'offer_response', choice });
  pendingOffer.chosen = choice;
  renderOfferTray();

  await Fx.wait(250);
  if (token !== gameToken) return;

  const assign = kind === 'gift'
    ? cards.map((_, k) => (k === choice ? 2 : 1))
    : cards.map((_, k) => (Math.floor(k / 2) === choice ? 2 : 1));
  await distributeOffer(assign);
  if (token !== gameToken) return;

  pendingOffer = null;
  const commit = await commitPromise;
  if (token !== gameToken) return;

  const prevNext = Game.getHand(2);
  Game.applyPlayerView(commit.view);
  pushHistory({
    player: 1,
    action: kind,
    cards: cards.map((card, k) => ({ card, to: assign[k] }))
  });
  await afterCommit(prevNext, token);
}

async function handleActionIntent(msg) {
  const token = gameToken;
  const { action, selected } = msg;
  const prevNext = Game.getHand(2);

  if (action === 'secret') {
    const idx = selected[0];
    const src = handEl(2, idx);
    const from = Fx.rectOf(src);
    const to = Fx.rectOf(els.opponentSecret.firstElementChild);
    src.style.visibility = 'hidden';

    await Fx.flyCard({
      from,
      to,
      frontSrc: null,
      backSrc: CARD_BACK,
      startFaceUp: false,
      endFaceUp: false
    });
    if (token !== gameToken) return;

    Game.performSecret(2, idx);
    netSession.send({ type: 'turn_commit', view: Game.buildPlayerView(2) });
    pushHistory({ player: 2, action: 'secret', cards: [{ card: null, to: 'secret' }] });
    await afterCommit(prevNext, token);
    return;
  }

  if (action === 'tradeoff') {
    const sel = [...selected];
    const froms = sel.map((i) => Fx.rectOf(handEl(2, i)));
    const to = Fx.rectOf(els.discardPile);
    sel.forEach((i) => { handEl(2, i).style.visibility = 'hidden'; });

    await Promise.all(sel.map((_, k) => Fx.flyCard({
      from: froms[k],
      to,
      frontSrc: null,
      backSrc: CARD_BACK,
      startFaceUp: false,
      endFaceUp: false,
      delay: k * 120
    })));
    if (token !== gameToken) return;

    Game.performTradeoff(2, sel);
    netSession.send({ type: 'turn_commit', view: Game.buildPlayerView(2) });
    pushHistory({
      player: 2,
      action: 'tradeoff',
      cards: sel.map(() => ({ card: null, to: 'discard' }))
    });
    await afterCommit(prevNext, token);
  }
}

async function handleOfferIntent(msg) {
  const token = gameToken;
  const { kind, selected, cards } = msg;
  const prevNext = Game.getHand(2);

  pendingOffer = {
    kind,
    offerer: 2,
    cards,
    revealed: false,
    interactive: false,
    chosen: null,
    hidden: new Set(),
    resolve: null
  };
  renderOfferTray();

  const froms = selected.map((i) => Fx.rectOf(handEl(2, i)));
  const tos = cards.map((_, k) => Fx.rectOf(els.offerTray.querySelector(`[data-slot="${k}"]`)));
  selected.forEach((i) => { handEl(2, i).style.visibility = 'hidden'; });

  const clones = await Promise.all(cards.map((card, k) => Fx.flyCard({
    from: froms[k],
    to: tos[k],
    frontSrc: cardFront(card),
    backSrc: CARD_BACK,
    startFaceUp: false,
    endFaceUp: true,
    delay: k * 90,
    keep: true
  })));
  if (token !== gameToken) return;

  pendingOffer.revealed = true;
  renderOfferTray();
  clones.forEach((c) => c.remove());

  const choice = await awaitHumanChoice();
  if (token !== gameToken) return;

  netSession.send({ type: 'offer_choice', choice });
  pendingOffer.chosen = choice;
  renderOfferTray();

  await Fx.wait(250);
  if (token !== gameToken) return;

  const assign = kind === 'gift'
    ? cards.map((_, k) => (k === choice ? 1 : 2))
    : cards.map((_, k) => (Math.floor(k / 2) === choice ? 1 : 2));
  await distributeOffer(assign);
  if (token !== gameToken) return;

  pendingOffer = null;
  if (kind === 'gift') {
    Game.performGift(2, selected, choice);
  } else {
    Game.performCompetition(2, selected, choice + 1);
  }

  netSession.send({ type: 'turn_commit', view: Game.buildPlayerView(2) });
  pushHistory({
    player: 2,
    action: kind,
    cards: cards.map((card, k) => ({ card, to: assign[k] }))
  });
  await afterCommit(prevNext, token);
}

function handleNetMessage(msg) {
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'round_start') {
    enqueueNetTurn(async () => {
      gameMode = 'online';
      localSeat = 2;
      gameStarted = true;
      closeConfirmModal();
      resetUIState();
      els.modeSelectionScreen.classList.add('hidden');

      Game.applyPlayerView(msg.view);
      await kickoffOnlineRound();
    });
    return;
  }

  if (msg.type === 'ready_next') {
    remoteReadyNext = true;
    if (localReadyNext && localSeat === 1) {
      if (msg.kind === 'next_round') {
        Game.startNextRound();
        netSession.send({
          type: 'round_start',
          round: Game.state.round,
          starter: Game.state.roundStarter,
          view: Game.buildPlayerView(2)
        });
        beginOnlineNextRound();
      } else if (msg.kind === 'rematch') {
        Game.startGame(startingPlayerPref);
        netSession.send({
          type: 'round_start',
          round: Game.state.round,
          starter: Game.state.roundStarter,
          view: Game.buildPlayerView(2)
        });
        beginOnlineNextRound();
      }
    }
    return;
  }

  if (msg.type === 'turn_commit') {
    resolveNetSignal('turn_commit', msg);
    return;
  }

  if (msg.type === 'offer_response') {
    resolveNetSignal('offer_response', msg);
    return;
  }

  if (msg.type === 'offer_choice') {
    resolveNetSignal('offer_choice', msg);
    return;
  }

  if (msg.type === 'remote_secret') {
    enqueueNetTurn(() => handleRemoteSecret(msg));
    return;
  }

  if (msg.type === 'remote_tradeoff') {
    enqueueNetTurn(() => handleRemoteTradeoff(msg));
    return;
  }

  if (msg.type === 'offer_made') {
    enqueueNetTurn(() => handleRemoteOfferMade(msg));
    return;
  }

  if (msg.type === 'action_intent') {
    enqueueNetTurn(() => handleActionIntent(msg));
    return;
  }

  if (msg.type === 'offer_intent') {
    enqueueNetTurn(() => handleOfferIntent(msg));
  }
}

function handleNetGuestJoined({ roomCode }) {
  gameMode = 'online';
  localSeat = 1;
  gameStarted = true;
  closeConfirmModal();
  resetUIState();
  els.modeSelectionScreen.classList.add('hidden');

  Game.startGame(startingPlayerPref);

  const view = Game.buildPlayerView(2);
  netSession.send({
    type: 'round_start',
    round: Game.state.round,
    starter: Game.state.roundStarter,
    view
  });

  kickoffOnlineRound();
}

function handleNetJoinedHost() {
  els.joinStatusMsg.textContent = 'Joined room! Waiting for host to start…';
}

function handleNetPeerLeft() {
  if (gameStarted && gameMode === 'online') {
    gameStarted = false;
    openDisconnectModal('Your opponent left the match or lost connection.');
  }
}

async function handleCreateRoomClick() {
  if (onlineBusy) return;
  onlineBusy = true;
  els.createRoomButton.disabled = true;
  els.hostLobbyStatus.textContent = 'Contacting signaling server…';
  els.hostLobbyStatus.classList.remove('error');

  try {
    netSession = Net.createNetSession({
      onGuestJoined: handleNetGuestJoined,
      onJoinedHost: null,
      onMessage: handleNetMessage,
      onPeerLeft: handleNetPeerLeft,
      onError: (err) => {
        console.error('Net error:', err);
      }
    });

    const { roomCode } = await netSession.hostRoom();
    onlineRoomCode = roomCode;
    els.lobbyRoomCode.textContent = roomCode;
    els.createRoomButton.classList.add('hidden');
    els.hostLobbyBox.classList.remove('hidden');
    els.hostLobbyStatus.textContent = 'Waiting for opponent to join…';
  } catch (err) {
    console.error(err);
    els.hostLobbyStatus.textContent = err.message || 'Failed to create room.';
    els.hostLobbyStatus.classList.add('error');
    els.createRoomButton.classList.remove('hidden');
    els.hostLobbyBox.classList.add('hidden');
    if (netSession) {
      netSession.close(false);
      netSession = null;
    }
  } finally {
    onlineBusy = false;
    els.createRoomButton.disabled = false;
  }
}

function handleCancelRoomClick() {
  if (netSession) {
    netSession.close(false);
    netSession = null;
  }
  onlineRoomCode = null;
  els.hostLobbyBox.classList.add('hidden');
  els.createRoomButton.classList.remove('hidden');
}

async function handleJoinRoomClick() {
  if (onlineBusy) return;
  const rawCode = els.joinCodeInput.value;
  const code = Net.normalizeRoomCode(rawCode);
  if (!Net.isValidRoomCode(code)) {
    els.joinStatusMsg.textContent = 'Please enter a 6-character room code.';
    els.joinStatusMsg.classList.remove('hidden');
    els.joinStatusMsg.classList.add('error');
    return;
  }

  onlineBusy = true;
  els.joinRoomButton.disabled = true;
  els.cancelJoinButton.classList.remove('hidden');
  els.joinStatusMsg.textContent = `Connecting to room ${code}…`;
  els.joinStatusMsg.classList.remove('hidden', 'error');

  try {
    netSession = Net.createNetSession({
      onGuestJoined: null,
      onJoinedHost: handleNetJoinedHost,
      onMessage: handleNetMessage,
      onPeerLeft: handleNetPeerLeft,
      onError: (err) => {
        console.error('Net error:', err);
      }
    });

    await netSession.joinRoom(code);
    onlineRoomCode = code;
    els.joinStatusMsg.textContent = 'Connected! Waiting for match to start…';
  } catch (err) {
    console.error(err);
    els.joinStatusMsg.textContent = err.message || 'Failed to join room.';
    els.joinStatusMsg.classList.add('error');
    if (netSession) {
      netSession.close(false);
      netSession = null;
    }
  } finally {
    onlineBusy = false;
    els.joinRoomButton.disabled = false;
    els.cancelJoinButton.classList.add('hidden');
  }
}

function handleCancelJoinClick() {
  if (netSession) {
    netSession.close(false);
    netSession = null;
  }
  onlineRoomCode = null;
  els.joinStatusMsg.classList.add('hidden');
  els.joinRoomButton.disabled = false;
  els.cancelJoinButton.classList.add('hidden');
  onlineBusy = false;
}

function handleLeaveOnline() {
  if (netSession) {
    netSession.close(true);
    netSession = null;
  }
  showModeSelection();
}

/* --- Lifecycle --- */

function resetUIState() {
  gameToken += 1;
  stopPeek(false);
  Fx.clearFx();
  pendingAction = null;
  pendingOffer = null;
  history = [];
  animating = false;
  hiddenDraw = null;
  revealDone = false;
  resultReady = false;
  localReadyNext = false;
  remoteReadyNext = false;
  rejectAllNetSignals();
}

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
      stopPeek(false);
      Fx.clearFx();
      pendingOffer = null;
      animating = false;
      render();
    }
  } else {
    render();
  }
}

async function kickoffOnlineRound() {
  renderHistory(false);
  render();
}

function showModeSelection() {
  gameStarted = false;
  gameMode = 'ai';
  localSeat = 1;
  if (netSession) {
    netSession.close(false);
    netSession = null;
  }
  onlineRoomCode = null;
  closeConfirmModal();
  closeDisconnectModal();
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
  gameMode = 'ai';
  localSeat = 1;
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

async function beginOnlineNextRound() {
  closeConfirmModal();
  resetUIState();
  gameStarted = true;
  await kickoffOnlineRound();
}

function handleRestartClick() {
  if (gameStarted) {
    openConfirmModal();
  } else {
    showModeSelection();
  }
}

export function startApp() {
  fitStage();
  window.addEventListener('resize', fitStage);

  const params = new URLSearchParams(window.location.search);
  const roomParam = params.get('room');
  if (roomParam && Net.isValidRoomCode(Net.normalizeRoomCode(roomParam))) {
    setupMode = 'online';
    onlineTab = 'join';
    els.joinCodeInput.value = Net.normalizeRoomCode(roomParam);
    try {
      window.history.replaceState({}, '', window.location.pathname);
    } catch (_) {}
  }

  showModeSelection();

  els.gameModeButtons.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    setupMode = btn.dataset.mode;
    updateSetupSelectionUI();
  });

  els.onlineRoleTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-online-tab]');
    if (!btn) return;
    onlineTab = btn.dataset.onlineTab;
    updateSetupSelectionUI();
  });

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
  els.restartButton.addEventListener('click', handleRestartClick);

  els.createRoomButton.addEventListener('click', handleCreateRoomClick);
  els.cancelRoomButton.addEventListener('click', handleCancelRoomClick);
  els.copyCodeButton.addEventListener('click', async () => {
    if (!onlineRoomCode) return;
    try {
      await navigator.clipboard.writeText(onlineRoomCode);
      const prev = els.copyCodeButton.textContent;
      els.copyCodeButton.textContent = 'Copied!';
      setTimeout(() => { els.copyCodeButton.textContent = prev; }, 1500);
    } catch (_) {}
  });
  els.copyLinkButton.addEventListener('click', async () => {
    if (!onlineRoomCode) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('room', onlineRoomCode);
      await navigator.clipboard.writeText(url.toString());
      const prev = els.copyLinkButton.textContent;
      els.copyLinkButton.textContent = 'Link Copied!';
      setTimeout(() => { els.copyLinkButton.textContent = prev; }, 1500);
    } catch (_) {}
  });

  els.joinRoomButton.addEventListener('click', handleJoinRoomClick);
  els.cancelJoinButton.addEventListener('click', handleCancelJoinClick);
  els.joinCodeInput.addEventListener('input', () => {
    els.joinCodeInput.value = Net.normalizeRoomCode(els.joinCodeInput.value);
  });
  els.joinCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleJoinRoomClick();
    }
  });

  els.confirmCancelButton.addEventListener('click', closeConfirmModal);
  els.confirmAcceptButton.addEventListener('click', () => {
    if (gameMode === 'online') {
      handleLeaveOnline();
    } else {
      showModeSelection();
    }
  });
  els.confirmModal.addEventListener('click', (e) => {
    if (e.target === els.confirmModal) closeConfirmModal();
  });

  els.disconnectOkButton.addEventListener('click', () => {
    closeDisconnectModal();
    showModeSelection();
  });
  els.disconnectModal.addEventListener('click', (e) => {
    if (e.target === els.disconnectModal) {
      closeDisconnectModal();
      showModeSelection();
    }
  });

  els.actionBar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.getAttribute('aria-disabled') === 'true') return;
    selectAction(btn.dataset.action);
  });

  els.confirmButton.addEventListener('click', () => {
    if (els.confirmButton.getAttribute('aria-disabled') === 'true') return;
    confirmSelection();
  });

  els.handList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-index]');
    if (!btn || btn.disabled) return;
    handleCardClick(Number(btn.dataset.index));
  });

  els.offerTray.addEventListener('click', (e) => {
    if (!pendingOffer?.interactive || peekState !== 'closed') return;
    if (pendingOffer.kind === 'competition') {
      const pairBtn = e.target.closest('button[data-pair]');
      if (pairBtn) resolveOfferChoice(Number(pairBtn.dataset.pair));
    } else {
      const slotBtn = e.target.closest('button[data-slot]');
      if (slotBtn) resolveOfferChoice(Number(slotBtn.dataset.slot));
    }
  });

  els.stage.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.peek-trigger-btn');
    if (!btn) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!canPeekBoard() || isConfirmModalOpen() || isDisconnectModalOpen()) return;
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
    if (!canPeekBoard() || isConfirmModalOpen() || isDisconnectModalOpen()) return;
    latchPeek();
  });

  window.addEventListener('pointerup', handlePeekPointerEnd);
  window.addEventListener('pointercancel', handlePeekPointerEnd);
  window.addEventListener('blur', () => {
    if (peekState === 'holding') stopPeek(false);
  });

  els.peekRestoreButton.addEventListener('click', () => stopPeek(true));

  document.addEventListener('keydown', (e) => {
    if (isDisconnectModalOpen()) {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault();
        closeDisconnectModal();
        showModeSelection();
      }
      return;
    }
    if (isConfirmModalOpen()) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeConfirmModal();
      }
      return;
    }
    if (!els.modeSelectionScreen.classList.contains('hidden')) return;
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
    if (e.key === 'Escape') {
      if (pendingAction && !animating && !pendingOffer) {
        pendingAction = null;
        render();
      }
    } else if (e.key === 'Enter') {
      if (pendingAction && !animating && !pendingOffer) {
        confirmSelection();
      }
    }
  });
}
