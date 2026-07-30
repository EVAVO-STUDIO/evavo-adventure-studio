import { z } from "zod";
import {
  idSchema,
  pointSchema,
  scalarSchema,
  type Id,
} from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";

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

const actorMovementSchema = z
  .object({
    actorInstanceId: idSchema("actor-instance"),
    route: navigationRouteSchema,
    nextSegmentIndex: z.number().int().nonnegative(),
    distanceAlongSegment: z.number().finite().nonnegative(),
    speedPixelsPerSecond: z.number().finite().positive(),
    walkAnimationState: z.string().min(1),
    arrivalAnimationState: z.string().min(1),
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
  .strict();

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
  })
  .strict();
export type SaveGameInterfaceState = z.infer<
  typeof saveGameInterfaceStateSchema
>;

const saveGamePayloadSchema = z
  .object({
    saveVersion: z.literal(1),
    projectId: idSchema("project"),
    bundleFingerprint: fnvFingerprintSchema,
    assetManifestFingerprint: sha256Schema,
    world: interactiveWorldSaveSchema,
    interface: saveGameInterfaceStateSchema,
  })
  .strict();

export const saveGameSchema = saveGamePayloadSchema
  .extend({ saveFingerprint: fnvFingerprintSchema })
  .strict();
export type SaveGame = z.infer<typeof saveGameSchema>;

export type SaveGameCompatibilityIssueCode =
  | "save-fingerprint-mismatch"
  | "project-mismatch"
  | "bundle-fingerprint-mismatch"
  | "asset-manifest-mismatch"
  | "story-project-mismatch"
  | "missing-current-scene"
  | "missing-current-entrance"
  | "missing-inventory-item"
  | "missing-active-dialogue"
  | "missing-active-dialogue-node"
  | "missing-active-sequence"
  | "sequence-save-disabled"
  | "sequence-boundary-required"
  | "actor-instance-set-mismatch"
  | "actor-instance-identity-mismatch"
  | "missing-actor"
  | "missing-animation-clip"
  | "invalid-animation-frame"
  | "invalid-animation-progress"
  | "invalid-movement"
  | "invalid-pending-command"
  | "missing-object-state"
  | "invalid-object-state"
  | "invalid-controlled-actor"
  | "invalid-selected-item"
  | "invalid-selected-verb"
  | "parser-history-limit";

export interface SaveGameCompatibilityIssue {
  readonly severity: "error";
  readonly code: SaveGameCompatibilityIssueCode;
  readonly path: string;
  readonly message: string;
}

export class SaveGameIntegrityError extends Error {
  constructor() {
    super("Save-game payload fingerprint does not match its contents.");
    this.name = "SaveGameIntegrityError";
  }
}

export class SaveGameCompatibilityError extends Error {
  readonly issues: readonly SaveGameCompatibilityIssue[];

  constructor(issues: readonly SaveGameCompatibilityIssue[]) {
    super(`Save game is incompatible with this runtime bundle (${issues.length} issue(s)).`);
    this.name = "SaveGameCompatibilityError";
    this.issues = issues;
  }
}

export class SaveGamePolicyError extends Error {
  readonly issues: readonly SaveGameCompatibilityIssue[];

  constructor(issues: readonly SaveGameCompatibilityIssue[]) {
    super(issues[0]?.message ?? "The game cannot be saved at this time.");
    this.name = "SaveGamePolicyError";
    this.issues = issues;
  }
}

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort((left, right) =>
      left.localeCompare(right),
    )) {
      const child = source[key];
      if (child !== undefined) output[key] = canonicalize(child);
    }
    return output;
  }
  return value;
};

export const canonicalSaveGameJson = (value: unknown): string => {
  const serialized = JSON.stringify(canonicalize(value));
  if (serialized === undefined) {
    throw new TypeError("Save-game data cannot be represented as JSON.");
  }
  return serialized;
};

