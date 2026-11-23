# Maker Faire Kochi angled reveal

The reference is the **22.5-second silent date announcement** for Maker Faire Kochi, 5–6 February 2027. The event name opens the film, three programme rows make room for three photographs, and the date closes the film. The sequence works as a short invitation on its own and as a starting point for visitor and volunteer callouts.

The image motion takes its cue from [Alphabetical’s Blavatnik Galleries case study](https://alphabetical.studio/project/iwm-blavatnik-art-film-and-photography-galleries). In the Kochi version, the moving paper edge and the intact Studio letters give the photo room to open.

## How to build it

1. **Open with the event name.** Set `MAKER / FAIRE / KOCHI` as three white rows on Maker Faire red. Bring the rows in close together and make the complete title readable before the angled white wipe.
2. **Let the lettering create the photo window.** Set `EXHIBITIONS / WORKSHOPS / SESSIONS` as three red rows on white. Show the list together first. Lift the active row as the window grows beneath it, and move the other rows out of the reading area. The image fills the mask and keeps its proportions. Close the first two windows back to the list before opening the next one. Let the last photo stay open into the date wipe.
3. **Use native Studio motion.** Reuse [Flow](../src/flow-motion.js) through [the treatment renderer](../src/treatment.js) for the title and programme rows. Keep each glyph whole and let the rows move with the opening. Place the photo and headline on the same timeline so their edges meet as intended.
4. **Show a distinct subject in each window.** Select the opening and crop with the subject in mind. For exhibitions, a candid view of several developed projects gives the viewer something to inspect. For workshops, frame hands, tools and the work in progress. For sessions, frame the demonstration or the exchange between people. Use real maker-event photos when available and describe generated scenes as illustrations. The reference cut pairs a generated exhibition bench with real TinkerSpace workshop and session photos.
5. **End on one readable date card.** Wipe to red, then bring in the date, month and year, small white logo, venue and website. Use Studio Air for `FEBRUARY 2027` and match the venue and website font sizes. Keep the white lockup compact with room around it. The numerals get one entrance and stay fixed once they are revealed.
6. **Export the silent cut.** Use 1080 × 1920 at 30 fps for this reference. Check the hook and the fully open photos at phone size. Scrub the date entrance and compare two frames during the hold to confirm the finished card is still.

## Reference timing

Use these timings to recreate the reference. For a new message, preserve the short opener, the time to read each photograph, and the still end card.

| Time | What the viewer sees |
| --- | --- |
| 0.00–1.75 s | `MAKER / FAIRE / KOCHI` is fully in place by about 0.66 s. |
| 1.75–2.63 s | The angled white wipe brings in the programme list. |
| 2.63–4.38 s | The three programme rows hold together before the first image. |
| 4.38–7.88 s | Exhibitions opens to the bench at 5.26 s, holds, then closes. |
| 7.88–11.39 s | Workshops opens to badge soldering at 8.76 s, holds, then closes. |
| 11.39–14.89 s | Sessions opens to a live demonstration at 12.26 s and holds into the red wipe. |
| 14.89–17.52 s | The date takes over. **5–6** settles at 15.77 s. The small white logo and supporting lines finish their entrances. |
| 17.52–22.50 s | The finished date, venue and website hold still. |

At 1080 × 1920, the open photo window is 894 px wide. Its upper edge rises 56 px from left to right. Animate the upper and lower edges away from the same seam and keep the photo behind the mask. On the end card, the reference uses the [long white lockup](../assets/logos/MF_Kochi_Logo_long_white.svg) at 468 px wide. The venue and website both use 48 px text.

## Adapt it for a callout

For a visitor invite, use a short opening line and open onto a project, workshop or encounter worth coming for. End with the date, venue and free entry. For a volunteer callout, show a candid moment that gives a sense of the people and the work, then use the end card for the action and destination. A single strong image can carry a short callout. Give each post one clear reason to come or take part.

Use [the Window script](../scripts/reel/window.mjs) as a starting point for a single photo opening. The timing above specifies the separate stages for an announcement with multiple windows and a dedicated date card.
