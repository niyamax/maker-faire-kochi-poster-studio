# Maker Faire Kochi Poster Studio

Make expressive posters with letters that stretch, share space and move together. Poster Studio combines direct canvas editing, a small set of lettering treatments and the Maker Faire Kochi colour palette in a browser-based tool.

![Poster Studio showing an editable Maker Faire Kochi poster](docs/images/studio.png)

## What you can make

- **Three treatments:** Air, Flex and Packed. Switching treatments keeps your font, layout, headline, supporting text and saved positions.
- **Expressive type:** seven font choices, optical spacing, selective exaggeration, inflation and outline drawing.
- **Direct editing:** drag letters, reshape them with handles, and move or resize the supporting text and logo.
- **Cohesive layouts:** shared margins, snapping, alignment controls and portrait, story, square and banner formats.
- **Motion posters:** seamless eight-second loops with Smooth, Steady, Punchy and Elastic curves.
- **Image layouts:** an Image window for photography and an Object cut-out layout for transparent objects, with local upload and crop or overlap controls.
- **Portable output:** PNG images, outlined SVG artwork, video loops and editable JSON project files.

The editor renders artwork and saves projects in your browser. It requires no account, application backend or API keys. Fonts and artwork assets are bundled locally; the application contains no analytics or cloud upload integration.

## Get started

Install [Node.js](https://nodejs.org/) 22 or newer, then:

```sh
git clone https://github.com/niyamax/maker-faire-kochi-poster-studio.git
cd maker-faire-kochi-poster-studio
npm ci
npm run dev
```

Open **[http://127.0.0.1:8800/](http://127.0.0.1:8800/)**. The development server listens only on your computer. JavaScript and CSS changes rebuild automatically; refresh the browser to see them.

If the port is occupied, set the `PORT` environment variable before starting the server. For example, in a POSIX shell:

```sh
PORT=8801 npm run dev
```

## Create a poster

1. Enter a headline and supporting text. Headlines accept **120 characters**, including spaces and line breaks. Use line breaks to shape the composition.
2. Choose **Air**, **Flex** or **Packed** above the canvas, then select a font and layout in the properties panel.
3. Adjust **Contrast** for emphasis, **Inflation** or **Stroke** for drawing weight, and **Character** for shape variation.
4. Drag a letter to move it. Pull its handles to reshape it; nearby letters make room. Select supporting text to align its lines left, centre or right. Text and logo blocks can also be resized or aligned to the poster.
5. Pick a palette or set custom colours. Press Play to preview motion, then export.

### Add an image

New posters start with the **Studio robot** cut-out. Saved projects retain their selected image, including posters with no image. Use **Replace** or **Add image** in the content panel, or the **Samples** dropdown beside the Image heading, to choose another image.

- **Image window** starts with a composed photo frame. Drag it anywhere on the poster. Corner handles resize it proportionally; edge handles change the frame shape. Double-click the photo or choose Adjust crop to reframe its contents with dragging and Crop zoom.
- **Object cut-out** places a transparent PNG or WebP in front of the lettering. Drag it freely in two dimensions and use corner handles or Size to resize it without distortion. Moving the object keeps its size fixed. Type response controls how strongly the letters give way around the silhouette, from no response to full interaction.

Both layouts have poster alignment controls, snapping guides and Reset image placement. Images may extend beyond the poster edge for intentional cropping. Image position, frame size and crop are saved separately.

Upload PNG, JPG or WebP files up to 20 MB. The browser resizes and re-encodes images locally, preserves transparency, trims transparent padding and embeds the processed pixels in saved projects. All export formats use the same image placement. Removing an image restores the full typography frame while retaining your saved type settings and offsets.

| Image window | Object cut-out |
| --- | --- |
| [![Image window example](docs/images/image-window.png)](docs/images/image-window.png) | [![Object cut-out example](docs/images/object-cutout.png)](docs/images/object-cutout.png) |

### Canvas shortcuts

| Action | Control |
| --- | --- |
| Move a selected item | Arrow keys |
| Bypass snapping while dragging | Hold Alt |
| Cancel a drag or clear selection | Escape |
| Play or pause with canvas focus | Space |
| Undo | Cmd/Ctrl + Z |
| Redo | Cmd/Ctrl + Shift + Z |

### Save your work

Projects autosave to local browser storage. Use **Poster Studio → Save project** to download an editable JSON file, and **Open project…** to restore it.

Browser storage is specific to the address and port you use. Save a project file before switching addresses, clearing browser storage or moving to another device. Project files contain the poster settings and any uploaded image. Fonts and the logo are supplied by the application. Project files can be up to 4 MB.

### Export

| Format | Output |
| --- | --- |
| PNG | A still image of the current poster |
| SVG | Vector artwork with outlined text and an embedded logo |
| Video | One complete eight-second loop, up to 1920 pixels on its longest side |

Video exports use MP4 when supported by the browser, with WebM as a fallback. Keep the tab visible while recording. The editor reports when canvas video recording is unavailable.

Headlines use the supported Latin uppercase letters, numbers and punctuation. Supporting text uses the bundled Inter character set and up to two lines. Connected-script shaping is not implemented.

## Build and development

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local editor with JavaScript and CSS rebuilds |
| `npm run build` | Generate the distributable application in `dist/` |
| `npm run preview` | Serve an existing `dist/` build locally |
| `npm test` | Run the geometry, motion, state and export tests |

The `dist/` folder can be served by a static web host. It includes the application, runtime assets, licence and asset notices. Keep these files together when distributing the build. The development server is for local use.

The npm package has `private: true` to prevent accidental publication to the npm registry; this does not restrict the public GitHub repository or the MIT licence.

### Source map

| Folder | Contents |
| --- | --- |
| `src/` | Editor, typography geometry, alignment, motion and export |
| `src/data/` | Precompiled font outlines, supporting-text paths and embedded logo |
| `src/styles/` | Editor styles and design tokens |
| `assets/` | Source fonts, logo and asset manifests |
| `public/` | Application HTML |
| `scripts/` | Build, local server and optional font generation |
| `tests/` | Rendering, continuity, positioning, state and export tests |

Precompiled outlines are included, so normal builds need only Node.js. To regenerate them, install `fonttools[woff]` in a Python virtual environment and run:

```sh
python scripts/build-fonts.py
python scripts/build-copy-font.py
```

## Contributing

Bug reports, improvements and contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and guidance for visual changes. You can [report a bug or suggest a feature](https://github.com/niyamax/maker-faire-kochi-poster-studio/issues/new/choose).

## Licence and assets

The **application code is licensed under MIT**. See [LICENSE](LICENSE).

Bundled fonts and their derived outlines retain the **SIL Open Font License 1.1**, with individual notices in [licenses/](licenses/) and source details in [assets/font-manifest.json](assets/font-manifest.json).

The Maker Faire Kochi logo and Maker Faire names and marks are separate from the application-code licence. No trademark rights are granted. See [NOTICE.md](NOTICE.md) for the asset notices.
