import React from "react";
import { AbsoluteFill, Img, useVideoConfig } from "remotion";
import { DrawOn } from "./DrawOn";
import { SketchDiagram } from "./SketchDiagram";
import { SKETCH_COLORS, SKETCH_LAYOUT, SKETCH_FONT_FAMILY, sketchFontFaceCss } from "../sketchStyle";
import { DecorationLayer } from "../decorations";
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
    .map(([, slot]) => ({ label: slot.label ?? "" }))
    .filter((t) => t.label.length > 0);

  return (
    <>
      <SketchDiagram
        diagramType="pyramid"
        title={title ?? ""}
        tiers={tierEntries.length > 0 ? tierEntries : [{ label: "" }]}
        leftCharacterSrc={slots.leftCharacter?.imageUrl}
        rightCharacterSrc={slots.rightCharacter?.imageUrl}
      />
      <SlotDecorations slots={slots} />
    </>
  );
}

const PANEL_POSITIONS = [
  { left: "6%", top: 220 },
  { left: "52%", top: 220 },
  { left: "6%", top: 920 },
  { left: "52%", top: 920 },
];

/** Up to 4 image+caption panels in a 2x2 grid, connected by arrows in
 * reading order (1→2→3→4) — a real multi-beat visual, not a wall of
 * assets shown all at once. */
export function Storyboard4PanelTemplate({ title, slots }: CompositionTemplateProps) {
  const panels = ["panel1", "panel2", "panel3", "panel4"].map((key) => slots[key]).filter(Boolean) as CompositionSlot[];

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
        {/* 1→2 (horizontal), 2→3 (diagonal wrap), 3→4 (horizontal) — reading order across the 2x2 grid. */}
        {panels.length > 1 && <line x1={486} y1={430} x2={572} y2={430} stroke={SKETCH_COLORS.accentArrow} strokeWidth={5} markerEnd="url(#storyboard-arrowhead)" />}
        {panels.length > 2 && <line x1={756} y1={640} x2={216} y2={920} stroke={SKETCH_COLORS.accentArrow} strokeWidth={5} markerEnd="url(#storyboard-arrowhead)" />}
        {panels.length > 3 && <line x1={486} y1={1130} x2={572} y2={1130} stroke={SKETCH_COLORS.accentArrow} strokeWidth={5} markerEnd="url(#storyboard-arrowhead)" />}
      </svg>

      {panels.map((panel, i) => {
        const pos = PANEL_POSITIONS[i]!;
        return (
          <SlotReveal key={i} slot={panel} style={{ position: "absolute", left: pos.left, top: pos.top, width: "42%" }}>
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
                  <Img src={panel.imageUrl} style={{ width: "100%", height: "auto", display: "block" }} />
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
export function Comparison2BoxTemplate({ title, slots }: CompositionTemplateProps) {
  const left = slots.left;
  const right = slots.right;

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
        <SlotReveal slot={left} style={{ position: "absolute", left: "4%", top: 260, width: "42%" }}>
          <div style={boxStyle}>
            {left.imageUrl && <Img src={left.imageUrl} style={{ width: "100%", height: "auto", display: "block" }} />}
            {left.label && (
              <div style={{ marginTop: 10, textAlign: "center", fontFamily: SKETCH_FONT_FAMILY, fontSize: 26, color: SKETCH_COLORS.ink }}>
                {left.label}
              </div>
            )}
          </div>
        </SlotReveal>
      )}
      {right && (
        <SlotReveal slot={right} style={{ position: "absolute", right: "4%", top: 260, width: "42%" }}>
          <div style={boxStyle}>
            {right.imageUrl && <Img src={right.imageUrl} style={{ width: "100%", height: "auto", display: "block" }} />}
            {right.label && (
              <div style={{ marginTop: 10, textAlign: "center", fontFamily: SKETCH_FONT_FAMILY, fontSize: 26, color: SKETCH_COLORS.ink }}>
                {right.label}
              </div>
            )}
          </div>
        </SlotReveal>
      )}

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 460,
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
    <SlotDecorations slots={slots} />
    </AbsoluteFill>
  );
}
