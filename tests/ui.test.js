import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const htmlPath = path.resolve('docs/index.html');
const cssPath = path.resolve('docs/src/styles.css');
const uiPath = path.resolve('docs/src/ui.js');

test('index.html contains peek restore button and eye icon symbols', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');

  assert.ok(html.includes('id="peek-restore-button"'), 'Missing #peek-restore-button in index.html');
  assert.ok(html.includes('id="icon-eye"'), 'Missing #icon-eye in index.html');
  assert.ok(html.includes('id="icon-eye-off"'), 'Missing #icon-eye-off in index.html');
});

test('styles.css contains peek classes, un-dimming rules, and scoped offer tray icon', () => {
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
});

test('ui.js wires peek state, triggers, and resets', () => {
  const js = fs.readFileSync(uiPath, 'utf8');

  assert.ok(js.includes('canPeekBoard'), 'Missing canPeekBoard helper in ui.js');
  assert.ok(js.includes('beginPeekHold'), 'Missing beginPeekHold helper in ui.js');
  assert.ok(js.includes('latchPeek'), 'Missing latchPeek helper in ui.js');
  assert.ok(js.includes('stopPeek'), 'Missing stopPeek helper in ui.js');
  assert.ok(js.includes('handlePeekPointerEnd'), 'Missing handlePeekPointerEnd helper in ui.js');
  assert.ok(js.includes('tray-peek-btn'), 'Missing tray-peek-btn rendering in ui.js');
  assert.ok(js.includes('result-peek-btn'), 'Missing result-peek-btn rendering in ui.js');
  assert.ok(js.includes('peekRestoreButton'), 'Missing peekRestoreButton element ref in ui.js');

  // Verify resetUIState calls stopPeek(false)
  const resetFnMatch = js.match(/function resetUIState\(\)\s*\{([\s\S]*?)\}/);
  assert.ok(resetFnMatch, 'resetUIState function found');
  assert.ok(resetFnMatch[1].includes('stopPeek(false)'), 'resetUIState must call stopPeek(false)');

  // Verify resolveOfferChoice guards against peeking
  const resolveChoiceMatch = js.match(/function resolveOfferChoice\(choice\)\s*\{([\s\S]*?)\}/);
  assert.ok(resolveChoiceMatch, 'resolveOfferChoice function found');
  assert.ok(resolveChoiceMatch[1].includes("peekState !== 'closed'"), 'resolveOfferChoice must guard against peeking');
});
