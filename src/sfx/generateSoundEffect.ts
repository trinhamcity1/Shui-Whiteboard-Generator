// Same shape as tts/elevenlabs.ts's provider, but for ElevenLabs' Sound
// Effects endpoint (text prompt -> a short one-shot audio clip) instead of
// speech. Confirmed against ElevenLabs' own docs: POST /v1/sound-generation
// returns the raw MP3 bytes directly (not JSON+base64, unlike the TTS
// endpoint), 200 credits per generation regardless of length.
const COST_PER_GENERATION_USD = 0.033; // ~200 credits at the $22/121,000-credit Creator plan rate

export interface SoundEffectResult {
  audioBuffer: Buffer;
  costUsd: number;
}

export async function generateSoundEffect(
  apiKey: string,
  prompt: string,
  opts?: { durationSeconds?: number },
): Promise<SoundEffectResult> {
  if (!apiKey) throw new Error("generateSoundEffect requires an API key (ELEVENLABS_API_KEY).");

  const response = await fetch("https://api.elevenlabs.io/v1/sound-generation", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: prompt,
      duration_seconds: opts?.durationSeconds,
      model_id: "eleven_text_to_sound_v2",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`ElevenLabs sound-generation request failed (${response.status}): ${body}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  return { audioBuffer, costUsd: COST_PER_GENERATION_USD };
}
