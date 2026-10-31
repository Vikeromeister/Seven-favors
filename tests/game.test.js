import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../docs/src/game.js';

test('Game setup and initialization', () => {
  Game.startGame();

  assert.equal(Game.state.currentPlayer, 1);
  assert.equal(Game.state.turnsTaken, 0);
  assert.equal(Game.state.gameOver, false);
  assert.equal(Game.state.winner, 0);

  // Player 1 has 6 dealt + 1 drawn = 7 cards
  assert.equal(Game.getHand(1).length, 7);
  // Player 2 has 6 dealt = 6 cards
  assert.equal(Game.getHand(2).length, 6);
  // Deck: 21 - 12 dealt - 1 drawn = 8 cards remaining
  assert.equal(Game.state.deck.length, 8);

  // Actions available
  for (const player of [1, 2]) {
    assert.equal(Game.canUseAction(player, 'secret'), true);
    assert.equal(Game.canUseAction(player, 'tradeoff'), true);
    assert.equal(Game.canUseAction(player, 'gift'), true);
    assert.equal(Game.canUseAction(player, 'competition'), true);
  }

  // 7 Geishas
  const rows = Game.getGeishaRows();
  assert.equal(rows.length, 7);
  for (let i = 0; i < 7; i++) {
    assert.equal(rows[i].id, i + 1);
    assert.equal(rows[i].player1, 0);
    assert.equal(rows[i].player2, 0);
  }
});

test('Card definitions and deck counts match rules', () => {
  const expectedValues = [0, 2, 2, 2, 3, 3, 4, 5];
  for (let id = 1; id <= 7; id++) {
    assert.equal(Game.cardValue(id), expectedValues[id]);
    assert.ok(Game.cardName(id).length > 0);
    assert.notEqual(Game.cardName(id), 'unknown');
  }
  assert.equal(Game.cardValue(0), 0);
});

test('Action: Secret sets aside card and advances turn', () => {
  Game.startGame();
  const initialHand = Game.getHand(1);
  const cardToSecret = initialHand[0];

  const success = Game.performSecret(1, 0);
  assert.equal(success, true);
  assert.equal(Game.canUseAction(1, 'secret'), false);
  assert.equal(Game.state.secretCard[1], cardToSecret);
  assert.equal(Game.getHand(1).length, 6);

  // Turn advanced to Player 2, who drew 1 card (6 + 1 = 7)
  assert.equal(Game.state.currentPlayer, 2);
  assert.equal(Game.state.turnsTaken, 1);
  assert.equal(Game.getHand(2).length, 7);

  // Cannot perform secret twice
  assert.equal(Game.performSecret(1, 0), false);
  // Cannot perform with out of range index
  assert.equal(Game.performSecret(2, 99), false);
});

test('Action: Tradeoff discards 2 cards and advances turn', () => {
  Game.startGame();
  // Valid tradeoff
  const success = Game.performTradeoff(1, [0, 1]);
  assert.equal(success, true);
  assert.equal(Game.canUseAction(1, 'tradeoff'), false);
  assert.equal(Game.getHand(1).length, 5);

  assert.equal(Game.state.currentPlayer, 2);
  assert.equal(Game.state.turnsTaken, 1);

  // Rejects duplicate indices or invalid counts
  assert.equal(Game.performTradeoff(2, [0, 0]), false);
  assert.equal(Game.performTradeoff(2, [0]), false);
  assert.equal(Game.performTradeoff(2, [0, 1, 2]), false);
  assert.equal(Game.performTradeoff(2, [0, 99]), false);
});

