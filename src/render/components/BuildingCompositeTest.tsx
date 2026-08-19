import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { SKETCH_COLORS, SKETCH_LAYOUT, SKETCH_FONT_FAMILY, sketchFontFaceCss } from "../sketchStyle";

/**
 * Proof-of-concept only: answers "can a backdrop (building) and a
 * foreground character composite at a proportion that reads as balanced,"
 * the same question SketchDiagram's pyramid answered for diagrams. Not a
 * reusable component yet — if this direction holds, "backdrop" becomes a
 * third asset role (alongside character/prop) in the amendment's registry,
 * with its own placement convention (full width, characters scaled +
 * anchored to its ground line), not a one-off layout like this.
 *
 * `label` also proves text-on-image labeling (e.g. "JUSTICE" carved into a
 * courthouse frieze) works the same way pyramid labels do: real text laid
 * over the image, not baked into the AI generation. The catch this makes
 * visible: xFraction/yFraction is a manually-eyeballed anchor point for
 * THIS one generated image. A different building generation would need its
 * own anchor — see the workflow note on why this doesn't auto-generalize.
 */
export interface ImageLabel {
  text: string;
  xFraction: number; // 0-1 across the image's own rendered width
  yFraction: number; // 0-1 down the image's own rendered height
  fontSize: number;
}

export const BuildingCompositeTest: React.FC<{
  buildingSrc: string;
  characterSrc: string;
  buildingNaturalWidth: number;
  buildingNaturalHeight: number;
  label?: ImageLabel;
}> = ({ buildingSrc, characterSrc, buildingNaturalWidth, buildingNaturalHeight, label }) => {
  const canvasHeight = 800;
  const buildingHeight = 560;
  const buildingWidth = buildingHeight * (buildingNaturalWidth / buildingNaturalHeight);
  const buildingTop = canvasHeight - buildingHeight - 60;
  const buildingBaseY = buildingTop + buildingHeight;
  const buildingLeft = 500 - buildingWidth / 2;

  const characterHeight = buildingHeight * SKETCH_LAYOUT.characterToBuildingHeightRatio;
  const characterTop = buildingBaseY - characterHeight;

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <style>{sketchFontFaceCss}</style>
      <Img
        src={buildingSrc}
        style={{ position: "absolute", left: "50%", top: buildingTop, height: buildingHeight, width: "auto", transform: "translateX(-50%)" }}
      />
      {label && (
        <div
          style={{
            position: "absolute",
            left: buildingLeft + label.xFraction * buildingWidth,
            top: buildingTop + label.yFraction * buildingHeight,
            transform: "translate(-50%, -50%)",
            fontFamily: SKETCH_FONT_FAMILY,
            fontSize: label.fontSize,
            color: SKETCH_COLORS.ink,
            whiteSpace: "nowrap",
          }}
        >
          {label.text}
        </div>
      )}
      <Img
        src={characterSrc}
        style={{ position: "absolute", left: "50%", top: characterTop, height: characterHeight, width: "auto", transform: "translateX(-10%)" }}
      />
    </AbsoluteFill>
  );
};
