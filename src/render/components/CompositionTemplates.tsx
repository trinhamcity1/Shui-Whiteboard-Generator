import React from "react";
import { AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { DrawOn } from "./DrawOn";
import { SketchDiagram } from "./SketchDiagram";
import { SKETCH_COLORS, SKETCH_LAYOUT, SKETCH_FONT_FAMILY, sketchFontFaceCss } from "../sketchStyle";
import { DecorationLayer, TornPaperEdge, Arrow } from "../decorations";
import type { CompositionSlot } from "../../schema/scene";

/**
 * Revision-2 Layer 3's four starter composition templates — data-driven
 * layouts a human designed once (position/scale/z-order fixed in the
 * component), with the planner only ever selecting a templateId and
 * filling named slots. See the revision-2 doc, Layer 3: "an LLM inventing
 * a genuinely artistic layout from scratch, every render, is not reliable
 * — a mechanical grid is the predictable failure mode of skipping this
 * split."
 *
 * Per-slot reveal timing: each slot's visual reveal is offset within the
 * scene's own time window by passing a slot-specific startFrame straight
 * to DrawOn. Positioning for each slot is passed via DrawOn's own `style`
 * prop (position/coordinates on the wrapper itself), never as
 * position:absolute on a child inside an unstyled DrawOn wrapper — DrawOn
 * always applies a `transform`, which makes its wrapper the CSS containing
 * block for any absolutely-positioned descendant; a wrapper with no
 * explicit size resolves percentage/`bottom` values against its own
 * auto-sized content box instead of the intended full-frame box, which
 * silently failed to render several slots (a real bug hit building this
 * file — see DrawOn.tsx for the full explanation).
 */

export interface CompositionTemplateProps {
  title?: string;
  slots: Record<string, CompositionSlot>;
}

function useSlotOffsetFrames(slot: CompositionSlot | undefined): number {
  const { fps } = useVideoConfig();
  return Math.round((slot?.revealAtSeconds ?? 0) * fps);
}

/** A storyboard connector arrow, faded in at the same startFrame as the
 * panel it points TO — a real render showed all connector arrows drawn at
 * frame 0 while the panels they connected only appeared later (each
 * panel's own revealAtSeconds), reading as the arrow pointing at nothing.
 * SVG <line>/<marker> can't be wrapped in DrawOn's div, so this reimplements
 * the same fade-in math directly on the line's own opacity. */
function StoryboardArrow({ x1, y1, x2, y2, revealFrames }: { x1: number; y1: number; x2: number; y2: number; revealFrames: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const revealDuration = Math.round(fps * 0.4);
  const opacity = interpolate(frame, [revealFrames, revealFrames + revealDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={SKETCH_COLORS.accentArrow}
      strokeWidth={5}
      markerEnd="url(#storyboard-arrowhead)"
      opacity={opacity}
    />
  );
}

/** Collects every slot's decorations into one full-bleed overlay — decoration coordinates are absolute canvas-space, same as a plain action's. */
function SlotDecorations({ slots }: { slots: Record<string, CompositionSlot> }) {
  const all = Object.values(slots).flatMap((slot) => slot.decorations ?? []);
  if (all.length === 0) return null;
  return <DecorationLayer decorations={all} />;
}

/** Workstream 4's one allowed correction: a small nudge on top of the
 * template's own fixed position, via the independent CSS `translate`/
 * `scale` properties rather than `transform` — DrawOn already owns
 * `transform` for its own reveal animation, and these don't conflict with
 * it the way stacking two `transform` values would. */
function applyLayoutAdjustment(style: React.CSSProperties, slot: CompositionSlot | undefined): React.CSSProperties {
  const adj = slot?.layoutAdjustment;
  if (!adj) return style;
  return {
    ...style,
    translate: adj.offsetX !== undefined || adj.offsetY !== undefined ? `${adj.offsetX ?? 0}px ${adj.offsetY ?? 0}px` : undefined,
    scale: adj.scaleMultiplier,
  } as React.CSSProperties;
}

/** Workstream 3 item 3 — when a slot declares `attachTo: "otherSlotName"`
 * and that other slot resolved an "attachment" anchor (e.g. a building's
 * front steps), positions this slot at that anchor instead of a fixed
 * spot: "a character standing on the steps" rather than "a character in a
 * neighboring box." Mirrors HeroBackdropTemplate's own fixed backdrop box
 * (left 10%, top 220, width 80%) since that's the only geometry the
 * anchor's 0-1 fractions can be resolved against. Returns null (falls
 * back to the template's normal fixed position) if attachTo isn't set, or
 * the referenced slot has no attachment anchor / pixel dimensions yet. */
function resolveAttachmentStyle(
  slots: Record<string, CompositionSlot>,
  slot: CompositionSlot | undefined,
  canvasWidth: number,
): React.CSSProperties | null {
  if (!slot?.attachTo) return null;
  const target = slots[slot.attachTo];
  if (!target?.attachmentAnchor || !target.imageWidthPx || !target.imageHeightPx) return null;

  const backdropLeft = canvasWidth * 0.1;
  const backdropWidth = canvasWidth * 0.8;
  const backdropHeight = backdropWidth * (target.imageHeightPx / target.imageWidthPx);
  const backdropTop = 220;

  const anchorX = backdropLeft + target.attachmentAnchor.xFraction * backdropWidth;
  const anchorY = backdropTop + target.attachmentAnchor.yFraction * backdropHeight;
  const characterHeight = backdropHeight * SKETCH_LAYOUT.characterToBuildingHeightRatio;

  return { position: "absolute", left: anchorX, top: anchorY - characterHeight, height: characterHeight };
}

function SlotReveal({
  slot,
  style,
  children,
}: {
  slot: CompositionSlot | undefined;
  style: React.CSSProperties;
  children: React.ReactNode;
}) {
  const offsetFrames = useSlotOffsetFrames(slot);
  return (
    <DrawOn startFrame={offsetFrames} style={applyLayoutAdjustment(style, slot)}>
      {children}
    </DrawOn>
  );
}

function TitleHeading({ title }: { title?: string }) {
  if (!title) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 60,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: SKETCH_FONT_FAMILY,
        fontSize: 52,
        letterSpacing: 1,
        color: SKETCH_COLORS.ink,
        padding: "0 40px",
      }}
    >
      {title}
    </div>
  );
}

