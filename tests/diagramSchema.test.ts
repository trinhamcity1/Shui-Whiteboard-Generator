import { describe, it, expect } from "vitest";
import { DiagramSpec, collectDiagramNodes, isNodeSequenceSpec } from "../src/schema/diagram";

describe("DiagramSpec — the full diagram library", () => {
  it("accepts a valid pyramid", () => {
    const result = DiagramSpec.safeParse({
      kind: "pyramid",
      title: "Legal Hierarchy",
      nodes: [
        { id: "federal", label: "Federal Law" },
        { id: "state", label: "State Law" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid cycle", () => {
    const result = DiagramSpec.safeParse({
      kind: "cycle",
      title: "The Water Cycle",
      nodes: [
        { id: "evap", label: "Evaporation" },
        { id: "cond", label: "Condensation" },
        { id: "precip", label: "Precipitation" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid radial with a centerLabel", () => {
    const result = DiagramSpec.safeParse({
      kind: "radial",
      title: "The Four Freedoms",
      centerLabel: "Freedom",
      nodes: [
        { id: "speech", label: "Speech" },
        { id: "worship", label: "Worship" },
        { id: "want", label: "Want" },
        { id: "fear", label: "Fear" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a radial missing centerLabel", () => {
    const result = DiagramSpec.safeParse({
      kind: "radial",
      title: "The Four Freedoms",
      nodes: [{ id: "speech", label: "Speech" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid matrix with exactly 4 quadrants", () => {
    const result = DiagramSpec.safeParse({
      kind: "matrix",
      title: "Urgent vs. Important",
      xAxisLabel: "Urgency",
      yAxisLabel: "Importance",
      quadrants: [{ label: "Do now" }, { label: "Schedule" }, { label: "Delegate" }, { label: "Drop" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects a matrix with only 3 quadrants", () => {
    const result = DiagramSpec.safeParse({
      kind: "matrix",
      title: "Urgent vs. Important",
      xAxisLabel: "Urgency",
      yAxisLabel: "Importance",
      quadrants: [{ label: "Do now" }, { label: "Schedule" }, { label: "Delegate" }],
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid 2-set venn with an overlap label", () => {
    const result = DiagramSpec.safeParse({
      kind: "venn",
      title: "State vs. Federal Powers",
      sets: [
        { id: "state", label: "State" },
        { id: "federal", label: "Federal" },
      ],
      overlapLabels: { "federal+state": "Concurrent powers" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a venn with only 1 set", () => {
    const result = DiagramSpec.safeParse({ kind: "venn", title: "x", sets: [{ id: "a", label: "A" }] });
    expect(result.success).toBe(false);
  });

  it("accepts a valid tree with parentId references", () => {
    const result = DiagramSpec.safeParse({
      kind: "tree",
      title: "Federal Court System",
      nodes: [
        { id: "supreme", label: "Supreme Court" },
        { id: "circuit", label: "Circuit Courts", parentId: "supreme" },
        { id: "district", label: "District Courts", parentId: "circuit" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid network with edges", () => {
    const result = DiagramSpec.safeParse({
      kind: "network",
      title: "Checks and Balances",
      nodes: [
        { id: "congress", label: "Congress" },
        { id: "president", label: "President" },
        { id: "courts", label: "Courts" },
      ],
      edges: [
        { fromId: "congress", toId: "president", label: "can override veto" },
        { fromId: "courts", toId: "congress", label: "can strike down law" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid swimlane", () => {
    const result = DiagramSpec.safeParse({
      kind: "swimlane",
      title: "How a Bill Becomes Law",
      lanes: [
        { id: "congress", label: "Congress" },
        { id: "president", label: "President" },
      ],
      nodes: [
        { id: "propose", label: "Propose bill", laneId: "congress" },
        { id: "sign", label: "Sign or veto", laneId: "president" },
      ],
      edges: [{ fromId: "propose", toId: "sign" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid sequenceDiagram", () => {
    const result = DiagramSpec.safeParse({
      kind: "sequenceDiagram",
      title: "Login Request",
      actors: [
        { id: "client", label: "Client" },
        { id: "server", label: "Server" },
      ],
      messages: [{ fromActorId: "client", toActorId: "server", label: "POST /login" }],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid classDiagram", () => {
    const result = DiagramSpec.safeParse({
      kind: "classDiagram",
      title: "Order System",
      classes: [
        { id: "order", name: "Order", attributes: ["id", "total"] },
        { id: "customer", name: "Customer", attributes: ["id", "name"] },
      ],
      relationships: [{ fromClassId: "order", toClassId: "customer", label: "placed by" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown kind", () => {
    const result = DiagramSpec.safeParse({ kind: "wordcloud", title: "x" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid emphasis value and rejects an invalid one", () => {
    const valid = DiagramSpec.safeParse({
      kind: "pyramid",
      title: "x",
      nodes: [{ id: "a", label: "A", emphasis: "positive" }],
    });
    expect(valid.success).toBe(true);

    const invalid = DiagramSpec.safeParse({
      kind: "pyramid",
      title: "x",
      nodes: [{ id: "a", label: "A", emphasis: "pink" }],
    });
    expect(invalid.success).toBe(false);
  });

  describe("collectDiagramNodes", () => {
    it("returns nodes for node-bearing kinds and [] for the rest", () => {
      const pyramid = DiagramSpec.parse({ kind: "pyramid", title: "x", nodes: [{ id: "a", label: "A" }] });
      expect(collectDiagramNodes(pyramid)).toHaveLength(1);

      const matrix = DiagramSpec.parse({
        kind: "matrix",
        title: "x",
        xAxisLabel: "x",
        yAxisLabel: "y",
        quadrants: [{ label: "1" }, { label: "2" }, { label: "3" }, { label: "4" }],
      });
      expect(collectDiagramNodes(matrix)).toEqual([]);
    });
  });

  describe("isNodeSequenceSpec", () => {
    it("is true for the six node-sequence kinds and false otherwise", () => {
      const pyramid = DiagramSpec.parse({ kind: "pyramid", title: "x", nodes: [{ id: "a", label: "A" }] });
      expect(isNodeSequenceSpec(pyramid)).toBe(true);

      const tree = DiagramSpec.parse({ kind: "tree", title: "x", nodes: [{ id: "a", label: "A" }] });
      expect(isNodeSequenceSpec(tree)).toBe(false);
    });
  });
});