const fnv1a64 = (value: string): string => {
  const bytes = new TextEncoder().encode(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `fnv1a64:${hash.toString(16).padStart(16, "0")}`;
};

export const runtimeBundleFingerprint = (bundle: RuntimeBundle): string =>
  fnv1a64(canonicalSaveGameJson(bundle));

const payloadFromSave = (save: SaveGame): z.infer<typeof saveGamePayloadSchema> => ({
  saveVersion: save.saveVersion,
  projectId: save.projectId,
  bundleFingerprint: save.bundleFingerprint,
  assetManifestFingerprint: save.assetManifestFingerprint,
  world: save.world,
  interface: save.interface,
});

export const parseSaveGame = (input: unknown): SaveGame => {
  const save = saveGameSchema.parse(input);
  if (fnv1a64(canonicalSaveGameJson(payloadFromSave(save))) !== save.saveFingerprint) {
    throw new SaveGameIntegrityError();
  }
  return save;
};

const issue = (
  issues: SaveGameCompatibilityIssue[],
  code: SaveGameCompatibilityIssueCode,
  path: string,
  message: string,
): void => {
  issues.push({ severity: "error", code, path, message });
};

const activeSequencePolicyIssues = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
): readonly SaveGameCompatibilityIssue[] => {
  const issues: SaveGameCompatibilityIssue[] = [];
  world.story.activeSequences.forEach((active, index) => {
    const sequence = bundle.sequences.find(
      (candidate) => candidate.id === active.sequenceId,
    );
    if (!sequence) {
      issue(
        issues,
        "missing-active-sequence",
        `world.story.activeSequences[${index}].sequenceId`,
        `Active sequence '${active.sequenceId}' is missing from the runtime bundle.`,
      );
      return;
    }
    if (sequence.savePolicy === "disabled") {
      issue(
        issues,
        "sequence-save-disabled",
        `world.story.activeSequences[${index}]`,
        `Sequence '${sequence.id}' disables saving while it is active.`,
      );
    } else if (
      sequence.savePolicy === "boundary-only" &&
      active.elapsedTicks > 0
    ) {
      issue(
        issues,
        "sequence-boundary-required",
        `world.story.activeSequences[${index}].elapsedTicks`,
        `Sequence '${sequence.id}' permits saving only at a sequence boundary.`,
      );
    }
  });
  return issues;
};

export const assertSaveGameAllowed = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
): void => {
  const issues = activeSequencePolicyIssues(bundle, world);
  if (issues.length > 0) throw new SaveGamePolicyError(issues);
};

const authoredActorInstances = (bundle: RuntimeBundle) =>
  (bundle.sceneInstances?.scenes ?? []).flatMap((composition) =>
    composition.actorInstances.map((instance) => ({
      instance,
      sceneId: composition.sceneId,
    })),
  );

const authoredObjectInstances = (bundle: RuntimeBundle) =>
  (bundle.sceneInstances?.scenes ?? []).flatMap((composition) =>
    composition.objectInstances.map((instance) => ({
      instance,
      sceneId: composition.sceneId,
    })),
  );

