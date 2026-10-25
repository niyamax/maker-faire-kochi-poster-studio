# Maker Faire Kochi Poster Studio

A standalone browser editor for expressive Maker Faire Kochi posters and eight-second motion loops. All artwork rendering and project storage happen locally in the browser.

## Run locally

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:8800/`. Set `PORT` to choose another port. The development server listens only on the local computer and rebuilds JavaScript and CSS changes; refresh the browser to see updates.

```sh
npm test
npm run build
npm run preview
```

The build produces a self-contained `dist/` directory. It needs no application server, account, API keys or external font requests. Generated output and installed dependencies are excluded from Git.

## Editing

- Air, Flex and Packed share the headline, supporting copy, selected font, layout and saved positions.
- Drag letters to move them; use their handles to reshape them. Adjacent letters yield within the poster frame.
- Drag and resize supporting text or the logo, or align them to the poster margins and centre. Hold Alt to bypass snapping.
- Choose portrait, story, square or banner formats, curated palettes or custom colours.
- Tune optical spacing and selective emphasis with Contrast, drawing weight with Inflation or Stroke, and shape character with Character.
- Preview Smooth, Steady, Punchy or Elastic motion. Undo and Redo cover edits.
- Export PNG, SVG, or one complete video loop. Video uses MP4 when the browser supports it, with WebM as a fallback; keep the tab visible while recording.

Projects autosave to browser storage. Use **Poster Studio → Save project** for a portable JSON file and **Open project…** to restore one. Browser storage belongs to its exact address, including the port; use a project file when moving between addresses. Project files contain the poster settings, not uploaded font files.

## Structure

- `src/` — editor, typography geometry, alignment, motion and export.
- `src/data/` — precompiled font outlines, supporting-text paths and embedded logo.
- `src/styles/` — editor styles and design tokens.
- `assets/` — supplied logo and licensed source fonts.
- `public/` — application HTML.
- `scripts/` — build, local server and optional font generation.
- `tests/` — geometry, motion continuity, positioning, state and export checks.

The application has three treatments, seven font choices, three layouts and two lettering styles. Latin uppercase headlines and the bundled supporting-text character set are supported; connected-script shaping is not implemented.

## Font assets

Precompiled outlines are committed, so normal builds need only Node.js. To regenerate them, install `fonttools[woff]` in a Python virtual environment and run:

```sh
python scripts/build-fonts.py
python scripts/build-copy-font.py
```

Font sources, axes and checksums are recorded in `assets/font-manifest.json`. See `NOTICE.md` and `licenses/` for font licensing and logo rights.
