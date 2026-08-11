import React from "react";
import { Composition } from "remotion";
import { SceneRenderer, type SceneRendererProps } from "./compositions/SceneRenderer";
import type { SceneDocument } from "../schema/scene";

const FPS = 30;
const VERTICAL = { width: 1080, height: 1920 };
const HORIZONTAL = { width: 1920, height: 1080 };

export type SceneInputProps = SceneRendererProps & Record<string, unknown> & {
  totalDurationSeconds: number;
};

const DEFAULT_SCENE_DOCUMENT: SceneDocument = {
  schemaVersion: 1,
  narrationScript: "",
  voice: "",
  styleVariant: "classic-whiteboard",
  orientation: "vertical",
  actions: [],
};

export function RemotionRoot() {
  return (
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
  );
}
