import React from "react";
import type { DiagramSpec } from "../../schema/diagram";
import { NodeSequenceDiagram } from "./NodeSequenceDiagram";
import { TreeDiagram } from "./TreeDiagram";
import { MatrixDiagram } from "./MatrixDiagram";
import { VennDiagram } from "./VennDiagram";
import { FishboneDiagram } from "./FishboneDiagram";
import { NetworkDiagram } from "./NetworkDiagram";
import { SwimlaneDiagram } from "./SwimlaneDiagram";
import { SequenceDiagram } from "./SequenceDiagram";
import { ClassDiagram } from "./ClassDiagram";

export type DiagramRendererProps = DiagramSpec;

/**
 * The full diagram library's single entry point — dispatches on `kind` to
 * one of nine component files (six of the fourteen `kind` values share the
 * NodeSequenceDiagram engine; see its own doc comment for why). This is
 * what SceneRenderer.tsx renders for a "sketchDiagram" action; the action
 * TYPE name stayed "sketchDiagram" through the rebuild (renaming it would
 * ripple through ~10 unrelated files for no functional gain), only its
 * internal spec — and everything downstream of it — is new.
 */
export function DiagramRenderer(props: DiagramRendererProps) {
  switch (props.kind) {
    case "pyramid":
    case "funnel":
    case "flowchart":
    case "cycle":
    case "radial":
    case "comparison":
      return (
        <NodeSequenceDiagram
          kind={props.kind}
          title={props.title}
          topLabel={props.topLabel}
          bottomBanner={props.bottomBanner}
          centerLabel={"centerLabel" in props ? props.centerLabel : undefined}
          nodes={props.nodes}
          isCyclical={"isCyclical" in props ? props.isCyclical : undefined}
          leftCharacterSrc={props.leftCharacterUrl}
          rightCharacterSrc={props.rightCharacterUrl}
        />
      );
    case "tree":
      return <TreeDiagram title={props.title} nodes={props.nodes} />;
    case "matrix":
      return <MatrixDiagram title={props.title} xAxisLabel={props.xAxisLabel} yAxisLabel={props.yAxisLabel} quadrants={props.quadrants} />;
    case "venn":
      return <VennDiagram title={props.title} sets={props.sets} overlapLabels={props.overlapLabels} />;
    case "fishbone":
      return <FishboneDiagram title={props.title} effect={props.effect} categories={props.categories} />;
    case "network":
      return <NetworkDiagram title={props.title} nodes={props.nodes} edges={props.edges} />;
    case "swimlane":
      return <SwimlaneDiagram title={props.title} lanes={props.lanes} nodes={props.nodes} edges={props.edges} />;
    case "sequenceDiagram":
      return <SequenceDiagram title={props.title} actors={props.actors} messages={props.messages} />;
    case "classDiagram":
      return <ClassDiagram title={props.title} classes={props.classes} relationships={props.relationships} />;
    default: {
      const _exhaustive: never = props;
      return _exhaustive;
    }
  }
}
