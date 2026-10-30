import { cardValue, other } from './game.js';

function chooseRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Returns combinations of k indices from 0..n-1
 */
function getCombinations(n, k) {
  const results = [];
  function backtrack(start, combo) {
    if (combo.length === k) {
      results.push([...combo]);
      return;
    }
    for (let i = start; i < n; i++) {
      combo.push(i);
      backtrack(i + 1, combo);
      combo.pop();
    }
  }
  backtrack(0, []);
  return results;
}

/**
 * Evaluates the utility of card types for player given current board state
 */
function evaluateCardUtility(player, state) {
  const opp = other(player);
  const utilities = {};

  for (let g = 1; g <= 7; g++) {
    const val = cardValue(g); // also equals total copies in game
    const myGifts = state.geishagifts[player][g];
    const oppGifts = state.geishagifts[opp][g];
    const currentOwner = state.geishalove?.[g] ?? 0;
    const neededToWin = currentOwner === player ? Math.ceil(val / 2) : Math.floor(val / 2) + 1;
    const neededForOpp = currentOwner === opp ? Math.ceil(val / 2) : Math.floor(val / 2) + 1;

    // If already secured by AI
    if (myGifts >= neededToWin) {
      utilities[g] = 0; // extra copies don't change control
    } else if (oppGifts >= neededForOpp) {
      // Already lost to opponent
      utilities[g] = 0;
    } else {
      // Contested geisha
      const margin = myGifts - oppGifts;
      let weight = val * 2;
      // High value geishas (4, 5 pts) or geishas close to winning
      if (myGifts + 1 >= neededToWin) {
        weight += val * 3; // decisive card!
      }
      if (margin < 0 || (margin === 0 && currentOwner === opp)) {
        weight += val; // defensive block
      }
      utilities[g] = weight;
    }
  }

  return utilities;
}

/**
 * Heuristic score of a board state for a player
 */
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

  // Win condition checks
  if (myScore >= 11 || myGeishas >= 4) {
    if (oppScore >= 11 && myScore < 11) {
      // Opponent wins on points tiebreak
      return -5000;
    }
    return 10000 + myScore * 10 + myGeishas * 100;
  }
  if (oppScore >= 11 || oppGeishas >= 4) {
    return -10000 - oppScore * 10 - oppGeishas * 100;
  }

  return (myScore - oppScore) * 15 + (myGeishas - oppGeishas) * 50;
}

/**
 * Choose AI action and card indices based on difficulty
 */
