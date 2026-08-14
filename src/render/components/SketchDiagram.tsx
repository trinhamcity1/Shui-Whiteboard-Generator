import React, { useEffect, useMemo, useRef, useState } from "react";
import rough from "roughjs";
import { AbsoluteFill, Img, continueRender, delayRender } from "remotion";

/**
 * Proof-of-concept for the amendment §5 sketchDiagram action type — NOT yet
 * wired into the scene schema/pipeline. Built to answer one question before
 * committing engineering time to the full component: can rough.js shapes +
 * real text + our trained-style character illustrations actually composite
 * into something resembling the Golpo reference (a labeled pyramid with
 * characters beside it), the way the amendment claims. Only "pyramid" is
 * implemented — flowchart/comparison come later if this direction is approved.
 */

export interface PyramidTier {
  label: string;
  color: string;
}

export type SketchDiagramProps = {
  title: string;
  topLabel?: string;
  tiers: PyramidTier[];
  bottomBanner?: string;
  leftCharacterSrc?: string;
  rightCharacterSrc?: string;
} & Record<string, unknown>;

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 800;
const PYRAMID_TOP_Y = 230;
const TIER_HEIGHT = 100;
const TOP_WIDTH = 260;
const BOTTOM_WIDTH = 620;

/** A tapered ribbon-banner hexagon (pointed left/right ends), not a plain rectangle. */
function ribbonPoints(x0: number, y0: number, x1: number, y1: number, notch: number): [number, number][] {
  const yc = (y0 + y1) / 2;
  return [
    [x0 + notch, y0],
    [x1 - notch, y0],
    [x1, yc],
    [x1 - notch, y1],
    [x0 + notch, y1],
    [x0, yc],
  ];
}

function tierPolygon(index: number, total: number) {
  const wTop = TOP_WIDTH + ((BOTTOM_WIDTH - TOP_WIDTH) * index) / total;
  const wBottom = TOP_WIDTH + ((BOTTOM_WIDTH - TOP_WIDTH) * (index + 1)) / total;
  const y0 = PYRAMID_TOP_Y + index * TIER_HEIGHT;
  const y1 = y0 + TIER_HEIGHT;
  const cx = CANVAS_WIDTH / 2;
  const points: [number, number][] = [
    [cx - wTop / 2, y0],
    [cx + wTop / 2, y0],
    [cx + wBottom / 2, y1],
    [cx - wBottom / 2, y1],
  ];
  return { points, midY: (y0 + y1) / 2 };
}

