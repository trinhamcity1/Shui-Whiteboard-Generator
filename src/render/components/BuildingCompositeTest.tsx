import React from "react";
import { AbsoluteFill, Img } from "remotion";
import { SKETCH_COLORS, SKETCH_LAYOUT } from "../sketchStyle";

/**
 * Proof-of-concept only: answers "can a backdrop (building) and a
 * foreground character composite at a proportion that reads as balanced,"
 * the same question SketchDiagram's pyramid answered for diagrams. Not a
 * reusable component yet — if this direction holds, "backdrop" becomes a
 * third asset role (alongside character/prop) in the amendment's registry,
 * with its own placement convention (full width, characters scaled +
 * anchored to its ground line), not a one-off layout like this.
 */
export const BuildingCompositeTest: React.FC<{
  buildingSrc: string;
  characterSrc: string;
}> = ({ buildingSrc, characterSrc }) => {
  const canvasHeight = 800;
  const buildingHeight = 560;
  const buildingTop = canvasHeight - buildingHeight - 60;
  const buildingBaseY = buildingTop + buildingHeight;

  const characterHeight = buildingHeight * SKETCH_LAYOUT.characterToBuildingHeightRatio;
  const characterTop = buildingBaseY - characterHeight;

  return (
    <AbsoluteFill style={{ backgroundColor: SKETCH_COLORS.paper }}>
      <Img
        src={buildingSrc}
        style={{ position: "absolute", left: "50%", top: buildingTop, height: buildingHeight, width: "auto", transform: "translateX(-50%)" }}
      />
      <Img
        src={characterSrc}
        style={{ position: "absolute", left: "50%", top: characterTop, height: characterHeight, width: "auto", transform: "translateX(-10%)" }}
      />
    </AbsoluteFill>
  );
};
