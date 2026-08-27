import "dotenv/config";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { parseSceneDocument, type SceneDocument } from "../src/schema/scene";
import { resolveImages } from "../src/images/resolveImages";
import { inlineRemoteImagesForLocalDev } from "../src/pipeline/localDevInlining";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FPS = 30;
const DURATION = 5;

const DIAGRAMS: { id: string; sketchDiagram: SceneDocument["actions"][number]["sketchDiagram"] }[] = [
  {
    id: "pyramid",
    sketchDiagram: {
      kind: "pyramid",
      title: "Legal Hierarchy",
      topLabel: "Supreme Law",
      nodes: [
        { id: "federal", label: "Federal Law" },
        { id: "state", label: "State Law" },
      ],
      leftCharacterAssetId: "civics-judge-explaining",
      rightCharacterAssetId: "civics-officer-explaining",
    },
  },
  {
    id: "funnel",
    sketchDiagram: {
      kind: "funnel",
      title: "Hiring Funnel",
      nodes: [
        { id: "applicants", label: "Applicants" },
        { id: "interviews", label: "Interviews" },
        { id: "hires", label: "Hires" },
      ],
    },
  },
  {
    id: "flowchart",
    sketchDiagram: {
      kind: "flowchart",
      title: "How a Bill Becomes Law",
      nodes: [
        { id: "propose", label: "Bill Proposed" },
        { id: "vote", label: "Congress Votes" },
        { id: "sign", label: "President Signs" },
      ],
    },
  },
  {
    id: "cycle",
    sketchDiagram: {
      kind: "cycle",
      title: "The Water Cycle",
      nodes: [
        { id: "evap", label: "Evaporation" },
        { id: "cond", label: "Condensation" },
        { id: "precip", label: "Precipitation" },
        { id: "collect", label: "Collection" },
      ],
    },
  },
  {
    id: "radial",
    sketchDiagram: {
      kind: "radial",
      title: "The Four Freedoms",
      centerLabel: "Freedom",
      nodes: [
        { id: "speech", label: "Speech" },
        { id: "worship", label: "Worship" },
        { id: "want", label: "Want" },
        { id: "fear", label: "Fear" },
      ],
    },
  },
  {
    id: "comparison",
    sketchDiagram: {
      kind: "comparison",
      title: "State vs. Federal Law",
      nodes: [
        { id: "state", label: "State Law" },
        { id: "federal", label: "Federal Law" },
      ],
    },
  },
  {
    id: "tree",
    sketchDiagram: {
      kind: "tree",
      title: "Federal Court System",
      nodes: [
        { id: "supreme", label: "Supreme Court" },
        { id: "circuit1", label: "1st Circuit", parentId: "supreme" },
        { id: "circuit2", label: "9th Circuit", parentId: "supreme" },
        { id: "district1", label: "District Court A", parentId: "circuit1" },
        { id: "district2", label: "District Court B", parentId: "circuit2" },
      ],
    },
  },
  {
    id: "matrix",
    sketchDiagram: {
      kind: "matrix",
      title: "Urgent vs. Important",
      xAxisLabel: "Urgency",
      yAxisLabel: "Importance",
      quadrants: [
        { label: "Do Now", description: "Crises, deadlines" },
        { label: "Schedule", description: "Long-term goals" },
        { label: "Delegate", description: "Interruptions" },
        { label: "Drop", description: "Distractions" },
      ],
    },
  },
  {
    id: "venn",
    sketchDiagram: {
      kind: "venn",
      title: "State vs. Federal Powers",
      sets: [
        { id: "state", label: "State Powers" },
        { id: "federal", label: "Federal Powers" },
      ],
      overlapLabels: { "federal+state": "Concurrent Powers" },
    },
  },
  {
    id: "fishbone",
    sketchDiagram: {
      kind: "fishbone",
      title: "Why the Bill Failed",
      effect: "Bill Failed",
      categories: [
        { label: "Politics", causes: ["Party opposition", "Election year"] },
        { label: "Process", causes: ["Missed deadline"] },
        { label: "Public", causes: ["Low support"] },
      ],
    },
  },
  {
    id: "network",
    sketchDiagram: {
      kind: "network",
      title: "Checks and Balances",
      nodes: [
        { id: "congress", label: "Congress" },
        { id: "president", label: "President" },
        { id: "courts", label: "Courts" },
      ],
      edges: [
        { fromId: "congress", toId: "president", label: "override veto" },
        { fromId: "president", toId: "courts", label: "appoints judges" },
        { fromId: "courts", toId: "congress", label: "strikes down law" },
      ],
    },
  },
  {
    id: "swimlane",
    sketchDiagram: {
      kind: "swimlane",
      title: "How a Bill Becomes Law",
      lanes: [
        { id: "congress", label: "Congress" },
        { id: "president", label: "President" },
      ],
      nodes: [
        { id: "propose", label: "Propose Bill", laneId: "congress" },
        { id: "pass", label: "Pass Vote", laneId: "congress" },
        { id: "sign", label: "Sign or Veto", laneId: "president" },
      ],
      edges: [
        { fromId: "propose", toId: "pass" },
        { fromId: "pass", toId: "sign" },
      ],
    },
  },
  {
    id: "sequenceDiagram",
    sketchDiagram: {
      kind: "sequenceDiagram",
      title: "Login Request",
      actors: [
        { id: "client", label: "Client" },
        { id: "server", label: "Server" },
        { id: "db", label: "Database" },
      ],
      messages: [
        { fromActorId: "client", toActorId: "server", label: "POST /login" },
        { fromActorId: "server", toActorId: "db", label: "check credentials" },
        { fromActorId: "db", toActorId: "server", label: "valid" },
      ],
    },
  },
  {
    id: "classDiagram",
    sketchDiagram: {
      kind: "classDiagram",
      title: "Order System",
      classes: [
        { id: "order", name: "Order", attributes: ["id", "total", "status"] },
        { id: "customer", name: "Customer", attributes: ["id", "name"] },
      ],
      relationships: [{ fromClassId: "order", toClassId: "customer", label: "placed by" }],
    },
  },
];

