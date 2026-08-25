import type { SceneDocument, CompositionSlot } from "../schema/scene";
import type { ImageProvider, ImageProviderName } from "./types";
import { resolveImage } from "./cache";
import { resolveAssetId } from "./assetLibrary/registryLookup";
import { resolveConceptViaLibrary } from "./assetLibrary/autoExpand";
import { TrainedStyleImageProvider } from "./trainedStyle";

export interface ImageResolutionResult {
  imagesGenerated: number; // cache misses — real generations
  cacheHits: number;
  costUsd: number;
  provider?: ImageProviderName;
}

const CONCURRENCY = 3;

interface AssetIdTarget {
  assetId: string;
  label: string; // for a clear error message
  setUrl: (url: string) => void;
  setAttachmentAnchor?: (anchor: { xFraction: number; yFraction: number }) => void;
  setDimensions?: (widthPx: number, heightPx: number) => void;
}

interface ConceptTarget {
  concept: string;
  role: "character" | "prop" | "scene";
  setUrl: (url: string) => void;
  setAssetId: (assetId: string) => void;
}

/** A slot's name tells us how its image will actually be used: a
 * character/reactor/person is a standalone figure composited over
 * something else (needs a transparent cutout); a backdrop/panel/zone/
 * central image is shown as a complete picture in its own right (wants a
 * full illustrated scene, not a cutout with the background stripped out).
 * See trainedStyle.ts's backgroundMode for why this distinction matters —
 * conflating them was why every "scene"-style concept in a real render
 * batch came back with a baked-in vignette and failed transparency QA. */
function classifySlotRole(slotName: string): "character" | "prop" | "scene" {
  if (/^(character|leftCharacter|rightCharacter|reactor\d*|person\d*)$/.test(slotName)) return "character";
  return "scene";
}

/** Every place a raw assetId can appear across a SceneDocument — top-level
 * actions, sketchDiagram's flanking characters, and (Layer 3) composition
 * slots — collected into one flat list so they all resolve through the
 * same $0 registry lookup instead of three separate near-duplicate loops. */
function collectAssetIdTargets(sceneDocument: SceneDocument): AssetIdTarget[] {
  const targets: AssetIdTarget[] = [];

  for (const action of sceneDocument.actions) {
    if (action.assetId && !action.imageUrl) {
      targets.push({
        assetId: action.assetId,
        label: `action "${action.id}"`,
        setUrl: (url) => (action.imageUrl = url),
        // FullBleedGraphic needs this to tell a full-scene illustration
        // (safe to objectFit:"cover" edge-to-edge) apart from a narrow
        // character cutout (cover would blow it up and crop off the head —
        // a real bug hit putting a narrator reaction there directly).
        setDimensions: (widthPx, heightPx) => {
          action.imageWidthPx = widthPx;
          action.imageHeightPx = heightPx;
        },
      });
    }

    const diagram = action.sketchDiagram;
    if (diagram) {
      if (diagram.leftCharacterAssetId && !diagram.leftCharacterUrl) {
        targets.push({
          assetId: diagram.leftCharacterAssetId,
          label: `sketchDiagram leftCharacterAssetId (action "${action.id}")`,
          setUrl: (url) => (diagram.leftCharacterUrl = url),
        });
      }
      if (diagram.rightCharacterAssetId && !diagram.rightCharacterUrl) {
        targets.push({
          assetId: diagram.rightCharacterAssetId,
          label: `sketchDiagram rightCharacterAssetId (action "${action.id}")`,
          setUrl: (url) => (diagram.rightCharacterUrl = url),
        });
      }
      diagram.tiers.forEach((tier, tierIndex) => {
        if (tier.insetAssetId && !tier.insetImageUrl) {
          targets.push({
            assetId: tier.insetAssetId,
            label: `sketchDiagram tier[${tierIndex}] insetAssetId (action "${action.id}")`,
            setUrl: (url) => (tier.insetImageUrl = url),
          });
        }
      });
    }

    const composition = action.composition;
    if (composition) {
      for (const [slotName, slot] of Object.entries(composition.slots)) {
        if (slot.assetId && !slot.imageUrl) {
          targets.push({
            assetId: slot.assetId,
            label: `composition slot "${slotName}" (action "${action.id}")`,
            setUrl: (url) => (slot.imageUrl = url),
            // Workstream 3 item 3: only relevant if some other slot in this
            // composition actually attaches to this one, but resolving is
            // free (already-fetched registry data), so always set it.
            setAttachmentAnchor: (anchor) => (slot.attachmentAnchor = anchor),
            setDimensions: (widthPx, heightPx) => {
              slot.imageWidthPx = widthPx;
              slot.imageHeightPx = heightPx;
            },
          });
        }
      }
    }
  }

  return targets;
}

/** Same idea as collectAssetIdTargets, for live-generation (imageConcept)
 * targets — currently top-level actions and composition slots. */