test('Action: Gift distributes 1 card to opponent and 2 cards to active player', () => {
  Game.startGame();
  Game.state.players[1].hand = [7, 6, 5, 4, 3, 2, 1];

  // Rejects invalid inputs without mutating hand
  assert.equal(Game.performGift(1, [0, 1, 1], 0), false);
  assert.equal(Game.getHand(1).length, 7);
  assert.equal(Game.performGift(1, [0, 1, 2], 3), false); // chosenOfferIndex must be 0, 1, or 2
  assert.equal(Game.getHand(1).length, 7);

  // Player 1 offers cards at indices [0, 1, 2] -> values [7, 6, 5]
  // Opponent picks index 1 (card 6)
  const success = Game.performGift(1, [0, 1, 2], 1);
  assert.equal(success, true);
  assert.equal(Game.canUseAction(1, 'gift'), false);

  // Opponent (player 2) should get card 6
  assert.equal(Game.state.geishagifts[2][6], 1);
  // Player 1 should get card 7 and card 5
  assert.equal(Game.state.geishagifts[1][7], 1);
  assert.equal(Game.state.geishagifts[1][5], 1);
});

test('Action: Competition distributes chosen pair to opponent and other pair to player', () => {
  Game.startGame();
  Game.state.players[1].hand = [7, 6, 5, 4, 3, 2, 1];

  // Rejects duplicates or invalid pair selection
  assert.equal(Game.performCompetition(1, [0, 1, 2, 2], 1), false);
  assert.equal(Game.performCompetition(1, [0, 1, 2, 3], 3), false);

  // Pair 1: indices [0, 1] -> [7, 6]; Pair 2: indices [2, 3] -> [5, 4]
  // Opponent chooses Pair 1
  const success = Game.performCompetition(1, [0, 1, 2, 3], 1);
  assert.equal(success, true);
  assert.equal(Game.canUseAction(1, 'competition'), false);

  // Opponent (player 2) chose pair 1 -> cards [7, 6]
  assert.equal(Game.state.geishagifts[2][7], 1);
  assert.equal(Game.state.geishagifts[2][6], 1);
  // Player 1 gets remaining pair 2 -> cards [5, 4]
  assert.equal(Game.state.geishagifts[1][5], 1);
  assert.equal(Game.state.geishagifts[1][4], 1);
});

test('Endgame rule: 11+ points takes precedence over 4 geishas', () => {
  Game.startGame();
  // Turn 1-6
  Game.performSecret(1, 0);
  Game.performSecret(2, 0);
  Game.performTradeoff(1, [0, 1]);
  Game.performTradeoff(2, [0, 1]);
  Game.performGift(1, [0, 1, 2], 0);
  Game.performGift(2, [0, 1, 2], 0);

  // Force geisha gifts: Player 1 has four 2-3 pt geishas (IDs 1, 2, 3, 4 -> 9 pts)
  // Player 2 has IDs 5, 6, 7 (3+4+5 = 12 pts)
  Game.state.geishagifts[1] = [0, 2, 2, 2, 3, 0, 0, 0];
  Game.state.geishagifts[2] = [0, 0, 0, 0, 0, 3, 4, 5];
  Game.state.secretCard = [null, 1, 7]; // P1 gets +1 to ID 1, P2 gets +1 to ID 7

  // Complete turn 7 and 8
  Game.performCompetition(1, [0, 1, 2, 3], 1);
  Game.performCompetition(2, [0, 1, 2, 3], 1);

  assert.equal(Game.state.gameOver, true);
  // Under official rules, Player 2 (with 12 pts >= 11) must win over Player 1 (with 4 geishas)
  assert.equal(Game.state.winner, 2);
});

test('Full round: 8 turns triggers endgame scoring', () => {
  Game.startGame();

  // Turn 1 (P1): Secret
  Game.performSecret(1, 0);
  // Turn 2 (P2): Secret
  Game.performSecret(2, 0);
  // Turn 3 (P1): Tradeoff
  Game.performTradeoff(1, [0, 1]);
  // Turn 4 (P2): Tradeoff
  Game.performTradeoff(2, [0, 1]);
  // Turn 5 (P1): Gift
  Game.performGift(1, [0, 1, 2], 0);
  // Turn 6 (P2): Gift
  Game.performGift(2, [0, 1, 2], 0);
  // Turn 7 (P1): Competition
  Game.performCompetition(1, [0, 1, 2, 3], 1);
  // Turn 8 (P2): Competition
  Game.performCompetition(2, [0, 1, 2, 3], 1);

  assert.equal(Game.state.turnsTaken, 8);
  assert.equal(Game.state.gameOver, true);
  assert.ok([0, 1, 2].includes(Game.state.winner));

  const summary = Game.getResultSummary();
  assert.ok(typeof summary.player1.score === 'number');
  assert.ok(typeof summary.player2.score === 'number');
  assert.ok(typeof summary.player1.geishaCount === 'number');
  assert.ok(typeof summary.player2.geishaCount === 'number');
  assert.equal(summary.round, 1);
  assert.equal(summary.roundStarter, 1);
});

