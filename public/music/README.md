# Background music tracks

`SceneDocument.backgroundTrack` refers to a filename in this folder (served by
Remotion via `staticFile()`), mixed under the narration at low volume
(`volume={0.12}` in `SceneRenderer.tsx`).

No tracks are bundled yet — this repo doesn't ship any audio files by
default. Before using `backgroundTrack` on a real job:

1. Source a track from a clearly-licensed royalty-free library — Pixabay
   Music and the YouTube Audio Library both have usable options.
2. Drop the file in this folder (e.g. `calm-piano.mp3`).
3. **Record its license here**, plainly, before it ships in any real video:

| File | Source | License | Attribution required? |
|---|---|---|---|
| _(none yet)_ | | | |

Until a track is added and logged above, leave `backgroundTrack` unset —
`SceneRenderer` treats it as fully optional.
