# reverse-brand

`reverse-brand <url>` turns a public brand website into an **unofficial**, art-directed brand guide.
Every value is measured from computed styles, reduced to roles, exported as design tokens and
rebuilt in the guide to prove the tokens work.

## Rules the tool follows

- Everything is marked "Unofficial analysis" with "Not affiliated with or endorsed by <brand>.
  Trademarks belong to their owners." (guide cover, top bar, footer, every slide, the video).
- No logos, font files or brand images are copied. Logos become dashed placeholders with their
  measured size and colour; images are described in words and linked to their source pages.
- Bot checks are never bypassed. If headless capture meets a challenge it stops and offers
  `--headed` (you complete the check) or the DevTools snippet.
- AI images come from text prompts only and are labelled "AI-generated image" wherever they appear.

## Usage

```bash
node bin/reverse-brand.js https://www.example.com              # capture + everything
node bin/reverse-brand.js https://www.example.com --headed     # visible browser, you pass checks
node bin/reverse-brand.js https://www.example.com --snippet    # write snippet-devtools.js only
node bin/reverse-brand.js https://www.example.com --snapshot ~/Downloads/snapshot.json
node bin/reverse-brand.js https://www.example.com --images manual            # print prompts
node bin/reverse-brand.js https://www.example.com --snapshot out/<host>/snapshot.json --import
node verify.js out/<host>
```

Requires Node 18+, Playwright (uses installed Google Chrome when present, otherwise Playwright
Chromium, always with `--disable-gpu`) and ffmpeg (WebP and H.264).

### DevTools snippet

`--snippet` writes `snippet-devtools.js`. Paste it into the Console on the brand's home page: it
runs the same extractor in one same-origin popup window (resized to 1440px, then 390px), picks 3-5 key pages the same
way the CLI does, and downloads `snapshot.json`. Feed that file back with `--snapshot`.

### Images

`IMAGES` (env or `--images`): `none` (default, CSS gradients built from the colour tokens),
`manual` (print `prompts.json`; drop files into `out/<host>/images/<slot>.png`, then `--import`),
or `api` (provider adapter in `src/providers/`, key from `.env`, job ids saved before polling,
downloads streamed to disk, cost logged per image). Images are re-encoded to WebP (2000px wide
slots, 1400px others).

## Output: `out/<host>/`

`brand-guide.html` (no images, <=150 KB, offline), `brand-guide-hero.html` (WebP embedded once,
<=4 MB), `tokens.css`, `tokens.json` (W3C design tokens, OKLCH in `$extensions`), `snapshot.json`,
`analysis.json`, `prompts.json`, `images/`, `slides/` (8 x 1080x1350, 4 x 1600x900),
`video/<host>-presentation-1920x1080-60fps.mp4` + `video/stills/`, `run-log.md`,
`screenshots/`, `verify-report.json`.

## Layout

- `src/extractor.js` in-page extractor (shared by Playwright and the snippet)
- `src/pages.js` key-page scoring
- `src/capture.js` Playwright capture and challenge handling
- `src/analyse.js` type, colour, layout, components, imagery, voice
- `src/tokens.js` CSS custom properties and W3C JSON
- `src/theme.js`, `src/guide.js` the guide
- `src/images.js`, `src/providers/` prompts, import, API adapter
- `src/slides.js`, `src/video.js` social exports and the frame-accurate video
- `verify.js` checks and review screenshots
- `test/` a fictional fixture site for local runs (`node test/serve-fixture.js`)
