import test from 'node:test';
import assert from 'node:assert/strict';
import * as Game from '../docs/src/game.js';
import * as AI from '../docs/src/ai.js';

test('AI returns valid action and indices across all difficulties', () => {
  for (const diff of ['easy', 'medium', 'hard']) {
    Game.startGame();
    // Simulate player 1 taking turn 1
    Game.performSecret(1, 0);

    // AI is player 2
    const decision = AI.chooseAIAction(diff, 2, Game.state);
    assert.ok(['secret', 'tradeoff', 'gift', 'competition'].includes(decision.action));
    assert.ok(Array.isArray(decision.selected));

    const expectedCount = decision.action === 'secret' ? 1
      : decision.action === 'tradeoff' ? 2
      : decision.action === 'gift' ? 3 : 4;
    assert.equal(decision.selected.length, expectedCount);

    // Indices must be unique and within hand bounds
    const hand = Game.getHand(2);
    const unique = new Set(decision.selected);
    assert.equal(unique.size, expectedCount);
    for (const idx of decision.selected) {
      assert.ok(idx >= 0 && idx < hand.length);
    }
  }
});

test('AI Gift response returns valid card choice', () => {
  for (const diff of ['easy', 'medium', 'hard']) {
    Game.startGame();
    const offered = [1, 5, 7]; // Burger (2), Sunglasses (3), Smartphone (5)
    const choice = AI.chooseAIGiftResponse(diff, 2, Game.state, offered);
    assert.ok([0, 1, 2].includes(choice));
  }
});

test('Hard and Medium AI prioritize taking higher value card or winning geisha in gift response', () => {
  Game.startGame();
  const offered = [1, 2, 7]; // Burger (2), Chips (2), Smartphone (5)
  // Both medium and hard AI should take card 7 (Smartphone, 5 pts) when everything is neutral
  const choiceHard = AI.chooseAIGiftResponse('hard', 2, Game.state, offered);
  const choiceMedium = AI.chooseAIGiftResponse('medium', 2, Game.state, offered);
  assert.equal(choiceHard, 2); // index 2 corresponds to card 7 (5 pts)
  assert.equal(choiceMedium, 2);
});

test('AI Competition response returns pair 1 or 2', () => {
  for (const diff of ['easy', 'medium', 'hard']) {
    Game.startGame();
    const pair1 = [7, 6]; // 5 pts + 4 pts = 9 pts
    const pair2 = [1, 2]; // 2 pts + 2 pts = 4 pts
    const choice = AI.chooseAICompetitionResponse(diff, 2, Game.state, pair1, pair2);
    assert.ok([1, 2].includes(choice));
    if (diff === 'hard' || diff === 'medium') {
      // Should choose pair 1 with higher value
      assert.equal(choice, 1);
    }
  }
});

test('Hard AI Competition grouping pairs strategically', () => {
  Game.startGame();
  // Hand with 7 (Phone 5), 6 (Ticket 4), 1 (Burger 2), 2 (Chips 2)
  Game.state.players[2].hand = [7, 6, 2, 1];
  Game.state.players[2].actions = { secret: false, tradeoff: false, gift: false, competition: true };

  const decision = AI.chooseAIAction('hard', 2, Game.state);
  assert.equal(decision.action, 'competition');
  assert.equal(decision.selected.length, 4);
});

test('AI evaluates preserved geishalove carryover in Round 2', () => {
  Game.startGame();
  // In Round 1, neutral board: Pair 1 ([7, 1] = 5+2 = 7 pts) beats Pair 2 ([4, 2] = 3+2 = 5 pts)
  const choiceR1 = AI.chooseAICompetitionResponse('hard', 2, Game.state, [7, 1], [4, 2]);
  assert.equal(choiceR1, 1);

  // In Round 2: AI already owns Geishas 1, 2, 3 from Round 1
  Game.state.round = 2;
  Game.state.geishalove = [0, 2, 2, 2, 0, 0, 0, 0];
  // Player 1 has 1 gift on card 7 (so AI taking 7 only ties at 1-1, yielding 0 geishas)
  Game.state.geishagifts[1][7] = 1;

  // Pair 2 contains card 4 (uncontested), which grants AI their 4th geisha and instant game win!
  const choiceR2 = AI.chooseAICompetitionResponse('hard', 2, Game.state, [7, 1], [4, 2]);
  assert.equal(choiceR2, 2);
});
