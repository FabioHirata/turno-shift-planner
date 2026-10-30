import test from 'node:test';
import assert from 'node:assert/strict';
import { demoState, analyze, assign, restoreState, validState, csvCell, exportCSV, PEOPLE } from '../src/domain.js';
test('initial scenario exposes unavailable assignment and two missing shifts', () => {
  const r = analyze(demoState());
  assert.equal(r.covered, 12); assert.equal(r.conflicts.length, 1);
  assert.deepEqual(r.conflicts.map(c => [c.personId, c.day]), [['clara', 1]]);
  assert.equal(r.coverage[1].afternoon, 0); assert.equal(r.coverage[6].afternoon, 0);
  assert.equal(r.totalHours, 104);
});
test('assignments are immutable and constrained to known people/day/shift', () => {
  const original = demoState(); const next = assign(original, 'davi', 6, 'afternoon');
  assert.equal(original.assignments.davi[6], 'off'); assert.equal(next.assignments.davi[6], 'afternoon');
  for (const args of [['unknown', 0, 'off'], ['ana', -1, 'off'], ['ana', 7, 'off'], ['ana', 1.5, 'off'], ['ana', 0, 'night'], ['ana', 0, 'toString']]) assert.throws(() => assign(original, ...args));
});
test('repair demo reaches full coverage without conflicts', () => {
  let s = assign(demoState(), 'clara', 1, 'off');
  s = assign(s, 'bruno', 1, 'afternoon'); s = assign(s, 'davi', 6, 'afternoon');
  assert.equal(analyze(s).covered, 14); assert.equal(analyze(s).conflicts.length, 0);
});
test('hours above limit are flagged; unavailable hours still count as planned', () => {
  const s = assign(demoState(), 'ana', 5, 'morning'); const r = analyze(s);
  assert.equal(r.hours.ana, 48); assert.equal(r.coverage[5].morning, 1);
  assert.equal(r.conflicts.filter(c => c.personId === 'ana').length, 2);
});
test('restoration rejects corruption and strips unknown persisted properties', () => {
  for (const raw of ['oops', 'null', '{}', '{"version":2}', JSON.stringify({ ...demoState(), assignments: { ana: [] } })]) assert.equal(restoreState(raw), null);
  const s = demoState(); s.assignments.ana[0] = '__proto__'; assert.equal(validState(s), false);
  const good = demoState(); good.extra = '<script>'; good.assignments.extra = [];
  const clean = restoreState(JSON.stringify(good)); assert.equal(clean.extra, undefined); assert.deepEqual(Object.keys(clean.assignments), PEOPLE.map(p => p.id));
});
test('CSV escapes quotes, separators, multiline values and formula prefixes', () => {
  assert.equal(csvCell('a;"b'), '"a;""b"');
  for (const value of ['=1+1', '+CMD', '-1', '@SUM(1)', '\tformula', '\rtext', '\ntext', '  =1']) assert.equal(csvCell(value).startsWith('"\''), true);
  assert.equal(csvCell('Ana Lima'), '"Ana Lima"');
  const csv = exportCSV(demoState()); assert.ok(csv.startsWith('\uFEFF')); assert.equal(csv.split('\r\n').length, 5); assert.ok(csv.includes('"Ana Lima"'));
});
