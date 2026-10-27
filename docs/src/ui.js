import * as Game from './game.js';
import * as AI from './ai.js';

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

function getCardAssetPath(cardId) {
  return `${ASSET_BASE}${CARD_IMAGE_FILES[cardId] || 'background_card.png'}`;
}

function getGeishaAssetPath(cardId) {
  return `${ASSET_BASE}${GEISHA_IMAGE_FILES[cardId] || 'background_card.png'}`;
}

const elements = {
  message: document.getElementById('message'),
  boardContainer: document.getElementById('board-container'),
  deckContainer: document.getElementById('deck-container'),
  handList: document.getElementById('hand-list'),
  opponentHandList: document.getElementById('opponent-hand-list'),
  handLabel: document.getElementById('hand-label'),
  opponentLabel: document.getElementById('opponent-label'),
  gameModeBadge: document.getElementById('game-mode-badge'),
  turnBadge: document.getElementById('turn-badge'),
  activePlayerBadge: document.getElementById('active-player-badge'),
  secretButton: document.getElementById('secret-button'),
  tradeoffButton: document.getElementById('tradeoff-button'),
  giftButton: document.getElementById('gift-button'),
  competitionButton: document.getElementById('competition-button'),
  confirmButton: document.getElementById('confirm-button'),
  restartButton: document.getElementById('restart-button'),
  offerPanel: document.getElementById('offer-panel'),
  resultPanel: document.getElementById('result-panel'),
  transitionScreen: document.getElementById('transition-screen'),
  transitionTitle: document.getElementById('transition-title'),
  transitionText: document.getElementById('transition-text'),
  transitionButton: document.getElementById('transition-button'),
  modeSelectionScreen: document.getElementById('mode-selection-screen'),
  aiCasualButton: document.getElementById('ai-casual-button'),
  aiTacticalButton: document.getElementById('ai-tactical-button'),
  aiMasterButton: document.getElementById('ai-master-button'),
  multiplayerButton: document.getElementById('multiplayer-button')
};

let pendingAction = null;
let offerChoices = null;
let transition = null;
let gameMode = null; // 'single' | 'multi'
let aiDifficulty = 'medium'; // 'easy' | 'medium' | 'hard'

function updateStatus() {
  elements.message.textContent = Game.state.message;
}

function isComputer(player) {
  return gameMode === 'single' && player === 2;
}

function showTransition(player) {
  if (gameMode === 'single') {
    render();
    return;
  }

  transition = {
    player,
    title: `Player ${player}'s Turn`,
    text: `Pass the device to Player ${player}. Please look away while switching.`
  };
  render();
}

function hideTransition() {
  transition = null;
  render();
}

function resolveAIChoice() {
  if (!offerChoices) {
    hideTransition();
    return;
  }

  const handler = offerChoices.handler;
  const choiceIndex = offerChoices.aiChoice !== undefined
    ? offerChoices.aiChoice
    : Math.floor(Math.random() * offerChoices.options.length);

  offerChoices = null;
  pendingAction = null;
  hideTransition();
  handler(choiceIndex);
}

function prepareAIGiftResponse(player, selectedIndices) {
  const hand = Game.getHand(player);
  const giftCards = selectedIndices.map((i) => hand[i]);

  pendingAction = null;
  offerChoices = {
    title: 'Computer offered 3 cards as a Gift. Choose 1 card to take into your gifts:',
    options: giftCards.map((card, idx) => ({
      label: `${CARD_ICONS[card]} ${Game.cardName(card)} (${Game.cardValue(card)} pts)`
    })),
    handler: (chosenOfferIndex) => {
      Game.performGift(player, selectedIndices, chosenOfferIndex);
      offerChoices = null;
      pendingAction = null;
      if (!Game.state.gameOver) {
        if (gameMode === 'single' && Game.state.currentPlayer === 2) {
          executeAITurn();
        } else {
          showTransition(Game.state.currentPlayer);
        }
      } else {
        render();
      }
    }
  };

  Game.state.message = 'The Computer offered 3 cards. Choose 1 card to take.';
  render();
}

