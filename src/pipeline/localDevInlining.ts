import type { SceneDocument } from "../schema/scene";

/**
 * This sandboxed dev container has an unresolved gap: headless Chromium
 * can't reliably fetch remote https:// images during Remotion compositing
 * here (confirmed across TLS-trust and a separate, unexplained static-file
 * 404 issue — see git history around the Layer 1 test render for the full
 * investigation). Real deployments (Cloud Run, a normal dev machine) don't
 * sit behind this sandbox's proxy and shouldn't need this at all.
 *
 * Opt-in only, for local test renders in THIS environment: walks a resolved
 * SceneDocument and replaces every https:// image reference with a base64
 * data URI, fetched once via Node (which does trust this environment's
 * proxy CA). Never call this in production — it defeats R2's whole purpose
 * (small, cacheable, CDN-friendly URLs) and does a live fetch per image.
 */
export async function inlineRemoteImagesForLocalDev(sceneDocument: SceneDocument): Promise<void> {
  const toDataUri = async (url: string): Promise<string> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`inlineRemoteImagesForLocalDev: failed to fetch ${url} (${response.status})`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") ?? "image/png";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  };

  for (const action of sceneDocument.actions) {
    if (action.imageUrl && action.imageUrl.startsWith("https://")) {
      action.imageUrl = await toDataUri(action.imageUrl);
    }
    const diagram = action.sketchDiagram;
    if (diagram) {
      if (diagram.leftCharacterUrl?.startsWith("https://")) {
        diagram.leftCharacterUrl = await toDataUri(diagram.leftCharacterUrl);
      }
      if (diagram.rightCharacterUrl?.startsWith("https://")) {
        diagram.rightCharacterUrl = await toDataUri(diagram.rightCharacterUrl);
      }
    }
  }
}
