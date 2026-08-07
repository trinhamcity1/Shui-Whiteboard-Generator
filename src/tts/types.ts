export interface WordTiming {
  word: string;
  startSeconds: number;
  endSeconds: number;
}

export interface TTSResult {
  audioBuffer: Buffer;
  durationSeconds: number;
  wordTimings?: WordTiming[];
  costUsd: number;
  characters: number;
}

export interface TTSProvider {
  synthesize(text: string, opts: { voice: string }): Promise<TTSResult>;
}