/** One backdrop image, one character composited over it, one caption banner.
 * The character can either sit at its own fixed spot (default) or, via
 * `attachTo: "backdrop"`, stand at the backdrop asset's detected
 * attachment anchor — Workstream 3 item 3. */
export function HeroBackdropTemplate({ title, slots }: CompositionTemplateProps) {
  const backdrop = slots.backdrop;
  const character = slots.character;
  const caption = slots.caption;
  const { width: canvasWidth } = useVideoConfig();

  const attachmentStyle = resolveAttachmentStyle(slots, character, canvasWidth);
  const characterStyle: React.CSSProperties = attachmentStyle ?? { position: "absolute", right: 60, top: 900, height: 500, width: 400 };

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      <TitleHeading title={title} />

      {backdrop?.imageUrl && (
        <SlotReveal slot={backdrop} style={{ position: "absolute", left: "10%", top: 220, width: "80%" }}>
          <Img src={backdrop.imageUrl} style={{ width: "100%", height: "auto", display: "block" }} />
        </SlotReveal>
      )}

      {character?.imageUrl && (
        <SlotReveal slot={character} style={characterStyle}>
          <Img
            src={character.imageUrl}
            style={
              attachmentStyle
                ? { height: "100%", width: "auto", display: "block", transform: "translateX(-50%)" }
                : { height: "100%", width: "auto", display: "block", marginLeft: "auto" }
            }
          />
        </SlotReveal>
      )}

      {caption?.label && (
        <SlotReveal slot={caption} style={{ position: "absolute", left: "10%", right: "10%", bottom: 120 }}>
          <div
            style={{
              textAlign: "center",
              fontFamily: SKETCH_FONT_FAMILY,
              fontSize: 34,
              color: SKETCH_COLORS.ink,
              background: SKETCH_COLORS.panelFill,
              border: `3px solid ${SKETCH_COLORS.ink}`,
              borderRadius: 12,
              padding: "16px 24px",
            }}
          >
            {caption.label}
          </div>
        </SlotReveal>
      )}
    <SlotDecorations slots={slots} />
    </AbsoluteFill>
  );
}

