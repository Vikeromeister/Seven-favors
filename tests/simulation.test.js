import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../docs/src/game.js';
import * as AI from '../docs/src/ai.js';

test('Simulate 50 AI vs AI games across all difficulty combinations', () => {
  const difficulties = ['easy', 'medium', 'hard'];

  for (let i = 0; i < 50; i++) {
    const p1Diff = difficulties[i % 3];
    const p2Diff = difficulties[(i + 1) % 3];

    Game.startGame();

    while (!Game.state.gameOver && Game.state.turnsTaken < 8) {
      const activePlayer = Game.state.currentPlayer;
      const diff = activePlayer === 1 ? p1Diff : p2Diff;

      const decision = AI.chooseAIAction(diff, activePlayer, Game.state);
      assert.ok(decision, `Player ${activePlayer} must have a valid move at turn ${Game.state.turnsTaken}`);

      const { action, selected } = decision;

      if (action === 'secret') {
        const ok = Game.performSecret(activePlayer, selected[0]);
        assert.equal(ok, true);
      } else if (action === 'tradeoff') {
        const ok = Game.performTradeoff(activePlayer, selected);
        assert.equal(ok, true);
      } else if (action === 'gift') {
        const hand = Game.getHand(activePlayer);
        const giftCards = selected.map((idx) => hand[idx]);
        const otherPlayer = Game.other(activePlayer);
        const otherDiff = otherPlayer === 1 ? p1Diff : p2Diff;
        const chosenCardIdx = AI.chooseAIGiftResponse(otherDiff, otherPlayer, Game.state, giftCards);

        const ok = Game.performGift(activePlayer, selected, chosenCardIdx);
        assert.equal(ok, true);
      } else if (action === 'competition') {
        const hand = Game.getHand(activePlayer);
        const firstPair = [hand[selected[0]], hand[selected[1]]];
        const secondPair = [hand[selected[2]], hand[selected[3]]];
        const otherPlayer = Game.other(activePlayer);
        const otherDiff = otherPlayer === 1 ? p1Diff : p2Diff;
        const chosenPair = AI.chooseAICompetitionResponse(otherDiff, otherPlayer, Game.state, firstPair, secondPair);

        const ok = Game.performCompetition(activePlayer, selected, chosenPair);
        assert.equal(ok, true);
      }
    }

    assert.equal(Game.state.gameOver, true);
    assert.equal(Game.state.turnsTaken, 8);
    assert.ok([0, 1, 2].includes(Game.state.winner));

    const summary = Game.getResultSummary();
    assert.ok(summary.player1.score >= 0);
    assert.ok(summary.player2.score >= 0);
    assert.ok(summary.player1.geishaCount >= 0);
    assert.ok(summary.player2.geishaCount >= 0);
    assert.ok(summary.player1.geishaCount + summary.player2.geishaCount <= 7);
  }
});
