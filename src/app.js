import { createAPI } from './api.js';
import { LANGUAGES, DAYS_LOCAL, SHIFT_LOCAL, translate, hoursText, summary, gapText, conflictText } from './i18n.js';
import { PEOPLE, LIMIT, demoState, restoreState, assign, unavailable, analyze, exportCSV, peopleFor, setAvailability } from './domain.js';
const KEY = 'turno.demo.v1';
const apiMode = new URLSearchParams(globalThis.location?.search || '').get('mode') === 'api';
const api = apiMode ? createAPI() : null;
let revision = 0, serverReport = null, apiReady = false, apiBusy = false, apiMessage = '';

const $ = id => document.getElementById(id);
let state = demoState();
let language = 'pt';
try { const saved = localStorage.getItem('turno.language'); if (LANGUAGES.includes(saved)) language = saved; } catch {}
const t = text => translate(text, language);
const staticText = [];
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
while (walker.nextNode()) { const textNode = walker.currentNode; const source = textNode.textContent.trim(); if (source) staticText.push({ textNode, source, original: textNode.textContent }); }
const staticAttrs = [];
for (const el of document.querySelectorAll('[aria-label]')) staticAttrs.push({ el, source: el.getAttribute('aria-label') });
function localize() {
  document.documentElement.lang = language === 'pt' ? 'pt-BR' : language;
  document.title = t('Turno — Planejador de escalas');
  staticText.forEach(({textNode, source, original}) => { textNode.textContent = original.replace(source, t(source)); });
  staticAttrs.forEach(({el, source}) => el.setAttribute('aria-label', t(source)));
  document.querySelectorAll('thead th').forEach((th, i) => { if (i > 0 && i < 8) th.firstChild.textContent = DAYS_LOCAL[language][i - 1] + ' '; });
  $('language').value = language;
}
let saveMessage = 'Salvo neste navegador';
try {
  const raw = apiMode ? null : localStorage.getItem(KEY);
  if (raw) {
    const restored = restoreState(raw);
    if (restored) state = restored;
    else saveMessage = 'Dados locais inválidos; exemplo carregado';
  }
} catch { saveMessage = 'Armazenamento indisponível; use CSV para guardar'; }
function persist() {
  if (apiMode) return;
  try { localStorage.setItem(KEY, JSON.stringify(state)); saveMessage = 'Salvo neste navegador'; }
  catch { saveMessage = 'Não foi possível salvar; use CSV para guardar'; }
}
function node(tag, text, className) {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
}
function render() {
  localize();
  const report = apiMode && serverReport ? serverReport : analyze(state);
  const people = peopleFor(state);
  $('mode-title').textContent = t(apiMode ? 'API Go local' : 'Demonstração local');
  $('mode-description').textContent = apiMode ? t('Persistência no servidor local · revisão') + ' ' + revision : t('Dados salvos somente neste navegador.');
  $('mode-link').textContent = t(apiMode ? 'Voltar à demonstração' : 'Usar API Go local');
  $('mode-link').href = apiMode ? '?' : '?mode=api';
  $('api-message').hidden = !apiMessage; $('api-message').textContent = t(apiMessage);
  $('api-retry').hidden = !apiMode || apiBusy || apiReady;
  $('planner').hidden = $('metrics').hidden = $('lower-panels').hidden = apiMode && !apiReady;
  for (const id of ['reset','export','availability-save']) $(id).disabled = apiMode && (!apiReady || apiBusy);
  for (const id of ['availability-person','availability-day','availability-shifts']) $(id).disabled = apiMode && (!apiReady || apiBusy);
  $('save-status').textContent = apiMode ? t(apiBusy ? 'Sincronizando com API Go…' : apiReady ? 'Estado confirmado pela API Go' : 'API desconectada') : t(saveMessage);
  $('coverage-number').textContent = `${report.covered} / 14`;
  $('coverage-bar').style.width = `${report.covered / 14 * 100}%`;
  $('hours-number').textContent = hoursText(report.totalHours, language);
  $('conflict-number').textContent = String(report.conflicts.length + 14 - report.covered).padStart(2, '0');
  $('conflict-caption').textContent = summary(report.conflicts.length, 14 - report.covered, language);
  $('schedule').replaceChildren();
  for (const [index, p] of people.entries()) {
    const row = node('tr');
    const header = node('th'); header.scope = 'row';
    const person = node('div', undefined, 'person');
    person.append(node('span', p.name.split(' ').map(n => n[0]).join(''), `avatar avatar-${index}`));
    const details = node('div'); details.append(node('strong', p.name), node('small', t(p.role))); person.append(details); header.append(person); row.append(header);
    state.assignments[p.id].forEach((shift, day) => {
      const cell = node('td');
      const select = node('select', undefined, `shift ${shift}`);
      select.id = `${p.id}-${day}`;
      select.disabled = apiMode && (!apiReady || apiBusy);
      select.setAttribute('aria-label', `${p.name}, ${DAYS_LOCAL[language][day]}`);
      for (const [value, label] of Object.entries(SHIFT_LOCAL[language])) {
        const option = node('option', `${label}${unavailable(p, day, value) ? t(' · indisponível') : ''}`); option.value = value; select.append(option);
      }
      select.value = shift;
      if (unavailable(p, day, shift)) {
        select.classList.add('conflict'); select.setAttribute('aria-invalid', 'true');
        const hint = node('span', t('! Indisponível'), 'cell-warning'); hint.id = `${select.id}-warning`;
        select.setAttribute('aria-describedby', hint.id); cell.append(select, hint);
      } else cell.append(select);
      select.addEventListener('change', () => {
        if (apiMode) { void mutateAPI(() => api.assign(revision, p.id, day, select.value), select.id); return; }
        state = assign(state, p.id, day, select.value); persist(); render();
        $(select.id).focus();
        const r = analyze(state);
        $('announcement').textContent = summary(r.conflicts.length, 14 - r.covered, language);
      }); row.append(cell);
    });
    row.append(node('td', hoursText(report.hours[p.id], language), report.hours[p.id] > LIMIT ? 'hours excessive' : 'hours'));
    $('schedule').append(row);
  }
  const coverage = node('tr'); const label = node('th', t('Cobertura válida')); label.scope = 'row'; coverage.append(label);
  report.coverage.forEach(day => {
    const cell = node('td');
    for (const [s, prefix] of [['morning', language === 'ja' ? '早' : 'M'], ['afternoon', language === 'ja' ? '遅' : language === 'en' ? 'A' : 'T']]) cell.append(node('span', `${prefix} ${day[s]}/1 ${day[s] ? '✓' : '!'}`, day[s] ? 'coverage-ok' : 'coverage-gap'));
    coverage.append(cell);
  }); coverage.append(node('td', `${Math.round(report.covered / 14 * 100)}%`, 'hours')); $('coverage').replaceChildren(coverage);
  $('issues').replaceChildren();
  const messages = [...report.conflicts.map(c => conflictText(c, people, report.hours, language))];
  report.coverage.forEach((day, i) => { for (const s of ['morning', 'afternoon']) if (!day[s]) messages.push(gapText(i, s, language)); });
  if (!messages.length) $('issues').append(node('p', t('✓ Tudo certo neste cenário: cobertura completa e nenhuma regra da demo violada.'), 'success'));
  else { const list = node('ul', undefined, 'issue-list'); messages.forEach(m => list.append(node('li', m))); $('issues').append(list); }
  $('availability-list').replaceChildren();
  for (const p of people) {
    const li = node('li'); const restrictions = Object.entries(p.unavailable).filter(([,shifts]) => shifts.length).map(([day,shifts]) => DAYS_LOCAL[language][Number(day)] + ': ' + shifts.map(s => SHIFT_LOCAL[language][s]).join(' / ')).join(' · ');
    li.append(node('strong', p.name), node('span', restrictions || t('Nenhuma'))); $('availability-list').append(li);
  }
  renderAvailabilityEditor();
}
$('export').addEventListener('click', () => {
  const blob = new Blob([exportCSV(state, language)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = node('a'); a.href = url; a.download = 'turno-demo-2026-11-02.csv';
  // Attach for broader browser compatibility; keep the object URL alive for slow downloads.
  a.style.display = 'none'; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  $('announcement').textContent = t('Exportação CSV iniciada. O arquivo inclui a escala, mesmo se houver conflitos.');
});
const dialog = $('reset-dialog');
$('reset').addEventListener('click', () => dialog.showModal());
$('cancel-reset').addEventListener('click', () => dialog.close());
$('confirm-reset').addEventListener('click', () => {
  if (apiMode) { dialog.close(); void mutateAPI(() => api.reset(revision), 'reset'); return; }
  state = demoState(); persist(); render(); dialog.close(); $('reset').focus();
  $('announcement').textContent = t('Demonstração restaurada.');
});
initializeAvailabilityEditor();
render();
if (apiMode) void loadAPI();

$('language').addEventListener('change', () => { language = $('language').value; try { localStorage.setItem('turno.language', language); } catch {} render(); });

function initializeAvailabilityEditor() {
  for (const p of PEOPLE) { const option = node('option', p.name); option.value = p.id; $('availability-person').append(option); }
  $('availability-person').value = PEOPLE[0].id;
  $('availability-day').value = '0';
  $('availability-person').addEventListener('change', renderAvailabilityEditor);
  $('availability-day').addEventListener('change', renderAvailabilityEditor);
  $('availability-save').addEventListener('click', () => {
    const personId = $('availability-person').value, day = Number($('availability-day').value), value = $('availability-shifts').value;
    const shifts = value === 'both' ? ['morning','afternoon'] : value === 'none' ? [] : [value];
    if (apiMode) { void mutateAPI(() => api.availability(revision, personId, day, shifts), 'availability-save'); return; }
    state = setAvailability(state, personId, day, shifts); persist(); render();
    $('announcement').textContent = t('Disponibilidade atualizada.');
  });
  $('api-retry').addEventListener('click', () => { void loadAPI(); });
}
function renderAvailabilityEditor() {
  const dayValue = $('availability-day').value || '0';
  $('availability-day').replaceChildren();
  DAYS_LOCAL[language].forEach((label, day) => { const option = node('option', label); option.value = String(day); $('availability-day').append(option); });
  $('availability-day').value = dayValue;
  const person = peopleFor(state).find(p => p.id === $('availability-person').value) || peopleFor(state)[0];
  const shifts = person.unavailable[Number(dayValue)] || [];
  $('availability-shifts').value = shifts.length === 2 ? 'both' : shifts[0] || 'none';
}
function acceptAPI(data) { state = data.state; revision = data.revision; serverReport = data.report; apiReady = true; }
async function loadAPI() {
  if (apiBusy) return;
  apiBusy = true; apiMessage = 'Conectando à API Go local…'; render();
  try { acceptAPI(await api.load()); apiMessage = ''; }
  catch { apiReady = false; apiMessage = 'API indisponível. Inicie o servidor Go e abra esta página no endereço dele. Nenhum dado de demonstração foi enviado.'; }
  finally { apiBusy = false; render(); }
}
async function mutateAPI(operation, focusId) {
  if (apiBusy || !apiReady) return;
  apiBusy = true; apiMessage = ''; render();
  try { acceptAPI(await operation()); apiMessage = 'Alteração confirmada pela API Go.'; }
  catch (error) {
    try { acceptAPI(await api.load()); }
    catch { apiReady = false; }
    apiMessage = error.status === 409 && apiReady
      ? 'Outra janela alterou a escala. Recarregamos o estado; revise antes de tentar novamente.'
      : 'Não foi possível confirmar a alteração. Reconciliamos o estado quando possível; revise antes de tentar novamente.';
  } finally { apiBusy = false; render(); if (apiReady) $(focusId)?.focus(); }
}
