import React, { useEffect, useMemo, useRef, useState } from "react";
import rough from "roughjs";
import { AbsoluteFill, Img, continueRender, delayRender, useVideoConfig } from "remotion";
import { SKETCH_COLORS, SKETCH_LINE, SKETCH_LAYOUT, SKETCH_FONT_FAMILY, sketchFontFaceCss, waitForSketchFont } from "../sketchStyle";
import { BannerRibbon } from "../decorations";

/**
 * Started as a proof-of-concept for the amendment §5 sketchDiagram action
 * type; now wired into the real schema/pipeline (revision-2 Layer 1).
 * "pyramid" was the original, only-implemented shape. "flowchart" and
 * "comparison" (revision-2 doc, Layer 1 schema) were added after a real
 * test video (topic: the water cycle) showed the planner forcing a
 * genuinely cyclical process into a pyramid — a shape that visually claims
 * a ranking the content doesn't have. A pyramid still fits a real
 * hierarchy; a sequence/process/cycle should use flowchart instead.
 *
 * Every color/line/font choice below comes from ../sketchStyle.ts, not a
 * local constant — that file is the one place to tune "does this look like
 * Golpo" so future sketch-based components don't quietly drift apart.
 */

export interface PyramidTier {
  label: string;
  color?: string; // defaults to SKETCH_COLORS.tierPalette by index
  // Revision-3 Workstream 3: a small icon-scale illustration inside the
  // tier alongside its label — "diagram shapes carry embedded content"
  // (Part I §8), pyramid mode only (the shape most likely to have real
  // width to spare per tier).
  insetSrc?: string;
}

export type SketchDiagramProps = {
  diagramType?: "pyramid" | "flowchart" | "comparison";
  title: string;
  topLabel?: string;
  tiers: PyramidTier[];
  bottomBanner?: string;
  leftCharacterSrc?: string;
  rightCharacterSrc?: string;
  /** flowchart-only: draws the loop-back return arrow. See scene.ts's own comment on why this isn't automatic. */
  isCyclical?: boolean;
} & Record<string, unknown>;

const CANVAS_WIDTH = 1000;
const PYRAMID_CANVAS_HEIGHT = 800;
const PYRAMID_TOP_Y = 230;
const TIER_HEIGHT = 120;
const TIER_GAP = 26;
// Revision 4: the pyramid/trapezoid shape is gone (see the doc comment
// below tierPolygon's old home) — every tier is now a full-width rounded
// card of the SAME width, so a label is never measured against one width
// (BOTTOM_WIDTH) while actually confined by a narrower one (an upper
// tier's true trapezoid width). That mismatch was the root cause of a real
// render showing text spilling past a tier's visible edge, and of that
// tier's inset icon floating outside the shape entirely.
const STACK_WIDTH = 680;
// Revision 4 round 2: the fixed TIER_HEIGHT/TIER_GAP above left a real
// render's 2-3 tier hierarchy using well under half the actual vertical
// frame — a big dead zone below the stack (and, separately, a planner-
// authored decorative arrow with no knowledge of that geometry landed
// squarely inside the empty region, "pointing" at nothing). Fixed the same
// way the flowchart shape already was: tier height/gap now scale to fill
// the real available canvas height instead of a fixed per-tier constant.
const PYRAMID_TIER_HEIGHT_MAX = 280;
const PYRAMID_TIER_GAP_MAX = 90;
const PYRAMID_BOTTOM_RESERVE = 260; // room below the stack for bottomBanner/characters/padding
const PYRAMID_TITLE_BOTTOM = 100; // the title (top:25, 46px font) occupies roughly y:25-85
// Revision 4 round 2: the topLabel banner used to sit at PYRAMID_TOP_Y-150
// (=80), which overlapped the title's own bottom edge (~85) — "too close,"
// a real render's own complaint. It's also given up its hexagon-notched
// BannerRibbon shape for a plain rectangle: a real render showed a pyramid
// where the top label was one shape and its two tiers were another —
// the shape language has to stay consistent within one diagram.
const PYRAMID_TOP_LABEL_GAP_ABOVE = 45; // clearance below the title before the label box starts
const PYRAMID_TOP_LABEL_HEIGHT = 90;
const PYRAMID_TOP_LABEL_GAP_BELOW = 40; // clearance after the label box before the tier stack starts

