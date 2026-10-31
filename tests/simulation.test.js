import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../docs/src/game.js';
import * as AI from '../docs/src/ai.js';

test('Simulate 50 AI vs AI games across all difficulty combinations', () => {
  const difficulties = ['easy', 'medium', 'hard'];
  const starters = [1, 2, 'random'];

  for (let i = 0; i < 50; i++) {
    const p1Diff = difficulties[i % 3];
    const p2Diff = difficulties[(i + 1) % 3];
    const starterPref = starters[i % 3];

    Game.startGame(starterPref);
    if (starterPref !== 'random') {
      assert.equal(Game.state.roundStarter, starterPref);
      assert.equal(Game.state.currentPlayer, starterPref);
    } else {
      assert.ok([1, 2].includes(Game.state.roundStarter));
      assert.equal(Game.state.currentPlayer, Game.state.roundStarter);
    }

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
    assert.ok([1, 2].includes(summary.roundStarter));
  }
});

test('Multi-round tie simulation continues rounds until a decisive winner is reached', () => {
  const difficulties = ['easy', 'medium', 'hard'];
  const starters = [1, 2, 'random'];

  function playOneRound(p1Diff, p2Diff) {
    while (!Game.state.gameOver && Game.state.turnsTaken < 8) {
      const activePlayer = Game.state.currentPlayer;
      const diff = activePlayer === 1 ? p1Diff : p2Diff;

      const decision = AI.chooseAIAction(diff, activePlayer, Game.state);
      assert.ok(decision);
      const { action, selected } = decision;

      if (action === 'secret') {
        assert.equal(Game.performSecret(activePlayer, selected[0]), true);
      } else if (action === 'tradeoff') {
        assert.equal(Game.performTradeoff(activePlayer, selected), true);
      } else if (action === 'gift') {
        const hand = Game.getHand(activePlayer);
        const giftCards = selected.map((idx) => hand[idx]);
        const otherPlayer = Game.other(activePlayer);
        const otherDiff = otherPlayer === 1 ? p1Diff : p2Diff;
        const chosenCardIdx = AI.chooseAIGiftResponse(otherDiff, otherPlayer, Game.state, giftCards);
        assert.equal(Game.performGift(activePlayer, selected, chosenCardIdx), true);
      } else if (action === 'competition') {
        const hand = Game.getHand(activePlayer);
        const firstPair = [hand[selected[0]], hand[selected[1]]];
        const secondPair = [hand[selected[2]], hand[selected[3]]];
        const otherPlayer = Game.other(activePlayer);
        const otherDiff = otherPlayer === 1 ? p1Diff : p2Diff;
        const chosenPair = AI.chooseAICompetitionResponse(otherDiff, otherPlayer, Game.state, firstPair, secondPair);
        assert.equal(Game.performCompetition(activePlayer, selected, chosenPair), true);
      }
    }
  }

  for (let match = 0; match < 30; match++) {
    const p1Diff = difficulties[match % 3];
    const p2Diff = difficulties[(match + 1) % 3];
    const starterPref = starters[match % 3];

    Game.startGame(starterPref);
    const r1Starter = Game.state.roundStarter;
    if (starterPref !== 'random') {
      assert.equal(r1Starter, starterPref);
    } else {
      assert.ok([1, 2].includes(r1Starter));
    }
    playOneRound(p1Diff, p2Diff);

    let roundsPlayed = 1;
    while (Game.state.winner === 0 && roundsPlayed < 10) {
      const prevStarter = Game.state.roundStarter;
      const prevRound = Game.state.round;
      const ok = Game.startNextRound();
      assert.equal(ok, true);
      assert.equal(Game.state.round, prevRound + 1);
      assert.equal(Game.state.roundStarter, Game.other(prevStarter));
      assert.equal(Game.state.currentPlayer, Game.other(prevStarter));

      playOneRound(p1Diff, p2Diff);
      roundsPlayed += 1;
    }

    assert.equal(Game.state.gameOver, true);
    assert.ok([1, 2].includes(Game.state.winner));
    const summary = Game.getResultSummary();
    assert.ok(summary.winner === 1 || summary.winner === 2);
    assert.equal(summary.round, roundsPlayed);
    const expectedFinalStarter = roundsPlayed % 2 === 1 ? r1Starter : Game.other(r1Starter);
    assert.equal(summary.roundStarter, expectedFinalStarter);
  }
});
