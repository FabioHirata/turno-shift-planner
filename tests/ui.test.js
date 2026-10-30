// Lightweight DOM adapter exercises application event wiring without browser dependencies.
// Real rendering, browser focus behavior and downloads still require browser QA.
import test from 'node:test';
import assert from 'node:assert/strict';
import { demoState, analyze, assign } from '../src/domain.js';
const nativeFetch = globalThis.fetch;
const flush = () => new Promise(resolve => setImmediate(resolve));
let instance = 0;
async function boot({ language = 'pt', stored = null, blocked = false, mode = 'demo', fetcher = nativeFetch } = {}) {
  globalThis.location = { search: mode === 'api' ? '?mode=api' : '' };
  globalThis.fetch = fetcher;
  const elements = new Map();
  const created = [];
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.style = {}; this.events = {}; this.classList = { add: c => this.className = `${this.className || ''} ${c}` }; }
    set id(value) { this._id = value; elements.set(value, this); }
    get id() { return this._id; }
    set textContent(value) { this.text = String(value); this.children = []; }
    get textContent() { return (this.text || '') + this.children.map(c => c.textContent).join(''); }
    append(...items) { this.children.push(...items); }
    replaceChildren(...items) { this.children = items; this.text = ''; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(name, callback) { this.events[name] = callback; }
    focus() { document.activeElement = this; }
    remove() { this.removed = true; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    click() { this.clicked = true; this.events.click?.(); }
  }
  const ids = ['mode-title','mode-description','mode-link','api-message','api-retry','planner','metrics','lower-panels','availability-list','availability-person','availability-day','availability-shifts','availability-save','language','save-status','coverage-number','coverage-bar','hours-number','conflict-number','conflict-caption','schedule','coverage','issues','announcement','export','reset','reset-dialog','cancel-reset','confirm-reset'];
  for (const id of ids) { const el = new Element('div'); el.id = id; }
  const storage = new Map([['turno.language', language]]); if (stored !== null) storage.set('turno.demo.v1', stored);
  globalThis.localStorage = { getItem: k => { if (blocked) throw Error('blocked'); return storage.get(k) ?? null; }, setItem: (k,v) => { if (blocked) throw Error('blocked'); storage.set(k,v); } };
  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  globalThis.document = { body: new Element('body'), documentElement: {}, createTreeWalker: () => ({ nextNode: () => false }), querySelectorAll: () => [], getElementById: id => elements.get(id), createElement: tag => { const el = new Element(tag); created.push(el); return el; } };
  await import(`../src/app.js?test=${++instance}`);
  await flush();
  return { get: id => elements.get(id), storage, created, change(id, value) { const el = elements.get(id); el.value = value; el.events.change(); } };
}
test('UI renders initial metrics and handles edits with focus and persistence', async () => {
  const ui = await boot();
  assert.equal(ui.get('coverage-number').textContent, '12 / 14');
  assert.equal(ui.get('clara-1').attributes['aria-invalid'], 'true');
  ui.change('clara-1', 'off'); ui.change('bruno-1', 'afternoon'); ui.change('davi-6', 'afternoon');
  assert.equal(ui.get('coverage-number').textContent, '14 / 14');
  assert.equal(ui.get('conflict-number').textContent, '00');
  assert.equal(document.activeElement.id, 'davi-6');
  assert.equal(JSON.parse(ui.storage.get('turno.demo.v1')).assignments.davi[6], 'afternoon');
  assert.match(ui.get('issues').textContent, /Tudo certo/);
});
test('reset cancel preserves edits, confirm restores the demo', async () => {
  const ui = await boot(); ui.change('davi-6', 'afternoon');
  ui.get('reset').click(); assert.equal(ui.get('reset-dialog').open, true);
  ui.get('cancel-reset').click(); assert.equal(ui.get('reset-dialog').open, false); assert.equal(ui.get('davi-6').value, 'afternoon');
  ui.get('reset').click(); ui.get('confirm-reset').click();
  assert.equal(ui.get('davi-6').value, 'off'); assert.equal(ui.get('reset-dialog').open, false); assert.equal(document.activeElement.id, 'reset');
});
test('language selection updates dynamic labels, validation, document language and stored preference', async () => {
  const ui = await boot();
  for (const [lang, label, fragment] of [['en','Ana Lima, Mon','conflict(s)'], ['ja','Ana Lima, 月','件の問題'], ['pt','Ana Lima, Seg','conflito(s)']]) {
    ui.change('language', lang);
    assert.equal(document.documentElement.lang, lang === 'pt' ? 'pt-BR' : lang);
    assert.equal(ui.get('ana-0').attributes['aria-label'], label);
    assert.ok(ui.get('conflict-caption').textContent.includes(fragment));
    assert.equal(ui.storage.get('turno.language'), lang);
  }
});
test('corrupted and unavailable browser storage recover without blocking edits', async () => {
  let ui = await boot({ stored: 'not json' });
  assert.match(ui.get('save-status').textContent, /inválidos/);
  ui = await boot({ blocked: true }); assert.match(ui.get('save-status').textContent, /indisponível/);
  ui.change('davi-6', 'afternoon'); assert.equal(ui.get('coverage-number').textContent, '13 / 14');
  assert.match(ui.get('save-status').textContent, /Não foi possível salvar/);
});

