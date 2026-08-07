import type { TTSProvider, TTSResult, WordTiming } from "./types.js";

// Published ElevenLabs rate is closer to $0.18 per 1,000 characters on
// paid tiers. This is a planning-stage estimate for the cost printout,
// not billing data pulled from the account — Phase 2 can replace this
// with a real usage API call if ElevenLabs exposes one.
const COST_PER_CHARACTER_USD = 0.00018;

interface ElevenLabsAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

interface ElevenLabsWithTimestampsResponse {
  audio_base64: string;
  alignment: ElevenLabsAlignment;
}

function wordTimingsFromAlignment(alignment: ElevenLabsAlignment): WordTiming[] {
  const { characters, character_start_times_seconds, character_end_times_seconds } = alignment;
  const timings: WordTiming[] = [];

  let currentWord = "";
  let wordStart: number | null = null;
  let wordEnd = 0;

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i]!;
    if (/\s/.test(char)) {
      if (currentWord.length > 0 && wordStart !== null) {
        timings.push({ word: currentWord, startSeconds: wordStart, endSeconds: wordEnd });
      }
      currentWord = "";
      wordStart = null;
      continue;
    }
    if (wordStart === null) {
      wordStart = character_start_times_seconds[i]!;
    }
    wordEnd = character_end_times_seconds[i]!;
    currentWord += char;
  }
  if (currentWord.length > 0 && wordStart !== null) {
    timings.push({ word: currentWord, startSeconds: wordStart, endSeconds: wordEnd });
  }

  return timings;
}

export class ElevenLabsTTSProvider implements TTSProvider {
  constructor(private readonly apiKey: string) {
    if (!apiKey) {
      throw new Error("ElevenLabsTTSProvider requires an API key (ELEVENLABS_API_KEY).");
    }
  }

  async synthesize(text: string, opts: { voice: string }): Promise<TTSResult> {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${opts.voice}/with-timestamps`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ElevenLabs TTS request failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as ElevenLabsWithTimestampsResponse;
    const audioBuffer = Buffer.from(data.audio_base64, "base64");
    const wordTimings = wordTimingsFromAlignment(data.alignment);
    const durationSeconds = wordTimings.length > 0 ? wordTimings[wordTimings.length - 1]!.endSeconds : 0;

    return {
      audioBuffer,
      durationSeconds,
      wordTimings,
      characters: text.length,
      costUsd: text.length * COST_PER_CHARACTER_USD,
    };
  }
}
