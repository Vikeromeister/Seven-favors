import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('UI elements definition and HTML ID integrity', () => {
  const uiCode = fs.readFileSync('docs/src/ui.js', 'utf8');
  const htmlCode = fs.readFileSync('docs/index.html', 'utf8');

  // Verify els object definition
  const elsDefMatch = uiCode.match(/const els = \{([\s\S]*?)\};/);
  assert.ok(elsDefMatch, 'els object must be defined in docs/src/ui.js');

  const definedProps = new Set();
  for (const line of elsDefMatch[1].split('\n')) {
    const m = line.match(/^\s*([a-zA-Z0-9_]+):/);
    if (m) definedProps.add(m[1]);
  }

  // Find all property accesses on els.prop
  const usedProps = new Set();
  const propRe = /els\.([a-zA-Z0-9_]+)/g;
  let m;
  while ((m = propRe.exec(uiCode)) !== null) {
    usedProps.add(m[1]);
  }

  assert.ok(usedProps.size > 20, 'Should find all UI element references');
  for (const prop of usedProps) {
    assert.ok(
      definedProps.has(prop),
      `Property els.${prop} is accessed in docs/src/ui.js but missing from els definition`
    );
  }

  // Verify all getElementById IDs match HTML elements
  const idRe = /getElementById\(['"]([^'"]+)['"]\)/g;
  while ((m = idRe.exec(elsDefMatch[1])) !== null) {
    const id = m[1];
    assert.ok(
      htmlCode.includes(`id="${id}"`) || htmlCode.includes(`id='${id}'`),
      `Element with id "${id}" in els definition must exist in docs/index.html`
    );
  }
});