export const validateSaveGameCompatibility = (
  bundle: RuntimeBundle,
  save: SaveGame,
): readonly SaveGameCompatibilityIssue[] => {
  const issues: SaveGameCompatibilityIssue[] = [];
  if (save.projectId !== bundle.projectId) {
    issue(issues, "project-mismatch", "projectId", `Save project '${save.projectId}' does not match '${bundle.projectId}'.`);
  }
  const bundleFingerprint = runtimeBundleFingerprint(bundle);
  if (save.bundleFingerprint !== bundleFingerprint) {
    issue(issues, "bundle-fingerprint-mismatch", "bundleFingerprint", "Save game was created from a different runtime bundle.");
  }
  if (save.assetManifestFingerprint !== bundle.assetManifestFingerprint) {
    issue(issues, "asset-manifest-mismatch", "assetManifestFingerprint", "Save game was created from a different compiled asset manifest.");
  }
  if (save.world.story.projectId !== bundle.projectId) {
    issue(issues, "story-project-mismatch", "world.story.projectId", "Saved story state belongs to a different project.");
  }

  const scene = bundle.scenes.find(
    (candidate) => candidate.id === save.world.story.currentSceneId,
  );
  if (!scene) {
    issue(issues, "missing-current-scene", "world.story.currentSceneId", `Saved scene '${save.world.story.currentSceneId}' does not exist.`);
  } else if (
    !scene.entrances.some(
      (entrance) => entrance.id === save.world.story.currentEntranceId,
    )
  ) {
    issue(issues, "missing-current-entrance", "world.story.currentEntranceId", `Saved entrance '${save.world.story.currentEntranceId}' does not exist in scene '${scene.id}'.`);
  }

  const itemIds = new Set(bundle.inventoryItems.map((item) => item.id as string));
  save.world.story.inventory.forEach((itemId, index) => {
    if (!itemIds.has(itemId)) {
      issue(issues, "missing-inventory-item", `world.story.inventory[${index}]`, `Saved inventory item '${itemId}' does not exist.`);
    }
  });

  if (save.world.story.activeDialogue) {
    const active = save.world.story.activeDialogue;
    const dialogue = bundle.dialogues.find(
      (candidate) => candidate.id === active.dialogueId,
    );
    if (!dialogue) {
      issue(issues, "missing-active-dialogue", "world.story.activeDialogue.dialogueId", `Saved dialogue '${active.dialogueId}' does not exist.`);
    } else if (!dialogue.nodes.some((node) => node.id === active.nodeId)) {
      issue(issues, "missing-active-dialogue-node", "world.story.activeDialogue.nodeId", `Saved dialogue node '${active.nodeId}' does not exist.`);
    }
  }

  issues.push(...activeSequencePolicyIssues(bundle, save.world as InteractiveRuntimeWorldState));

  const actorPlacements = authoredActorInstances(bundle);
  const authoredActorIds = new Set(
    actorPlacements.map(({ instance }) => instance.id as string),
  );
  const savedActorIds = new Set(Object.keys(save.world.actorInstances));
  for (const actorInstanceId of new Set([...authoredActorIds, ...savedActorIds])) {
    if (!authoredActorIds.has(actorInstanceId) || !savedActorIds.has(actorInstanceId)) {
      issue(issues, "actor-instance-set-mismatch", "world.actorInstances", `Actor instance '${actorInstanceId}' is not present in both the bundle and save game.`);
    }
  }

  for (const [key, actorState] of Object.entries(save.world.actorInstances)) {
    const authored = actorPlacements.find(
      ({ instance }) => instance.id === actorState.instanceId,
    );
    if (key !== actorState.instanceId || !authored) {
      issue(issues, "actor-instance-identity-mismatch", `world.actorInstances.${key}`, `Saved actor instance '${key}' has invalid identity metadata.`);
      continue;
    }
    if (
      authored.instance.actorId !== actorState.actorId ||
      authored.sceneId !== actorState.sceneId
    ) {
      issue(issues, "actor-instance-identity-mismatch", `world.actorInstances.${key}`, `Saved actor instance '${key}' no longer matches its authored actor or scene.`);
    }
    const actor = bundle.actors.find(
      (candidate) => candidate.id === actorState.actorId,
    );
    if (!actor) {
      issue(issues, "missing-actor", `world.actorInstances.${key}.actorId`, `Saved actor '${actorState.actorId}' does not exist.`);
      continue;
    }
    const clip = actor.animations.find(
      (candidate) => candidate.id === actorState.playback.clipId,
    );
    if (!clip) {
      issue(issues, "missing-animation-clip", `world.actorInstances.${key}.playback.clipId`, `Saved animation clip '${actorState.playback.clipId}' does not exist.`);
      continue;
    }
    const frameId = clip.frameIds[actorState.playback.frameIndex];
    const frame = actor.frames.find((candidate) => candidate.id === frameId);
    if (!frame) {
      issue(issues, "invalid-animation-frame", `world.actorInstances.${key}.playback.frameIndex`, `Saved animation frame index ${actorState.playback.frameIndex} is invalid for '${clip.id}'.`);
    } else if (actorState.playback.ticksIntoFrame > frame.durationTicks) {
      issue(issues, "invalid-animation-progress", `world.actorInstances.${key}.playback.ticksIntoFrame`, `Saved animation progress exceeds frame '${frame.id}' duration.`);
    }
  }

  for (const [key, movement] of Object.entries(save.world.movements)) {
    const segment = movement.route.segments[movement.nextSegmentIndex];
    if (
      key !== movement.actorInstanceId ||
      !savedActorIds.has(movement.actorInstanceId) ||
      movement.nextSegmentIndex >= movement.route.segments.length ||
      !segment ||
      movement.distanceAlongSegment > segment.distance
    ) {
      issue(issues, "invalid-movement", `world.movements.${key}`, `Saved movement for actor instance '${key}' is invalid.`);
    }
  }

  const objectPlacements = authoredObjectInstances(bundle);
  const objectIds = new Set(
    objectPlacements.map(({ instance }) => instance.id as string),
  );
  const definitions = new Map(
    (bundle.sceneInstances?.objectDefinitions ?? []).map((definition) => [
      definition.id as string,
      definition,
    ] as const),
  );
  for (const { instance } of objectPlacements) {
    const stateId = save.world.story.objectStates[instance.id];
    if (!stateId) {
      issue(issues, "missing-object-state", `world.story.objectStates.${instance.id}`, `Object instance '${instance.id}' has no saved state.`);
      continue;
    }
    const definition = definitions.get(instance.definitionId);
    if (!definition?.states.some((state) => state.id === stateId)) {
      issue(issues, "invalid-object-state", `world.story.objectStates.${instance.id}`, `Object instance '${instance.id}' has unknown state '${stateId}'.`);
    }
  }

  for (const [key, pending] of Object.entries(save.world.pendingObjectCommands)) {
    if (
      key !== pending.actorInstanceId ||
      !savedActorIds.has(pending.actorInstanceId) ||
      !objectIds.has(pending.objectInstanceId) ||
      (pending.itemId !== null && !itemIds.has(pending.itemId))
    ) {
      issue(issues, "invalid-pending-command", `world.pendingObjectCommands.${key}`, `Saved pending command '${key}' references unavailable runtime entities.`);
    }
  }

  const controlled = save.interface.controlledActorInstanceId;
  if (controlled !== null && !savedActorIds.has(controlled)) {
    issue(issues, "invalid-controlled-actor", "interface.controlledActorInstanceId", `Controlled actor instance '${controlled}' does not exist.`);
  }
  if (
    save.interface.selectedItemId !== null &&
    !save.world.story.inventory.includes(save.interface.selectedItemId)
  ) {
    issue(issues, "invalid-selected-item", "interface.selectedItemId", `Selected inventory item '${save.interface.selectedItemId}' is not currently held.`);
  }
  if (save.interface.selectedVerbId !== null) {
    const skin = bundle.uiSkins?.skins.find(
      (candidate) => candidate.id === bundle.uiSkins?.defaultSkinId,
    );
    if (!skin?.verbs.some((verb) => verb.id === save.interface.selectedVerbId)) {
      issue(issues, "invalid-selected-verb", "interface.selectedVerbId", `Selected verb '${save.interface.selectedVerbId}' does not exist in the default UI skin.`);
    }
  }
  const parserLimit =
    bundle.uiSkins?.skins.find(
      (candidate) => candidate.id === bundle.uiSkins?.defaultSkinId,
    )?.parser?.historyLimit ?? 20;
  if (save.interface.parser.history.length > parserLimit) {
    issue(issues, "parser-history-limit", "interface.parser.history", `Saved parser history exceeds the configured limit of ${parserLimit}.`);
  }

  return issues;
};