export function chooseAIAction(difficulty, player, state) {
  const hand = [...state.players[player].hand];
  const actions = state.players[player].actions;
  const opp = other(player);

  const availableActions = [];
  if (actions.secret && hand.length >= 1) availableActions.push('secret');
  if (actions.tradeoff && hand.length >= 2) availableActions.push('tradeoff');
  if (actions.gift && hand.length >= 3) availableActions.push('gift');
  if (actions.competition && hand.length >= 4) availableActions.push('competition');

  if (availableActions.length === 0) {
    return null;
  }

  if (difficulty === 'easy') {
    const action = chooseRandom(availableActions);
    const count = action === 'secret' ? 1 : action === 'tradeoff' ? 2 : action === 'gift' ? 3 : 4;
    const allIndices = Array.from({ length: hand.length }, (_, i) => i);
    const selected = shuffle(allIndices).slice(0, count);
    return { action, selected };
  }

  const utilities = evaluateCardUtility(player, state);

  // Map hand indices with utility
  const handWithUtility = hand.map((card, index) => ({
    index,
    card,
    utility: utilities[card] ?? cardValue(card),
    value: cardValue(card)
  }));

  if (difficulty === 'medium') {
    // Medium tactical decision
    let action = chooseRandom(availableActions);

    // Prefer secret if holding a high utility card
    const highUtilityCards = handWithUtility.filter((c) => c.utility >= 6);
    if (availableActions.includes('secret') && highUtilityCards.length > 0 && Math.random() < 0.6) {
      action = 'secret';
    } else if (availableActions.includes('tradeoff') && handWithUtility.some((c) => c.utility === 0) && Math.random() < 0.6) {
      // Prefer tradeoff if holding dead cards
      action = 'tradeoff';
    }

    if (action === 'secret') {
      // Pick highest utility or highest value card
      const sorted = [...handWithUtility].sort((a, b) => b.utility - a.utility || b.value - a.value);
      return { action, selected: [sorted[0].index] };
    }

    if (action === 'tradeoff') {
      // Discard lowest utility cards
      const sorted = [...handWithUtility].sort((a, b) => a.utility - b.utility || a.value - b.value);
      return { action, selected: [sorted[0].index, sorted[1].index] };
    }

    if (action === 'gift') {
      // Pick 3 cards: 1 lower utility bait, 2 higher utility to keep
      const sorted = [...handWithUtility].sort((a, b) => b.utility - a.utility);
      // Give two good cards and one bait
      const selected = [sorted[0].index, sorted[1].index, sorted[sorted.length - 1].index];
      return { action, selected };
    }

    if (action === 'competition') {
      // Pick 4 cards: pair them to balance
      const sorted = [...handWithUtility].sort((a, b) => b.value - a.value);
      const top4 = sorted.slice(0, 4);
      // Pair 1: top4[0] and top4[3], Pair 2: top4[1] and top4[2]
      return {
        action,
        selected: [top4[0].index, top4[3].index, top4[1].index, top4[2].index]
      };
    }
  }

  // --- HARD (MASTER) ---
  // Strategic action selection & minimax calculation
  // Pick action: prefer Tradeoff if holding multiple dead cards, Secret if holding a critical game-deciding card
  let chosenAction = availableActions[0];

  // Evaluate Secret
  let bestSecret = null;
  if (availableActions.includes('secret')) {
    const sorted = [...handWithUtility].sort((a, b) => b.utility - a.utility || b.value - a.value);
    bestSecret = sorted[0].index;
  }

  // Evaluate Tradeoff
  let bestTradeoff = null;
  if (availableActions.includes('tradeoff')) {
    const sorted = [...handWithUtility].sort((a, b) => a.utility - b.utility || a.value - b.value);
    bestTradeoff = [sorted[0].index, sorted[1].index];
  }

  // Evaluate Gift (Maximin)
  let bestGift = null;
  let bestGiftScore = -Infinity;
  if (availableActions.includes('gift')) {
    const combos = getCombinations(hand.length, 3);
    for (const combo of combos) {
      const cards = combo.map((i) => hand[i]);
      // Opponent chooses 1 card that is best for opponent
      let worstCaseForAI = Infinity;

      for (let oppPick = 0; oppPick < 3; oppPick++) {
        const oppCard = cards[oppPick];
        const aiCards = cards.filter((_, idx) => idx !== oppPick);

        const g1 = [...state.geishagifts[1]];
        const g2 = [...state.geishagifts[2]];
        const giftsAI = player === 1 ? g1 : g2;
        const giftsOpp = player === 1 ? g2 : g1;

        giftsOpp[oppCard] += 1;
        for (const c of aiCards) {
          giftsAI[c] += 1;
        }

        const score = scoreBoardState(player, g1, g2, state.secretCard[1], state.secretCard[2], state.geishalove);
        if (score < worstCaseForAI) {
          worstCaseForAI = score;
        }
      }

      if (worstCaseForAI > bestGiftScore) {
        bestGiftScore = worstCaseForAI;
        bestGift = combo;
      }
    }
  }

  // Evaluate Competition (Minimax Partition)
  let bestComp = null;
  let bestCompScore = -Infinity;
  if (availableActions.includes('competition')) {
    const combos = getCombinations(hand.length, 4);
    for (const combo of combos) {
      const c = combo.map((i) => hand[i]);
      // 3 possible pairings of 4 cards:
      // P1: (0,1) vs (2,3)
      // P2: (0,2) vs (1,3)
      // P3: (0,3) vs (1,2)
      const pairings = [
        [combo[0], combo[1], combo[2], combo[3]],
        [combo[0], combo[2], combo[1], combo[3]],
        [combo[0], combo[3], combo[1], combo[2]]
      ];

      for (const pairConfig of pairings) {
        const p1Cards = [hand[pairConfig[0]], hand[pairConfig[1]]];
        const p2Cards = [hand[pairConfig[2]], hand[pairConfig[3]]];

        // Opponent picks either pair 1 or pair 2
        // If opp picks pair 1:
        const g1A = [...state.geishagifts[1]];
        const g2A = [...state.geishagifts[2]];
        const aiA = player === 1 ? g1A : g2A;
        const oppA = player === 1 ? g2A : g1A;
        p1Cards.forEach((card) => { oppA[card] += 1; });
        p2Cards.forEach((card) => { aiA[card] += 1; });
        const scoreIfOppPicks1 = scoreBoardState(player, g1A, g2A, state.secretCard[1], state.secretCard[2], state.geishalove);

        // If opp picks pair 2:
        const g1B = [...state.geishagifts[1]];
        const g2B = [...state.geishagifts[2]];
        const aiB = player === 1 ? g1B : g2B;
        const oppB = player === 1 ? g2B : g1B;
        p2Cards.forEach((card) => { oppB[card] += 1; });
        p1Cards.forEach((card) => { aiB[card] += 1; });
        const scoreIfOppPicks2 = scoreBoardState(player, g1B, g2B, state.secretCard[1], state.secretCard[2], state.geishalove);

        const guaranteedScore = Math.min(scoreIfOppPicks1, scoreIfOppPicks2);
        if (guaranteedScore > bestCompScore) {
          bestCompScore = guaranteedScore;
          bestComp = pairConfig;
        }
      }
    }
  }

  // Priority: if high dead card count, Tradeoff
  const deadCardsCount = handWithUtility.filter((c) => c.utility === 0).length;
  if (availableActions.includes('tradeoff') && deadCardsCount >= 2) {
    return { action: 'tradeoff', selected: bestTradeoff };
  }

  // If holding game-winning secret card (e.g. 5 or 4 points that wins the geisha)
  if (availableActions.includes('secret') && handWithUtility.some((c) => c.utility >= 10)) {
    return { action: 'secret', selected: [bestSecret] };
  }

  // Compare Competition vs Gift if both available
  if (availableActions.includes('competition') && bestCompScore >= (bestGiftScore ?? -Infinity)) {
    return { action: 'competition', selected: bestComp };
  }
  if (availableActions.includes('gift') && bestGift) {
    return { action: 'gift', selected: bestGift };
  }
  if (availableActions.includes('competition') && bestComp) {
    return { action: 'competition', selected: bestComp };
  }
  if (availableActions.includes('secret') && bestSecret !== null) {
    return { action: 'secret', selected: [bestSecret] };
  }
  if (availableActions.includes('tradeoff') && bestTradeoff) {
    return { action: 'tradeoff', selected: bestTradeoff };
  }

  return { action: availableActions[0], selected: [0] };
}