/** A thin wrapper over the existing SketchDiagram pyramid — reuses the
 * already-tested rough.js pyramid instead of a second implementation.
 * Slots named tier1, tier2, ... (in key order) become the pyramid's
 * tiers; leftCharacter/rightCharacter flank it, same as the raw
 * sketchDiagram action type. Not per-slot animated (the pyramid draws as
 * one piece, same as its original tested behavior) — per-slot reveal
 * timing applies to the other three templates, whose slots are genuinely
 * independent elements. */
export function PyramidFlankedTemplate({ title, slots }: CompositionTemplateProps) {
  const tierEntries = Object.entries(slots)
    .filter(([key]) => key.startsWith("tier"))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, slot]) => ({ label: slot.label ?? "", insetSrc: slot.imageUrl }))
    .filter((t) => t.label.length > 0);

  return (
    <>
      <SketchDiagram
        diagramType="pyramid"
        title={title ?? ""}
        // Revision-3 WS5 pyramid-flanked upgrade: topLabel/bottomBanner
        // slots (rendered by SketchDiagram as WS2 BannerRibbon panels, per
        // the WS3 item-4 refactor) and each tierN slot's own resolved
        // imageUrl (a tier-inset icon, per WS3 item 2) — previously wired
        // into SketchDiagram's props but never actually reached from here.
        topLabel={slots.topLabel?.label}
        bottomBanner={slots.bottomBanner?.label}
        tiers={tierEntries.length > 0 ? tierEntries : [{ label: "" }]}
        leftCharacterSrc={slots.leftCharacter?.imageUrl}
        rightCharacterSrc={slots.rightCharacter?.imageUrl}
      />
      <SlotDecorations slots={slots} />
    </>
  );
}

const PANEL_GRID_POSITIONS = [
  { left: "6%", top: 220 },
  { left: "52%", top: 220 },
  { left: "6%", top: 920 },
  { left: "52%", top: 920 },
];

// A fixed 2x2 grid left position 4 (bottom-right) empty whenever fewer
// than 4 panels were supplied — a real dead-zone LayoutQA flagged on a
// real render (3 panels is a common, valid count). 1-3 panels now lay out
// as a single centered row instead, using the vertical space a missing
// second row would have left empty; exactly 4 keeps the original grid.
function computePanelLayout(count: number): { positions: { left: string; top: number }[]; widthPct: number } {
  if (count === 4 || count === 0) return { positions: PANEL_GRID_POSITIONS, widthPct: 42 };
  const singleRowTop = 480;
  if (count <= 2) {
    return { positions: [{ left: "6%", top: singleRowTop }, { left: "52%", top: singleRowTop }].slice(0, count), widthPct: 42 };
  }
  // 3 panels: narrower than the grid's 42% so all three fit in one row.
  const widthPct = 29;
  const gapPct = 3;
  const totalWidthPct = count * widthPct + (count - 1) * gapPct;
  const startLeftPct = (100 - totalWidthPct) / 2;
  return {
    positions: Array.from({ length: count }, (_, i) => ({ left: `${startLeftPct + i * (widthPct + gapPct)}%`, top: singleRowTop })),
    widthPct,
  };
}

/** Up to 4 image+caption panels, connected by arrows in reading order — a
 * real multi-beat visual, not a wall of assets shown all at once. Exactly
 * 4 panels lay out as a 2x2 grid; fewer lay out as a single centered row
 * (see computePanelLayout). */