function prepareAICompetitionResponse(player, selectedIndices) {
  const hand = Game.getHand(player);
  const firstPair = [hand[selectedIndices[0]], hand[selectedIndices[1]]];
  const secondPair = [hand[selectedIndices[2]], hand[selectedIndices[3]]];

  pendingAction = null;
  offerChoices = {
    title: 'Computer partitioned 4 cards into 2 pairs. Choose 1 pair to take:',
    options: [
      {
        label: `Pair 1: ${CARD_ICONS[firstPair[0]]} ${Game.cardName(firstPair[0])} (${Game.cardValue(firstPair[0])}p) + ${CARD_ICONS[firstPair[1]]} ${Game.cardName(firstPair[1])} (${Game.cardValue(firstPair[1])}p)`
      },
      {
        label: `Pair 2: ${CARD_ICONS[secondPair[0]]} ${Game.cardName(secondPair[0])} (${Game.cardValue(secondPair[0])}p) + ${CARD_ICONS[secondPair[1]]} ${Game.cardName(secondPair[1])} (${Game.cardValue(secondPair[1])}p)`
      }
    ],
    handler: (chosenPairIndex) => {
      Game.performCompetition(player, selectedIndices, chosenPairIndex + 1);
      offerChoices = null;
      pendingAction = null;
      if (!Game.state.gameOver) {
        if (gameMode === 'single' && Game.state.currentPlayer === 2) {
          executeAITurn();
        } else {
          showTransition(Game.state.currentPlayer);
        }
      } else {
        render();
      }
    }
  };

  Game.state.message = 'The Computer offered 2 pairs for Competition. Choose which pair to take.';
  render();
}

function executeAITurn() {
  if (Game.state.gameOver || !isComputer(Game.state.currentPlayer)) {
    return;
  }

  const player = Game.state.currentPlayer;
  const decision = AI.chooseAIAction(aiDifficulty, player, Game.state);

  if (!decision) {
    Game.state.message = 'Computer has no available actions.';
    render();
    return;
  }

  const { action, selected } = decision;

  switch (action) {
    case 'secret':
      Game.performSecret(player, selected[0]);
      render();
      break;
    case 'tradeoff':
      Game.performTradeoff(player, selected);
      render();
      break;
    case 'gift':
      prepareAIGiftResponse(player, selected);
      break;
    case 'competition':
      prepareAICompetitionResponse(player, selected);
      break;
  }
}

function showModeSelection() {
  gameMode = null;
  pendingAction = null;
  offerChoices = null;
  transition = null;
  elements.modeSelectionScreen.classList.remove('hidden');
  Game.state.message = 'Select game mode to begin.';
  render();
}

function hideModeSelection() {
  elements.modeSelectionScreen.classList.add('hidden');
}

function startNewGame(mode, difficulty = 'medium') {
  gameMode = mode;
  aiDifficulty = difficulty;
  hideModeSelection();
  Game.startGame();
  pendingAction = null;
  offerChoices = null;
  transition = null;

  const diffLabel = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
  Game.state.message = mode === 'single'
    ? `Single Player mode (${diffLabel} AI). You go first.`
    : 'Two Player mode. Player 1 goes first.';

  render();
}

function acknowledgeTransition() {
  if (!transition) {
    return;
  }

  if (offerChoices && gameMode === 'single' && transition.player === 2) {
    resolveAIChoice();
    return;
  }

  hideTransition();

  if (gameMode === 'single' && Game.state.currentPlayer === 2 && !Game.state.gameOver) {
    executeAITurn();
  }
}

