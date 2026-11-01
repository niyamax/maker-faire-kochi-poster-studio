# Licence and asset notices

## Application code

Application source code, scripts and documentation are licensed under the MIT License in [LICENSE](LICENSE). The font software and brand artwork below are governed separately.

## Procedural lettering

Studio Sans and the exploratory Beam Sans sample are original procedural application code covered by the MIT licence. Beam Sans is currently a drawing system and specimen page, not a redistributed font binary.

## Fonts

Bundled fonts and derived outlines retain their respective SIL Open Font License 1.1 terms. Unmodified licence files are included in [licenses/](licenses/); official source URLs, source filenames, instance axes and SHA-256 checksums appear in [assets/font-manifest.json](assets/font-manifest.json).

The editor UI uses Geist. Supporting text uses Inter. Display fonts include Geist, Inter, Anton, Bowlby One, Dela Gothic One and Bricolage Grotesque, alongside the procedural Studio Sans alphabet. Studio Sans is part of the application code.

Keep the applicable font notices with redistributed fonts and derived outlines. The build copies the licence files into `dist/licenses/`.

## Brand artwork

The supplied Maker Faire Kochi logo is preserved as artwork. The MIT licence for the application does not license the logo, Maker Faire names or related marks, and does not grant trademark rights. Those rights remain with their respective holders.

The original raster logo is `assets/MF_Kochi_Logo_long.png`. The selectable long, bordered and square SVG logos, including black and white versions, are in `assets/logos/`, converted from the supplied vector PDFs. Their embedded rendering data is generated in `src/data/logo.js` by `scripts/build-logos.mjs`. Source notes are in [assets/logos/README.md](assets/logos/README.md); asset checksums are recorded in [assets/logo.json](assets/logo.json).

## Demonstration images

The images in `assets/samples/` were generated for this project's layout demonstrations and are provided under the MIT licence. They illustrate sample maker projects. User-uploaded images retain their own rights and are processed locally in the browser.

## Media encoding

Mediabunny 1.62.1 by Vanilagy and contributors is bundled, unmodified, for WebCodecs encoding and MP4/WebM muxing. It is licensed under the Mozilla Public License 2.0; see `licenses/MEDIABUNNY-MPL-2.0.txt`. The corresponding source is distributed in the [exact npm source package](https://registry.npmjs.org/mediabunny/-/mediabunny-1.62.1.tgz) and maintained at [Vanilagy/mediabunny](https://github.com/Vanilagy/mediabunny). This separate dependency retains its licence; the surrounding application code retains its MIT licence.
