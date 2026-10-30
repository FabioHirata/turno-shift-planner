import { LANGUAGES, DAYS_LOCAL, SHIFT_LOCAL, translate, hoursText, summary, gapText, conflictText } from './i18n.js';
import { PEOPLE, LIMIT, demoState, restoreState, assign, unavailable, analyze, exportCSV } from './domain.js';
const KEY = 'turno.demo.v1';
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
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const restored = restoreState(raw);
    if (restored) state = restored;
    else saveMessage = 'Dados locais inválidos; exemplo carregado';
  }
} catch { saveMessage = 'Armazenamento indisponível; use CSV para guardar'; }
function persist() {
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
  const report = analyze(state);
  $('save-status').textContent = t(saveMessage);
  $('coverage-number').textContent = `${report.covered} / 14`;
  $('coverage-bar').style.width = `${report.covered / 14 * 100}%`;
  $('hours-number').textContent = hoursText(report.totalHours, language);
  $('conflict-number').textContent = String(report.conflicts.length + 14 - report.covered).padStart(2, '0');
  $('conflict-caption').textContent = summary(report.conflicts.length, 14 - report.covered, language);
  $('schedule').replaceChildren();
  for (const [index, p] of PEOPLE.entries()) {
    const row = node('tr');
    const header = node('th'); header.scope = 'row';
    const person = node('div', undefined, 'person');
    person.append(node('span', p.name.split(' ').map(n => n[0]).join(''), `avatar avatar-${index}`));
    const details = node('div'); details.append(node('strong', p.name), node('small', t(p.role))); person.append(details); header.append(person); row.append(header);
    state.assignments[p.id].forEach((shift, day) => {
      const cell = node('td');
      const select = node('select', undefined, `shift ${shift}`);
      select.id = `${p.id}-${day}`;
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
  const messages = [...report.conflicts.map(c => conflictText(c, PEOPLE, report.hours, language))];
  report.coverage.forEach((day, i) => { for (const s of ['morning', 'afternoon']) if (!day[s]) messages.push(gapText(i, s, language)); });
  if (!messages.length) $('issues').append(node('p', t('✓ Tudo certo neste cenário: cobertura completa e nenhuma regra da demo violada.'), 'success'));
  else { const list = node('ul', undefined, 'issue-list'); messages.forEach(m => list.append(node('li', m))); $('issues').append(list); }
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
  state = demoState(); persist(); render(); dialog.close(); $('reset').focus();
  $('announcement').textContent = t('Demonstração restaurada.');
});
render();

$('language').addEventListener('change', () => { language = $('language').value; try { localStorage.setItem('turno.language', language); } catch {} render(); });