export const SketchDiagram: React.FC<SketchDiagramProps> = ({
  title,
  topLabel,
  tiers,
  bottomBanner,
  leftCharacterSrc,
  rightCharacterSrc,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [handle] = useState(() => delayRender("Drawing rough.js sketch diagram"));

  const tierLayout = useMemo(() => tiers.map((tier, i) => ({ tier, ...tierPolygon(i, tiers.length) })), [tiers]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const rc = rough.svg(svg);

    // Fixed seeds throughout — roughjs's "sketchy" wobble is randomized by
    // default, and an unseeded shape would redraw slightly differently on
    // every frame Remotion captures, producing a flickering diagram instead
    // of a stable one.
    tierLayout.forEach(({ tier, points }, i) => {
      svg.appendChild(
        rc.polygon(points, {
          fill: tier.color,
          fillStyle: "solid",
          roughness: 1.7,
          stroke: "#1a1a1a",
          strokeWidth: 2.5,
          seed: 100 + i,
        }),
      );
    });

    if (topLabel) {
      const cx = CANVAS_WIDTH / 2;
      const points = ribbonPoints(cx - 150, PYRAMID_TOP_Y - 150, cx + 150, PYRAMID_TOP_Y - 50, 24);
      svg.appendChild(
        rc.polygon(points, {
          fill: "#ffffff",
          fillStyle: "solid",
          roughness: 2.2,
          bowing: 2,
          stroke: "#1a1a1a",
          strokeWidth: 3,
          seed: 999,
        }),
      );
    }

    if (bottomBanner) {
      const cx = CANVAS_WIDTH / 2;
      const bannerY = PYRAMID_TOP_Y + tiers.length * TIER_HEIGHT + 30;
      const points = ribbonPoints(cx - 320, bannerY, cx + 320, bannerY + 70, 40);
      svg.appendChild(
        rc.polygon(points, {
          fill: "#ffffff",
          fillStyle: "solid",
          roughness: 2.2,
          bowing: 2,
          stroke: "#1a1a1a",
          strokeWidth: 3,
          seed: 1000,
        }),
      );
    }

    // A sketchy connecting arrow from the pyramid to the right-hand
    // character — the same visual device Golpo uses to link a diagram to
    // the people it's explaining. Drawn as a curved rough.js line with a
    // solid triangular arrowhead, not a straight/geometric line.
    const arrowStartX = CANVAS_WIDTH / 2 + BOTTOM_WIDTH / 2 + 10;
    const arrowStartY = PYRAMID_TOP_Y + TIER_HEIGHT;
    const arrowEndX = arrowStartX + 90;
    const arrowEndY = arrowStartY + 110;
    svg.appendChild(
      rc.curve(
        [
          [arrowStartX, arrowStartY],
          [arrowStartX + 50, arrowStartY + 40],
          [arrowEndX, arrowEndY],
        ],
        { stroke: "#c0392b", strokeWidth: 6, roughness: 1.9, seed: 1100 },
      ),
    );
    const angle = Math.atan2(arrowEndY - (arrowStartY + 40), arrowEndX - (arrowStartX + 50));
    const headLen = 22;
    const headSpread = 0.5;
    svg.appendChild(
      rc.polygon(
        [
          [arrowEndX, arrowEndY],
          [
            arrowEndX - headLen * Math.cos(angle - headSpread),
            arrowEndY - headLen * Math.sin(angle - headSpread),
          ],
          [
            arrowEndX - headLen * Math.cos(angle + headSpread),
            arrowEndY - headLen * Math.sin(angle + headSpread),
          ],
        ],
        { fill: "#c0392b", fillStyle: "solid", stroke: "#c0392b", strokeWidth: 1, roughness: 1.5, seed: 1101 },
      ),
    );

    continueRender(handle);
  }, [handle, tierLayout, topLabel, bottomBanner, tiers.length]);

  const bannerY = PYRAMID_TOP_Y + tiers.length * TIER_HEIGHT + 30;

  return (
    <AbsoluteFill style={{ backgroundColor: "#faf6ec" }}>
      <div
        style={{
          position: "absolute",
          top: 25,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontWeight: 900,
          fontSize: 42,
          letterSpacing: 1,
          color: "#1a1a1a",
        }}
      >
        {title}
      </div>

      <svg ref={svgRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={{ position: "absolute", left: 0, top: 0 }} />

      {topLabel && (
        <div
          style={{
            position: "absolute",
            left: CANVAS_WIDTH / 2 - 150,
            top: PYRAMID_TOP_Y - 150,
            width: 300,
            height: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontWeight: 800,
            fontSize: 22,
            textAlign: "center",
            color: "#1a1a1a",
          }}
        >
          {topLabel}
        </div>
      )}

      {tierLayout.map(({ tier, midY }) => (
        <div
          key={tier.label}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: midY - 22,
            textAlign: "center",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontWeight: 800,
            fontSize: 34,
            color: "#1a1a1a",
          }}
        >
          {tier.label}
        </div>
      ))}

      {bottomBanner && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: bannerY + 22,
            textAlign: "center",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontWeight: 800,
            fontSize: 26,
            color: "#1a1a1a",
          }}
        >
          {bottomBanner}
        </div>
      )}

      {leftCharacterSrc && (
        <Img
          src={leftCharacterSrc}
          style={{ position: "absolute", left: 20, top: 320, width: 240, height: "auto" }}
        />
      )}
      {rightCharacterSrc && (
        <Img
          src={rightCharacterSrc}
          style={{ position: "absolute", right: 20, top: 320, width: 240, height: "auto" }}
        />
      )}
    </AbsoluteFill>
  );
};
