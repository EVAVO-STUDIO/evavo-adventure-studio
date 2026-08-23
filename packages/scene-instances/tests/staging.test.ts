import { describe, expect, it } from "vitest";
import {
  preferredLaneCostMultiplierAtPoint,
  sampleDepthScale,
  sceneStagingManifestSchema,
  selectApproachSlot,
} from "../src/staging.js";

const asId = <T extends string>(value: string): string & { readonly __id: T } => value as never;

describe("classic adventure scene staging", () => {
  it("samples piecewise perspective curves", () => {
    const curve = {
      id: asId<"depth-scale-curve">("depth.office"),
      interpolation: "linear" as const,
      keys: [
        { y: 80, scale: 0.5 },
        { y: 120, scale: 0.7 },
        { y: 180, scale: 1.1 },
      ],
    };

    expect(sampleDepthScale(curve, 80)).toBe(0.5);
    expect(sampleDepthScale(curve, 100)).toBeCloseTo(0.6);
    expect(sampleDepthScale(curve, 180)).toBe(1.1);
  });

  it("prefers an authored approach slot before a merely closer one", () => {
    const result = selectApproachSlot(
      [
        {
          id: asId<"approach-slot">("slot.close"),
          position: { x: 12, y: 10 },
          facing: "north" as const,
          validVerbs: ["use"],
          validItemIds: [],
          preferred: false,
        },
        {
          id: asId<"approach-slot">("slot.directed"),
          position: { x: 20, y: 10 },
          facing: "north" as const,
          validVerbs: ["use"],
          validItemIds: [],
          preferred: true,
        },
      ],
      { actorPosition: { x: 10, y: 10 }, verb: "use" },
    );

    expect(result?.slot.id).toBe("slot.directed");
  });

  it("biases routes near a preferred lane without making the lane mandatory", () => {
    const lane = {
      id: asId<"preferred-walk-lane">("lane.carpet"),
      points: [
        { x: 20, y: 150 },
        { x: 220, y: 150 },
      ],
      influenceRadius: 20,
      costMultiplier: 0.7,
    };

    expect(preferredLaneCostMultiplierAtPoint(lane, { x: 100, y: 150 })).toBeCloseTo(0.7);
    expect(preferredLaneCostMultiplierAtPoint(lane, { x: 100, y: 170 })).toBe(1);
  });

  it("rejects malformed custom surfaces and unsorted depth curves", () => {
    const result = sceneStagingManifestSchema.safeParse({
      manifestVersion: 1,
      projectId: "project.test",
      scenes: [
        {
          sceneId: "scene.test",
          surfaceZones: [
            {
              id: "surface.test",
              shape: { points: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }] },
              surface: "custom",
            },
          ],
          depthScaleCurves: [
            {
              id: "depth.test",
              keys: [
                { y: 100, scale: 0.7 },
                { y: 90, scale: 0.8 },
              ],
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
