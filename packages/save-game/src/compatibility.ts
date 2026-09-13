import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import { runtimeBundleFingerprint } from "./canonical.js";
import { addSaveGameIssue, type SaveGameCompatibilityIssue } from "./errors.js";
import { activeSequencePolicyIssues } from "./policy.js";
import type { SaveGame } from "./schema.js";
import {
  authoredActorInstances,
  authoredObjectInstances,
  validateSavedCamera,
  validateSavedMovement,
} from "./validation-helpers.js";

type RuntimeDialogueNode = RuntimeBundle["dialogues"][number]["nodes"][number];
type RuntimeActor = RuntimeBundle["actors"][number];
type RuntimeActorFrame = RuntimeActor["frames"][number];
type RuntimeAnimationClip = RuntimeActor["animations"][number];
type RuntimeObjectState = NonNullable<
  RuntimeBundle["sceneInstances"]
>["objectDefinitions"][number]["states"][number];
type RuntimeUiSkin = NonNullable<RuntimeBundle["uiSkins"]>["skins"][number];
type RuntimeUiVerb = RuntimeUiSkin["verbs"][number];

export const validateSaveGameCompatibility = (
  bundle: RuntimeBundle,
  save: SaveGame,
): readonly SaveGameCompatibilityIssue[] => {
  const issues: SaveGameCompatibilityIssue[] = [];
  if (save.projectId !== bundle.projectId) {
    addSaveGameIssue(
      issues,
      "project-mismatch",
      "projectId",
      `Save project '${save.projectId}' does not match '${bundle.projectId}'.`,
    );
  }
  const bundleFingerprint = runtimeBundleFingerprint(bundle);
  if (save.bundleFingerprint !== bundleFingerprint) {
    addSaveGameIssue(
      issues,
      "bundle-fingerprint-mismatch",
      "bundleFingerprint",
      "Save game was created from a different runtime bundle.",
    );
  }
  if (save.assetManifestFingerprint !== bundle.assetManifestFingerprint) {
    addSaveGameIssue(
      issues,
      "asset-manifest-mismatch",
      "assetManifestFingerprint",
      "Save game was created from a different compiled asset manifest.",
    );
  }
  if (save.world.story.projectId !== bundle.projectId) {
    addSaveGameIssue(
      issues,
      "story-project-mismatch",
      "world.story.projectId",
      "Saved story state belongs to a different project.",
    );
  }

  const scene = bundle.scenes.find((candidate) => candidate.id === save.world.story.currentSceneId);
  if (!scene) {
    addSaveGameIssue(
      issues,
      "missing-current-scene",
      "world.story.currentSceneId",
      `Saved scene '${save.world.story.currentSceneId}' does not exist.`,
    );
  } else if (!scene.entrances.some((entrance) => entrance.id === save.world.story.currentEntranceId)) {
    addSaveGameIssue(
      issues,
      "missing-current-entrance",
      "world.story.currentEntranceId",
      `Saved entrance '${save.world.story.currentEntranceId}' does not exist ` + `in scene '${scene.id}'.`,
    );
  }

  const itemIds = new Set(bundle.inventoryItems.map((item) => item.id as string));
  save.world.story.inventory.forEach((itemId, index) => {
    if (!itemIds.has(itemId)) {
      addSaveGameIssue(
        issues,
        "missing-inventory-item",
        `world.story.inventory[${index}]`,
        `Saved inventory item '${itemId}' does not exist.`,
      );
    }
  });

  if (save.world.story.activeDialogue) {
    const active = save.world.story.activeDialogue;
    const dialogue = bundle.dialogues.find((candidate) => candidate.id === active.dialogueId);
    if (!dialogue) {
      addSaveGameIssue(
        issues,
        "missing-active-dialogue",
        "world.story.activeDialogue.dialogueId",
        `Saved dialogue '${active.dialogueId}' does not exist.`,
      );
    } else if (!dialogue.nodes.some((node: RuntimeDialogueNode) => node.id === active.nodeId)) {
      addSaveGameIssue(
        issues,
        "missing-active-dialogue-node",
        "world.story.activeDialogue.nodeId",
        `Saved dialogue node '${active.nodeId}' does not exist.`,
      );
    }
  }

  issues.push(...activeSequencePolicyIssues(bundle, save.world as InteractiveRuntimeWorldState));

  const actorPlacements = authoredActorInstances(bundle);
  const authoredActorIds = new Set(actorPlacements.map(({ instance }) => instance.id as string));
  const savedActorIds = new Set(Object.keys(save.world.actorInstances));
  for (const actorInstanceId of new Set([...authoredActorIds, ...savedActorIds])) {
    if (!authoredActorIds.has(actorInstanceId) || !savedActorIds.has(actorInstanceId)) {
      addSaveGameIssue(
        issues,
        "actor-instance-set-mismatch",
        "world.actorInstances",
        `Actor instance '${actorInstanceId}' is not present in both the ` + "bundle and save game.",
      );
    }
  }

  for (const [key, actorState] of Object.entries(save.world.actorInstances)) {
    const authored = actorPlacements.find(({ instance }) => instance.id === actorState.instanceId);
    if (key !== actorState.instanceId || !authored) {
      addSaveGameIssue(
        issues,
        "actor-instance-identity-mismatch",
        `world.actorInstances.${key}`,
        `Saved actor instance '${key}' has invalid identity metadata.`,
      );
      continue;
    }
    if (authored.instance.actorId !== actorState.actorId) {
      addSaveGameIssue(
        issues,
        "actor-instance-identity-mismatch",
        `world.actorInstances.${key}.actorId`,
        `Saved actor instance '${key}' no longer matches its authored actor.`,
      );
    }
    if (!bundle.scenes.some((candidate) => candidate.id === actorState.sceneId)) {
      addSaveGameIssue(
        issues,
        "actor-instance-identity-mismatch",
        `world.actorInstances.${key}.sceneId`,
        `Saved actor instance '${key}' references missing scene ` + `'${actorState.sceneId}'.`,
      );
    }
    const actor = bundle.actors.find((candidate: RuntimeActor) => candidate.id === actorState.actorId);
    if (!actor) {
      addSaveGameIssue(
        issues,
        "missing-actor",
        `world.actorInstances.${key}.actorId`,
        `Saved actor '${actorState.actorId}' does not exist.`,
      );
      continue;
    }
    const clip = actor.animations.find(
      (candidate: RuntimeAnimationClip) => candidate.id === actorState.playback.clipId,
    );
    if (!clip) {
      addSaveGameIssue(
        issues,
        "missing-animation-clip",
        `world.actorInstances.${key}.playback.clipId`,
        `Saved animation clip '${actorState.playback.clipId}' does not exist.`,
      );
      continue;
    }
    const frameId = clip.frameIds[actorState.playback.frameIndex];
    const frame = actor.frames.find((candidate: RuntimeActorFrame) => candidate.id === frameId);
    if (!frame) {
      addSaveGameIssue(
        issues,
        "invalid-animation-frame",
        `world.actorInstances.${key}.playback.frameIndex`,
        `Saved animation frame index ${actorState.playback.frameIndex} is ` + `invalid for '${clip.id}'.`,
      );
    } else if (actorState.playback.ticksIntoFrame > frame.durationTicks) {
      addSaveGameIssue(
        issues,
        "invalid-animation-progress",
        `world.actorInstances.${key}.playback.ticksIntoFrame`,
        `Saved animation progress exceeds frame '${frame.id}' duration.`,
      );
    }
  }

  for (const [key, movement] of Object.entries(save.world.movements)) {
    validateSavedMovement(bundle, save, savedActorIds, key, movement, issues);
  }
  validateSavedCamera(bundle, save, issues);

  const objectPlacements = authoredObjectInstances(bundle);
  const objectIds = new Set(objectPlacements.map(({ instance }) => instance.id as string));
  const definitions = new Map(
    (bundle.sceneInstances?.objectDefinitions ?? []).map(
      (definition) => [definition.id as string, definition] as const,
    ),
  );
  for (const { instance } of objectPlacements) {
    const stateId = save.world.story.objectStates[instance.id];
    if (!stateId) {
      addSaveGameIssue(
        issues,
        "missing-object-state",
        `world.story.objectStates.${instance.id}`,
        `Object instance '${instance.id}' has no saved state.`,
      );
      continue;
    }
    const definition = definitions.get(instance.definitionId);
    if (!definition?.states.some((state: RuntimeObjectState) => state.id === stateId)) {
      addSaveGameIssue(
        issues,
        "invalid-object-state",
        `world.story.objectStates.${instance.id}`,
        `Object instance '${instance.id}' has unknown state '${stateId}'.`,
      );
    }
  }

  for (const [key, pending] of Object.entries(save.world.pendingObjectCommands)) {
    if (
      key !== pending.actorInstanceId ||
      !savedActorIds.has(pending.actorInstanceId) ||
      !objectIds.has(pending.objectInstanceId) ||
      (pending.itemId !== null && !itemIds.has(pending.itemId))
    ) {
      addSaveGameIssue(
        issues,
        "invalid-pending-command",
        `world.pendingObjectCommands.${key}`,
        `Saved pending command '${key}' references unavailable runtime entities.`,
      );
    }
  }

  const controlled = save.interface.controlledActorInstanceId;
  if (controlled !== null && !savedActorIds.has(controlled)) {
    addSaveGameIssue(
      issues,
      "invalid-controlled-actor",
      "interface.controlledActorInstanceId",
      `Controlled actor instance '${controlled}' does not exist.`,
    );
  }
  if (
    save.interface.selectedItemId !== null &&
    !save.world.story.inventory.includes(save.interface.selectedItemId)
  ) {
    addSaveGameIssue(
      issues,
      "invalid-selected-item",
      "interface.selectedItemId",
      `Selected inventory item '${save.interface.selectedItemId}' is not held.`,
    );
  }
  if (save.interface.selectedVerbId !== null) {
    const skin = bundle.uiSkins?.skins.find(
      (candidate: RuntimeUiSkin) => candidate.id === bundle.uiSkins?.defaultSkinId,
    );
    if (!skin?.verbs.some((verb: RuntimeUiVerb) => verb.id === save.interface.selectedVerbId)) {
      addSaveGameIssue(
        issues,
        "invalid-selected-verb",
        "interface.selectedVerbId",
        `Selected verb '${save.interface.selectedVerbId}' does not exist in ` + "the default UI skin.",
      );
    }
  }
  const parserLimit =
    bundle.uiSkins?.skins.find((candidate: RuntimeUiSkin) => candidate.id === bundle.uiSkins?.defaultSkinId)
      ?.parser?.historyLimit ?? 20;
  if (save.interface.parser.history.length > parserLimit) {
    addSaveGameIssue(
      issues,
      "parser-history-limit",
      "interface.parser.history",
      `Saved parser history exceeds the configured limit of ${parserLimit}.`,
    );
  }

  return issues;
};
