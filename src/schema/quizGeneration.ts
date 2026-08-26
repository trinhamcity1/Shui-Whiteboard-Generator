import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// Same Sonnet rates/model as scriptWriting.ts and planning.ts — kept as its
// own constant pair, same reasoning as those two: this module can change
// model/pricing independently later without an unrelated diff elsewhere.
const INPUT_COST_PER_MTOK_USD = 3.0;
const OUTPUT_COST_PER_MTOK_USD = 15.0;
const DEFAULT_MODEL = "claude-sonnet-5";

const QuizOptionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

export const QuizQuestionPlanSchema = z
  .object({
    id: z.string().min(1),
    prompt: z.string().min(1),
    options: z.array(QuizOptionSchema).min(2).max(6),
    correctOptionIds: z.array(z.string().min(1)).min(1),
    requiredCorrectCount: z.number().int().positive(),
    explanation: z.string().min(1),
  })
  .superRefine((q, ctx) => {
    const optionIds = new Set(q.options.map((o) => o.id));
    if (optionIds.size !== q.options.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `question "${q.id}" has duplicate option ids`, path: ["options"] });
    }
    for (const correctId of q.correctOptionIds) {
      if (!optionIds.has(correctId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `question "${q.id}"'s correctOptionIds references "${correctId}", which is not one of its own option ids`,
          path: ["correctOptionIds"],
        });
      }
    }
    if (q.requiredCorrectCount > q.correctOptionIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `question "${q.id}"'s requiredCorrectCount (${q.requiredCorrectCount}) exceeds its own correctOptionIds count (${q.correctOptionIds.length})`,
        path: ["requiredCorrectCount"],
      });
    }
  });

export const QuizPlanSchema = z.object({
  questions: z.array(QuizQuestionPlanSchema).min(1),
});
export type QuizPlan = z.infer<typeof QuizPlanSchema>;

// Mirrors Shui's videos/{id}/quiz/current and quiz/answers Firestore
// documents exactly (see shui/scripts/seed_civics.ts) — options and
// requiredCorrectCount are public (shown to the learner before answering);
// correctOptionIds and explanation are answers-only (server/admin-read-only
// in Shui, never sent to a client ahead of grading). Keeping them as two
// separate return values instead of one combined object makes it structurally
// awkward to accidentally leak the answers doc into a public response.
export interface QuizCurrentDoc {
  version: 1;
  questions: Array<{
    id: string;
    prompt: string;
    options: Array<{ id: string; text: string }>;
    requiredCorrectCount: number;
    orderIndex: number;
  }>;
  passThreshold: number;
}

export interface QuizAnswersDoc {
  version: 1;
  answers: Array<{ id: string; correctOptionIds: string[]; explanation: string }>;
}

export interface QuizGenerationResult {
  quizCurrent: QuizCurrentDoc;
  quizAnswers: QuizAnswersDoc;
  tokensUsed: number;
  costUsd: number;
}

const DEFAULT_PASS_THRESHOLD = 0.6; // matches every quiz seed_civics.ts writes

function buildSystemPrompt(maxQuestions: number): string {
  return `You write multiple-choice quiz questions for a short educational video, testing exactly what the video's own narration just taught — never anything outside it.

Rules:
- Write at most ${maxQuestions} question(s). Write fewer if the narration doesn't honestly contain that many distinct testable facts — one question per genuinely distinct fact the narration states, never padding to hit a count and never testing something the narration didn't actually say.
- Each question needs 4 options when the content supports it (3 plausible, topically-relevant wrong answers plus the correct one) — never fewer than 2, never obviously-wrong throwaway distractors like "none of the above" or a joke answer. A good distractor is something a viewer who half-remembered the video might actually pick.
- Exactly one correct option per question in the overwhelming common case (correctOptionIds has one entry, requiredCorrectCount: 1). Only use more than one correct option if the narration genuinely presented multiple independently-correct answers to the same question and asks the learner to pick more than one of them.
- Option ids: "correct" for the correct answer, "d1"/"d2"/"d3" for distractors (matches this platform's existing content). Question ids: "q1", "q2", ... in order.
- "explanation" is shown only after the learner answers — one sentence saying why the correct option is right, specific enough to teach something even to someone who got it wrong.
- Prompts and options must stand alone without the video playing — no "as shown above," no "the thing I just mentioned."
- Output ONLY a JSON object of the shape {"questions": [...]}, no other text, no markdown fences.`;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenceMatch ? fenceMatch[1]! : trimmed;
  return JSON.parse(jsonText);
}

export function toDocs(plan: QuizPlan): { quizCurrent: QuizCurrentDoc; quizAnswers: QuizAnswersDoc } {
  return {
    quizCurrent: {
      version: 1,
      questions: plan.questions.map((q, orderIndex) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options,
        requiredCorrectCount: q.requiredCorrectCount,
        orderIndex,
      })),
      passThreshold: DEFAULT_PASS_THRESHOLD,
    },
    quizAnswers: {
      version: 1,
      answers: plan.questions.map((q) => ({ id: q.id, correctOptionIds: q.correctOptionIds, explanation: q.explanation })),
    },
  };
}

/**
 * Generates a Shui-compatible quiz (quiz/current + quiz/answers, matching
 * seed_civics.ts's exact shape) from a video's own narration script — the
 * "WG returns video + quiz together" contract for Shui's on-demand lessons
 * feature. Validates against the Zod schema and retries once with the
 * validation errors fed back, same discipline as planScenesFromScript.
 */
export async function generateQuizFromScript(
  narrationScript: string,
  opts: { maxQuestions?: number; apiKey?: string; model?: string } = {},
): Promise<QuizGenerationResult> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set — required for quiz generation.");
  }
  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const maxQuestions = opts.maxQuestions ?? 3;

  const client = new Anthropic({ apiKey });
  const system = buildSystemPrompt(maxQuestions);
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: `Narration script:\n\n${narrationScript}` }];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system,
      messages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    const textBlock = response.content.find((block) => block.type === "text");
    const rawText = textBlock && "text" in textBlock ? textBlock.text : "";

    let parsed: unknown;
    try {
      parsed = extractJson(rawText);
    } catch (err) {
      if (attempt === 0) {
        messages.push({ role: "assistant", content: rawText });
        messages.push({ role: "user", content: `That was not valid JSON (${(err as Error).message}). Return ONLY a valid JSON object, no other text.` });
        continue;
      }
      throw new Error(`Quiz generator returned invalid JSON after retry: ${(err as Error).message}`);
    }

    const result = QuizPlanSchema.safeParse(parsed);
    if (result.success) {
      const tokensUsed = totalInputTokens + totalOutputTokens;
      const costUsd =
        (totalInputTokens / 1_000_000) * INPUT_COST_PER_MTOK_USD + (totalOutputTokens / 1_000_000) * OUTPUT_COST_PER_MTOK_USD;
      return { ...toDocs(result.data), tokensUsed, costUsd };
    }

    if (attempt === 0) {
      const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      messages.push({ role: "assistant", content: rawText });
      messages.push({ role: "user", content: `That output failed validation: ${issues}. Return ONLY a corrected JSON object, no other text.` });
      continue;
    }

    throw new Error(`Quiz generator output failed validation after retry: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }

  throw new Error("Quiz generator: unreachable — both attempts fell through without returning or throwing.");
}
