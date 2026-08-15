import React from "react";
import { AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import type { SceneAction, SceneDocument } from "../../schema/scene";
import { TitleCard } from "../components/TitleCard";
import { BulletList } from "../components/BulletList";
import { IconCallout } from "../components/IconCallout";
import { DocumentReveal } from "../components/DocumentReveal";
import { Timeline } from "../components/Timeline";
import { ComparisonCards } from "../components/ComparisonCards";
import { Quote } from "../components/Quote";
import { FullBleedGraphic } from "../components/FullBleedGraphic";
import { SketchDiagram } from "../components/SketchDiagram";
import {
  HeroBackdropTemplate,
  PyramidFlankedTemplate,
  Storyboard4PanelTemplate,
  Comparison2BoxTemplate,
} from "../components/CompositionTemplates";
import { ThemeProvider } from "../theme/ThemeContext";
import { getTheme } from "../theme/themes";

function ActionRenderer({ action }: { action: SceneAction }) {
  switch (action.type) {
    case "titleCard":
      return <TitleCard text={action.text ?? ""} startFrame={0} />;
    case "bulletList":
      return <BulletList items={action.items ?? []} startFrame={0} />;
    case "iconCallout":
      return <IconCallout icon={action.icon ?? ""} text={action.text ?? ""} startFrame={0} />;
    case "documentReveal":
      return <DocumentReveal imageUrl={action.imageUrl ?? ""} attribution={action.attribution} startFrame={0} />;
    case "timeline":
      return <Timeline entries={action.timelineEntries ?? []} startFrame={0} />;
    case "comparisonCards":
      return <ComparisonCards cards={action.comparisonCards ?? []} startFrame={0} />;
    case "quote":
      return <Quote text={action.text ?? ""} attribution={action.attribution} startFrame={0} />;
    case "fullBleedGraphic":
      return <FullBleedGraphic imageUrl={action.imageUrl ?? ""} startFrame={0} />;
    case "sketchDiagram": {
      const diagram = action.sketchDiagram;
      if (!diagram) return null;
      return (
        <SketchDiagram
          diagramType={diagram.diagramType}
          title={diagram.title}
          topLabel={diagram.topLabel}
          tiers={diagram.tiers}
          bottomBanner={diagram.bottomBanner}
          leftCharacterSrc={diagram.leftCharacterUrl}
          rightCharacterSrc={diagram.rightCharacterUrl}
        />
      );
    }
    case "composition": {
      const composition = action.composition;
      if (!composition) return null;
      const props = { title: composition.title, slots: composition.slots };
      switch (composition.templateId) {
        case "hero-backdrop":
          return <HeroBackdropTemplate {...props} />;
        case "pyramid-flanked":
          return <PyramidFlankedTemplate {...props} />;
        case "storyboard-4panel":
          return <Storyboard4PanelTemplate {...props} />;
        case "comparison-2box":
          return <Comparison2BoxTemplate {...props} />;
      }
    }
  }
}

export type SceneRendererProps = {
  sceneDocument: SceneDocument;
  audioFileName: string;
} & Record<string, unknown>;

export function SceneRenderer({ sceneDocument, audioFileName }: SceneRendererProps) {
  const { fps } = useVideoConfig();
  const theme = getTheme(sceneDocument.styleVariant);

  return (
    <ThemeProvider styleVariant={sceneDocument.styleVariant}>
      <AbsoluteFill style={{ background: theme.background }}>
        <Audio src={staticFile(audioFileName)} />
        {sceneDocument.backgroundTrack ? (
          <Audio src={staticFile(sceneDocument.backgroundTrack)} volume={0.12} />
        ) : null}

        {sceneDocument.actions.map((action) => (
          <Sequence
            key={action.id}
            from={Math.round(action.atSeconds * fps)}
            durationInFrames={Math.max(1, Math.round(action.durationSeconds * fps))}
          >
            <ActionRenderer action={action} />
          </Sequence>
        ))}
      </AbsoluteFill>
    </ThemeProvider>
  );
}
