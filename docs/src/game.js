const CARD_NAMES = [
  '',
  'Burger',
  'Chips',
  'Fidget Spinner',
  'Cardigan',
  'Sunglasses',
  'Concert Ticket',
  'Smartphone'
];
const CARD_VALUES = [0, 2, 2, 2, 3, 3, 4, 5];
const INITIAL_DECK = [1, 1, 2, 2, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 7];

export const state = {
  deck: [],
  currentPlayer: 1,
  turnsTaken: 0,
  players: {
    1: {
      hand: [],
      actions: {
        secret: true,
        tradeoff: true,
        gift: true,
        competition: true
      }
    },
    2: {
      hand: [],
      actions: {
        secret: true,
        tradeoff: true,
        gift: true,
        competition: true
      }
    }
  },
  geishagifts: [null, Array(8).fill(0), Array(8).fill(0)],
  secretCard: [null, null, null],
  geishalove: Array(8).fill(0),
  scores: [0, 0, 0],
  geishaCount: [0, 0, 0],
  gameOver: false,
  winner: 0,
  message: ''
};

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function other(player) {
  return player === 1 ? 2 : 1;
}

function sortHand(hand) {
  hand.sort((a, b) => b - a);
}

export function cardName(code) {
  return CARD_NAMES[code] || 'unknown';
}

export function cardValue(code) {
  return CARD_VALUES[code] || 0;
}

export function resetGame() {
  state.deck = shuffle(INITIAL_DECK);
  state.currentPlayer = 1;
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
  state.geishalove = Array(8).fill(0);
  state.scores = [0, 0, 0];
  state.geishaCount = [0, 0, 0];
  state.gameOver = false;
  state.winner = 0;
  state.message = 'The game has started. Player 1 goes first.';
}

export function startGame() {
  resetGame();
  drawCard(state.currentPlayer);
}

export function drawCard(player) {
  if (state.deck.length === 0) {
    return;
  }
  const card = state.deck.shift();
  state.players[player].hand.push(card);
  sortHand(state.players[player].hand);
}

export function getHand(player) {
  return [...state.players[player].hand];
}

export function canUseAction(player, action) {
  return Boolean(state.players[player]?.actions[action]) && !state.gameOver;
}

function areValidUniqueIndices(indices, maxLen, expectedCount) {
  if (!Array.isArray(indices) || indices.length !== expectedCount) {
    return false;
  }
  const set = new Set();
  for (const idx of indices) {
    if (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0 || idx >= maxLen) {
      return false;
    }
    if (set.has(idx)) {
      return false;
    }
    set.add(idx);
  }
  return true;
}

function removeCardsFromHand(hand, indexes) {
  const sorted = [...indexes].sort((a, b) => b - a);
  const removed = [];
  for (const index of sorted) {
    if (index >= 0 && index < hand.length) {
      removed.unshift(hand.splice(index, 1)[0]);
    }
  }
  return removed;
}

function advanceTurn() {
  state.turnsTaken += 1;
  if (state.turnsTaken >= 8) {
    finishGame();
    return;
  }
  state.currentPlayer = other(state.currentPlayer);
  drawCard(state.currentPlayer);
}

export function performSecret(player, cardIndex) {
  const hand = state.players[player]?.hand;
  if (!hand || !state.players[player].actions.secret || cardIndex < 0 || cardIndex >= hand.length) {
    return false;
  }
  const card = hand.splice(cardIndex, 1)[0];
  state.secretCard[player] = card;
  state.players[player].actions.secret = false;
  state.message = `Player ${player} set aside a secret card.`;
  advanceTurn();
  return true;
}

export function performTradeoff(player, cardIndexes) {
  const hand = state.players[player]?.hand;
  if (!hand || !state.players[player].actions.tradeoff || !areValidUniqueIndices(cardIndexes, hand.length, 2)) {
    return false;
  }
  removeCardsFromHand(hand, cardIndexes);
  state.players[player].actions.tradeoff = false;
  state.message = `Player ${player} completed tradeoff (2 cards discarded).`;
  advanceTurn();
  return true;
}

