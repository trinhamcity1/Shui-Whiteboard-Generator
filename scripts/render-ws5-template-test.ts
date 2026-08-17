import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { resolveImages } from "../src/images/resolveImages";
import { inlineRemoteImagesForLocalDev } from "../src/pipeline/localDevInlining";
import { parseSceneDocument, type SceneDocument } from "../src/schema/scene";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

async function renderOne(id: string, doc: unknown) {
  const sceneDocument = parseSceneDocument(doc);
  await resolveImages(sceneDocument, { orientation: "vertical" });
  await inlineRemoteImagesForLocalDev(sceneDocument);

  const bundleLocation = await bundle({ entryPoint: path.join(ROOT, "src/render/index.ts") });
  const inputProps = { sceneDocument, audioFileName: "none.mp3", totalDurationSeconds: 6 };
  const composition = await selectComposition({ serveUrl: bundleLocation, id: "SceneRenderer", inputProps });

  const outputLocation = path.join(ROOT, "output", `ws5-${id}.png`);
  await renderStill({ composition, serveUrl: bundleLocation, output: outputLocation, frame: Math.round(3 * composition.fps), inputProps });
  console.log(`${id} -> ${outputLocation}`);
}

function base(action: SceneDocument["actions"][number]) {
  return {
    schemaVersion: 1,
    narrationScript: "placeholder",
    voice: "x",
    styleVariant: "classic-whiteboard",
    orientation: "vertical",
    actions: [action],
  };
}

async function main() {
  await renderOne(
    "narrative-3-zone",
    base({
      id: "1",
      type: "composition",
      atSeconds: 0,
      durationSeconds: 6,
      composition: {
        templateId: "narrative-3-zone",
        title: "JUDICIAL REVIEW",
        slots: {
          zone1: { assetId: "civics-judge-explaining", label: "A law is challenged in court", revealAtSeconds: 0 },
          zone2: { assetId: "civics-prop-gavel", label: "The court weighs the Constitution", revealAtSeconds: 0.5 },
          zone3: { assetId: "civics-judge-gavel-down", label: "The court strikes it down", revealAtSeconds: 1 },
        },
      },
    }),
  );

  await renderOne(
    "central-focal",
    base({
      id: "1",
      type: "composition",
      atSeconds: 0,
      durationSeconds: 6,
      composition: {
        templateId: "central-focal",
        title: "PUBLIC TRUST",
        slots: {
          central: { assetId: "civics-prop-government-building", revealAtSeconds: 0 },
          reactor1: { assetId: "civics-officer-explaining", revealAtSeconds: 0.3 },
          reactor2: { assetId: "civics-judge-explaining", revealAtSeconds: 0.4 },
          reactor3: { assetId: "narrator-thinking", revealAtSeconds: 0.5 },
          reactor4: { assetId: "civics-voter-casting-ballot", revealAtSeconds: 0.6 },
          caption: { label: "A crisis draws every branch's attention", revealAtSeconds: 1 },
        },
      },
    }),
  );

  await renderOne(
    "confrontation-mirror",
    base({
      id: "1",
      type: "composition",
      atSeconds: 0,
      durationSeconds: 6,
      composition: {
        templateId: "confrontation-mirror",
        title: "TWO BRANCHES, ONE QUESTION",
        slots: {
          left: { assetId: "civics-judge-explaining", revealAtSeconds: 0 },
          right: { assetId: "civics-officer-saluting", revealAtSeconds: 0.3 },
          caption: { label: "Who has the final word?", revealAtSeconds: 1 },
        },
      },
    }),
  );

  await renderOne(
    "group-lineup",
    base({
      id: "1",
      type: "composition",
      atSeconds: 0,
      durationSeconds: 6,
      composition: {
        templateId: "group-lineup",
        title: "WHO MAKES THE LAWS?",
        slots: {
          person1: { assetId: "civics-judge-explaining", revealAtSeconds: 0 },
          person2: { assetId: "civics-officer-explaining", revealAtSeconds: 0.1 },
          person3: { assetId: "narrator-explaining", revealAtSeconds: 0.2 },
          person4: { assetId: "narrator-pointing", revealAtSeconds: 0.3 },
          person5: { assetId: "narrator-celebrating", revealAtSeconds: 0.4 },
          person6: { assetId: "civics-officer-saluting", revealAtSeconds: 0.5 },
          caption: { label: "Every branch plays a part", revealAtSeconds: 1 },
        },
      },
    }),
  );

  await renderOne(
    "pyramid-flanked-upgrade",
    base({
      id: "1",
      type: "composition",
      atSeconds: 0,
      durationSeconds: 6,
      composition: {
        templateId: "pyramid-flanked",
        title: "HIERARCHY OF LAW",
        slots: {
          topLabel: { label: "CONSTITUTION" },
          bottomBanner: { label: "UNITED STATES" },
          tier1: { label: "FEDERAL", assetId: "prop-gear" },
          tier2: { label: "STATE", assetId: "prop-checkmark" },
          tier3: { label: "LOCAL", assetId: "prop-lightbulb" },
          leftCharacter: { assetId: "civics-judge-explaining" },
          rightCharacter: { assetId: "civics-officer-explaining" },
        },
      },
    }),
  );

  await renderOne(
    "comparison-torn",
    base({
      id: "1",
      type: "composition",
      atSeconds: 0,
      durationSeconds: 6,
      composition: {
        templateId: "comparison-2box",
        title: "COLLAPSE | TRANSFORMATION",
        dividerStyle: "torn",
        slots: {
          left: { assetId: "civics-prop-gavel", label: "Collapse", revealAtSeconds: 0 },
          right: { assetId: "prop-lightbulb", label: "Transformation", revealAtSeconds: 0.3 },
        },
      },
    }),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