/** A stacked "hierarchy card" tier — same width and shape for every tier,
 * top to bottom, connected by a short downward arrow instead of a
 * tapering trapezoid claiming a ranking via width. */
function tierPolygon(index: number, topY: number, tierHeight: number, tierGap: number) {
  const cx = CANVAS_WIDTH / 2;
  const y0 = topY + index * (tierHeight + tierGap);
  const y1 = y0 + tierHeight;
  const points: [number, number][] = [
    [cx - STACK_WIDTH / 2, y0],
    [cx + STACK_WIDTH / 2, y0],
    [cx + STACK_WIDTH / 2, y1],
    [cx - STACK_WIDTH / 2, y1],
  ];
  return { points, midY: (y0 + y1) / 2, cx };
}

const FLOWCHART_BOX_WIDTH = 860;
const FLOWCHART_BOX_HEIGHT = 130;
const FLOWCHART_GAP = 70;
const FLOWCHART_TOP_Y = 180;

const COMPARISON_BOX_WIDTH = 420;
const COMPARISON_BOX_HEIGHT = 420;
const COMPARISON_TOP_Y = 220;
const COMPARISON_CANVAS_HEIGHT = 800;

// The title sits at top:25 with a 46px font, so it occupies roughly
// y:25-85. A non-pyramid topLabel banner used to sit at y:60 — squarely
// inside that range — and clip straight through the title text. Pushing
// the banner (and the content that follows it) down clears the title
// first, then leaves its own gap before the diagram body starts.
const TOP_LABEL_Y_NONPYRAMID = 95;
const CONTENT_Y_OFFSET_WITH_LABEL = 55;

function boxPoints(cx: number, cy: number, w: number, h: number): [number, number][] {
  return [
    [cx - w / 2, cy - h / 2],
    [cx + w / 2, cy - h / 2],
    [cx + w / 2, cy + h / 2],
    [cx - w / 2, cy + h / 2],
  ];
}

/** Long tier/step labels (a real problem seen in the water-cycle test — a
 * full clause like "Evaporation: Sun heats ocean, water becomes vapor"
 * overflowed a fixed 34px size) shrink to stay legible inside their box. */
function fontSizeForLabel(label: string, base: number): number {
  if (label.length > 60) return Math.round(base * 0.55);
  if (label.length > 40) return Math.round(base * 0.7);
  if (label.length > 25) return Math.round(base * 0.85);
  return base;
}

