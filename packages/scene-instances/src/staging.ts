import {
  conditionSchema,
  idSchema,
  pointSchema,
  polygonSchema,
  type Point,
} from "@evavo/adventure-project-schema";
import { z } from "zod";

const facingSchema = z.enum([
  "north",
  "north-east",
  "east",
  "south-east",
  "south",
  "south-west",
  "west",
  "north-west",
]);

export const actorFootprintSchema = z
  .object({
    width: z.number().positive(),
    depth: z.number().positive(),
    clearance: z.number().nonnegative().default(0),
    collisionClass: z.string().min(1).default("human"),
  })
  .strict();
export type ActorFootprint = z.infer<typeof actorFootprintSchema>;

export const preferredWalkLaneSchema = z
  .object({
    id: idSchema("preferred-walk-lane"),
    points: z.array(pointSchema).min(2),
    influenceRadius: z.number().positive(),
    costMultiplier: z.number().positive().max(1).default(0.75),
    enabledWhen: conditionSchema.optional(),
  })
  .strict();
export type PreferredWalkLane = z.infer<typeof preferredWalkLaneSchema>;

export const surfaceZoneSchema = z
  .object({
    id: idSchema("surface-zone"),
    shape: polygonSchema,
    surface: z.enum(["wood", "carpet", "stone", "dirt", "grass", "water", "metal", "stairs", "custom"]),
    customSurfaceId: z.string().min(1).optional(),
    movementMultiplier: z.number().positive().default(1),
    footstepCueId: z.string().min(1).optional(),
    animationStateOverride: z.string().min(1).optional(),
    enabledWhen: conditionSchema.optional(),
  })
  .strict()
  .superRefine((zone, context) => {
    if (zone.surface === "custom" && !zone.customSurfaceId) {
      context.addIssue({
        code: "custom",
        path: ["customSurfaceId"],
        message: "Custom surface zones require customSurfaceId.",
      });
    }
  });
export type SurfaceZone = z.infer<typeof surfaceZoneSchema>;

export const depthScaleKeySchema = z
  .object({
    y: z.number().finite(),
    scale: z.number().positive(),
  })
  .strict();
export type DepthScaleKey = z.infer<typeof depthScaleKeySchema>;

export const depthScaleCurveSchema = z
  .object({
    id: idSchema("depth-scale-curve"),
    keys: z.array(depthScaleKeySchema).min(2),
    interpolation: z.enum(["linear", "step"]).default("linear"),
  })
  .strict()
  .superRefine((curve, context) => {
    for (let index = 1; index < curve.keys.length; index += 1) {
      const previous = curve.keys[index - 1];
      const current = curve.keys[index];
      if (previous && current && current.y <= previous.y) {
        context.addIssue({
          code: "custom",
          path: ["keys", index, "y"],
          message: "Depth scale curve keys must be strictly increasing by y.",
        });
      }
    }
  });
export type DepthScaleCurve = z.infer<typeof depthScaleCurveSchema>;

export const navigationScaleOverrideSchema = z
  .object({
    areaId: idSchema("navigation-area"),
    mode: z.enum(["curve", "fixed"]),
    curveId: idSchema("depth-scale-curve").optional(),
    fixedScale: z.number().positive().optional(),
  })
  .strict()
  .superRefine((override, context) => {
    if (override.mode === "curve" && !override.curveId) {
      context.addIssue({ code: "custom", path: ["curveId"], message: "Curve mode requires curveId." });
    }
    if (override.mode === "fixed" && override.fixedScale === undefined) {
      context.addIssue({
        code: "custom",
        path: ["fixedScale"],
        message: "Fixed mode requires fixedScale.",
      });
    }
  });
export type NavigationScaleOverride = z.infer<typeof navigationScaleOverrideSchema>;

export const approachSlotSchema = z
  .object({
    id: idSchema("approach-slot"),
    position: pointSchema,
    facing: facingSchema,
    validVerbs: z.array(z.string().min(1)).default([]),
    validItemIds: z.array(idSchema("item")).default([]),
    preferred: z.boolean().default(false),
    animationState: z.string().min(1).optional(),
    enabledWhen: conditionSchema.optional(),
  })
  .strict();
export type ApproachSlot = z.infer<typeof approachSlotSchema>;

export const interactionChoreographyBeatSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("actor-animation"),
      animationState: z.string().min(1),
      facing: facingSchema.optional(),
      waitForCompletion: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      kind: z.literal("object-state"),
      objectId: idSchema("object"),
      stateId: idSchema("object-state"),
    })
    .strict(),
  z
    .object({ kind: z.literal("sound"), cueId: z.string().min(1) }).strict(),
  z
    .object({ kind: z.literal("hold"), ticks: z.number().int().nonnegative() }).strict(),
  z
    .object({ kind: z.literal("sequence"), sequenceId: idSchema("sequence") }).strict(),
]);
export type InteractionChoreographyBeat = z.infer<typeof interactionChoreographyBeatSchema>;

export const interactionChoreographySchema = z
  .object({
    id: idSchema("interaction-choreography"),
    interactionId: idSchema("interaction"),
    approachSlotIds: z.array(idSchema("approach-slot")).default([]),
    brakingAnimationState: z.string().min(1).optional(),
    beats: z.array(interactionChoreographyBeatSchema).min(1),
    recoveryAnimationState: z.string().min(1).optional(),
  })
  .strict();
export type InteractionChoreography = z.infer<typeof interactionChoreographySchema>;