export function Storyboard4PanelTemplate({ title, slots }: CompositionTemplateProps) {
  const panels = ["panel1", "panel2", "panel3", "panel4"].map((key) => slots[key]).filter(Boolean) as CompositionSlot[];
  const { positions, widthPct } = computePanelLayout(panels.length);
  const isGrid = panels.length === 4;
  const { width: canvasWidth, height: canvasHeight, fps } = useVideoConfig();
  const revealFramesFor = (panel: CompositionSlot | undefined) => Math.round((panel?.revealAtSeconds ?? 0) * fps);

  // Panel center, in px, for drawing a reading-order arrow between two
  // panels — used for the single-row layout's straight left-to-right
  // chain, which needs actual coordinates rather than the grid's
  // hand-placed diagonal-wrap arrows.
  const centerXPx = (pos: { left: string }) => (parseFloat(pos.left) / 100 + widthPct / 100 / 2) * 1080;

  // The grid layout's two fixed rows (top:220/top:920) already have a
  // tuned, working vertical rhythm — left untouched. The single-row
  // layout is new, and its image height defaulted to "auto" (driven by
  // the asset's own aspect ratio), which for a near-square generated
  // image in a narrow single-row column left most of the frame below it
  // empty — a real dead zone LayoutQA flagged. Fixed height + cover
  // fills the real available space instead, same resolution already
  // applied to every other template with this exact bug.
  const singleRowImgHeight = isGrid
    ? undefined
    : Math.min(canvasHeight - (positions[0]?.top ?? 480) - 150, (widthPct / 100) * canvasWidth * 1.7);

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      <TitleHeading title={title} />

      <svg width={1080} height={1920} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        {panels.length > 1 && (
          <marker id="storyboard-arrowhead" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill={SKETCH_COLORS.accentArrow} />
          </marker>
        )}
        {isGrid ? (
          // 1→2 (horizontal), 2→3 (diagonal wrap), 3→4 (horizontal) — reading
          // order across the 2x2 grid. Each arrow reveals with the panel it
          // points TO, not at frame 0.
          <>
            {panels.length > 1 && <StoryboardArrow x1={486} y1={430} x2={572} y2={430} revealFrames={revealFramesFor(panels[1])} />}
            {panels.length > 2 && <StoryboardArrow x1={756} y1={640} x2={216} y2={920} revealFrames={revealFramesFor(panels[2])} />}
            {panels.length > 3 && <StoryboardArrow x1={486} y1={1130} x2={572} y2={1130} revealFrames={revealFramesFor(panels[3])} />}
          </>
        ) : (
          // Single row — a straight left-to-right chain between each panel's
          // actual center, each arrow revealing with the panel it points TO.
          positions.slice(0, -1).map((pos, i) => {
            const next = positions[i + 1]!;
            const y = pos.top + 300;
            return (
              <StoryboardArrow
                key={i}
                x1={centerXPx(pos) + (widthPct / 100) * 1080 * 0.55}
                y1={y}
                x2={centerXPx(next) - (widthPct / 100) * 1080 * 0.55}
                y2={y}
                revealFrames={revealFramesFor(panels[i + 1])}
              />
            );
          })
        )}
      </svg>

      {panels.map((panel, i) => {
        const pos = positions[i]!;
        return (
          <SlotReveal key={i} slot={panel} style={{ position: "absolute", left: pos.left, top: pos.top, width: `${widthPct}%` }}>
            <div>
              {panel.imageUrl && (
                <div
                  style={{
                    border: `3px solid ${SKETCH_COLORS.ink}`,
                    borderRadius: 10,
                    background: SKETCH_COLORS.panelFill,
                    padding: 10,
                  }}
                >
                  <Img
                    src={panel.imageUrl}
                    style={
                      singleRowImgHeight
                        ? { width: "100%", height: singleRowImgHeight, objectFit: "cover", display: "block" }
                        : { width: "100%", height: "auto", display: "block" }
                    }
                  />
                </div>
              )}
              {panel.label && (
                <div
                  style={{
                    marginTop: 12,
                    textAlign: "center",
                    fontFamily: SKETCH_FONT_FAMILY,
                    fontSize: 26,
                    color: SKETCH_COLORS.ink,
                  }}
                >
                  {panel.label}
                </div>
              )}
            </div>
          </SlotReveal>
        );
      })}
    <SlotDecorations slots={slots} />
    </AbsoluteFill>
  );
}

/** Two illustrated boxes side by side with a VS divider — for "X vs Y"
 * content that needs actual images, not just text (the existing
 * comparisonCards action stays the right choice for text-only compare). */
const COMPARISON_BOX_TOP = 260;
const COMPARISON_LABEL_RESERVE = 90; // room below the image for its label

