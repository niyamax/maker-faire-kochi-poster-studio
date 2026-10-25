# Contributing

Thanks for helping improve Poster Studio. The project is a focused poster editor with shared layout rules, expressive type and direct canvas editing.

## Start a change

For a bug, include the steps to reproduce it, what you expected, what happened, and your browser and operating system. A screenshot or short recording is useful for lettering and motion issues. Share a minimal example instead of a private project file.

For a larger feature or visual change, open an issue to discuss the intended behaviour before making a substantial change. Small fixes can go straight to a pull request.

## Work locally

Fork the repository, clone your fork, and create a branch for your change. With Node.js 22 or newer:

```sh
npm ci
npm run dev
```

The application opens at `http://127.0.0.1:8800/`. Refresh after source changes rebuild. `npm test` runs the existing test suite, and `npm run build` creates `dist/`.

Use `src/` for application changes and `public/index.html` for the shell markup. Build output, dependencies and local project exports do not belong in commits.

## Typography and interaction changes

- Preserve the selected font, layout, content and saved placements when changing treatments.
- Keep canvas, PNG, SVG and video rendering consistent by using the shared scene renderer.
- Keep motion deterministic and continuous across the loop boundary.
- Preserve readable counters, logo proportions, direct editing and keyboard access.
- Keep controls focused on producing a cohesive set of posters.

For a visual change, include before-and-after images or a short recording and describe which fonts, formats and treatments it affects. For a behaviour change, explain the trigger and resulting behaviour. Keep pull requests focused so the change is easy to review.

## Assets and generated files

Font outlines in `src/data/` are generated from the source fonts in `assets/fonts/`. Regenerate them with the scripts described in the README when changing font assets. Include the applicable licence and update the asset manifest when adding or replacing a font.

Do not remove font copyright notices or treat the application-code licence as permission to reuse brand marks. See [NOTICE.md](NOTICE.md).

## Licence

By submitting a contribution to the application code or documentation, you agree that it may be distributed under the project's [MIT License](LICENSE). Identify any third-party material and its separate terms in your pull request.