/**
 * Responding to opponent's Gift action
 * Returns the index of the chosen card (0, 1, or 2)
 */
export function chooseAIGiftResponse(difficulty, player, state, giftCards) {
  if (difficulty === 'easy') {
    if (Math.random() < 0.3) {
      return Math.floor(Math.random() * giftCards.length);
    }
    // Simple greedy
    let bestIdx = 0;
    let bestVal = -1;
    giftCards.forEach((card, idx) => {
      const v = cardValue(card);
      if (v > bestVal) {
        bestVal = v;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }

  // Medium and Hard evaluate resulting state
  let bestIndex = 0;
  let bestScore = -Infinity;

  for (let i = 0; i < giftCards.length; i++) {
    const chosenCard = giftCards[i];
    const opponentCards = giftCards.filter((_, idx) => idx !== i);

    const g1 = [...state.geishagifts[1]];
    const g2 = [...state.geishagifts[2]];
    const myGifts = player === 1 ? g1 : g2;
    const oppGifts = player === 1 ? g2 : g1;

    myGifts[chosenCard] += 1;
    for (const c of opponentCards) {
      oppGifts[c] += 1;
    }

    const score = scoreBoardState(player, g1, g2, state.secretCard[1], state.secretCard[2], state.geishalove);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

/**
 * Responding to opponent's Competition action
 * Returns 1 (Pair 1) or 2 (Pair 2)
 */
export function chooseAICompetitionResponse(difficulty, player, state, firstPair, secondPair) {
  if (difficulty === 'easy') {
    if (Math.random() < 0.3) {
      return Math.random() < 0.5 ? 1 : 2;
    }
    const val1 = cardValue(firstPair[0]) + cardValue(firstPair[1]);
    const val2 = cardValue(secondPair[0]) + cardValue(secondPair[1]);
    return val1 >= val2 ? 1 : 2;
  }

  // Medium and Hard evaluate resulting states
  // Choice 1: AI takes firstPair, opponent gets secondPair
  const g1A = [...state.geishagifts[1]];
  const g2A = [...state.geishagifts[2]];
  const myA = player === 1 ? g1A : g2A;
  const oppA = player === 1 ? g2A : g1A;
  firstPair.forEach((c) => { myA[c] += 1; });
  secondPair.forEach((c) => { oppA[c] += 1; });
  const score1 = scoreBoardState(player, g1A, g2A, state.secretCard[1], state.secretCard[2], state.geishalove);

  // Choice 2: AI takes secondPair, opponent gets firstPair
  const g1B = [...state.geishagifts[1]];
  const g2B = [...state.geishagifts[2]];
  const myB = player === 1 ? g1B : g2B;
  const oppB = player === 1 ? g2B : g1B;
  secondPair.forEach((c) => { myB[c] += 1; });
  firstPair.forEach((c) => { oppB[c] += 1; });
  const score2 = scoreBoardState(player, g1B, g2B, state.secretCard[1], state.secretCard[2], state.geishalove);

  return score1 >= score2 ? 1 : 2;
}