async function main() {
  const outputDir = path.join(ROOT, "output", "diagram-gallery");
  await fs.mkdir(outputDir, { recursive: true });

  const doc = {
    schemaVersion: 1,
    narrationScript: "test",
    voice: "x",
    styleVariant: "classic-whiteboard",
    orientation: "vertical",
    actions: DIAGRAMS.map((d, i) => ({
      id: d.id,
      type: "sketchDiagram" as const,
      atSeconds: i * DURATION,
      durationSeconds: DURATION,
      sketchDiagram: d.sketchDiagram,
    })),
  };

  const sceneDocument = parseSceneDocument(doc);
  await resolveImages(sceneDocument, { orientation: "vertical" });
  await inlineRemoteImagesForLocalDev(sceneDocument);

  const bundleLocation = await bundle({ entryPoint: path.join(ROOT, "src/render/index.ts") });
  const totalDurationSeconds = DIAGRAMS.length * DURATION;
  const inputProps = { sceneDocument, audioFileName: "none.mp3", totalDurationSeconds };
  const composition = await selectComposition({ serveUrl: bundleLocation, id: "SceneRenderer", inputProps });

  for (let i = 0; i < DIAGRAMS.length; i++) {
    const frame = Math.round((i * DURATION + DURATION / 2) * FPS);
    const outPath = path.join(outputDir, `${String(i).padStart(2, "0")}-${DIAGRAMS[i]!.id}.png`);
    await renderStill({ composition, serveUrl: bundleLocation, output: outPath, frame, inputProps });
    console.log(`   still -> ${outPath}`);
  }
}

main().catch((err) => {
  console.error("render-diagram-library-gallery failed:", err);
  process.exitCode = 1;
});