function collectConceptTargets(sceneDocument: SceneDocument): ConceptTarget[] {
  const targets: ConceptTarget[] = [];

  for (const action of sceneDocument.actions) {
    // Top-level imageConcept only ever backs documentReveal/fullBleedGraphic
    // — always a full-frame visual, never a composited cutout.
    if (action.imageConcept && !action.imageUrl) {
      targets.push({
        concept: action.imageConcept,
        role: "scene",
        setUrl: (url) => (action.imageUrl = url),
        setAssetId: (assetId) => (action.assetId = assetId),
      });
    }

    const composition = action.composition;
    if (composition) {
      for (const [slotName, slot] of Object.entries(composition.slots)) {
        if (slot.imageConcept && !slot.imageUrl) {
          targets.push({
            concept: slot.imageConcept,
            role: classifySlotRole(slotName),
            setUrl: (url) => (slot.imageUrl = url),
            setAssetId: (assetId) => (slot.assetId = assetId),
          });
        }
      }
    }
  }

  return targets;
}

/**
 * Walks every action (including sketchDiagram characters and, since Layer
 * 3, composition slots), resolving assetId/imageConcept -> imageUrl
 * (cache-first) for anything that has one but no imageUrl yet, then
 * mutates the scene document in place. Runs before TTS in
 * resolveSceneDocument — same position in the pipeline TTS itself
 * occupies — so a failed image generation fails fast and cheap, before
 * the expensive render step.
 */
export async function resolveImages(
  sceneDocument: SceneDocument,
  opts: {
    provider?: ImageProvider;
    orientation: "vertical" | "horizontal";
    /** Echo mode (a customer's private trained style) must never reuse or
     * promote into the SHARED asset library — see cache.ts's
     * cacheProviderDiscriminator and echoTypes.ts's own comment on why.
     * Defaults to true for the product's own default trained-style
     * provider; set false explicitly when opts.provider is an Echo
     * model's TrainedStyleImageProvider. */
    useSharedLibraryExpansion?: boolean;
  },
): Promise<ImageResolutionResult> {
  // Revision-2 Layer 1: assetId is a registry lookup — $0, no live API
  // call — and resolves first, since it's the default path for any
  // recurring character/prop. imageConcept (live generation) only ever
  // runs for actions that don't select a library asset.
  for (const target of collectAssetIdTargets(sceneDocument)) {
    const resolved = await resolveAssetId(target.assetId);
    if (!resolved) {
      throw new Error(`assetId "${target.assetId}" (${target.label}) was not found in the asset library registry.`);
    }
    target.setUrl(resolved.imageUrl);
    if (target.setDimensions) target.setDimensions(resolved.widthPx, resolved.heightPx);
    const attachmentAnchor = resolved.anchors?.find((a) => a.kind === "attachment");
    if (attachmentAnchor && target.setAttachmentAnchor) {
      target.setAttachmentAnchor({ xFraction: attachmentAnchor.xFraction, yFraction: attachmentAnchor.yFraction });
    }
  }

  const pending = collectConceptTargets(sceneDocument);

  let imagesGenerated = 0;
  let cacheHits = 0;
  let costUsd = 0;

  if (pending.length > 0 && !opts.provider) {
    throw new Error("resolveImages: pending imageConcept actions require an ImageProvider, but none was given.");
  }

  // Layer 2: an imageConcept resolved through the trained-style provider
  // runs the real self-expanding-library flow (semantic near-match reuse,
  // then generate-and-quarantine on a genuine miss) instead of the plain
  // exact-hash cache — that's what actually grows the asset library over
  // time. Any other provider (recraft/flux, used only by direct
  // provider-comparison scripts, never the real pipeline default) keeps
  // the simple cache-only path.
  const useLibraryExpansion =
    opts.provider instanceof TrainedStyleImageProvider && (opts.useSharedLibraryExpansion ?? true);

  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (target) => {
        if (useLibraryExpansion) {
          const trainedProvider = opts.provider as TrainedStyleImageProvider;
          const expanded = await resolveConceptViaLibrary(target.concept, {
            falApiKey: trainedProvider.apiKey,
            anthropicApiKey: process.env.ANTHROPIC_API_KEY,
            styleModel: trainedProvider.styleModel,
            role: target.role,
          });
          return {
            target,
            generated: {
              imageUrl: expanded.imageUrl,
              cacheHit: expanded.reused,
              costUsd: expanded.costUsd,
              assetId: expanded.assetId as string | undefined,
            },
          };
        }
        const generated = await resolveImage(target.concept, {
          provider: opts.provider!,
          styleVariant: sceneDocument.styleVariant,
          orientation: opts.orientation,
        });
        return { target, generated: { ...generated, assetId: undefined as string | undefined } };
      }),
    );

    for (const { target, generated } of results) {
      target.setUrl(generated.imageUrl);
      if (generated.assetId) target.setAssetId(generated.assetId);
      if (generated.cacheHit) cacheHits++;
      else imagesGenerated++;
      costUsd += generated.costUsd;
    }
  }

  return {
    imagesGenerated,
    cacheHits,
    costUsd,
    provider: pending.length > 0 ? opts.provider!.name : undefined,
  };
}

export type { CompositionSlot };