function createGiftStack(count, rowId, playerLabel) {
  const stack = document.createElement('div');
  stack.className = `gift-stack gift-stack-${playerLabel}`;

  if (count === 0) {
    const empty = document.createElement('div');
    empty.className = 'gift-stack-empty';
    empty.textContent = '\u00A0';
    stack.appendChild(empty);
    return stack;
  }

  const displayCount = Math.min(count, 3);
  for (let i = 0; i < displayCount; i++) {
    const giftCard = document.createElement('div');
    giftCard.className = 'gift-card';
    giftCard.setAttribute('data-card', rowId);
    giftCard.style.backgroundImage = `url('${getCardAssetPath(rowId)}')`;
    giftCard.style.backgroundSize = 'contain';
    giftCard.style.backgroundPosition = 'center';
    giftCard.style.backgroundRepeat = 'no-repeat';
    giftCard.style.top = `${i * 24}px`;
    giftCard.style.zIndex = `${i + 1}`;
    stack.appendChild(giftCard);
  }

  if (count > 3) {
    const countDiv = document.createElement('div');
    countDiv.className = 'gift-count';
    countDiv.textContent = `+${count - 3}`;
    stack.appendChild(countDiv);
  }

  return stack;
}

function buildBoard() {
  const rows = Game.getGeishaRows();
  elements.boardContainer.innerHTML = '';

  const boardWrapper = document.createElement('div');
  boardWrapper.className = 'board-wrapper';

  // Secret card area
  const secretDiv = document.createElement('div');
  secretDiv.className = 'secret-area';
  const currentSecret = Game.state.secretCard[Game.state.currentPlayer];
  if (currentSecret !== null) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'secret-card card-back';
    cardDiv.title = 'Your secret card (revealed at endgame)';
    const revealDiv = document.createElement('div');
    revealDiv.className = 'secret-reveal';
    revealDiv.innerHTML = `<span>Secret</span><strong>${CARD_ICONS[currentSecret]} ${Game.cardName(currentSecret)} (${Game.cardValue(currentSecret)}p)</strong>`;
    cardDiv.appendChild(revealDiv);
    secretDiv.appendChild(cardDiv);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'secret-placeholder';
    placeholder.textContent = 'No Secret';
    secretDiv.appendChild(placeholder);
  }
  boardWrapper.appendChild(secretDiv);

  const boardGrid = document.createElement('div');
  boardGrid.className = 'geisha-grid';

  rows.forEach((row) => {
    const column = document.createElement('div');
    column.className = 'geisha-column';

    // Player 2 gifts (top)
    const p2Gifts = createGiftStack(row.player2, row.id, 'player2');

    // Central Geisha card
    const geishaDiv = document.createElement('div');
    geishaDiv.className = `geisha-card geisha-${row.id}`;

    // Favor marker
    const favorDiv = document.createElement('div');
    favorDiv.className = `favor-marker favor-${row.owner === 1 ? 'p1' : row.owner === 2 ? 'p2' : 'neutral'}`;
    if (row.owner === 1) {
      favorDiv.textContent = '▼ Favors P1';
    } else if (row.owner === 2) {
      favorDiv.textContent = isComputer(2) ? '▲ Favors AI' : '▲ Favors P2';
    } else {
      favorDiv.textContent = '● Neutral';
    }

    const geishaImage = document.createElement('div');
    geishaImage.className = 'geisha-image';
    geishaImage.style.backgroundImage = `url('${getGeishaAssetPath(row.id)}')`;
    geishaImage.style.backgroundSize = 'contain';
    geishaImage.style.backgroundPosition = 'center';
    geishaImage.style.backgroundRepeat = 'no-repeat';

    const labelDiv = document.createElement('div');
    labelDiv.className = 'geisha-label';
    labelDiv.textContent = `${CARD_ICONS[row.id]} ${row.name} (${row.value} pts)`;

    geishaDiv.appendChild(favorDiv);
    geishaDiv.appendChild(geishaImage);
    geishaDiv.appendChild(labelDiv);

    // Player 1 gifts (bottom)
    const p1Gifts = createGiftStack(row.player1, row.id, 'player1');

    column.appendChild(p2Gifts);
    column.appendChild(geishaDiv);
    column.appendChild(p1Gifts);
    boardGrid.appendChild(column);
  });

  boardWrapper.appendChild(boardGrid);
  elements.boardContainer.appendChild(boardWrapper);
}

