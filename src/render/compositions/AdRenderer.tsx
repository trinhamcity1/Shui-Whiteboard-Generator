import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import type { AdBeat, AdDocument } from "../../schema/ad";
import { KenBurnsPhoto } from "../ad/KenBurnsPhoto";
import { AnimatedCaption } from "../ad/AnimatedCaption";
import { PromoBadge } from "../ad/PromoBadge";
import { CtaCard } from "../ad/CtaCard";

function BeatContent({
  beat,
  durationInFrames,
  productImages,
}: {
  beat: AdBeat;
  durationInFrames: number;
  productImages: AdDocument["productImages"];
}) {
  return (
    <>
      {beat.photoRef ? (
        <KenBurnsPhoto
          src={productImages[beat.photoRef.imageIndex]!.url}
          photoRef={beat.photoRef}
          startFrame={0}
          durationInFrames={durationInFrames}
        />
      ) : (
        // A pure-text beat (no photo) still needs a ground to read
        // against — a flat field rather than leaving the frame
        // transparent/black.
        <AbsoluteFill style={{ background: "#141414" }} />
      )}
      {beat.promoBadge && <PromoBadge badge={beat.promoBadge} startFrame={0} />}
      {beat.ctaLabel && <CtaCard label={beat.ctaLabel} startFrame={0} />}
      {beat.text && (
        <AnimatedCaption text={beat.text} startFrame={0} durationInFrames={durationInFrames} style={beat.captionStyle} />
      )}
    </>
  );
}

export type AdRendererProps = {
  adDocument: AdDocument;
  audioFileName: string;
} & Record<string, unknown>;

export function AdRenderer({ adDocument, audioFileName }: AdRendererProps) {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ background: "#000000" }}>
      <Audio src={staticFile(audioFileName)} />

      {adDocument.beats.map((beat) => {
        const durationInFrames = Math.max(1, Math.round(beat.durationSeconds * fps));
        return (
          <Sequence key={beat.id} from={Math.round(beat.atSeconds * fps)} durationInFrames={durationInFrames}>
            <BeatContent beat={beat} durationInFrames={durationInFrames} productImages={adDocument.productImages} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
