import React from "react";
import { AbsoluteFill } from "remotion";
import { SKETCH_COLORS, SKETCH_LINE, SKETCH_FONT_FAMILY, sketchFontFaceCss } from "../sketchStyle";
import { roughGenerator, drawableToPaths } from "../decorations/roughPath";
import { RevealPath } from "../decorations/RevealPath";
import { Arrow } from "../decorations";
import { CANVAS_WIDTH, RoughRect, DiagramTitle } from "./primitives";

export interface SequenceDiagramProps {
  title: string;
  actors: { id: string; label: string }[];
  messages: { fromActorId: string; toActorId: string; label: string }[];
}

const ACTOR_TOP = 220;
const ACTOR_HEIGHT = 90;
const MESSAGE_GAP = 130;
const LIFELINE_BOTTOM_PAD = 100;

/** Technical/systems content ONLY — a genuinely different rendering
 * paradigm from every other diagram kind: time flows top-to-bottom along
 * vertical lifelines, not a spatial arrangement. "How does a request flow
 * through this system," step by step between actors over time. */
export function SequenceDiagram({ title, actors, messages }: SequenceDiagramProps) {
  const lifelineBottom = ACTOR_TOP + ACTOR_HEIGHT + messages.length * MESSAGE_GAP + LIFELINE_BOTTOM_PAD;
  const actorGap = CANVAS_WIDTH / (actors.length + 1);
  const actorX = new Map(actors.map((a, i) => [a.id, actorGap * (i + 1)]));
  const actorWidth = Math.min(200, actorGap - 40);

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      <DiagramTitle title={title} />

      <svg width={CANVAS_WIDTH} height={lifelineBottom + 60} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        {actors.map((a) => {
          const x = actorX.get(a.id)!;
          const drawable = roughGenerator.line(x, ACTOR_TOP + ACTOR_HEIGHT, x, lifelineBottom, {
            stroke: SKETCH_COLORS.ink,
            strokeWidth: SKETCH_LINE.strokeWidthThin * 1.5,
            roughness: SKETCH_LINE.roughness * 0.6,
            bowing: SKETCH_LINE.bowing,
          });
          return drawableToPaths(drawable).map((p, i) => <RevealPath key={`${a.id}-${i}`} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} startFrame={0} instant />);
        })}
        {messages.map((m, i) => {
          const fromX = actorX.get(m.fromActorId);
          const toX = actorX.get(m.toActorId);
          if (fromX === undefined || toX === undefined) return null;
          const y = ACTOR_TOP + ACTOR_HEIGHT + 40 + i * MESSAGE_GAP;
          return <Arrow key={`msg-${i}`} from={{ x: fromX, y }} to={{ x: toX, y }} color={SKETCH_COLORS.accentArrow} variant="straight" instant seed={i} />;
        })}
      </svg>

      {actors.map((a, i) => (
        <RoughRect key={a.id} x={actorX.get(a.id)! - actorWidth / 2} y={ACTOR_TOP} width={actorWidth} height={ACTOR_HEIGHT} instant seed={100 + i} />
      ))}
      {actors.map((a) => (
        <div
          key={`label-${a.id}`}
          style={{
            position: "absolute",
            left: actorX.get(a.id)! - actorWidth / 2,
            top: ACTOR_TOP,
            width: actorWidth,
            height: ACTOR_HEIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontFamily: SKETCH_FONT_FAMILY,
            fontSize: 22,
            color: SKETCH_COLORS.ink,
          }}
        >
          {a.label}
        </div>
      ))}
      {messages.map((m, i) => {
        const fromX = actorX.get(m.fromActorId);
        const toX = actorX.get(m.toActorId);
        if (fromX === undefined || toX === undefined) return null;
        const y = ACTOR_TOP + ACTOR_HEIGHT + 40 + i * MESSAGE_GAP;
        const midX = (fromX + toX) / 2;
        return (
          <div key={`msg-label-${i}`} style={{ position: "absolute", left: midX - 140, top: y - 30, width: 280, textAlign: "center", fontFamily: SKETCH_FONT_FAMILY, fontSize: 18, color: SKETCH_COLORS.ink }}>
            {m.label}
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