export const SketchDiagram: React.FC<SketchDiagramProps> = ({
  diagramType = "pyramid",
  title,
  topLabel,
  tiers,
  bottomBanner,
  leftCharacterSrc,
  rightCharacterSrc,
  isCyclical = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [handle] = useState(() => delayRender("Loading font + drawing rough.js sketch diagram"));
  const { height: realCanvasHeight } = useVideoConfig();

  // Only non-pyramid diagrams need this — the pyramid's own topLabel sits
  // well above the pyramid body (PYRAMID_TOP_Y - 150), nowhere near the
  // title, so it never needed the push in the first place.
  const contentYOffset = topLabel && diagramType !== "pyramid" ? CONTENT_Y_OFFSET_WITH_LABEL : 0;

  const pyramidTopLabelBoxTop = PYRAMID_TITLE_BOTTOM + PYRAMID_TOP_LABEL_GAP_ABOVE;
  const pyramidTiersTopY = topLabel
    ? pyramidTopLabelBoxTop + PYRAMID_TOP_LABEL_HEIGHT + PYRAMID_TOP_LABEL_GAP_BELOW
    : PYRAMID_TOP_Y;
  const pyramidAvailableHeight = Math.max(0, realCanvasHeight - pyramidTiersTopY - PYRAMID_BOTTOM_RESERVE);
  const pyramidPerTier = tiers.length > 0 ? pyramidAvailableHeight / tiers.length : 0;
  const pyramidTierHeight = Math.min(PYRAMID_TIER_HEIGHT_MAX, Math.max(TIER_HEIGHT, pyramidPerTier * 0.62));
  const pyramidTierGap = Math.min(PYRAMID_TIER_GAP_MAX, Math.max(TIER_GAP, pyramidPerTier * 0.3));
  const pyramidStackHeightUncentered = tiers.length * pyramidTierHeight + Math.max(0, tiers.length - 1) * pyramidTierGap;
  // A small tier count (2-3) hits the per-tier height/gap caps above well
  // before it uses the real available height — capping tier height is
  // correct (an uncapped single tier could become an absurd, oversized
  // rectangle), but left uncorrected it reopens the exact dead-zone problem
  // the caps were added to avoid, just below the stack instead of below the
  // whole diagram. Splitting the leftover space evenly above/below the
  // (still modestly-sized) stack turns it into breathing room instead.
  const pyramidLeftoverHeight = Math.max(0, pyramidAvailableHeight - pyramidStackHeightUncentered);
  const pyramidTiersStartY = pyramidTiersTopY + pyramidLeftoverHeight / 2;

  const tierLayout = useMemo(
    () =>
      tiers.map((tier, i) => ({
        tier: { ...tier, color: tier.color ?? SKETCH_COLORS.tierPalette[i % SKETCH_COLORS.tierPalette.length]! },
        ...tierPolygon(i, pyramidTiersStartY, pyramidTierHeight, pyramidTierGap),
      })),
    [tiers, pyramidTiersStartY, pyramidTierHeight, pyramidTierGap],
  );

  // Caught on a real render: a bare flowchart (no flanking character, no
  // tier insets — a real case, e.g. a short cause-and-effect reasoning
  // chain) only ever sized its SVG to a minimal fit around
  // FLOWCHART_BOX_HEIGHT/GAP, then just left the rest of the REAL video
  // frame (which this component never queried) as blank paper below it —
  // a 3-tier flowchart used under half the actual canvas height. Box
  // height/gap now scale to fill the real available vertical space
  // instead of a fixed per-tier constant, bounded so a many-tier
  // flowchart doesn't grow absurdly tall or a short one grow absurdly
  // sparse.
  const flowchartAvailableHeight = Math.max(0, realCanvasHeight - FLOWCHART_TOP_Y - contentYOffset - 140);
  const flowchartPerTier = tiers.length > 0 ? flowchartAvailableHeight / tiers.length : 0;
  const flowchartBoxHeight = Math.min(340, Math.max(FLOWCHART_BOX_HEIGHT, flowchartPerTier * 0.68));
  const flowchartGap = Math.min(140, Math.max(FLOWCHART_GAP, flowchartPerTier * 0.38));

  const flowSteps = useMemo(
    () =>
      tiers.map((tier, i) => {
        const cx = CANVAS_WIDTH / 2;
        const cy = FLOWCHART_TOP_Y + contentYOffset + i * (flowchartBoxHeight + flowchartGap) + flowchartBoxHeight / 2;
        return {
          tier: { ...tier, color: tier.color ?? SKETCH_COLORS.tierPalette[i % SKETCH_COLORS.tierPalette.length]! },
          points: boxPoints(cx, cy, FLOWCHART_BOX_WIDTH, flowchartBoxHeight),
          cx,
          cy,
        };
      }),
    [tiers, contentYOffset, flowchartBoxHeight, flowchartGap],
  );
  const flowchartCanvasHeight =
    FLOWCHART_TOP_Y + contentYOffset + tiers.length * (flowchartBoxHeight + flowchartGap) + 120;

  const comparisonBoxes = useMemo(() => {
    const pair = tiers.slice(0, 2);
    return pair.map((tier, i) => {
      const cx = CANVAS_WIDTH / 2 + (i === 0 ? -1 : 1) * (COMPARISON_BOX_WIDTH / 2 + 40);
      const cy = COMPARISON_TOP_Y + contentYOffset + COMPARISON_BOX_HEIGHT / 2;
      return {
        tier: { ...tier, color: tier.color ?? SKETCH_COLORS.tierPalette[i % SKETCH_COLORS.tierPalette.length]! },
        points: boxPoints(cx, cy, COMPARISON_BOX_WIDTH, COMPARISON_BOX_HEIGHT),
        cx,
        cy,
      };
    });
  }, [tiers, contentYOffset]);

  const pyramidStackHeight = pyramidStackHeightUncentered;
  const pyramidBaseY = pyramidTiersStartY + pyramidStackHeight;

  const canvasHeight =
    diagramType === "flowchart"
      ? flowchartCanvasHeight
      : diagramType === "comparison"
        ? COMPARISON_CANVAS_HEIGHT + contentYOffset
        : Math.max(PYRAMID_CANVAS_HEIGHT, pyramidBaseY + 200, realCanvasHeight);

  const anchorBaseY = diagramType === "pyramid" ? pyramidBaseY : diagramType === "flowchart" ? flowchartCanvasHeight - 120 : COMPARISON_TOP_Y + contentYOffset + COMPARISON_BOX_HEIGHT;
  // Capped at 700 for every diagram type — flowchart and pyramid both scale
  // their own height to fill the real canvas (the dead-zone fix), which
  // would otherwise inflate a flanking character to an enormous size on a
  // tall vertical video. Caught on a real render: an uncapped flowchart
  // character grew tall enough to completely cover two of its own steps'
  // text — the diagram filling the frame doesn't mean the character beside
  // it should too.
  const characterHeightBasis = Math.min(diagramType === "pyramid" ? pyramidStackHeight : anchorBaseY - 150, 700);
  const characterHeight = characterHeightBasis * SKETCH_LAYOUT.characterToPyramidHeightRatio;
  // Same fix, the other axis: a character positioned at a fixed left:20/
  // right:20 inset has only the margin between the canvas edge and this
  // diagram's own box width before it starts overlapping that box — same
  // real render showed the (also uncapped) width overlapping flowchart step
  // boxes even where the height alone looked reasonable.
  const diagramBoxWidth = diagramType === "pyramid" ? STACK_WIDTH : diagramType === "flowchart" ? FLOWCHART_BOX_WIDTH : COMPARISON_BOX_WIDTH * 2 + 80;
  const characterMaxWidth = Math.max(60, (CANVAS_WIDTH - diagramBoxWidth) / 2 - 40);
  // Pyramid centers its flanking characters against the stack's own
  // vertical midpoint instead of anchoring to its bottom edge — since the
  // stack can now be much taller than the (capped) character, bottom
  // anchoring would strand the character down by the last tier with a tall
  // empty gap above it, beside the earlier tiers.
  const characterTop =
    diagramType === "pyramid" ? pyramidTiersStartY + (pyramidStackHeight - characterHeight) / 2 : anchorBaseY - characterHeight;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await waitForSketchFont();
      if (cancelled) return;

      const svg = svgRef.current;
      if (!svg) return;
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      const rc = rough.svg(svg);

      const drawBox = (points: [number, number][], color: string, seed: number) => {
        svg.appendChild(
          rc.polygon(points, {
            fill: color,
            fillStyle: SKETCH_LINE.fillStyle,
            roughness: SKETCH_LINE.roughness,
            bowing: SKETCH_LINE.bowing,
            stroke: SKETCH_COLORS.ink,
            strokeWidth: SKETCH_LINE.strokeWidth,
            seed,
          }),
        );
      };

      const drawArrow = (x0: number, y0: number, x1: number, y1: number, seed: number) => {
        svg.appendChild(
          rc.curve(
            [
              [x0, y0],
              [(x0 + x1) / 2, (y0 + y1) / 2],
              [x1, y1],
            ],
            { stroke: SKETCH_COLORS.accentArrow, strokeWidth: SKETCH_LINE.strokeWidthThick, roughness: SKETCH_LINE.roughness, seed },
          ),
        );
        const angle = Math.atan2(y1 - (y0 + y1) / 2, x1 - (x0 + x1) / 2);
        const headLen = 20;
        const headSpread = 0.5;
        svg.appendChild(
          rc.polygon(
            [
              [x1, y1],
              [x1 - headLen * Math.cos(angle - headSpread), y1 - headLen * Math.sin(angle - headSpread)],
              [x1 - headLen * Math.cos(angle + headSpread), y1 - headLen * Math.sin(angle + headSpread)],
            ],
            { fill: SKETCH_COLORS.accentArrow, fillStyle: SKETCH_LINE.fillStyle, stroke: SKETCH_COLORS.accentArrow, strokeWidth: SKETCH_LINE.strokeWidthHairline, roughness: SKETCH_LINE.roughnessTight, seed: seed + 1 },
          ),
        );
      };

      if (diagramType === "flowchart") {
        flowSteps.forEach(({ tier, points, cx: bx }, i) => {
          drawBox(points, tier.color, 100 + i);
          if (i < flowSteps.length - 1) {
            const next = flowSteps[i + 1]!;
            drawArrow(bx, points[2]![1], next.cx, next.points[0]![1], 500 + i);
          }
        });
        // A curved return arrow from the last step back to the first —
        // makes an explicitly cyclical process (the common reason this
        // shape got added) read as a loop, not a dead-ended list. Only
        // when the planner actually marked this sequence cyclical — see
        // scene.ts's isCyclical comment for the real render this fixed
        // (a plain 3-example list got an unwanted loop arrow drawn onto
        // it just because it happened to use the flowchart shape).
        if (isCyclical && flowSteps.length > 1) {
          const first = flowSteps[0]!;
          const last = flowSteps[flowSteps.length - 1]!;
          const returnX = CANVAS_WIDTH - 60;
          svg.appendChild(
            rc.curve(
              [
                [last.cx + FLOWCHART_BOX_WIDTH / 2, last.cy],
                [returnX, last.cy],
                [returnX, first.cy],
                [first.cx + FLOWCHART_BOX_WIDTH / 2, first.cy],
              ],
              { stroke: SKETCH_COLORS.accentArrow, strokeWidth: SKETCH_LINE.strokeWidthThick, roughness: SKETCH_LINE.roughness, seed: 900 },
            ),
          );
        }
      } else if (diagramType === "comparison") {
        comparisonBoxes.forEach(({ tier, points }, i) => drawBox(points, tier.color, 100 + i));
      } else {
        // Revision 4 round 2: the top label is now a plain rectangle drawn
        // the same way as the tiers below it (same drawBox call, same
        // width) instead of the hexagon-notched BannerRibbon — a real
        // render showed a pyramid where the label was one shape and its
        // tiers were another, breaking the "everything here is a rectangle"
        // shape language the rest of the diagram commits to.
        if (topLabel) {
          const labelPoints = boxPoints(CANVAS_WIDTH / 2, pyramidTopLabelBoxTop + PYRAMID_TOP_LABEL_HEIGHT / 2, STACK_WIDTH, PYRAMID_TOP_LABEL_HEIGHT);
          drawBox(labelPoints, SKETCH_COLORS.panelFill, 40);
          if (tierLayout.length > 0) {
            const first = tierLayout[0]!;
            drawArrow(CANVAS_WIDTH / 2, pyramidTopLabelBoxTop + PYRAMID_TOP_LABEL_HEIGHT, first.cx, first.points[0]![1], 480);
          }
        }
        // Revision 4: each tier card connects to the next with a short
        // straight down-arrow instead of the old design's single diagonal
        // arrow off to a flanking character — that arrow was a fixed pixel
        // length regardless of where the character actually stood, so on
        // a real render it visibly pointed at empty canvas, not the
        // character it was meant to connect to.
        tierLayout.forEach(({ tier, points, cx: tx }, i) => {
          drawBox(points, tier.color, 100 + i);
          if (i < tierLayout.length - 1) {
            const next = tierLayout[i + 1]!;
            drawArrow(tx, points[2]![1], next.cx, next.points[0]![1], 500 + i);
          }
        });
        // Same rectangle-consistency fix as the top label above — the
        // footer banner was still the hexagon-notched BannerRibbon, which
        // would have left the diagram with a rectangle top+tiers but a
        // hexagon bottom, the exact inconsistency the design-system rule
        // (Revision 4) now calls out explicitly.
        if (bottomBanner) {
          const bannerPoints = boxPoints(CANVAS_WIDTH / 2, anchorBaseY + 65, 640, 70);
          drawBox(bannerPoints, SKETCH_COLORS.panelFill, 700);
        }
      }

      continueRender(handle);
    })();

    return () => {
      cancelled = true;
    };
  }, [handle, diagramType, tierLayout, flowSteps, comparisonBoxes, topLabel, bottomBanner, anchorBaseY, contentYOffset, isCyclical]);

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      <div
        style={{
          position: "absolute",
          top: 25,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: SKETCH_FONT_FAMILY,
          fontSize: 46,
          letterSpacing: 1,
          color: SKETCH_COLORS.ink,
        }}
      >
        {title}
      </div>

      <svg ref={svgRef} width={CANVAS_WIDTH} height={canvasHeight} style={{ position: "absolute", left: 0, top: 0 }} />

      {/* Revision-3 Workstream 3 item 4: title/footer panels reuse the
          shared BannerRibbon decoration instead of a second hand-rolled
          ribbon-polygon implementation. Rendered in its own <svg>, after
          the imperative canvas above, so it paints on top the same way
          the old inline drawBox(ribbonPoints(...)) calls did. */}
      <svg width={CANVAS_WIDTH} height={canvasHeight} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        {/* Pyramid's topLabel is drawn as a plain rectangle in the
            imperative rough.js pass above (matching the tiers' own shape),
            not this ribbon — see the round-2 comment there. */}
        {topLabel && diagramType !== "pyramid" && <BannerRibbon x={CANVAS_WIDTH / 2 - 150} y={TOP_LABEL_Y_NONPYRAMID} width={300} height={100} instant />}
        {/* Pyramid's bottomBanner is drawn as a plain rectangle in the
            imperative rough.js pass above, same rectangle-consistency fix
            as topLabel. */}
        {bottomBanner && diagramType !== "pyramid" && <BannerRibbon x={CANVAS_WIDTH / 2 - 320} y={anchorBaseY + 30} width={640} height={70} instant />}
        {diagramType === "comparison" && comparisonBoxes.length === 2 && (
          <BannerRibbon
            x={CANVAS_WIDTH / 2 - 60}
            y={COMPARISON_TOP_Y + contentYOffset + COMPARISON_BOX_HEIGHT / 2 - 35}
            width={120}
            height={70}
            instant
          />
        )}
      </svg>

      {topLabel && diagramType === "pyramid" && (
        <div
          style={{
            position: "absolute",
            left: CANVAS_WIDTH / 2 - STACK_WIDTH / 2,
            top: pyramidTopLabelBoxTop,
            width: STACK_WIDTH,
            height: PYRAMID_TOP_LABEL_HEIGHT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: SKETCH_FONT_FAMILY,
            fontSize: 26,
            textAlign: "center",
            color: SKETCH_COLORS.ink,
          }}
        >
          {topLabel}
        </div>
      )}
      {topLabel && diagramType !== "pyramid" && (
        <div
          style={{
            position: "absolute",
            left: CANVAS_WIDTH / 2 - 150,
            top: TOP_LABEL_Y_NONPYRAMID + 10,
            width: 300,
            height: 80,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: SKETCH_FONT_FAMILY,
            fontSize: 24,
            textAlign: "center",
            color: SKETCH_COLORS.ink,
          }}
        >
          {topLabel}
        </div>
      )}

      {diagramType === "flowchart" &&
        flowSteps.map(({ tier, cy }) => (
          <div
            key={tier.label}
            style={{
              position: "absolute",
              left: CANVAS_WIDTH / 2 - FLOWCHART_BOX_WIDTH / 2 + 30,
              width: FLOWCHART_BOX_WIDTH - 60,
              top: cy - fontSizeForLabel(tier.label, 34) * 0.8,
              textAlign: "center",
              fontFamily: SKETCH_FONT_FAMILY,
              fontSize: fontSizeForLabel(tier.label, 34),
              lineHeight: 1.25,
              color: SKETCH_COLORS.ink,
            }}
          >
            {tier.label}
          </div>
        ))}

      {diagramType === "comparison" &&
        comparisonBoxes.map(({ tier, cx, cy }) => (
          <div
            key={tier.label}
            style={{
              position: "absolute",
              left: cx - COMPARISON_BOX_WIDTH / 2 + 40,
              width: COMPARISON_BOX_WIDTH - 80,
              top: cy - fontSizeForLabel(tier.label, 28) * 0.8,
              textAlign: "center",
              fontFamily: SKETCH_FONT_FAMILY,
              fontSize: fontSizeForLabel(tier.label, 28),
              lineHeight: 1.3,
              wordBreak: "break-word",
              overflowWrap: "break-word",
              color: SKETCH_COLORS.ink,
            }}
          >
            {tier.label}
          </div>
        ))}

      {diagramType === "comparison" && comparisonBoxes.length === 2 && (
        <div
          style={{
            position: "absolute",
            left: CANVAS_WIDTH / 2 - 60,
            top: COMPARISON_TOP_Y + contentYOffset + COMPARISON_BOX_HEIGHT / 2 - 24,
            width: 120,
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: SKETCH_FONT_FAMILY,
            fontSize: 30,
            color: SKETCH_COLORS.ink,
          }}
        >
          VS
        </div>
      )}

      {diagramType === "pyramid" &&
        tierLayout.map(({ tier, midY }) => {
          const insetSize = TIER_HEIGHT * 0.7;
          return (
            <React.Fragment key={tier.label}>
              <div
                style={{
                  position: "absolute",
                  left: CANVAS_WIDTH / 2 - STACK_WIDTH / 2 + 40,
                  width: STACK_WIDTH - 80 - (tier.insetSrc ? insetSize + 16 : 0),
                  top: midY - fontSizeForLabel(tier.label, 34) * 0.65,
                  textAlign: "center",
                  fontFamily: SKETCH_FONT_FAMILY,
                  fontSize: fontSizeForLabel(tier.label, 34),
                  lineHeight: 1.2,
                  color: SKETCH_COLORS.ink,
                }}
              >
                {tier.label}
              </div>
              {tier.insetSrc && (
                <Img
                  src={tier.insetSrc}
                  style={{
                    position: "absolute",
                    left: CANVAS_WIDTH / 2 + STACK_WIDTH / 2 - insetSize - 24,
                    top: midY - insetSize / 2,
                    height: insetSize,
                    width: insetSize,
                    objectFit: "contain",
                  }}
                />
              )}
            </React.Fragment>
          );
        })}

      {bottomBanner && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: anchorBaseY + 30 + 22,
            textAlign: "center",
            fontFamily: SKETCH_FONT_FAMILY,
            fontSize: 28,
            color: SKETCH_COLORS.ink,
          }}
        >
          {bottomBanner}
        </div>
      )}

      {leftCharacterSrc && (
        // Revision 4 round 2 fix: a diagram filling a tall vertical frame
        // (the dead-zone fix above) computes a tall characterHeight, but
        // scaling a flanking character by height alone let a normally-
        // proportioned character grow WIDER than its actual side margin
        // and overlap the diagram's own boxes/text — a real regression
        // from that same fix, caught on a real render for both pyramid and
        // flowchart. maxWidth caps it on that axis too, same "fit within
        // both bounds" resolution already used for HeroBackdropTemplate.
        <Img
          src={leftCharacterSrc}
          style={{ position: "absolute", left: 20, top: characterTop, maxHeight: characterHeight, maxWidth: characterMaxWidth, width: "auto", height: "auto" }}
        />
      )}
      {rightCharacterSrc && diagramType === "pyramid" && (
        <Img
          src={rightCharacterSrc}
          style={{ position: "absolute", right: 20, top: characterTop, maxHeight: characterHeight, maxWidth: characterMaxWidth, width: "auto", height: "auto" }}
        />
      )}
    </AbsoluteFill>
  );
};