export const entryChoreographySchema = z
  .object({
    entranceId: idSchema("entrance"),
    spawnPosition: pointSchema.optional(),
    entryPath: z.array(pointSchema).default([]),
    entryAnimationState: z.string().min(1).optional(),
    arrivalFacing: facingSchema.optional(),
    arrivalAnimationState: z.string().min(1).optional(),
    unlockControlAt: z.enum(["spawn", "path-end", "animation-end"]).default("path-end"),
  })
  .strict();
export type EntryChoreography = z.infer<typeof entryChoreographySchema>;

export const paletteLightZoneSchema = z
  .object({
    id: idSchema("palette-light-zone"),
    shape: polygonSchema,
    paletteMapId: z.string().min(1),
    blendMode: z.enum(["hard", "ordered-dither"]).default("hard"),
    priority: z.number().int().default(0),
    enabledWhen: conditionSchema.optional(),
  })
  .strict();
export type PaletteLightZone = z.infer<typeof paletteLightZoneSchema>;

export const sceneStagingSchema = z
  .object({
    sceneId: idSchema("scene"),
    actorFootprints: z.record(idSchema("actor"), actorFootprintSchema).default({}),
    preferredWalkLanes: z.array(preferredWalkLaneSchema).default([]),
    surfaceZones: z.array(surfaceZoneSchema).default([]),
    depthScaleCurves: z.array(depthScaleCurveSchema).default([]),
    navigationScaleOverrides: z.array(navigationScaleOverrideSchema).default([]),
    approachSlotsByObject: z.record(idSchema("object"), z.array(approachSlotSchema)).default({}),
    interactionChoreographies: z.array(interactionChoreographySchema).default([]),
    entryChoreographies: z.array(entryChoreographySchema).default([]),
    paletteLightZones: z.array(paletteLightZoneSchema).default([]),
  })
  .strict();
export type SceneStaging = z.infer<typeof sceneStagingSchema>;

export const sceneStagingManifestSchema = z
  .object({
    manifestVersion: z.literal(1),
    projectId: idSchema("project"),
    scenes: z.array(sceneStagingSchema).default([]),
  })
  .strict();
export type SceneStagingManifest = z.infer<typeof sceneStagingManifestSchema>;

export interface ApproachSelectionRequest {
  readonly actorPosition: Point;
  readonly verb?: string;
  readonly itemId?: string;
  readonly reachable?: (point: Point) => boolean;
}

export interface ApproachSelectionResult {
  readonly slot: ApproachSlot;
  readonly distance: number;
}

const squaredDistance = (left: Point, right: Point): number => {
  const x = left.x - right.x;
  const y = left.y - right.y;
  return x * x + y * y;
};

export const selectApproachSlot = (
  slots: readonly ApproachSlot[],
  request: ApproachSelectionRequest,
): ApproachSelectionResult | null => {
  const candidates = slots
    .filter((slot) => !request.verb || slot.validVerbs.length === 0 || slot.validVerbs.includes(request.verb))
    .filter(
      (slot) =>
        !request.itemId ||
        slot.validItemIds.length === 0 ||
        slot.validItemIds.some((itemId) => itemId === request.itemId),
    )
    .filter((slot) => !request.reachable || request.reachable(slot.position))
    .map((slot) => ({ slot, distanceSquared: squaredDistance(request.actorPosition, slot.position) }))
    .sort((left, right) => {
      if (left.slot.preferred !== right.slot.preferred) return left.slot.preferred ? -1 : 1;
      if (left.distanceSquared !== right.distanceSquared) return left.distanceSquared - right.distanceSquared;
      return left.slot.id.localeCompare(right.slot.id);
    });

  const selected = candidates[0];
  return selected ? { slot: selected.slot, distance: Math.sqrt(selected.distanceSquared) } : null;
};

export const sampleDepthScale = (curve: DepthScaleCurve, y: number): number => {
  const first = curve.keys[0];
  const last = curve.keys.at(-1);
  if (!first || !last) throw new RangeError("Depth scale curve requires at least two keys.");
  if (y <= first.y) return first.scale;
  if (y >= last.y) return last.scale;

  for (let index = 0; index < curve.keys.length - 1; index += 1) {
    const left = curve.keys[index];
    const right = curve.keys[index + 1];
    if (!left || !right || y < left.y || y > right.y) continue;
    if (curve.interpolation === "step") return left.scale;
    const progress = (y - left.y) / (right.y - left.y);
    return left.scale + (right.scale - left.scale) * progress;
  }
  return last.scale;
};

const distancePointToSegment = (point: Point, start: Point, end: Point): number => {
  const x = end.x - start.x;
  const y = end.y - start.y;
  const lengthSquared = x * x + y * y;
  if (lengthSquared === 0) return Math.sqrt(squaredDistance(point, start));
  const progress = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * x + (point.y - start.y) * y) / lengthSquared),
  );
  return Math.sqrt(
    squaredDistance(point, {
      x: start.x + x * progress,
      y: start.y + y * progress,
    }),
  );
};

export const preferredLaneCostMultiplierAtPoint = (
  lane: PreferredWalkLane,
  point: Point,
): number => {
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 0; index < lane.points.length - 1; index += 1) {
    const start = lane.points[index];
    const end = lane.points[index + 1];
    if (!start || !end) continue;
    nearest = Math.min(nearest, distancePointToSegment(point, start, end));
  }
  if (!Number.isFinite(nearest) || nearest >= lane.influenceRadius) return 1;
  const influence = 1 - nearest / lane.influenceRadius;
  return 1 - (1 - lane.costMultiplier) * influence;
};