export function Comparison2BoxTemplate({ title, slots, dividerStyle = "vs" }: CompositionTemplateProps & { dividerStyle?: "vs" | "torn" }) {
  const left = slots.left;
  const right = slots.right;
  const { width: canvasWidth, height: canvasHeight } = useVideoConfig();

  // The image used to render at its own natural (often near-square)
  // aspect ratio inside a fixed-width box, which on a tall vertical canvas
  // left most of the frame empty below it — the real bug a reviewer
  // flagged. A fixed height (capped so a very wide image doesn't stretch
  // into an absurdly tall sliver) plus objectFit "cover" makes each box
  // actually fill most of the vertical frame, the "split the screen in
  // half" look, instead of floating as a small card near the top.
  const boxWidthPx = canvasWidth * 0.42;
  const availableHeight = canvasHeight - COMPARISON_BOX_TOP - COMPARISON_LABEL_RESERVE - 60;
  const boxHeight = Math.min(availableHeight, boxWidthPx * 1.6);
  const dividerCenterY = COMPARISON_BOX_TOP + boxHeight / 2;

  const boxStyle: React.CSSProperties = {
    border: `3px solid ${SKETCH_COLORS.ink}`,
    borderRadius: 10,
    background: SKETCH_COLORS.panelFill,
    padding: 14,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      <TitleHeading title={title} />

      {left && (
        <SlotReveal slot={left} style={{ position: "absolute", left: "4%", top: COMPARISON_BOX_TOP, width: "42%" }}>
          <div style={boxStyle}>
            {left.imageUrl && <Img src={left.imageUrl} style={{ width: "100%", height: boxHeight, objectFit: "cover", display: "block" }} />}
            {left.label && (
              <div style={{ marginTop: 10, textAlign: "center", fontFamily: SKETCH_FONT_FAMILY, fontSize: 26, color: SKETCH_COLORS.ink }}>
                {left.label}
              </div>
            )}
          </div>
        </SlotReveal>
      )}
      {right && (
        <SlotReveal slot={right} style={{ position: "absolute", right: "4%", top: COMPARISON_BOX_TOP, width: "42%" }}>
          <div style={boxStyle}>
            {right.imageUrl && <Img src={right.imageUrl} style={{ width: "100%", height: boxHeight, objectFit: "cover", display: "block" }} />}
            {right.label && (
              <div style={{ marginTop: 10, textAlign: "center", fontFamily: SKETCH_FONT_FAMILY, fontSize: 26, color: SKETCH_COLORS.ink }}>
                {right.label}
              </div>
            )}
          </div>
        </SlotReveal>
      )}

      {dividerStyle === "torn" ? (
        // WS5 comparison-2box upgrade — the reference corpus's "Collapse |
        // Transformation" treatment: a jagged torn-paper seam instead of a
        // neutral VS badge, for a comparison that reads as a rupture.
        // TornPaperEdge draws teeth along its own top edge with a filled
        // body below; rotating that strip 90° about the divider's center
        // turns it into a vertical seam between the two boxes.
        <svg width={canvasWidth} height={canvasHeight} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
          <g transform={`rotate(90, ${canvasWidth / 2}, ${dividerCenterY})`}>
            <TornPaperEdge x={canvasWidth / 2 - 150} y={dividerCenterY - 40} width={300} height={80} instant />
          </g>
        </svg>
      ) : (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: dividerCenterY,
            transform: "translate(-50%, -50%)",
            width: 90,
            height: 90,
            borderRadius: "50%",
            border: `3px solid ${SKETCH_COLORS.ink}`,
            background: SKETCH_COLORS.panelFill,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: SKETCH_FONT_FAMILY,
            fontSize: 32,
            color: SKETCH_COLORS.ink,
          }}
        >
          VS
        </div>
      )}
    <SlotDecorations slots={slots} />
    </AbsoluteFill>
  );
}

/** Reverse-engineered from the reference corpus's Judicial Review frame:
 * scene -> consequence -> decision, read top-to-bottom, each zone an
 * image + caption connected to the next by a downward arrow — a real
 * narrative sequence, not a grid of unrelated panels (Storyboard4Panel's
 * reading order is left-to-right/2x2, wrong shape for a 3-beat story). */
const ZONE_TOP = [220, 800, 1380];
const ZONE_IMG_HEIGHT = 380;

