import { debitAccount, getEchoModel, updateEchoModel } from "../storage/firestore";
import { runEchoTrainingPipeline } from "../images/styleModel/echoPipeline";
import { ECHO_RETRAIN_CREDITS, ECHO_TRAIN_CREDITS } from "../billing/tiers";
import type { EchoTrainingJobPayload } from "../queue/types";
import type { EchoModelStatus } from "../images/styleModel/echoTypes";

/**
 * The actual Echo model (re)training work, run asynchronously after the
 * upload endpoint has already returned. Same dispatch pattern as
 * renderHandler.ts's handleRenderJob — shared by DevQueue (local dev) and
 * the /internal/echo-train endpoint (real Cloud Tasks in production).
 */
export async function handleEchoTrainingJob(payload: EchoTrainingJobPayload): Promise<void> {
  const model = await getEchoModel(payload.echoModelId);
  if (!model) {
    console.error(`handleEchoTrainingJob: Echo model ${payload.echoModelId} not found, skipping.`);
    return;
  }

  const falApiKey = process.env.FLUX_API_KEY;
  if (!falApiKey) {
    await updateEchoModel(model.id, { status: "failed", errorMessage: "Server misconfiguration: FLUX_API_KEY not set." });
    return;
  }

  try {
    const result = await runEchoTrainingPipeline({
      echoModelId: model.id,
      referenceImageUrls: model.referenceImageUrls,
      falApiKey,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      onStatusChange: async (status: EchoModelStatus) => {
        await updateEchoModel(model.id, { status });
      },
    });

    await updateEchoModel(model.id, {
      status: "ready",
      candidateImageUrls: result.candidateUrls,
      selectedImageUrls: result.selectedUrls,
      styleModel: result.styleModel,
      lastRunCostUsd: result.costUsd,
    });

    // Charged only on real success — a failed run costs the business real
    // fal.ai/Anthropic money (see the `catch` below) but never costs the
    // customer credits for a model they didn't get. The route-level
    // pre-check (echo.ts) already confirmed the account could plausibly
    // afford this before the run started; retrainCount is 0 only for a
    // model's very first training, so it doubles as the new-vs-retrain
    // signal without a separate flag.
    const creditsOwed = model.retrainCount === 0 ? ECHO_TRAIN_CREDITS : ECHO_RETRAIN_CREDITS;
    try {
      await debitAccount(model.ownerLabel, creditsOwed, `echo-train:${model.id}`);
    } catch (err) {
      console.error(`handleEchoTrainingJob: billing failed for model ${model.id}:`, err);
      await updateEchoModel(model.id, {
        errorMessage: `Model trained successfully, but billing failed: ${(err as Error).message}`,
      });
    }
  } catch (err) {
    await updateEchoModel(model.id, { status: "failed", errorMessage: (err as Error).message });
  }
}
