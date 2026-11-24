# What Is a Maker Faire?

A 24-second silent explainer. The opening photo and its shrinking frame give it a different rhythm from the date announcement. The final 4K cut uses the [shared vertical export and crop settings](reels.md#maker-faire-kochi-awareness). [Earlier 1080p reference](media/what-is-a-maker-faire.mp4)

## Open the editable reel

From the repository root, with the project dependencies installed:

```sh
node scripts/reel/what-is-a-maker-faire.mjs
```

Open `output/reels/what-is-a-maker-faire.html` in Chromium or another browser with Canvas 2D and OffscreenCanvas. The preview works offline and has Play, Pause, Replay and a scrubber. Add `--out path/to/reel.html` to choose an output path. This generator reproduces the earlier 1080p cut. Apply the framing changes below when rebuilding the final master.

Edit the scene timing, photo crops and folds in [reel.js](../scripts/reel/awareness/reel.js). Edit the programme wording, date data or asset paths in [the preview generator](../scripts/reel/what-is-a-maker-faire.mjs). The generator uses the Studio [treatment renderer](../src/treatment.js) and [Flow motion](../src/flow-motion.js) for the letterforms. The [angled reveal recipe](reel-date-reveal.md) covers the related announcement style.

## Reference flow

| Time | What the viewer sees |
| --- | --- |
| 0.00–3.24 s | Solid-white Studio type opens over a full-bleed black-and-white photo. The photo shrinks into its frame and regains color as the question becomes **A show-and-tell for things people make**. |
| 3.24–5.54 s | The definition holds. Its photo and caption then close into a diagonal seam, and the three prompts unfold from it. |
| 5.54–9.36 s | The three prompts appear together. At 5.82 s, **See a prototype** opens an angled window that rises to the right. The window closes back to the prompts. |
| 9.36–12.90 s | **Meet the maker** opens a window that rises to the left, then closes back to the prompts. |
| 12.90–16.50 s | **Ask how it works** opens a window that rises to the right and holds on the soldering photo. |
| 16.50–19.14 s | The photo and title close into a seam. Red opens from it and reveals **5–6** in place, followed by the small white logo and the event details. |
| 19.14–24.00 s | The finished date card holds still. |

## On-screen script and type

Slashes mark line breaks in the lettering.

| State | Copy | Type |
| --- | --- | --- |
| Opening | `WHAT IS A / MAKER / FAIRE?` | White Studio Packed with Flow |
| Definition | `A SHOW-AND-TELL / FOR THINGS / PEOPLE MAKE` | Studio Packed with Flow. White over the photo and red on the surrounding white canvas as the words move below the frame. |
| Prompts | `SEE A PROTOTYPE / MEET THE MAKER / ASK HOW IT WORKS` | Red Studio Packed with Flow. Lift and lean the active row as its photo window opens. |
| Date card | `5–6`<br>`FEBRUARY 2027`<br>`The Grounds @ Chakola Mill`<br>`makerfaire.in`<br>`Free entry` | White Studio Packed numerals, Studio Air for the month and year, and bundled Inter for the details. Set venue and website at the same 48 px size and free entry at 43 px on the 1080 layout. |

## Framing and transitions

- Open with a full-bleed monochrome hall photo and white type directly over it. From 1.85 s, shrink the photo into its frame and bring back its color. Overlap the two text states as the question contracts and the definition stretches into place. Keep the programme photos in color.
- Connect the definition, prompts, and date with folds. Bring both edges of the photo mask into a diagonal seam and compress the active lettering toward it. Open the next composition from the same seam. Keep the photo and the moving type on the same timeline.
- Work on a logical 1080 × 1920 canvas. In the 4K cut the settled definition frame is `x=76, y=325, w=928, h=857`. The programme window spans `x=93` to `x=987`, with its high edge at `y=530`, its low edge at `y=586`, and its base near `y=1490`. Set the raised prompt near `y=369`.
- Center the [long white logo](../assets/logos/MF_Kochi_Logo_long_white.svg) at 468 px wide on the 1080 layout. Open the red card over the date and let the supporting elements finish their entrances. Keep the date numerals anchored throughout the reveal and the hold.

## Photo sources

- **Cover and definition.** The TinkerSpace hall photo published with the Gramasabha listing. The cover uses a grayscale copy of the same crop. [TinkerSpace](https://tinkerhub.foundation/tinkerspace)
- **See a prototype.** Robots lined up at the Arduino Day track, from Abhiram N J’s recap. [Arduino Day](https://www.linkedin.com/posts/abhiram-n-j_i-landed-in-kochi-at-9-am-the-event-started-activity-7447217883576770561-UFN5)
- **Meet the maker.** A group watching a demonstration at Maker Thursday. [TinkerSpace](https://tinkerhub.foundation/tinkerspace)
- **Ask how it works.** Attendees soldering badges at Space Carnival. [Space Carnival](https://space-carnival-psi.vercel.app/badge/)
