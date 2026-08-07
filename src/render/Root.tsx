import React from "react";
import { Composition } from "remotion";
import { TestScene, type TestSceneProps } from "./compositions/TestScene";

const FPS = 30;

export type TestSceneInputProps = TestSceneProps & {
  totalDurationSeconds: number;
};

export function RemotionRoot() {
  return (
    <Composition
      id="TestScene"
      component={TestScene}
      fps={FPS}
      width={1080}
      height={1920}
      durationInFrames={FPS * 60}
      defaultProps={{
        titleText: "",
        bulletItems: [],
        titleDurationInFrames: FPS * 3,
        audioFileName: "tts-audio.mp3",
        totalDurationSeconds: 60,
      } satisfies TestSceneInputProps}
      calculateMetadata={async ({ props }) => {
        const { totalDurationSeconds } = props as TestSceneInputProps;
        return {
          durationInFrames: Math.max(1, Math.round(totalDurationSeconds * FPS)),
        };
      }}
    />
  );
}
