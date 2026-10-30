# Morada design system v1

Identity: Morada (indigo night, sunset gold, trust green; Bricolage Grotesque, Figtree, IBM Plex Mono; pill buttons).
Structure: measured with `reverse-brand` on www.immobiliare.it (8px grid, type ratio 1.47, 48px controls,
16px card radius, 56/48px header, `cubic-bezier(0.4, 0, 0.2, 1)` at 250ms, voice rules). No colours, fonts,
images or copy were taken from the reference site.

- `design-system.html`: the guide (Italian, examples in Spanish), dark and light themes.
- `tokens.css`, `tokens.json`: 96 tokens (W3C JSON with OKLCH and light-theme values).
- `morada-bridge.css`: maps Morada's current variables (`--bg`, `--accent`, `--r`, ...) onto the tokens.
- `identity.json`: Morada's identity and copy; `reference-analysis.json`: the measured structure.

Rebuild: `node ../reverse-brand/bin/derive-system.js reference-analysis.json identity.json .`
