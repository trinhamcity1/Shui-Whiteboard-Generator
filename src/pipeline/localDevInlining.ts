import type { SceneDocument } from "../schema/scene";
import type { AdDocument } from "../schema/ad";
import { collectDiagramNodes, isNodeSequenceSpec } from "../schema/diagram";

/**
 * This sandboxed dev container has an unresolved gap: headless Chromium
 * can't reliably fetch remote https:// images during Remotion compositing
 * here (confirmed across TLS-trust and a separate, unexplained static-file
 * 404 issue — see git history around the Layer 1 test render for the full
 * investigation; the Ads product's own first test render hit the same
 * ERR_CERT_AUTHORITY_INVALID even on a plain B&H product photo URL that
 * curl fetches fine, confirming it's this sandbox's headless-Chromium/proxy
 * gap, not anything about the specific image or host). Real deployments
 * (Cloud Run, a normal dev machine) don't sit behind this sandbox's proxy
 * and shouldn't need any of this.
 *
 * Opt-in only, for local test renders in THIS environment: replaces every
 * https:// image reference with a base64 data URI, fetched once via Node
 * (which does trust this environment's proxy CA). Never call this in
 * production — it defeats R2's whole purpose (small, cacheable, CDN-
 * friendly URLs) and does a live fetch per image.
 */
async function toDataUri(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`inline-for-local-dev: failed to fetch ${url} (${response.status})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") ?? "image/png";
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

export async function inlineRemoteImagesForLocalDev(sceneDocument: SceneDocument): Promise<void> {
  for (const action of sceneDocument.actions) {
    if (action.imageUrl && action.imageUrl.startsWith("https://")) {
      action.imageUrl = await toDataUri(action.imageUrl);
    }
    const diagram = action.sketchDiagram;
    if (diagram) {
      if (isNodeSequenceSpec(diagram)) {
        if (diagram.leftCharacterUrl?.startsWith("https://")) {
          diagram.leftCharacterUrl = await toDataUri(diagram.leftCharacterUrl);
        }
        if (diagram.rightCharacterUrl?.startsWith("https://")) {
          diagram.rightCharacterUrl = await toDataUri(diagram.rightCharacterUrl);
        }
      }
      for (const node of collectDiagramNodes(diagram)) {
        if (node.insetImageUrl?.startsWith("https://")) {
          node.insetImageUrl = await toDataUri(node.insetImageUrl);
        }
      }
    }

    const composition = action.composition;
    if (composition) {
      for (const slot of Object.values(composition.slots)) {
        if (slot.imageUrl?.startsWith("https://")) {
          slot.imageUrl = await toDataUri(slot.imageUrl);
        }
      }
    }
  }
}

/** Same workaround, ad-mode's sibling — inlines every productImages[].url and every kinetic-hero cutout. */
export async function inlineAdImagesForLocalDev(adDocument: AdDocument): Promise<void> {
  for (const image of adDocument.productImages) {
    if (image.url.startsWith("https://")) {
      image.url = await toDataUri(image.url);
    }
  }
  for (const beat of adDocument.beats) {
    if (beat.kineticHero?.cutoutUrl?.startsWith("https://")) {
      beat.kineticHero.cutoutUrl = await toDataUri(beat.kineticHero.cutoutUrl);
    }
  }
}
