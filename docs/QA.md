# Verification — Go + JavaScript upgrade

## Current automated checks

- Frontend `npm run check`: **24 passing tests**, syntax checks included.
- `npm run test:contract`: **6 passing tests** (one suite with five scenarios), compiling and starting the actual Go HTTP server with temporary data, using the JavaScript API client over loopback HTTP. Checks initial static page/report, assignments, availability, stale-write rejection, parity for **30 deterministic varied schedules**, and persistence after server restart.
- Backend `go test -race -count=1 -cover ./...`: **12 tests + one executable example**, passing with race detector and **78.7% statement coverage**. An earlier backend revision also passed ten repetitions with race detection; final shutdown/lock lifecycle changes received a fresh race run.
- Backend `go vet ./...` and `go build` passed. Official Go 1.27.3 toolchain was downloaded and SHA-256 verified for this environment; the code declares Go 1.22+.
- `npm run build` prepares only frontend resources in `dist/`; Go binaries, data, toolchain, credentials and local preview metadata are not frontend assets.

The frontend event tests use a lightweight DOM adapter, not a rendering engine. The HTTP contract tests use real TCP requests and real file persistence, not mocked server responses. API client tests separately simulate timeout, offline responses and invalid schemas.

## Browser QA for the upgrade

Supported managed Sites preview + CUA, 2026-10-30, Chromium desktop window 1188 × 848:

- Connected to the actual Go backend: explicit API mode, revision 1 and initial server-derived 12/14 coverage displayed.
- Changed Davi Sunday to afternoon through the UI: server-confirmed revision advanced and coverage became 13/14.
- Edited Clara Tuesday availability to none: persisted through the API, reached 14/14 with zero conflicts.
- Reloaded the page: revision 3, 14/14 and edited availability survived.
- Switched PT → EN → JA and visually inspected translated API-mode labels and metrics.
- Confirmed reset in Japanese: server revision advanced to 4 and initial 12/14, 104h scenario returned.
- Followed Back to demo: URL left API mode and clearly displayed browser-only storage mode again.
- Screenshots of the actual Go-backed UI: `api-go-pt.png`, `api-go-en.png`, `api-go-ja.png`.
- Preview stopped. Temporary preview launcher removed from package.json; shipped run commands do not refer to this environment's /tmp binaries.

Limits: mobile rendering, screen-reader audit and completed CSV download remain unverified. API concurrency/conflict, timeout and restart behavior are covered by automated tests rather than simultaneous browser tabs. No remote backend deployment occurred.

---

## Earlier static-demo QA (v1)



## Automated domain and translation checks

- `npm run check`: 14 passing tests (Node.js 24.22.1).
- Covers immutable updates, rejected input, repair to full coverage, availability exclusions, weekly hours, corrupted local state, CSV escaping/formula safety, complete EN/JA translations and all three CSV languages.
- UI event tests use a lightweight DOM adapter (not a rendering engine): edits, metrics, focus requests, reset/cancel, three languages and blocked storage, and CSV Blob/download-link event wiring. These do not replace real-browser QA.
- No dependency installation, build step or external service required.

## Browser verification

Manual Chromium QA using the managed Sites preview and supported CUA UI, 2026-10-30:

- Desktop rendering checked at a 1188 × 848 browser window in PT, EN and JA. Saved screenshots: `desktop-en.png`, `desktop-ja.png`. Portuguese was visually checked but its saved capture was discarded because another task changed the shared browser at that instant.
- Japanese choice persisted across reload; switching back to PT restored translated labels.
- Edited Clara Tuesday to Off, Bruno Tuesday to Afternoon and Davi Sunday to Afternoon. Verified 100% coverage, no conflicts and persistence after reload.
- Opened reset dialog, canceled and verified changes remained; reopened and confirmed, then verified initial 12/14 coverage, 104h and three review items.
- Native selects worked with keyboard navigation and showed visible focus.
- Clicked CSV export, but browser download history remained empty. Download completion is **not verified** in this managed browser. CSV content/escaping and localized Blob/link wiring are verified by automated tests; after this check, the link was hardened to attach to the DOM and revoke its Blob URL only after 30 seconds. That compatibility adjustment has not been rerun in the browser; no browser policy workaround was attempted.
- Mobile rendering is **not verified**: ordinary native window resize attempts left the available viewport unchanged, and device emulation was unavailable. Responsive CSS is implemented but still needs a real narrow-viewport/device check.
- No automated accessibility audit, screen-reader session, cross-browser matrix or production deployment was performed.

## Build

`npm run build` copies only HTML, CSS and source modules into `dist/`; successful local build. No publication or repository creation performed.
