import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { TitleCard } from "../components/TitleCard.js";
import { BulletList } from "../components/BulletList.js";

export type TestSceneProps = {
  titleText: string;
  bulletItems: string[];
  titleDurationInFrames: number;
  audioFileName: string;
} & Record<string, unknown>;

export function TestScene({ titleText, bulletItems, titleDurationInFrames, audioFileName }: TestSceneProps) {
  return (
    <AbsoluteFill style={{ background: "#f7f6f2" }}>
      <Audio src={staticFile(audioFileName)} />

      <Sequence from={0} durationInFrames={titleDurationInFrames}>
        <TitleCard text={titleText} startFrame={0} />
      </Sequence>

      <Sequence from={titleDurationInFrames}>
        <BulletList items={bulletItems} startFrame={0} />
      </Sequence>
    </AbsoluteFill>
  );
}