export interface CreateSaveGameOptions {
  readonly controlledActorInstanceId: Id<"actor-instance"> | null;
  readonly selectedVerbId: Id<"ui-verb"> | null;
  readonly selectedItemId: Id<"item"> | null;
  readonly statusText: string;
  readonly parser: {
    readonly text: string;
    readonly history: readonly string[];
  };
}

export const createSaveGame = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  options: CreateSaveGameOptions,
): SaveGame => {
  assertSaveGameAllowed(bundle, world);
  const payload = saveGamePayloadSchema.parse({
    saveVersion: 1,
    projectId: bundle.projectId,
    bundleFingerprint: runtimeBundleFingerprint(bundle),
    assetManifestFingerprint: bundle.assetManifestFingerprint,
    world,
    interface: options,
  });
  const save = saveGameSchema.parse({
    ...payload,
    saveFingerprint: fnv1a64(canonicalSaveGameJson(payload)),
  });
  const issues = validateSaveGameCompatibility(bundle, save);
  if (issues.length > 0) throw new SaveGameCompatibilityError(issues);
  return save;
};

export const loadSaveGame = (
  bundle: RuntimeBundle,
  input: unknown,
): SaveGame => {
  const save = parseSaveGame(input);
  const issues = validateSaveGameCompatibility(bundle, save);
  if (issues.length > 0) throw new SaveGameCompatibilityError(issues);
  return save;
};

export const serializeSaveGame = (save: SaveGame): string =>
  `${canonicalSaveGameJson(save)}\n`;