function buildDeck() {
  elements.deckContainer.innerHTML = '';

  const label = document.createElement('div');
  label.className = 'deck-label';
  label.textContent = 'Deck';

  const cardDiv = document.createElement('div');
  cardDiv.className = 'deck-card';
  cardDiv.textContent = Game.state.deck.length;
  cardDiv.title = `${Game.state.deck.length} card(s) remaining in deck`;

  elements.deckContainer.appendChild(label);
  elements.deckContainer.appendChild(cardDiv);
}

function buildOpponentHand() {
  const opponent = Game.other(Game.state.currentPlayer);
  const opponentHand = Game.getHand(opponent);
  elements.opponentHandList.innerHTML = '';

  opponentHand.forEach(() => {
    const backDiv = document.createElement('div');
    backDiv.className = 'card-back';
    elements.opponentHandList.appendChild(backDiv);
  });
}

function buildHand() {
  const hand = Game.getHand(Game.state.currentPlayer);
  elements.handList.innerHTML = '';

  hand.forEach((card, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'card-button';
    button.setAttribute('data-card', card);
    button.title = `${Game.cardName(card)} (${Game.cardValue(card)} pts)`;
    button.style.backgroundImage = `url('${getCardAssetPath(card)}')`;
    button.style.backgroundSize = 'contain';
    button.style.backgroundPosition = 'center';
    button.style.backgroundRepeat = 'no-repeat';

    button.disabled = !pendingAction || pendingAction.mode !== 'select';

    const selectionIndex = pendingAction ? pendingAction.selected.indexOf(index) : -1;
    if (selectionIndex !== -1) {
      button.classList.add('selected');

      // If Competition action, display Pair 1 or Pair 2 badge
      if (pendingAction.type === 'competition') {
        const badge = document.createElement('span');
        badge.className = `pair-badge ${selectionIndex < 2 ? 'pair-1' : 'pair-2'}`;
        badge.textContent = selectionIndex < 2 ? 'Pair 1' : 'Pair 2';
        button.appendChild(badge);
      }
    }

    button.addEventListener('click', () => handleCardClick(index));
    elements.handList.appendChild(button);
  });
}

function buildOfferPanel() {
  elements.offerPanel.innerHTML = '';
  elements.offerPanel.classList.add('hidden');

  if (!offerChoices || transition) {
    return;
  }

  elements.offerPanel.classList.remove('hidden');
  const title = document.createElement('p');
  title.className = 'offer-title';
  title.textContent = offerChoices.title;
  elements.offerPanel.appendChild(title);

  offerChoices.options.forEach((option, index) => {
    const button = document.createElement('button');
    button.className = 'offer-button';
    button.type = 'button';
    button.textContent = option.label;
    button.addEventListener('click', () => offerChoices.handler(index));
    elements.offerPanel.appendChild(button);
  });
}

function buildResultPanel() {
  elements.resultPanel.innerHTML = '';
  elements.resultPanel.classList.add('hidden');

  if (!Game.state.gameOver) {
    return;
  }

  elements.resultPanel.classList.remove('hidden');
  const result = Game.getResultSummary();

  const heading = document.createElement('h2');
  heading.textContent = 'Game Over';

  const p1SecretName = result.player1.secretCard ? `${CARD_ICONS[result.player1.secretCard]} ${Game.cardName(result.player1.secretCard)} (${Game.cardValue(result.player1.secretCard)} pts)` : 'None';
  const p2SecretName = result.player2.secretCard ? `${CARD_ICONS[result.player2.secretCard]} ${Game.cardName(result.player2.secretCard)} (${Game.cardValue(result.player2.secretCard)} pts)` : 'None';

  let winnerText = 'Tie game!';
  if (result.winner === 1) {
    winnerText = gameMode === 'single' ? '🏆 You won!' : '🏆 Player 1 wins!';
  } else if (result.winner === 2) {
    winnerText = gameMode === 'single' ? '🤖 Computer won!' : '🏆 Player 2 wins!';
  }

  const p2Name = isComputer(2) ? 'Computer' : 'Player 2';

  const details = document.createElement('div');
  details.className = 'result-details';
  details.innerHTML = `
    <div class="result-winner">${winnerText}</div>
    <div class="result-stats">
      <div class="result-col">
        <h3>${gameMode === 'single' ? 'You' : 'Player 1'}</h3>
        <p><strong>Charm Points:</strong> ${result.player1.score}</p>
        <p><strong>Geishas Won:</strong> ${result.player1.geishaCount} / 7</p>
        <p><strong>Revealed Secret:</strong> ${p1SecretName}</p>
      </div>
      <div class="result-col">
        <h3>${p2Name}</h3>
        <p><strong>Charm Points:</strong> ${result.player2.score}</p>
        <p><strong>Geishas Won:</strong> ${result.player2.geishaCount} / 7</p>
        <p><strong>Revealed Secret:</strong> ${p2SecretName}</p>
      </div>
    </div>
  `;

  const restartBtn = document.createElement('button');
  restartBtn.className = 'primary restart-result-btn';
  restartBtn.type = 'button';
  restartBtn.textContent = 'Play Again';
  restartBtn.addEventListener('click', () => showModeSelection());

  elements.resultPanel.appendChild(heading);
  elements.resultPanel.appendChild(details);
  elements.resultPanel.appendChild(restartBtn);
}

