import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COPY, LANGUAGES, translate, DAYS_LOCAL, SHIFT_LOCAL, gapText, conflictText, summary, hoursText } from '../src/i18n.js';
import { exportCSV, demoState, analyze, PEOPLE } from '../src/domain.js';
test('all translation entries have nonempty English and Japanese values', () => {
  for (const [key, values] of Object.entries(COPY)) {
    assert.equal(values.length, 2, key); values.forEach(v => assert.ok(typeof v === 'string' && v.trim(), key));
    assert.equal(translate(key, 'pt'), key); assert.equal(translate(key, 'en'), values[0]); assert.equal(translate(key, 'ja'), values[1]);
  }
});
test('dynamic validation, shifts, dates and CSV are localized in all languages', () => {
  const s = demoState(), r = analyze(s);
  for (const lang of LANGUAGES) {
    assert.equal(DAYS_LOCAL[lang].length, 7); assert.equal(Object.keys(SHIFT_LOCAL[lang]).length, 3);
    assert.ok(gapText(1, 'afternoon', lang)); assert.ok(summary(1, 2, lang));
    assert.ok(conflictText(r.conflicts[0], PEOPLE, r.hours, lang));
    assert.ok(exportCSV(s, lang).includes(DAYS_LOCAL[lang][0]));
    assert.ok(exportCSV(s, lang).includes(SHIFT_LOCAL[lang].morning));
  }
  assert.match(hoursText(40, 'ja'), /40時間/);
  assert.match(exportCSV(s, 'ja'), /氏名（架空）/);
  assert.match(exportCSV(s, 'en'), /Person \(fictional\)/);
});
test('static UI phrases are translated or explicitly language-independent', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const excluded = new Set(['turno','T','.','/','▦','◷','ⓘ','↓','02','03','04','05','06','07','08','Seg','Ter','Qua','Qui','Sex','Sáb','Dom','Ana Lima','Bruno Reis','Clara Alves','Davi Costa','Português','English','日本語','Idioma / Language / 言語']);
  const phrases = [...html.matchAll(/>([^<>]+)</g)].map(m => m[1].trim()).filter(Boolean);
  for (const phrase of phrases) assert.ok(COPY[phrase] || excluded.has(phrase), `Missing translation: ${phrase}`);
});
