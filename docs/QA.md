# Verification

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