export function Narrative3ZoneTemplate({ title, slots }: CompositionTemplateProps) {
  const { width: canvasWidth } = useVideoConfig();
  const zones = ["zone1", "zone2", "zone3"].map((key) => slots[key]).filter(Boolean) as CompositionSlot[];

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      <TitleHeading title={title} />

      <svg width={canvasWidth} height={1920} style={{ position: "absolute", left: 0, top: 0, pointerEvents: "none" }}>
        {zones.length > 1 && (
          <Arrow from={{ x: canvasWidth / 2, y: ZONE_TOP[0]! + ZONE_IMG_HEIGHT + 60 }} to={{ x: canvasWidth / 2, y: ZONE_TOP[1]! - 20 }} color={SKETCH_COLORS.accentArrow} variant="straight" instant />
        )}
        {zones.length > 2 && (
          <Arrow from={{ x: canvasWidth / 2, y: ZONE_TOP[1]! + ZONE_IMG_HEIGHT + 60 }} to={{ x: canvasWidth / 2, y: ZONE_TOP[2]! - 20 }} color={SKETCH_COLORS.accentArrow} variant="straight" instant />
        )}
      </svg>

      {zones.map((zone, i) => (
        <SlotReveal key={i} slot={zone} style={{ position: "absolute", left: "18%", top: ZONE_TOP[i]!, width: "64%" }}>
          <div>
            {zone.imageUrl && (
              <div style={{ border: `3px solid ${SKETCH_COLORS.ink}`, borderRadius: 10, background: SKETCH_COLORS.panelFill, padding: 10 }}>
                <Img src={zone.imageUrl} style={{ width: "100%", height: ZONE_IMG_HEIGHT - 20, objectFit: "contain", display: "block" }} />
              </div>
            )}
            {zone.label && (
              <div style={{ marginTop: 10, textAlign: "center", fontFamily: SKETCH_FONT_FAMILY, fontSize: 28, color: SKETCH_COLORS.ink }}>{zone.label}</div>
            )}
          </div>
        </SlotReveal>
      ))}
      <SlotDecorations slots={slots} />
    </AbsoluteFill>
  );
}

/** Reverse-engineered from the reference corpus's crumbling "PUBLIC
 * TRUST" monument frame: one large central image with several smaller
 * "reacting figure" images scattered around its base, all implicitly
 * facing inward toward the central event.
 *
 * Both the central slot and each reactor slot use a FIXED-height box —
 * a real dead-zone bug was caught rendering this template's own test: a
 * landscape-oriented central asset (a wide building) only filled ~380px
 * of a nominally 700px-tall region, leaving a large empty gap before the
 * reactors below (which were positioned assuming the tallest case). A
 * fixed box makes the layout's vertical footprint predictable regardless
 * of which asset's aspect ratio lands in a given slot. That first fix
 * used objectFit "contain", which still let a mismatched aspect ratio
 * leave empty space INSIDE its own box — a real render later flagged
 * exactly that as its own dead zone. Both slots now use "cover" instead
 * (the same crop-to-fill resolution already applied to
 * Comparison2BoxTemplate/ConfrontationMirrorTemplate), which guarantees
 * the box is actually filled at the cost of some edge cropping. */
const CENTRAL_TOP = 220;
const CENTRAL_HEIGHT = 700;
const REACTOR_TOP = CENTRAL_TOP + CENTRAL_HEIGHT + 40;
const REACTOR_HEIGHT = 320;
// A fixed 2x2 grid left position 4 (bottom-right) empty whenever the
// planner supplied fewer than 4 reactors — a real dead-zone LayoutQA
// flagged on a real render, since 3 reactors is a common, valid count.
// 1-3 reactors now lay out as a single centered row (using the row-2
// space a 2x2 grid would have left empty), sized larger since they no
// longer share the footprint with a second row; exactly 4 keeps the
// original 2x2 grid, which is the shape that actually needs it.
const REACTOR_HEIGHT_SINGLE_ROW = REACTOR_HEIGHT * 1.7;

