import type { AudioRuntimeState } from "@evavo/adventure-audio/runtime";
import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import type { RuntimeInvestigationState } from "@evavo/adventure-scene-runtime/investigation-runtime";
import type { MultiProtagonistState } from "@evavo/adventure-scene-runtime/multi-protagonist";
import type { RuntimeRoomScriptState } from "@evavo/adventure-scene-runtime/room-scripts";
import type { AdventureRpgState } from "@evavo/adventure-scene-runtime/rpg";
import { validateSavedAudio } from "./audio-compatibility.js";
import {
  canonicalSaveGameJson,
  fnv1a64,
  parseSaveGame,
  runtimeBundleFingerprint,
} from "./canonical.js";
import { validateSaveGameCompatibility } from "./compatibility.js";
import { SaveGameCompatibilityError } from "./errors.js";
import { validateSavedInvestigation } from "./investigation-compatibility.js";
import { validateSavedItemCombinations } from "./item-combination-compatibility.js";
import type { SaveGameItemCombinationState } from "./item-combinations.js";
import { validateSavedMultiProtagonist } from "./multi-protagonist-compatibility.js";
import { assertSaveGameAllowed } from "./policy.js";
import type { SaveGameProfiledRuntimeCameraState } from "./profiled-camera.js";
import { validateSavedRoomScripts } from "./room-script-compatibility.js";
import { validateSavedAdventureRpg } from "./rpg-compatibility.js";
import type { SaveGameSentenceState } from "./sentence.js";
import { validateSavedSentence } from "./sentence-compatibility.js";
import {
  type SaveGame,
  saveGamePayloadSchema,
  saveGameSchema,
} from "./schema.js";

export interface CreateSaveGameOptions {
  readonly controlledActorInstanceId: Id<"actor-instance"> | null;
  readonly selectedVerbId: Id<"ui-verb"> | null;
  readonly selectedItemId: Id<"item"> | null;
  readonly statusText: string;
  readonly parser: {
    readonly text: string;
    readonly history: readonly string[];
  };
  readonly profiledCamera?: SaveGameProfiledRuntimeCameraState;
  readonly sentence?: SaveGameSentenceState;
  readonly audio?: AudioRuntimeState;
  readonly investigation?: RuntimeInvestigationState;
  readonly itemCombinations?: SaveGameItemCombinationState;
  readonly multiProtagonist?: MultiProtagonistState;
  readonly roomScripts?: RuntimeRoomScriptState;
  readonly rpg?: AdventureRpgState;
}

const completeCompatibilityIssues = (
  bundle: RuntimeBundle,
  save: SaveGame,
) => [
  ...validateSaveGameCompatibility(bundle, save),
  ...validateSavedAudio(bundle, save),
  ...validateSavedInvestigation(bundle, save),
  ...validateSavedItemCombinations(bundle, save),
  ...validateSavedMultiProtagonist(bundle, save),
  ...validateSavedSentence(bundle, save),
  ...validateSavedRoomScripts(bundle, save),
  ...validateSavedAdventureRpg(bundle, save),
];

export const createSaveGame = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  options: CreateSaveGameOptions,
): SaveGame => {
  assertSaveGameAllowed(bundle, world);
  const {
    audio,
    investigation,
    itemCombinations,
    multiProtagonist,
    roomScripts,
    rpg,
    sentence,
    ...interfaceState
  } = options;
  const payload = saveGamePayloadSchema.parse({
    saveVersion: 1,
    projectId: bundle.projectId,
    bundleFingerprint: runtimeBundleFingerprint(bundle),
    assetManifestFingerprint: bundle.assetManifestFingerprint,
    world,
    interface: {
      ...interfaceState,
      ...(sentence ? { sentence } : {}),
    },
    ...(audio ? { audio } : {}),
    ...(investigation ? { investigation } : {}),
    ...(itemCombinations ? { itemCombinations } : {}),
    ...(multiProtagonist ? { multiProtagonist } : {}),
    ...(roomScripts ? { roomScripts } : {}),
    ...(rpg ? { rpg } : {}),
  });
  const save = saveGameSchema.parse({
    ...payload,
    saveFingerprint: fnv1a64(canonicalSaveGameJson(payload)),
  });
  const issues = completeCompatibilityIssues(bundle, save);
  if (issues.length > 0) throw new SaveGameCompatibilityError(issues);
  return save;
};

export const loadSaveGame = (
  bundle: RuntimeBundle,
  input: unknown,
): SaveGame => {
  const save = parseSaveGame(input);
  const issues = completeCompatibilityIssues(bundle, save);
  if (issues.length > 0) throw new SaveGameCompatibilityError(issues);
  return save;
};

export const serializeSaveGame = (save: SaveGame): string =>
  `${canonicalSaveGameJson(save)}\n`;