function updateActionButtons() {
  const player = Game.state.currentPlayer;
  const transitionActive = Boolean(transition);
  const responsePending = Boolean(offerChoices);
  const isAITurn = gameMode === 'single' && Game.state.currentPlayer === 2 && !responsePending;

  elements.secretButton.disabled = !Game.canUseAction(player, 'secret') || Game.state.gameOver || Boolean(pendingAction) || transitionActive || responsePending || isAITurn;
  elements.tradeoffButton.disabled = !Game.canUseAction(player, 'tradeoff') || Game.state.gameOver || Boolean(pendingAction) || transitionActive || responsePending || isAITurn;
  elements.giftButton.disabled = !Game.canUseAction(player, 'gift') || Game.state.gameOver || Boolean(pendingAction) || transitionActive || responsePending || isAITurn;
  elements.competitionButton.disabled = !Game.canUseAction(player, 'competition') || Game.state.gameOver || Boolean(pendingAction) || transitionActive || responsePending || isAITurn;
  elements.confirmButton.disabled = !pendingAction || pendingAction.mode !== 'select' || transitionActive || responsePending || isAITurn;
}

function updateInfoBadges() {
  if (gameMode === 'single') {
    const diff = aiDifficulty.charAt(0).toUpperCase() + aiDifficulty.slice(1);
    elements.gameModeBadge.textContent = `Single Player (${diff})`;
    elements.opponentLabel.textContent = `Computer (${diff} AI)`;
    elements.handLabel.textContent = 'Your Hand';
  } else {
    elements.gameModeBadge.textContent = 'Pass & Play';
    elements.opponentLabel.textContent = `Player ${Game.other(Game.state.currentPlayer)}'s Hand (Hidden)`;
    elements.handLabel.textContent = `Player ${Game.state.currentPlayer}'s Hand`;
  }

  elements.turnBadge.textContent = `Turn ${Math.min(Game.state.turnsTaken + 1, 8)} / 8`;

  if (gameMode === 'single') {
    elements.activePlayerBadge.textContent = Game.state.currentPlayer === 1 ? 'Your Turn' : "Computer's Turn";
  } else {
    elements.activePlayerBadge.textContent = `Player ${Game.state.currentPlayer}'s Turn`;
  }
}

function setPendingAction(actionType) {
  if (Game.state.gameOver) {
    return;
  }

  let max = 1;
  let prompt = '';

  switch (actionType) {
    case 'secret':
      max = 1;
      prompt = 'Select 1 card to set aside in secret (will score at the end of the round).';
      break;
    case 'tradeoff':
      max = 2;
      prompt = 'Select 2 cards to permanently discard from the game (tradeoff).';
      break;
    case 'gift':
      max = 3;
      prompt = 'Select 3 cards to offer: your opponent picks 1 to keep, and you keep the other 2.';
      break;
    case 'competition':
      max = 4;
      prompt = 'Select 4 cards: the 1st & 2nd cards form Pair 1; the 3rd & 4th cards form Pair 2.';
      break;
    default:
      return;
  }

  pendingAction = {
    mode: 'select',
    type: actionType,
    selected: [],
    maxSelection: max,
    prompt
  };

  Game.state.message = prompt;
  offerChoices = null;
  render();
}

