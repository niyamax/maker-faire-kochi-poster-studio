# What Is a Maker Faire?

A 24-second silent awareness reel at 1080 × 1920 and 30 fps. [Watch or download the reference MP4](media/what-is-a-maker-faire.mp4).

## Open the editable reel

From the repository root, with the project dependencies installed:

```sh
node scripts/reel/what-is-a-maker-faire.mjs
```

Open `output/reels/what-is-a-maker-faire.html` in Chromium or another browser with Canvas 2D and OffscreenCanvas. The preview works offline and has Play, Pause, Replay and a scrubber. Add `--out path/to/reel.html` to choose an output path.

Edit the scene timing, photo crops and folds in [reel.js](../scripts/reel/awareness/reel.js). Edit the programme wording, date data or asset paths in [the preview generator](../scripts/reel/what-is-a-maker-faire.mjs). The generator uses the Studio [treatment renderer](../src/treatment.js) and [Flow motion](../src/flow-motion.js) for the letterforms. The [angled reveal recipe](reel-date-reveal.md) covers the related announcement style.

## Reference flow

| Time | What the viewer sees |
| --- | --- |
| 0.00–3.24 s | Solid-white Studio type opens over a full-bleed black-and-white photo. The photo shrinks into its frame and regains color as the question becomes **A show-and-tell for things people make**. |
| 3.24–5.54 s | The definition holds. Its photo and caption then close into a diagonal seam, and the three prompts unfold from it. |
| 5.82–9.36 s | **See a prototype** opens an angled window that rises to the right. |
| 9.36–12.90 s | **Meet the maker** opens a window that rises to the left. |
| 12.90–16.50 s | **Ask how it works** opens to the right and holds on the soldering photo. |
| 16.50–19.14 s | The photo and title close into a seam. Red opens from it and reveals **5–6** in place, followed by the small white logo and the event details. |
| 19.14–24.00 s | The finished date card holds still. |

## Photo sources

- **Cover and definition.** The TinkerSpace hall photo published with the Gramasabha listing. The cover uses a grayscale copy of the same crop. [TinkerSpace](https://tinkerhub.foundation/tinkerspace)
- **See a prototype.** Robots lined up at the Arduino Day track, from Abhiram N J’s recap. [Arduino Day](https://www.linkedin.com/posts/abhiram-n-j_i-landed-in-kochi-at-9-am-the-event-started-activity-7447217883576770561-UFN5)
- **Meet the maker.** A group watching a demonstration at Maker Thursday. [TinkerSpace](https://tinkerhub.foundation/tinkerspace)
- **Ask how it works.** Attendees soldering badges at Space Carnival. [Space Carnival](https://space-carnival-psi.vercel.app/badge/)
