import React from "react";
import { Composition, staticFile } from "remotion";
import { SceneRenderer, type SceneRendererProps } from "./compositions/SceneRenderer";
import { AdRenderer, type AdRendererProps } from "./compositions/AdRenderer";
import type { SceneDocument } from "../schema/scene";
import type { AdDocument } from "../schema/ad";
import { DiagramRenderer, type DiagramRendererProps } from "./diagrams/DiagramRenderer";
import { BuildingCompositeTest } from "./components/BuildingCompositeTest";
import { getPlatformPreset } from "./ad/platformPresets";

const FPS = 30;
const VERTICAL = { width: 1080, height: 1920 };
const HORIZONTAL = { width: 1920, height: 1080 };

export type SceneInputProps = SceneRendererProps & Record<string, unknown> & {
  totalDurationSeconds: number;
};

export type AdInputProps = AdRendererProps & Record<string, unknown>;

const DEFAULT_AD_DOCUMENT: AdDocument = {
  schemaVersion: 2,
  templateId: "problem-solution",
  visualStyle: "photo-real",
  platform: "instagram",
  voice: "",
  durationSeconds: 10,
  targetAudience: "",
  productImages: [{ url: "" }],
  beats: [],
};

const DEFAULT_SCENE_DOCUMENT: SceneDocument = {
  schemaVersion: 1,
  narrationScript: "",
  voice: "",
  styleVariant: "classic-whiteboard",
  orientation: "vertical",
  actions: [],
};

// Dev harness for quick visual iteration on the diagram library (see
// src/render/diagrams/) without a full pipeline render — not part of the
// shipped scene schema.
const DIAGRAM_TEST_PROPS: DiagramRendererProps = {
  kind: "pyramid",
  title: "HIERARCHY OF LAW",
  topLabel: "CONSTITUTION",
  nodes: [
    { id: "federal", label: "FEDERAL" },
    { id: "state", label: "STATE" },
    { id: "local", label: "LOCAL" },
  ],
  bottomBanner: "UNITED STATES",
  leftCharacterUrl: staticFile("test-assets/judge-candidate-transparent.png"),
  rightCharacterUrl: staticFile("test-assets/officer-candidate-transparent.png"),
};

export function RemotionRoot() {
  return (
    <>
      <Composition
        id="SceneRenderer"
        component={SceneRenderer}
        fps={FPS}
        width={VERTICAL.width}
        height={VERTICAL.height}
        durationInFrames={FPS * 60}
        defaultProps={{
          sceneDocument: DEFAULT_SCENE_DOCUMENT,
          audioFileName: "tts-audio.mp3",
          totalDurationSeconds: 60,
        } satisfies SceneInputProps}
        calculateMetadata={async ({ props }) => {
          const { totalDurationSeconds, sceneDocument } = props as SceneInputProps;
          const dimensions = sceneDocument.orientation === "horizontal" ? HORIZONTAL : VERTICAL;
          return {
            durationInFrames: Math.max(1, Math.round(totalDurationSeconds * FPS)),
            width: dimensions.width,
            height: dimensions.height,
          };
        }}
      />
      <Composition
        id="AdRenderer"
        component={AdRenderer}
        fps={FPS}
        width={VERTICAL.width}
        height={VERTICAL.height}
        durationInFrames={FPS * 30}
        defaultProps={{
          adDocument: DEFAULT_AD_DOCUMENT,
          audioFileName: "tts-audio.mp3",
        } satisfies AdInputProps}
        calculateMetadata={async ({ props }) => {
          const { adDocument } = props as AdInputProps;
          const preset = getPlatformPreset(adDocument.platform);
          const lastBeat = adDocument.beats[adDocument.beats.length - 1];
          const totalDurationSeconds = lastBeat ? lastBeat.atSeconds + lastBeat.durationSeconds : adDocument.durationSeconds;
          return {
            durationInFrames: Math.max(1, Math.round(totalDurationSeconds * preset.fps)),
            width: preset.width,
            height: preset.height,
            fps: preset.fps,
          };
        }}
      />
      <Composition
        id="SketchDiagramTest"
        component={DiagramRenderer}
        fps={30}
        width={1080}
        height={1920}
        durationInFrames={1}
        defaultProps={DIAGRAM_TEST_PROPS}
      />
      <Composition
        id="BuildingCompositeTest"
        component={BuildingCompositeTest}
        fps={30}
        width={1000}
        height={800}
        durationInFrames={1}
        defaultProps={{
          buildingSrc: staticFile("test-assets/government-building-transparent.png"),
          characterSrc: staticFile("test-assets/judge-candidate-transparent.png"),
          buildingNaturalWidth: 745,
          buildingNaturalHeight: 735,
          label: { text: "JUSTICE", xFraction: 0.5, yFraction: 0.465, fontSize: 34 },
        }}
      />
    </>
  );
}