function handleCardClick(index) {
  if (!pendingAction || pendingAction.mode !== 'select') {
    return;
  }

  const existingIndex = pendingAction.selected.indexOf(index);
  if (existingIndex >= 0) {
    pendingAction.selected.splice(existingIndex, 1);
  } else if (pendingAction.selected.length < pendingAction.maxSelection) {
    pendingAction.selected.push(index);
  }

  // Update prompt with dynamic feedback for Competition pairing
  if (pendingAction.type === 'competition') {
    const hand = Game.getHand(Game.state.currentPlayer);
    const sel = pendingAction.selected;
    const p1Names = sel.slice(0, 2).map((i) => Game.cardName(hand[i])).join(', ') || '...';
    const p2Names = sel.slice(2, 4).map((i) => Game.cardName(hand[i])).join(', ') || '...';
    Game.state.message = `Pair 1: [${p1Names}] | Pair 2: [${p2Names}] (${sel.length}/4 selected)`;
  }

  render();
}

function confirmSelection() {
  if (!pendingAction || pendingAction.mode !== 'select') {
    return;
  }

  const player = Game.state.currentPlayer;
  const selected = [...pendingAction.selected];

  if (selected.length !== pendingAction.maxSelection) {
    Game.state.message = `Please select exactly ${pendingAction.maxSelection} card(s). Currently selected: ${selected.length}.`;
    render();
    return;
  }

  const actionType = pendingAction.type;

  switch (actionType) {
    case 'secret':
      Game.performSecret(player, selected[0]);
      pendingAction = null;
      if (!Game.state.gameOver) {
        if (gameMode === 'single' && Game.state.currentPlayer === 2) {
          executeAITurn();
        } else {
          showTransition(Game.state.currentPlayer);
        }
      }
      break;
    case 'tradeoff':
      Game.performTradeoff(player, selected);
      pendingAction = null;
      if (!Game.state.gameOver) {
        if (gameMode === 'single' && Game.state.currentPlayer === 2) {
          executeAITurn();
        } else {
          showTransition(Game.state.currentPlayer);
        }
      }
      break;
    case 'gift':
      prepareGiftResponse(player, selected);
      break;
    case 'competition':
      prepareCompetitionResponse(player, selected);
      break;
  }

  render();
}

function prepareGiftResponse(player, selectedIndices) {
  const hand = Game.getHand(player);
  const giftCards = selectedIndices.map((i) => hand[i]);

  pendingAction = null;

  if (gameMode === 'single' && player === 1) {
    // Computer responds to human's Gift offer
    const aiChoice = AI.chooseAIGiftResponse(aiDifficulty, 2, Game.state, giftCards);
    const chosenCard = giftCards[aiChoice];
    Game.performGift(player, selectedIndices, aiChoice);
    Game.state.message = `You offered 3 gifts. Computer took ${CARD_ICONS[chosenCard]} ${Game.cardName(chosenCard)}. You kept the other 2.`;
    pendingAction = null;
    offerChoices = null;

    if (!Game.state.gameOver) {
      if (Game.state.currentPlayer === 2) {
        executeAITurn();
      }
    } else {
      render();
    }
    return;
  }

  // Multiplayer mode: opponent chooses 1 card
  offerChoices = {
    title: `Player ${player} offered 3 cards. Player ${Game.other(player)}, choose 1 card to take:`,
    options: giftCards.map((card) => ({
      label: `${CARD_ICONS[card]} ${Game.cardName(card)} (${Game.cardValue(card)} pts)`
    })),
    handler: (chosenOfferIndex) => {
      Game.performGift(player, selectedIndices, chosenOfferIndex);
      offerChoices = null;
      pendingAction = null;
      if (!Game.state.gameOver) {
        showTransition(Game.state.currentPlayer);
      } else {
        render();
      }
    }
  };

  Game.state.message = `Player ${Game.other(player)} is choosing from the offered cards.`;
  showTransition(Game.other(player));
}