function computeReactorPositions(count: number): { left: string; top: number }[] {
  if (count === 4) {
    return [
      { left: "4%", top: REACTOR_TOP },
      { left: "76%", top: REACTOR_TOP },
      { left: "4%", top: REACTOR_TOP + REACTOR_HEIGHT + 30 },
      { left: "76%", top: REACTOR_TOP + REACTOR_HEIGHT + 30 },
    ];
  }
  const widthPct = 22;
  const gapPct = 4;
  const totalWidthPct = count * widthPct + Math.max(0, count - 1) * gapPct;
  const startLeftPct = (100 - totalWidthPct) / 2;
  return Array.from({ length: count }, (_, i) => ({
    left: `${startLeftPct + i * (widthPct + gapPct)}%`,
    top: REACTOR_TOP,
  }));
}

export function CentralFocalTemplate({ title, slots }: CompositionTemplateProps) {
  const central = slots.central;
  const reactors = ["reactor1", "reactor2", "reactor3", "reactor4"].map((key) => slots[key]).filter(Boolean) as CompositionSlot[];
  const caption = slots.caption;

  const reactorPositions = computeReactorPositions(reactors.length);
  const reactorHeight = reactors.length === 4 ? REACTOR_HEIGHT : REACTOR_HEIGHT_SINGLE_ROW;
  const reactorRows = reactors.length === 4 ? 2 : reactors.length > 0 ? 1 : 0;
  const contentBottom =
    reactorRows === 0
      ? CENTRAL_TOP + CENTRAL_HEIGHT
      : REACTOR_TOP + reactorRows * reactorHeight + (reactorRows - 1) * 30;
  // Caption now sits a fixed gap below wherever the real content actually
  // ends, instead of a flat `bottom: 120` that left a large empty band
  // whenever fewer reactors (a shorter layout) were present.
  const captionTop = contentBottom + 40;

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      <TitleHeading title={title} />

      {central?.imageUrl && (
        <SlotReveal slot={central} style={{ position: "absolute", left: "15%", top: CENTRAL_TOP, width: "70%", height: CENTRAL_HEIGHT }}>
          <Img src={central.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </SlotReveal>
      )}

      {reactors.map((reactor, i) => {
        const pos = reactorPositions[i]!;
        return (
          <SlotReveal key={i} slot={reactor} style={{ position: "absolute", left: pos.left, top: pos.top, width: reactors.length === 4 ? "20%" : "24%", height: reactorHeight }}>
            <Img src={reactor.imageUrl ?? ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </SlotReveal>
        );
      })}

      {caption?.label && (
        <SlotReveal slot={caption} style={{ position: "absolute", left: "10%", right: "10%", top: captionTop }}>
          <div
            style={{
              textAlign: "center",
              fontFamily: SKETCH_FONT_FAMILY,
              fontSize: 32,
              color: SKETCH_COLORS.ink,
              background: SKETCH_COLORS.panelFill,
              border: `3px solid ${SKETCH_COLORS.ink}`,
              borderRadius: 12,
              padding: "16px 24px",
            }}
          >
            {caption.label}
          </div>
        </SlotReveal>
      )}
      <SlotDecorations slots={slots} />
    </AbsoluteFill>
  );
}

/** Reverse-engineered from the reference corpus's "two armies facing
 * off" frame: two large images filling most of the frame's height,
 * mirrored toward a thin central gap — a standoff, not a comparison, so
 * (unlike Comparison2BoxTemplate) there's no VS badge and no per-side
 * caption card; just a plain center seam and one shared title/caption. */
const CONFRONTATION_TOP = 240;
const CONFRONTATION_CAPTION_RESERVE = 200; // room below for the shared caption card

export function ConfrontationMirrorTemplate({ title, slots }: CompositionTemplateProps) {
  const left = slots.left;
  const right = slots.right;
  const caption = slots.caption;
  const { width: canvasWidth, height: canvasHeight } = useVideoConfig();

  // The doc comment above promises "two large images filling most of the
  // frame's height" — the real code never did that, it sized each image
  // by its own natural (often near-square) aspect ratio, same dead-space
  // bug Comparison2BoxTemplate had. Here it was worse: the red divider
  // line's height was a flat hardcoded 1100px regardless of where the
  // images actually ended, so it visibly ran on through the empty gap
  // below them — the "questionable red line" a reviewer flagged.
  const boxWidthPx = canvasWidth * 0.45;
  const availableHeight = canvasHeight - CONFRONTATION_TOP - CONFRONTATION_CAPTION_RESERVE;
  const boxHeight = Math.min(availableHeight, boxWidthPx * 1.8);

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      <TitleHeading title={title} />

      {left?.imageUrl && (
        <SlotReveal slot={left} style={{ position: "absolute", left: "3%", top: CONFRONTATION_TOP, width: "45%" }}>
          <Img src={left.imageUrl} style={{ width: "100%", height: boxHeight, objectFit: "cover", display: "block" }} />
        </SlotReveal>
      )}
      {right?.imageUrl && (
        <SlotReveal slot={right} style={{ position: "absolute", right: "3%", top: CONFRONTATION_TOP, width: "45%" }}>
          <Img src={right.imageUrl} style={{ width: "100%", height: boxHeight, objectFit: "cover", display: "block" }} />
        </SlotReveal>
      )}

      <div
        style={{
          position: "absolute",
          left: canvasWidth / 2 - 2,
          top: CONFRONTATION_TOP,
          width: 4,
          height: boxHeight,
          background: SKETCH_COLORS.signalRed,
        }}
      />

      {caption?.label && (
        <SlotReveal slot={caption} style={{ position: "absolute", left: "10%", right: "10%", bottom: 120 }}>
          <div
            style={{
              textAlign: "center",
              fontFamily: SKETCH_FONT_FAMILY,
              fontSize: 32,
              color: SKETCH_COLORS.ink,
              background: SKETCH_COLORS.panelFill,
              border: `3px solid ${SKETCH_COLORS.ink}`,
              borderRadius: 12,
              padding: "16px 24px",
            }}
          >
            {caption.label}
          </div>
        </SlotReveal>
      )}
      <SlotDecorations slots={slots} />
    </AbsoluteFill>
  );
}

