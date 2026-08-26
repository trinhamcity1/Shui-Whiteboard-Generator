import { beforeEach, describe, expect, it } from "vitest";
import { generateQuizFromScript, QuizPlanSchema, toDocs } from "../src/schema/quizGeneration";

const validPlan = {
  questions: [
    {
      id: "q1",
      prompt: "What is the supreme law of the land?",
      options: [
        { id: "correct", text: "the Constitution" },
        { id: "d1", text: "the Declaration of Independence" },
        { id: "d2", text: "the Bill of Rights" },
        { id: "d3", text: "an Act of Congress" },
      ],
      correctOptionIds: ["correct"],
      requiredCorrectCount: 1,
      explanation: "The Constitution is the supreme law of the land.",
    },
  ],
};

describe("QuizPlanSchema", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("accepts a well-formed quiz plan", () => {
    expect(QuizPlanSchema.safeParse(validPlan).success).toBe(true);
  });

  it("rejects a question whose correctOptionIds references an option that doesn't exist", () => {
    const malformed = {
      questions: [{ ...validPlan.questions[0], correctOptionIds: ["not-a-real-option"] }],
    };
    const result = QuizPlanSchema.safeParse(malformed);
    expect(result.success).toBe(false);
  });

  it("rejects duplicate option ids within one question", () => {
    const malformed = {
      questions: [
        {
          ...validPlan.questions[0],
          options: [
            { id: "correct", text: "the Constitution" },
            { id: "correct", text: "a duplicate id" },
          ],
        },
      ],
    };
    const result = QuizPlanSchema.safeParse(malformed);
    expect(result.success).toBe(false);
  });

  it("rejects requiredCorrectCount greater than the number of correct options given", () => {
    const malformed = {
      questions: [{ ...validPlan.questions[0], requiredCorrectCount: 2 }],
    };
    const result = QuizPlanSchema.safeParse(malformed);
    expect(result.success).toBe(false);
  });

  it("rejects an empty questions array", () => {
    expect(QuizPlanSchema.safeParse({ questions: [] }).success).toBe(false);
  });

  it("toDocs splits a validated plan into Shui's exact public/answers doc shapes", () => {
    const parsed = QuizPlanSchema.parse(validPlan);
    const { quizCurrent, quizAnswers } = toDocs(parsed);

    expect(quizCurrent.version).toBe(1);
    expect(quizCurrent.passThreshold).toBe(0.6);
    expect(quizCurrent.questions).toHaveLength(1);
    expect(quizCurrent.questions[0]!.orderIndex).toBe(0);
    // The public doc must never carry the answer.
    expect(quizCurrent.questions[0]).not.toHaveProperty("correctOptionIds");
    expect(quizCurrent.questions[0]).not.toHaveProperty("explanation");

    expect(quizAnswers.version).toBe(1);
    expect(quizAnswers.answers).toEqual([{ id: "q1", correctOptionIds: ["correct"], explanation: validPlan.questions[0]!.explanation }]);
  });

  it("generateQuizFromScript fails clearly without an ANTHROPIC_API_KEY configured", async () => {
    await expect(generateQuizFromScript("Any narration text.")).rejects.toThrow(/ANTHROPIC_API_KEY/i);
  });
});
