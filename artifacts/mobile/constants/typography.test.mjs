import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { manropeByWeight, regularFont, resolveTypography } from './typography.ts';

test('mobile font assets are byte-identical to the web font assets', () => {
  for (const name of ['thin', 'light', 'regular', 'medium', 'semibold', 'bold', 'extrabold']) {
    assert.deepEqual(
      readFileSync(new URL(`../assets/fonts/manrope-${name}.otf`, import.meta.url)),
      readFileSync(new URL(`../../trivia-game/public/fonts/manrope-${name}.otf`, import.meta.url)),
    );
  }
});

test('weight-only styles select the actual weighted face without synthetic bold', () => {
  for (const weight of [100, 200, 300, 400, 500, 600, 700, 800, 900]) {
    assert.deepEqual(resolveTypography({ fontWeight: weight }), {
      fontFamily: manropeByWeight[weight],
      fontWeight: 'normal',
    });
  }
  assert.equal(resolveTypography({ fontWeight: 'bold' }).fontFamily, manropeByWeight[700]);
});

test('nested text inherits its parent font unless a weight or family is explicit', () => {
  assert.equal(resolveTypography().fontFamily, regularFont);
  assert.equal(resolveTypography({}, manropeByWeight[800]).fontFamily, manropeByWeight[800]);
  assert.equal(resolveTypography({ fontWeight: 'normal' }, manropeByWeight[800]).fontFamily, regularFont);
  assert.equal(resolveTypography({ fontFamily: manropeByWeight[600] }).fontFamily, manropeByWeight[600]);
  assert.deepEqual(resolveTypography({ fontFamily: 'monospace', fontWeight: '700' }), {
    fontFamily: 'monospace',
    fontWeight: '700',
  });
});