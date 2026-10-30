import { DAYS_LOCAL, SHIFT_LOCAL } from './i18n.js';
export const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
export const SHIFTS = { off: 'Folga', morning: 'Manhã', afternoon: 'Tarde' };
export const PEOPLE = [
  { id: 'ana', name: 'Ana Lima', role: 'Atendimento', unavailable: { 5: ['morning', 'afternoon'], 6: ['morning', 'afternoon'] } },
  { id: 'bruno', name: 'Bruno Reis', role: 'Atendimento', unavailable: { 2: ['morning'] } },
  { id: 'clara', name: 'Clara Alves', role: 'Atendimento', unavailable: { 1: ['afternoon'] } },
  { id: 'davi', name: 'Davi Costa', role: 'Atendimento', unavailable: { 0: ['morning'] } },
];
export function defaultAvailability() { return Object.fromEntries(PEOPLE.map(p => [p.id, structuredClone(p.unavailable)])); }
export function peopleFor(state) { return PEOPLE.map(p => ({ ...p, unavailable: state.availability?.[p.id] || p.unavailable })); }
export function validAvailability(availability) {
  if (!availability || typeof availability !== 'object' || Array.isArray(availability)) return false;
  if (Object.keys(availability).some(id => !PEOPLE.some(p => p.id === id))) return false;
  return PEOPLE.every(p => {
    const days = availability[p.id];
    return days && typeof days === 'object' && !Array.isArray(days) && Object.entries(days).every(([day, shifts]) => /^[0-6]$/.test(day) && Array.isArray(shifts) && shifts.length <= 2 && new Set(shifts).size === shifts.length && shifts.every(s => s === 'morning' || s === 'afternoon'));
  });
}
export const HOURS = 8;
export const LIMIT = 40;
export function demoState() {
  return { version: 1, availability: defaultAvailability(), assignments: {
    ana: ['morning', 'morning', 'morning', 'morning', 'morning', 'off', 'off'],
    bruno: ['afternoon', 'off', 'off', 'afternoon', 'off', 'morning', 'morning'],
    clara: ['off', 'afternoon', 'afternoon', 'off', 'afternoon', 'off', 'off'],
    davi: ['off', 'off', 'off', 'off', 'off', 'afternoon', 'off'],
  } };
}
export function validState(state) {
  return !!state && state.version === 1 && (state.availability === undefined || validAvailability(state.availability)) && !!state.assignments && PEOPLE.every(p =>
    Array.isArray(state.assignments[p.id]) && state.assignments[p.id].length === 7 &&
    state.assignments[p.id].every(s => Object.hasOwn(SHIFTS, s)));
}
export function restoreState(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!validState(parsed)) return null;
    return { version: 1, availability: parsed.availability ? structuredClone(parsed.availability) : defaultAvailability(), assignments: Object.fromEntries(PEOPLE.map(p => [p.id, [...parsed.assignments[p.id]]])) };
  } catch { return null; }
}
export function assign(state, personId, day, shift) {
  if (!validState(state) || !PEOPLE.some(p => p.id === personId) || !Number.isInteger(day) || day < 0 || day > 6 || !Object.hasOwn(SHIFTS, shift)) throw new Error('Atribuição inválida');
  const next = restoreState(JSON.stringify(state));
  next.assignments[personId][day] = shift;
  return next;
}
export function setAvailability(state, personId, day, shifts) {
  if (!validState(state) || !PEOPLE.some(p => p.id === personId) || !Number.isInteger(day) || day < 0 || day > 6) throw new Error('Disponibilidade inválida');
  const next = restoreState(JSON.stringify(state));
  next.availability[personId][day] = shifts;
  if (!validAvailability(next.availability)) throw new Error('Disponibilidade inválida');
  next.availability[personId][day] = [...shifts];
  return next;
}
export function unavailable(person, day, shift) {
  return (person.unavailable[day] || []).includes(shift);
}
export function analyze(state) {
  if (!validState(state)) throw new Error('Estado inválido');
  const conflicts = [], hours = {};
  const people = peopleFor(state);
  for (const p of people) {
    hours[p.id] = state.assignments[p.id].filter(s => s !== 'off').length * HOURS;
    state.assignments[p.id].forEach((s, day) => {
      if (unavailable(p, day, s)) conflicts.push({ personId: p.id, day, type: 'availability', text: `${p.name}: ${DAYS[day]}, ${SHIFTS[s].toLowerCase()} indisponível.` });
    });
    if (hours[p.id] > LIMIT) conflicts.push({ personId: p.id, type: 'hours', text: `${p.name}: ${hours[p.id]}h excedem o limite demonstrativo de ${LIMIT}h.` });
  }
  const coverage = DAYS.map((_, day) => Object.fromEntries(['morning', 'afternoon'].map(s => [s, people.filter(p => state.assignments[p.id][day] === s && !unavailable(p, day, s)).length])));
  const covered = coverage.reduce((total, day) => total + Number(day.morning >= 1) + Number(day.afternoon >= 1), 0);
  return { conflicts, hours, coverage, covered, total: 14, totalHours: Object.values(hours).reduce((a, b) => a + b, 0) };
}
// Quote every CSV field; prefix spreadsheet formula starters before quoting.
export function csvCell(value) {
  let text = String(value);
  if (/^[\s]*[=+\-@\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function exportCSV(state, language = 'pt') {
  const report = analyze(state);
  const rows = [[language === 'ja' ? '氏名（架空）' : language === 'en' ? 'Person (fictional)' : 'Pessoa (fictícia)', ...DAYS_LOCAL[language], language === 'ja' ? '予定勤務時間' : language === 'en' ? 'Planned hours' : 'Horas planejadas'], ...PEOPLE.map(p => [p.name, ...state.assignments[p.id].map(s => SHIFT_LOCAL[language][s]), report.hours[p.id]])];
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
}
