import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const htmlPath = path.resolve('docs/index.html');
const cssPath = path.resolve('docs/src/styles.css');
const uiPath = path.resolve('docs/src/ui.js');

test('index.html contains peek restore button, default random starter, and online 2P elements', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.ok(html.includes('id="peek-restore-button"'), 'Missing #peek-restore-button in index.html');
  assert.ok(html.includes('id="icon-eye"'), 'Missing #icon-eye in index.html');
  assert.ok(html.includes('id="icon-eye-off"'), 'Missing #icon-eye-off in index.html');

  // Verify starting player defaults to random
  assert.ok(
    html.includes('id="starter-random-button" class="setup-button selected"'),
    'Expected #starter-random-button to be selected by default in index.html'
  );
  assert.ok(
    html.includes('id="starter-human-button" class="setup-button"'),
    'Expected #starter-human-button to not be selected by default in index.html'
  );

  // Verify AI buttons are Easy, Medium, Hard
  assert.ok(html.includes('id="ai-easy-button"'), 'Missing #ai-easy-button in index.html');
  assert.ok(html.includes('id="ai-medium-button"'), 'Missing #ai-medium-button in index.html');
  assert.ok(html.includes('id="ai-hard-button"'), 'Missing #ai-hard-button in index.html');
  assert.ok(html.includes('Medium AI'), 'Expected Medium AI in difficulty badge in index.html');

  // Verify Online 2P markup
  assert.ok(html.includes('id="mode-ai-button"'), 'Missing #mode-ai-button in index.html');
  assert.ok(html.includes('id="mode-online-button"'), 'Missing #mode-online-button in index.html');
  assert.ok(html.includes('id="create-room-button"'), 'Missing #create-room-button in index.html');
  assert.ok(html.includes('id="join-room-button"'), 'Missing #join-room-button in index.html');
  assert.ok(html.includes('id="disconnect-modal"'), 'Missing #disconnect-modal in index.html');
});

test('styles.css contains peek classes, perspective-safe stack badges, and online setup styling', () => {
  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('.stage.is-peeking .offer-tray'), 'Missing .stage.is-peeking .offer-tray in styles.css');
  assert.ok(css.includes('.stage.is-peeking .result-panel'), 'Missing .stage.is-peeking .result-panel in styles.css');
  assert.ok(css.includes('.stage.is-peeking .board-row.offer-active .board'), 'Missing .stage.is-peeking un-dimming rule in styles.css');
  assert.ok(css.includes('.peek-restore-btn'), 'Missing .peek-restore-btn in styles.css');
  assert.ok(css.includes('.peek-trigger-btn'), 'Missing .peek-trigger-btn in styles.css');
  assert.ok(css.includes('.tray-peek-btn'), 'Missing .tray-peek-btn in styles.css');
  assert.ok(css.includes('.result-peek-btn'), 'Missing .result-peek-btn in styles.css');
  assert.ok(css.includes('.result-actions'), 'Missing .result-actions in styles.css');

  // Verify that tray-head icon selector is scoped with direct child to avoid corrupting peek button icons
  assert.ok(css.includes('.offer-tray .tray-head > .icon'), 'Expected .offer-tray .tray-head > .icon to be scoped');
  assert.ok(!css.includes('.offer-tray .tray-head .icon {'), 'Unscoped .offer-tray .tray-head .icon must not exist');

  // Verify perspective-safe stack count badge classes
  assert.ok(css.includes('.gift-stack.stack-bottom .stack-count'), 'Missing .gift-stack.stack-bottom .stack-count in styles.css');
  assert.ok(css.includes('.gift-stack.stack-top .stack-count'), 'Missing .gift-stack.stack-top .stack-count in styles.css');

  // Verify online setup styles and selectable room code
  assert.ok(css.includes('.room-code-value'), 'Missing .room-code-value in styles.css');
  assert.ok(css.includes('.room-code-input'), 'Missing .room-code-input in styles.css');
  assert.ok(css.includes('user-select: text'), 'Expected user-select: text for room code/input in styles.css');
});

test('ui.js wires peek state, default random starter, renamed AI diffs, and online 2P flow', () => {
  const js = fs.readFileSync(uiPath, 'utf8');

  assert.ok(js.includes('canPeekBoard'), 'Missing canPeekBoard helper in ui.js');
  assert.ok(js.includes('beginPeekHold'), 'Missing beginPeekHold helper in ui.js');
  assert.ok(js.includes('latchPeek'), 'Missing latchPeek helper in ui.js');
  assert.ok(js.includes('stopPeek'), 'Missing stopPeek helper in ui.js');
  assert.ok(js.includes('handlePeekPointerEnd'), 'Missing handlePeekPointerEnd helper in ui.js');
  assert.ok(js.includes('tray-peek-btn'), 'Missing tray-peek-btn rendering in ui.js');
  assert.ok(js.includes('result-peek-btn'), 'Missing result-peek-btn rendering in ui.js');
  assert.ok(js.includes('peekRestoreButton'), 'Missing peekRestoreButton element ref in ui.js');

  // Verify default random starter
  assert.ok(js.includes("startingPlayerPref = 'random'"), 'startingPlayerPref must default to random in ui.js');

  // Verify DIFF_LABELS are Easy, Medium, Hard
  assert.ok(js.includes("easy: 'Easy'"), 'DIFF_LABELS.easy must be Easy');
  assert.ok(js.includes("medium: 'Medium'"), 'DIFF_LABELS.medium must be Medium');
  assert.ok(js.includes("hard: 'Hard'"), 'DIFF_LABELS.hard must be Hard');

  // Verify Online 2P handlers
  assert.ok(js.includes('handleCreateRoomClick'), 'Missing handleCreateRoomClick in ui.js');
  assert.ok(js.includes('handleJoinRoomClick'), 'Missing handleJoinRoomClick in ui.js');
  assert.ok(js.includes('handleNetMessage'), 'Missing handleNetMessage in ui.js');
  assert.ok(js.includes('localSeat'), 'Missing localSeat in ui.js');
  assert.ok(js.includes('oppSeat'), 'Missing oppSeat helper in ui.js');

  // Verify resetUIState calls stopPeek(false)
  const resetFnMatch = js.match(/function resetUIState\(\)\s*\{([\s\S]*?)\}/);
  assert.ok(resetFnMatch, 'resetUIState function found');
  assert.ok(resetFnMatch[1].includes('stopPeek(false)'), 'resetUIState must call stopPeek(false)');

  // Verify resolveOfferChoice guards against peeking
  const resolveChoiceMatch = js.match(/function resolveOfferChoice\(choice\)\s*\{([\s\S]*?)\}/);
  assert.ok(resolveChoiceMatch, 'resolveOfferChoice function found');
  assert.ok(resolveChoiceMatch[1].includes("peekState !== 'closed'"), 'resolveOfferChoice must guard against peeking');
});