test('export event creates a localized CSV Blob and download link', async () => {
  const ui = await boot({ language: 'ja' });
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL, timeout = globalThis.setTimeout;
  let blob;
  URL.createObjectURL = value => { blob = value; return 'blob:test-export'; };
  URL.revokeObjectURL = () => {};
  globalThis.setTimeout = (callback, delay) => { assert.equal(delay, 30_000); callback(); return 1; };
  try {
    ui.get('export').click();
    assert.match(await blob.text(), /氏名（架空）/);
    const a = ui.created.find(el => el.tagName === 'a');
    assert.equal(a.download, 'turno-demo-2026-11-02.csv');
    assert.equal(a.href, 'blob:test-export'); assert.equal(a.clicked, true); assert.equal(a.removed, true);
    assert.ok(document.body.children.includes(a));
    assert.equal(blob.type, 'text/csv;charset=utf-8');
    assert.match(ui.get('announcement').textContent, /CSV/);
  } finally { URL.createObjectURL = create; URL.revokeObjectURL = revoke; globalThis.setTimeout = timeout; }
});

test('availability editor updates coverage without altering assignments', async () => {
  const ui = await boot();
  ui.change('availability-person', 'clara'); ui.change('availability-day', '1');
  assert.equal(ui.get('availability-shifts').value, 'afternoon');
  ui.get('availability-shifts').value = 'none'; ui.get('availability-save').click();
  assert.equal(ui.get('coverage-number').textContent, '13 / 14');
  assert.equal(ui.get('clara-1').value, 'afternoon');
  assert.equal(JSON.parse(ui.storage.get('turno.demo.v1')).availability.clara['1'].length, 0);
});

const apiResponse = (state = demoState(), revision = 1) => ({ ok: true, status: 200, json: async () => ({ ...state, revision, week: '2026-11-02', report: analyze(state) }) });
test('API UI loads backend only, sends PATCH and never stores backend schedule in browser', async () => {
  let server = demoState(), revision = 1; const calls = [];
  const ui = await boot({ mode: 'api', fetcher: async (url, options) => {
    calls.push({url, method:options.method});
    if (options.method === 'PATCH') { const body = JSON.parse(options.body); assert.equal(body.revision, revision); server = assign(server,body.personId,body.day,body.shift); revision++; }
    return apiResponse(server, revision);
  }});
  assert.equal(ui.get('planner').hidden, false); assert.equal(ui.get('mode-title').textContent, 'API Go local');
  assert.equal(calls.length, 1); assert.equal(calls[0].method, 'GET');
  ui.change('davi-6','afternoon'); await flush();
  assert.equal(ui.get('coverage-number').textContent, '13 / 14');
  assert.equal(calls[1].method, 'PATCH'); assert.equal(ui.storage.has('turno.demo.v1'), false);
});
test('API UI stale write refreshes authoritative state and does not silently retry', async () => {
  let count = 0; const server = assign(demoState(), 'davi', 6, 'afternoon');
  const ui = await boot({ mode: 'api', fetcher: async (_, options) => {
    count++;
    if (options.method === 'PATCH') return {ok:false,status:409};
    return count === 1 ? apiResponse() : apiResponse(server, 2);
  }});
  ui.change('ana-0','off'); await flush();
  assert.equal(count, 3); assert.equal(ui.get('ana-0').value,'morning'); assert.equal(ui.get('davi-6').value,'afternoon');
  assert.match(ui.get('api-message').textContent,/Outra janela/);
});
test('API unavailable leaves editing hidden and does not fall back to fake server data', async () => {
  const ui = await boot({mode:'api',fetcher:async()=>{throw Error('offline');}});
  assert.equal(ui.get('planner').hidden,true); assert.equal(ui.get('export').disabled,true);
  assert.equal(ui.get('api-retry').hidden,false); assert.match(ui.get('api-message').textContent,/API indisponível/);
});
