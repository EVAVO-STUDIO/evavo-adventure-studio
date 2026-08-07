import { z } from "zod";
import {
  idSchema,
  pointSchema,
  scalarSchema,
  type Id,
} from "@evavo/adventure-project-schema";
import {
  parseProfiledNavigationMovementState,
  type ProfiledNavigationMovementState,
} from "@evavo/adventure-scene-runtime/profiled-movement";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import {
  saveGameProfiledRuntimeCameraStateSchema,
  type SaveGameProfiledRuntimeCameraState,
} from "./profiled-camera.js";

const fnvFingerprintSchema = z
  .string()
  .regex(/^fnv1a64:[0-9a-f]{16}$/u, "Expected an FNV-1a 64-bit fingerprint.");
const sha256Schema = z
  .string()
  .regex(/^[0-9a-f]{64}$/u, "Expected a lowercase SHA-256 digest.");

const animationPlaybackSchema = z
  .object({
    clipId: idSchema("animation-clip"),
    frameIndex: z.number().int().nonnegative(),
    ticksIntoFrame: z.number().int().nonnegative(),
    loopIteration: z.number().int().nonnegative(),
    completed: z.boolean(),
  })
  .strict();

const actorInstanceRuntimeSchema = z
  .object({
    instanceId: idSchema("actor-instance"),
    sceneId: idSchema("scene"),
    actorId: idSchema("actor"),
    position: pointSchema,
    facing: z.string().min(1),
    animationState: z.string().min(1),
    playback: animationPlaybackSchema,
    visibleOverride: z.boolean().nullable(),
  })
  .strict();

const activeDialogueSchema = z
  .object({
    dialogueId: idSchema("dialogue"),
    nodeId: idSchema("dialogue-node"),
  })
  .strict();

const activeSequenceSchema = z
  .object({
    sequenceId: idSchema("sequence"),
    elapsedTicks: z.number().int().nonnegative(),
    iteration: z.number().int().nonnegative(),
    nextCueIndexByTrack: z.record(
      z.string().min(1),
      z.number().int().nonnegative(),
    ),
  })
  .strict();

const runtimeStorySchema = z
  .object({
    schemaVersion: z.literal(1),
    projectId: idSchema("project"),
    tick: z.number().int().nonnegative(),
    currentSceneId: idSchema("scene"),
    currentEntranceId: idSchema("entrance"),
    flags: z.record(z.string().min(1), z.boolean()),
    variables: z.record(z.string().min(1), scalarSchema),
    inventory: z.array(idSchema("item")),
    awardedScoreIds: z.array(idSchema("score-award")),
    consumedInteractionIds: z.array(idSchema("interaction")),
    consumedDialogueChoiceIds: z.array(idSchema("dialogue-choice")),
    activeDialogue: activeDialogueSchema.nullable(),
    activeSequences: z.array(activeSequenceSchema),
    objectStates: z.record(z.string().min(1), z.string().min(1)),
    randomStreams: z.record(
      z.string().min(1),
      z.number().int().nonnegative().max(0xffffffff),
    ),
    score: z.number().int(),
  })
  .strict();

const navigationSegmentSchema = z
  .object({
    from: pointSchema,
    to: pointSchema,
    kind: z.enum(["walk", "portal"]),
    areaId: idSchema("navigation-area").nullable(),
    portalId: idSchema("navigation-portal").nullable(),
    distance: z.number().finite().nonnegative(),
  })
  .strict();

const navigationRouteSchema = z
  .object({
    points: z.array(pointSchema).min(1),
    segments: z.array(navigationSegmentSchema),
    distance: z.number().finite().nonnegative(),
    startAreaId: idSchema("navigation-area"),
    endAreaId: idSchema("navigation-area"),
    snappedStart: z.boolean(),
    snappedEnd: z.boolean(),
  })
  .strict();

const profiledMovementStateSchema = z.unknown().transform(
  (
    value: unknown,
    context: { addIssue(issue: { code: "custom"; message: string }): void },
  ): ProfiledNavigationMovementState => {
    try {
      return parseProfiledNavigationMovementState(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message:
          error instanceof Error
            ? error.message
            : "Profiled movement state is invalid.",
      });
      return z.NEVER;
    }
  },
);

const actorMovementSchema = z
  .object({
    actorInstanceId: idSchema("actor-instance"),
    route: navigationRouteSchema,
    nextSegmentIndex: z.number().int().nonnegative(),
    distanceAlongSegment: z.number().finite().nonnegative(),
    speedPixelsPerSecond: z.number().finite().positive(),
    walkAnimationState: z.string().min(1),
    arrivalAnimationState: z.string().min(1),
    profiled: profiledMovementStateSchema.optional(),
  })
  .strict();

const pendingCommandSchema = z
  .object({
    actorInstanceId: idSchema("actor-instance"),
    actorId: idSchema("actor"),
    objectInstanceId: idSchema("object"),
    verb: z.string().min(1),
    itemId: idSchema("item").nullable(),
  })
  .strict();

export const interactiveWorldSaveSchema = z
  .object({
    story: runtimeStorySchema,
    actorInstances: z.record(z.string().min(1), actorInstanceRuntimeSchema),
    movements: z.record(z.string().min(1), actorMovementSchema),
    pendingObjectCommands: z.record(z.string().min(1), pendingCommandSchema),
  })
  .strict() as z.ZodType<InteractiveRuntimeWorldState>;

export interface SaveGameInterfaceState {
  readonly controlledActorInstanceId: Id<"actor-instance"> | null;
  readonly selectedVerbId: Id<"ui-verb"> | null;
  readonly selectedItemId: Id<"item"> | null;
  readonly statusText: string;
  readonly parser: {
    readonly text: string;
    readonly history: readonly string[];
  };
  readonly profiledCamera?: SaveGameProfiledRuntimeCameraState;
}

export const saveGameInterfaceStateSchema = z
  .object({
    controlledActorInstanceId: idSchema("actor-instance").nullable(),
    selectedVerbId: idSchema("ui-verb").nullable(),
    selectedItemId: idSchema("item").nullable(),
    statusText: z.string(),
    parser: z
      .object({
        text: z.string().max(120),
        history: z.array(z.string().min(1).max(120)).max(200),
      })
      .strict(),
    profiledCamera: saveGameProfiledRuntimeCameraStateSchema.optional(),
  })
  .strict() as z.ZodType<SaveGameInterfaceState>;

export interface SaveGamePayload {
  readonly saveVersion: 1;
  readonly projectId: Id<"project">;
  readonly bundleFingerprint: string;
  readonly assetManifestFingerprint: string;
  readonly world: InteractiveRuntimeWorldState;
  readonly interface: SaveGameInterfaceState;
}

const saveGamePayloadObjectSchema = z
  .object({
    saveVersion: z.literal(1),
    projectId: idSchema("project"),
    bundleFingerprint: fnvFingerprintSchema,
    assetManifestFingerprint: sha256Schema,
    world: interactiveWorldSaveSchema,
    interface: saveGameInterfaceStateSchema,
  })
  .strict();

export const saveGamePayloadSchema =
  saveGamePayloadObjectSchema as z.ZodType<SaveGamePayload>;

export interface SaveGame extends SaveGamePayload {
  readonly saveFingerprint: string;
}

export const saveGameSchema = saveGamePayloadObjectSchema
  .extend({ saveFingerprint: fnvFingerprintSchema })
  .strict() as z.ZodType<SaveGame>;