function prepareCompetitionResponse(player, selectedIndices) {
  const hand = Game.getHand(player);
  const firstPair = [hand[selectedIndices[0]], hand[selectedIndices[1]]];
  const secondPair = [hand[selectedIndices[2]], hand[selectedIndices[3]]];

  pendingAction = null;

  if (gameMode === 'single' && player === 1) {
    // Computer responds to human's Competition split
    const aiChoice = AI.chooseAICompetitionResponse(aiDifficulty, 2, Game.state, firstPair, secondPair);
    Game.performCompetition(player, selectedIndices, aiChoice);
    Game.state.message = `You offered 2 pairs. Computer chose Pair ${aiChoice}. You kept the remaining pair.`;
    pendingAction = null;
    offerChoices = null;

    if (!Game.state.gameOver) {
      if (Game.state.currentPlayer === 2) {
        executeAITurn();
      }
    } else {
      render();
    }
    return;
  }

  // Multiplayer mode: opponent chooses Pair 1 or Pair 2
  offerChoices = {
    title: `Player ${player} offered 2 pairs. Player ${Game.other(player)}, choose 1 pair to take:`,
    options: [
      {
        label: `Pair 1: ${CARD_ICONS[firstPair[0]]} ${Game.cardName(firstPair[0])} (${Game.cardValue(firstPair[0])}p) + ${CARD_ICONS[firstPair[1]]} ${Game.cardName(firstPair[1])} (${Game.cardValue(firstPair[1])}p)`
      },
      {
        label: `Pair 2: ${CARD_ICONS[secondPair[0]]} ${Game.cardName(secondPair[0])} (${Game.cardValue(secondPair[0])}p) + ${CARD_ICONS[secondPair[1]]} ${Game.cardName(secondPair[1])} (${Game.cardValue(secondPair[1])}p)`
      }
    ],
    handler: (chosenPairIndex) => {
      Game.performCompetition(player, selectedIndices, chosenPairIndex + 1);
      offerChoices = null;
      pendingAction = null;
      if (!Game.state.gameOver) {
        showTransition(Game.state.currentPlayer);
      } else {
        render();
      }
    }
  };

  Game.state.message = `Player ${Game.other(player)} is choosing between the two pairs.`;
  showTransition(Game.other(player));
}

function render() {
  updateInfoBadges();
  updateStatus();
  buildOpponentHand();
  buildBoard();
  buildDeck();
  buildHand();
  buildOfferPanel();
  buildResultPanel();
  updateActionButtons();

  if (transition) {
    elements.transitionTitle.textContent = transition.title;
    elements.transitionText.textContent = transition.text;
    elements.transitionScreen.classList.remove('hidden');
  } else {
    elements.transitionScreen.classList.add('hidden');
  }
}

function restartGame() {
  if (gameMode === null) {
    showModeSelection();
    return;
  }
  startNewGame(gameMode, aiDifficulty);
}

export function startApp() {
  showModeSelection();

  elements.aiCasualButton.addEventListener('click', () => startNewGame('single', 'easy'));
  elements.aiTacticalButton.addEventListener('click', () => startNewGame('single', 'medium'));
  elements.aiMasterButton.addEventListener('click', () => startNewGame('single', 'hard'));
  elements.multiplayerButton.addEventListener('click', () => startNewGame('multi'));

  elements.secretButton.addEventListener('click', () => setPendingAction('secret'));
  elements.tradeoffButton.addEventListener('click', () => setPendingAction('tradeoff'));
  elements.giftButton.addEventListener('click', () => setPendingAction('gift'));
  elements.competitionButton.addEventListener('click', () => setPendingAction('competition'));
  elements.confirmButton.addEventListener('click', () => confirmSelection());
  elements.restartButton.addEventListener('click', () => restartGame());
  elements.transitionButton.addEventListener('click', () => acknowledgeTransition());
}
