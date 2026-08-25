# Sound effects

Generated once via ElevenLabs' Sound Effects API (`POST /v1/sound-generation`,
`eleven_text_to_sound_v2`) using the same API key as narration TTS — see
`scripts/generate-sfx-library.ts` for the exact prompts. Reused free on
every render after generation, same economics as the drawn art library.
No third-party licensing question (unlike `public/music/`): these are
generated directly from a text prompt, not sourced from anyone else's
recording.

| File | Prompt | Used for |
|---|---|---|
| `scene-whoosh.mp3` | "A soft, quick whoosh transition sound effect for a video cut..." | Every scene cut but the first (`SceneRenderer.tsx`) |
| `reveal-chime.mp3` | "A short, bright, pleasant single bell chime..." | A `checkmark` decoration's reveal (`decorations/Decoration.tsx`) |

To add more: add an entry to `SFX_MANIFEST` in
`scripts/generate-sfx-library.ts` and run it — it only generates files
that don't already exist here (`--force` regenerates everything).