export function performGift(player, cardIndexes, chosenOfferIndex) {
  const hand = state.players[player]?.hand;
  if (!hand || !state.players[player].actions.gift || !areValidUniqueIndices(cardIndexes, hand.length, 3)) {
    return false;
  }
  if (typeof chosenOfferIndex !== 'number' || chosenOfferIndex < 0 || chosenOfferIndex >= 3) {
    return false;
  }
  const selected = removeCardsFromHand(hand, cardIndexes);
  const opponent = other(player);
  for (let i = 0; i < selected.length; i++) {
    if (i === chosenOfferIndex) {
      state.geishagifts[opponent][selected[i]] += 1;
    } else {
      state.geishagifts[player][selected[i]] += 1;
    }
  }
  state.players[player].actions.gift = false;
  state.message = `Player ${player} completed gift action.`;
  advanceTurn();
  return true;
}

export function performCompetition(player, cardIndexes, chosenPair) {
  const hand = state.players[player]?.hand;
  if (!hand || !state.players[player].actions.competition || !areValidUniqueIndices(cardIndexes, hand.length, 4)) {
    return false;
  }
  if (chosenPair !== 1 && chosenPair !== 2) {
    return false;
  }
  const firstPair = [hand[cardIndexes[0]], hand[cardIndexes[1]]];
  const secondPair = [hand[cardIndexes[2]], hand[cardIndexes[3]]];
  removeCardsFromHand(hand, cardIndexes);

  const opponent = other(player);
  const playerPair = chosenPair === 2 ? firstPair : secondPair;
  const opponentPair = chosenPair === 2 ? secondPair : firstPair;

  for (const card of playerPair) {
    state.geishagifts[player][card] += 1;
  }
  for (const card of opponentPair) {
    state.geishagifts[opponent][card] += 1;
  }
  state.players[player].actions.competition = false;
  state.message = `Player ${player} completed competition. Opponent chose pair ${chosenPair}.`;
  advanceTurn();
  return true;
}

export function computeEndgame() {
  if (state.secretCard[1] !== null) {
    state.geishagifts[1][state.secretCard[1]] += 1;
  }
  if (state.secretCard[2] !== null) {
    state.geishagifts[2][state.secretCard[2]] += 1;
  }
  state.geishalove = Array(8).fill(0);
  state.scores = [0, 0, 0];
  state.geishaCount = [0, 0, 0];
  for (let i = 1; i <= 7; i++) {
    if (state.geishagifts[1][i] > state.geishagifts[2][i]) {
      state.geishalove[i] = 1;
      state.scores[1] += CARD_VALUES[i];
      state.geishaCount[1] += 1;
    } else if (state.geishagifts[2][i] > state.geishagifts[1][i]) {
      state.geishalove[i] = 2;
      state.scores[2] += CARD_VALUES[i];
      state.geishaCount[2] += 1;
    }
  }

  const p1Points = state.scores[1] >= 11;
  const p2Points = state.scores[2] >= 11;
  const p1Geishas = state.geishaCount[1] >= 4;
  const p2Geishas = state.geishaCount[2] >= 4;

  // Official Hanamikoji rule:
  // If one player wins 11+ points and the other wins 4+ geishas,
  // the player with 11+ charm points wins!
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
    state.message = 'Tie game!';
  } else {
    state.message = `Game over! Player ${state.winner} wins.`;
  }
}

export function getGeishaRows() {
  return Array.from({ length: 7 }, (_, index) => {
    const cardId = index + 1;
    return {
      id: cardId,
      name: CARD_NAMES[cardId],
      value: CARD_VALUES[cardId],
      player1: state.geishagifts[1][cardId],
      player2: state.geishagifts[2][cardId],
      owner: state.geishalove[cardId]
    };
  });
}

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
    winner: state.winner
  };
}