test('Multi-round tie continuation preserves geishalove and alternates starting player', () => {
  Game.startGame();
  // Guard: cannot start next round before current round is over
  assert.equal(Game.startNextRound(), false);

  // Setup tied end of round 1:
  // Player 1 wins Geisha 1 (2 pts), Player 2 wins Geisha 2 (2 pts), all others tied at 0
  Game.state.geishagifts[1] = [0, 2, 0, 0, 0, 0, 0, 0];
  Game.state.geishagifts[2] = [0, 0, 2, 0, 0, 0, 0, 0];
  Game.state.secretCard = [null, null, null];
  Game.state.turnsTaken = 8;
  Game.computeEndgame();
  Game.state.gameOver = true;

  assert.equal(Game.state.winner, 0); // Tie: both have 2 pts and 1 geisha
  assert.equal(Game.state.geishalove[1], 1);
  assert.equal(Game.state.geishalove[2], 2);
  assert.equal(Game.state.round, 1);

  const rowsR1 = Game.getGeishaRows();
  assert.equal(rowsR1[0].owner, 1);
  assert.equal(rowsR1[1].owner, 2);
  assert.equal(rowsR1[0].priorOwner, 0);

  // Start round 2
  const started = Game.startNextRound();
  assert.equal(started, true);
  assert.equal(Game.state.round, 2);
  assert.equal(Game.state.roundStarter, 2);
  assert.equal(Game.state.currentPlayer, 2);
  assert.equal(Game.state.turnsTaken, 0);
  assert.equal(Game.state.gameOver, false);

  // P2 drew 1 card (6 + 1 = 7), P1 has 6
  assert.equal(Game.getHand(2).length, 7);
  assert.equal(Game.getHand(1).length, 6);

  // Preserved geishalove
  assert.equal(Game.state.geishalove[1], 1);
  assert.equal(Game.state.geishalove[2], 2);
  assert.equal(Game.state.priorGeishaLove[1], 1);
  assert.equal(Game.state.priorGeishaLove[2], 2);

  // In Round 2, gifts tied at 0 on Geisha 1 must PRESERVE P1's ownership!
  // Player 1 also wins Geisha 3 (2 pts) and Geisha 4 (3 pts) and Geisha 5 (3 pts) -> 10 pts, 4 geishas -> P1 wins
  Game.state.geishagifts[1] = [0, 0, 0, 2, 2, 2, 0, 0];
  Game.state.geishagifts[2] = [0, 0, 0, 0, 0, 0, 0, 0];
  Game.computeEndgame();

  assert.equal(Game.state.geishalove[1], 1); // Preserved from Round 1
  assert.equal(Game.state.geishalove[2], 2); // Preserved from Round 1
  assert.equal(Game.state.geishalove[3], 1);
  assert.equal(Game.state.geishalove[4], 1);
  assert.equal(Game.state.geishalove[5], 1);
  assert.equal(Game.state.geishaCount[1], 4);
  assert.equal(Game.state.winner, 1); // P1 wins with 4 geishas

  // Guard: cannot start next round if there is a winner
  Game.state.gameOver = true;
  assert.equal(Game.startNextRound(), false);
});

