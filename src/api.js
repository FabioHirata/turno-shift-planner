import { restoreState, validAvailability, PEOPLE } from './domain.js';
export class APIError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
// Relative, same-origin URL only: this demo never sends schedules to an external service.
export function createAPI(fetcher = globalThis.fetch.bind(globalThis), timeoutMs = 8000) {
  const base = '/api/weeks/2026-11-02';
  async function request(path = '', method = 'GET', body) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(base + path, {
        method, signal: controller.signal, cache: 'no-store', credentials: 'same-origin',
        headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) throw new APIError(response.status, response.status === 409 ? 'revision_conflict' : 'request_failed');
      const data = await response.json();
      const state = restoreState(JSON.stringify(data));
      if (!state || !validAvailability(data.availability) || !Number.isInteger(data.revision) || data.revision < 1 || data.week !== '2026-11-02' || !data.report || !Array.isArray(data.report.conflicts) || !Array.isArray(data.report.coverage) || data.report.coverage.length !== 7 || !Number.isInteger(data.report.covered) || data.report.covered < 0 || data.report.covered > 14 || data.report.total !== 14 || !data.report.hours || !PEOPLE.every(p => Number.isInteger(data.report.hours[p.id]) && data.report.hours[p.id] >= 0) || !data.report.coverage.every(d => Number.isInteger(d.morning) && d.morning >= 0 && Number.isInteger(d.afternoon) && d.afternoon >= 0) || !data.report.conflicts.every(c => PEOPLE.some(p => p.id === c.personId) && ['hours','availability'].includes(c.type) && (c.type === 'hours' || Number.isInteger(c.day) && c.day >= 0 && c.day <= 6)) || !Number.isFinite(data.report.totalHours)) throw new APIError(502, 'invalid_response');
      return { state, revision: data.revision, report: data.report };
    } catch (error) {
      if (error instanceof APIError) throw error;
      throw new APIError(0, error.name === 'AbortError' ? 'timeout' : 'network_error');
    } finally { clearTimeout(timeout); }
  }
  return {
    load: () => request(),
    assign: (revision, personId, day, shift) => request('/assignments', 'PATCH', { revision, personId, day, shift }),
    availability: (revision, personId, day, shifts) => request('/availability', 'PUT', { revision, personId, day, shifts }),
    reset: revision => request('/reset', 'POST', { revision }),
  };
}
