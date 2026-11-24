# How Can I Take Part?

A 16.8-second silent invitation to visit, exhibit, or volunteer at Maker Faire Kochi. The three roles share one poster. Each photo band grows in place, takes the viewer’s attention for a few seconds, then gives that space to the next role. Use the [shared 4K export and crop settings](reels.md#maker-faire-kochi-awareness).

## On-screen script

| Beat | Headline | Supporting copy |
| --- | --- | --- |
| Opening | `HOW CAN I` / `TAKE PART?` | |
| Visit | `VISIT` | Meet the people behind the projects. |
| Exhibit | `EXHIBIT` | Bring something you’ve made. |
| Volunteer | `VOLUNTEER` | Help the crew bring it all together. |
| Close | `5–6` / `FEBRUARY 2027` | `makerfaire.in` |

The end card uses the white Maker Faire Kochi lockup and makes the main event site the sole call to action.

## Type and layout

- Use red **Studio Packed** with Flow for the two-line headline and the role labels. Keep the headline above the three bands throughout the role sequence. On the 1080 × 1920 layout, the 4K composition’s title box is `x=67, y=329, w=946, h=289`.
- Start the photo bands at `y=659` with a 16 px gap. Keep their right edge at `x=1005`. Let the active photo reach left to `x=75` as its band gains height. The other two stay visible in narrower, partly desaturated crops. Use a slight diagonal tilt on the moving edge. Let each photo’s human subject or project stay visible as the aperture changes.
- Keep the role label red over white and white where it crosses the photo. Use a dark gradient near the bottom of the active crop for legibility. Bring its supporting line in as the band reaches its expanded state. The supporting lines use 41 px Geist at weight 590 on the 1080 layout.
- Open a red end card from the volunteer photo. Center the [long white logo](../assets/logos/MF_Kochi_Logo_long_white.svg) at 468 px wide. Set the date in **Studio Packed**, `FEBRUARY 2027` in **Studio Air**, and the website in white 58 px Geist at weight 640. Hold the completed card still.

For the headline and roles, use [the Studio outline helper](../scripts/reel/awareness/studio-type.js) with the [Flow timing](../src/flow-motion.js). Ease the band weights together, applying each weight to the row height, the photo mask, the label bounds, and the supporting text opacity. Use a single closing reveal from the last photo.

## Timing

| Time | What the viewer sees |
| --- | --- |
| 0.00–0.91 s | The question and all three compact roles are visible. |
| 0.91–4.56 s | Visit expands, reaches its full state at 1.68 s, and holds. |
| 4.56–8.15 s | Exhibit takes over the expanded band, reaching full size at 5.30 s. |
| 8.15–11.84 s | Volunteer takes over the expanded band, reaching full size at 8.92 s. |
| 11.84–13.09 s | The red card unfolds from inside the volunteer photo. The mask reveals the logo, date, and website in place. |
| 13.09–16.80 s | The finished date and website hold still. |

## Photo sources

- **Visit.** `DSC03951.JPG`, TinkerHub media archive. [Glass Room Exhibition Press album](https://drive.google.com/drive/folders/1OzZ5ZtbT5FAw4qNxyeHT5XRbObcKOdjV)
- **Exhibit.** `PXL_20241214_072957469.PORTRAIT.jpg`, TinkerHub media archive. [Space Carnival 2024](https://drive.google.com/drive/folders/1vojOC0FUQFyTXWjzIRZ_JKmMv5-m_520)
- **Volunteer.** `20241214_143737.jpg`, TinkerHub media archive. [Space Carnival 2024](https://drive.google.com/drive/folders/1vojOC0FUQFyTXWjzIRZ_JKmMv5-m_520)