test('Selectable starting player (1, 2, random), full round with Player 2 starting, and deterministic starter alternation', () => {
  // Explicit Player 1 start
  Game.startGame(1);
  assert.equal(Game.state.round, 1);
  assert.equal(Game.state.roundStarter, 1);
  assert.equal(Game.state.currentPlayer, 1);
  assert.equal(Game.getHand(1).length, 7);
  assert.equal(Game.getHand(2).length, 6);
  assert.equal(Game.state.deck.length, 8);

  // Explicit Player 2 start + full 8-turn round completion
  Game.startGame(2);
  assert.equal(Game.state.round, 1);
  assert.equal(Game.state.roundStarter, 2);
  assert.equal(Game.state.currentPlayer, 2);
  assert.equal(Game.getHand(2).length, 7);
  assert.equal(Game.getHand(1).length, 6);
  assert.equal(Game.state.deck.length, 8);

  assert.equal(Game.performSecret(2, 0), true);
  assert.equal(Game.state.currentPlayer, 1);
  assert.equal(Game.performSecret(1, 0), true);
  assert.equal(Game.state.currentPlayer, 2);
  assert.equal(Game.performTradeoff(2, [0, 1]), true);
  assert.equal(Game.performTradeoff(1, [0, 1]), true);
  assert.equal(Game.performGift(2, [0, 1, 2], 0), true);
  assert.equal(Game.performGift(1, [0, 1, 2], 0), true);
  assert.equal(Game.performCompetition(2, [0, 1, 2, 3], 1), true);
  assert.equal(Game.performCompetition(1, [0, 1, 2, 3], 1), true);

  assert.equal(Game.state.turnsTaken, 8);
  assert.equal(Game.state.gameOver, true);
  assert.equal(Game.getResultSummary().roundStarter, 2);

  // Deterministic 2 -> 1 -> 2 alternation across tied rounds
  Game.startGame(2);
  Game.state.geishagifts[1] = [0, 2, 0, 0, 0, 0, 0, 0];
  Game.state.geishagifts[2] = [0, 0, 2, 0, 0, 0, 0, 0];
  Game.state.secretCard = [null, null, null];
  Game.state.turnsTaken = 8;
  Game.computeEndgame();
  Game.state.gameOver = true;
  assert.equal(Game.state.winner, 0);

  assert.equal(Game.startNextRound(), true);
  assert.equal(Game.state.round, 2);
  assert.equal(Game.state.roundStarter, 1);
  assert.equal(Game.state.currentPlayer, 1);
  assert.equal(Game.getHand(1).length, 7);
  assert.equal(Game.getHand(2).length, 6);

  // Tie again in Round 2 -> Round 3 alternates back to Player 2
  Game.state.turnsTaken = 8;
  Game.computeEndgame();
  Game.state.gameOver = true;
  assert.equal(Game.state.winner, 0);

  assert.equal(Game.startNextRound(), true);
  assert.equal(Game.state.round, 3);
  assert.equal(Game.state.roundStarter, 2);
  assert.equal(Game.state.currentPlayer, 2);
  assert.equal(Game.getHand(2).length, 7);
  assert.equal(Game.getHand(1).length, 6);

  // Random starter resolves to concrete 1 or 2 and alternates deterministically thereafter
  for (let i = 0; i < 30; i++) {
    Game.startGame('random');
    const r1Starter = Game.state.roundStarter;
    assert.ok(r1Starter === 1 || r1Starter === 2);
    assert.equal(Game.state.currentPlayer, r1Starter);
    assert.equal(Game.getHand(r1Starter).length, 7);
    assert.equal(Game.getHand(Game.other(r1Starter)).length, 6);

    Game.state.geishagifts[1] = [0, 2, 0, 0, 0, 0, 0, 0];
    Game.state.geishagifts[2] = [0, 0, 2, 0, 0, 0, 0, 0];
    Game.state.secretCard = [null, null, null];
    Game.state.turnsTaken = 8;
    Game.computeEndgame();
    Game.state.gameOver = true;

    assert.equal(Game.startNextRound(), true);
    assert.equal(Game.state.roundStarter, Game.other(r1Starter));
    assert.equal(Game.state.currentPlayer, Game.other(r1Starter));

    Game.state.turnsTaken = 8;
    Game.computeEndgame();
    Game.state.gameOver = true;

    assert.equal(Game.startNextRound(), true);
    assert.equal(Game.state.roundStarter, r1Starter);
    assert.equal(Game.state.currentPlayer, r1Starter);
  }
});
