import { describe, expect, it } from "vitest";
import type { SceneStaging } from "@evavo/adventure-scene-instances/staging";
import {
  preferredRouteCostMultiplier,
  resolveInteractionApproach,
  resolvePerspectiveScale,
  surfaceZoneAtPoint,
} from "../src/staging.js";

const asId = <T extends string>(value: string): string & { readonly __id: T } => value as never;

const staging: SceneStaging = {
  sceneId: asId<"scene">("scene.office"),
  actorFootprints: {},
  preferredWalkLanes: [
    {
      id: asId<"preferred-walk-lane">("lane.carpet"),
      points: [
        { x: 20, y: 150 },
        { x: 220, y: 150 },
      ],
      influenceRadius: 20,
      costMultiplier: 0.7,
    },
  ],
  surfaceZones: [
    {
      id: asId<"surface-zone">("surface.carpet"),
      shape: { points: [{ x: 20, y: 130 }, { x: 220, y: 130 }, { x: 220, y: 170 }, { x: 20, y: 170 }] },
      surface: "carpet",
      movementMultiplier: 1,
    },
  ],
  depthScaleCurves: [
    {
      id: asId<"depth-scale-curve">("depth.office"),
      interpolation: "linear",
      keys: [
        { y: 80, scale: 0.5 },
        { y: 180, scale: 1.1 },
      ],
    },
  ],
  navigationScaleOverrides: [
    {
      areaId: asId<"navigation-area">("navigation.office"),
      mode: "curve",
      curveId: asId<"depth-scale-curve">("depth.office"),
    },
  ],
  approachSlotsByObject: {
    "object.desk": [
      {
        id: asId<"approach-slot">("slot.desk-front"),
        position: { x: 120, y: 150 },
        facing: "north",
        validVerbs: ["use"],
        validItemIds: [],
        preferred: true,
      },
    ],
  },
  interactionChoreographies: [],
  entryChoreographies: [],
  paletteLightZones: [],
};

describe("runtime staging resolution", () => {
  it("resolves an authored object approach", () => {
    const result = resolveInteractionApproach(staging, asId<"object">("object.desk"), {
      actorPosition: { x: 70, y: 160 },
      verb: "use",
      reachable: () => true,
    });
    expect(result?.slot.id).toBe("slot.desk-front");
  });

  it("resolves a piecewise perspective scale for an area", () => {
    expect(
      resolvePerspectiveScale(staging, asId<"navigation-area">("navigation.office"), 130, 1),
    ).toBeCloseTo(0.8);
  });

  it("exposes preferred lane and surface information to movement", () => {
    expect(preferredRouteCostMultiplier(staging, { x: 100, y: 150 })).toBeCloseTo(0.7);
    expect(surfaceZoneAtPoint(staging, { x: 100, y: 150 })?.surface).toBe("carpet");
  });
});