/** Reverse-engineered from the reference corpus's 25-emperors crowd
 * frame: a wrapping row of many small character portraits under a
 * banner title — reads as "a crowd," not individually-composed panels.
 * Slot keys person1..personN (any count) are collected and laid out in a
 * simple wrapping grid, small enough that a dozen-plus fit comfortably. */
export function GroupLineupTemplate({ title, slots }: CompositionTemplateProps) {
  const people = Object.entries(slots)
    .filter(([key]) => key.startsWith("person"))
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, slot]) => slot);
  const caption = slots.caption;

  const columns = 4;
  const cellWidth = 22; // percent
  const cellHeight = 280;
  const gridTop = 260;

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      <TitleHeading title={title} />

      {people.map((person, i) => {
        const col = i % columns;
        const row = Math.floor(i / columns);
        return (
          <SlotReveal
            key={i}
            slot={person}
            // Height-driven, not width-driven: character portraits vary
            // widely in aspect ratio (a bust vs. a full standing figure),
            // and a fixed width with auto height let a tall portrait blow
            // past its row's height and collide with the row below — a
            // real overlap bug caught rendering this template's own test.
            // A fixed height keeps every row's vertical footprint
            // predictable regardless of which asset lands in it.
            style={{ position: "absolute", left: `${4 + col * (cellWidth + 2)}%`, top: gridTop + row * cellHeight, width: `${cellWidth}%`, height: cellHeight - 40 }}
          >
            {person.imageUrl && <Img src={person.imageUrl} style={{ height: "100%", width: "auto", maxWidth: "100%", display: "block", margin: "0 auto", objectFit: "contain" }} />}
          </SlotReveal>
        );
      })}

      {caption?.label && (
        <SlotReveal
          slot={caption}
          style={{ position: "absolute", left: "10%", right: "10%", top: gridTop + Math.ceil(people.length / columns) * cellHeight + 30 }}
        >
          <div
            style={{
              textAlign: "center",
              fontFamily: SKETCH_FONT_FAMILY,
              fontSize: 32,
              color: SKETCH_COLORS.ink,
              background: SKETCH_COLORS.panelFill,
              border: `3px solid ${SKETCH_COLORS.ink}`,
              borderRadius: 12,
              padding: "16px 24px",
            }}
          >
            {caption.label}
          </div>
        </SlotReveal>
      )}
      <SlotDecorations slots={slots} />
    </AbsoluteFill>
  );
}
