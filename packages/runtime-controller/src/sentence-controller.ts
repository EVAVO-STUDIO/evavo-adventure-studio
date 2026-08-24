import {
  createItemCombinationRuntimeState,
  type ItemCombinationManifest,
  type ItemCombinationRuntimeState,
} from "@evavo/adventure-scene-runtime/item-combinations";
import {
  classicScumm5SentenceGrammar,
  createSentenceState,
  formatSentence,
  resolveSentenceIntent,
  selectSentenceTarget,
  selectSentenceVerb,
  type SentenceGrammar,
  type SentenceState,
  type SentenceTarget,
} from "@evavo/adventure-scene-runtime/sentence";
import { executeSentenceIntent } from "@evavo/adventure-scene-runtime/sentence-execution";
import type { Id, Point } from "@evavo/adventure-project-schema";
import type { ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  createSaveGame as createRuntimeSaveGame,
  loadSaveGame as loadRuntimeSaveGame,
  type SaveGame,
} from "@evavo/adventure-save-game";
import { hitTestSceneObject } from "@evavo/adventure-scene-runtime/interactions";
import { uiSkinById } from "@evavo/adventure-ui-skin";
import { hitTestUiSkin } from "@evavo/adventure-ui-skin/hit-testing";
import type { PackagedRuntimeControllerOptions } from "./packaged-controller.js";
import { nativeScreenPointToWorld, type SoftwareCursorState } from "./input.js";
import type { ParserBufferState, ParserKeyInput } from "./parser.js";
import type { ProfiledRuntimeCameraState } from "./profiled-camera.js";
import {
  createBasePackagedSessionController,
  type PackagedSessionController,
  type PackagedSessionControllerFactory,
} from "./session-controller.js";
import { runtimeUiState } from "./runtime-ui.js";

export interface SentencePackagedRuntimeController extends PackagedSessionController {
  sentenceState(): SentenceState;
  sentenceText(): string;
  combinationState(): ItemCombinationRuntimeState;
}

const combinationManifestFor = (bundle: RuntimeBundle): ItemCombinationManifest => ({
  manifestVersion: 1,
  recipes: bundle.itemCombinations?.recipes ?? [],
  ...(bundle.itemCombinations?.fallbackText ? { fallbackText: bundle.itemCombinations.fallbackText } : {}),
});

const initialVerb = (bundle: RuntimeBundle): Id<"ui-verb"> | null => {
  const skin = bundle.uiSkins ? uiSkinById(bundle.uiSkins) : null;
  return skin?.verbs.find((verb) => verb.primary)?.id ?? skin?.verbs[0]?.id ?? null;
};

const inventoryLabel = (bundle: RuntimeBundle, itemId: Id<"item">): string =>
  bundle.inventoryItems.find((item) => item.id === itemId)?.name ?? itemId;

const objectTargetAt = (
  bundle: RuntimeBundle,
  base: PackagedSessionController,
  position: Point,
): SentenceTarget | null => {
  const frame = base.createFrame(base.worldState().story.tick);
  const worldPoint = nativeScreenPointToWorld(position, frame.camera);
  const target = hitTestSceneObject(bundle, base.worldState(), worldPoint);
  return target
    ? {
        kind: "scene-object",
        objectId: target.objectInstanceId,
        label: target.hotspot.name,
      }
    : null;
};

const replaceSentenceStatus = (frame: ResolvedFrame, text: string): ResolvedFrame => {
  if (!text) return frame;
  return {
    ...frame,
    nodes: frame.nodes.map((node) =>
      node.kind === "bitmap-text" && node.id === "runtime.ui.status.text"
        ? { ...node, text }
        : node,
    ),
  };
};

export const createSentencePackagedRuntimeControllerWithFactory = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
  innerFactory: PackagedSessionControllerFactory = createBasePackagedSessionController,
): SentencePackagedRuntimeController => {
  if (!bundle.uiSkins || !bundle.bitmapFonts) {
    throw new Error("Classic sentence control requires a packaged UI skin and bitmap fonts.");
  }
  const skin = uiSkinById(bundle.uiSkins);
  if (skin.interactionMode !== "verb-list") {
    throw new Error(`Classic sentence control requires a verb-list UI skin, received '${skin.interactionMode}'.`);
  }
  const grammar: SentenceGrammar = classicScumm5SentenceGrammar(skin.verbs);
  const base = innerFactory(bundle, options);
  let sentence = createSentenceState(initialVerb(bundle));
  let combinations = createItemCombinationRuntimeState();
  let pointer: Point | null = null;
  let pressed = false;

  const displayText = (): string =>
    sentence.primary || sentence.secondary ? formatSentence(grammar, sentence) : base.statusText();

  const cursorState = (): SoftwareCursorState => ({
    position: pointer,
    cursorId: "walk",
    pressed,
  });

  const uiTargetAt = (position: Point) =>
    hitTestUiSkin(
      skin,
      bundle.bitmapFonts!,
      runtimeUiState(bundle, base.worldState(), skin, displayText(), cursorState(), {
        ...(sentence.verbId ? { activeVerbId: sentence.verbId } : {}),
        ...(sentence.primary?.kind === "inventory-item"
          ? { selectedItemId: sentence.primary.itemId }
          : {}),
      }),
      position,
    );

  const restoreStory = (story: ReturnType<PackagedSessionController["worldState"]>["story"]): void => {
    const baseSave = base.createSaveGame();
    const save = createRuntimeSaveGame(bundle, { ...base.worldState(), story }, {
      controlledActorInstanceId: baseSave.interface.controlledActorInstanceId,
      selectedVerbId: baseSave.interface.selectedVerbId,
      selectedItemId: null,
      statusText: baseSave.interface.statusText,
      parser: baseSave.interface.parser,
      ...(baseSave.interface.profiledCamera ? { profiledCamera: baseSave.interface.profiledCamera } : {}),
      ...(baseSave.investigation ? { investigation: baseSave.investigation } : {}),
      ...(baseSave.multiProtagonist ? { multiProtagonist: baseSave.multiProtagonist } : {}),
      ...(baseSave.roomScripts ? { roomScripts: baseSave.roomScripts } : {}),
      sentence,
      itemCombinations: { usedRecipeIds: combinations.usedRecipeIds },
    });
    base.restoreSaveGame(save);
  };

  const executeCombinationIfComplete = (): boolean => {
    const intent = resolveSentenceIntent(grammar, sentence);
    if (intent.kind !== "item-combination") return false;
    const executed = executeSentenceIntent(
      grammar,
      sentence,
      base.worldState().story,
      combinationManifestFor(bundle),
      combinations,
    );
    if (executed.kind !== "item-combination") return false;
    combinations = executed.combinations;
    restoreStory(executed.story);
    sentence = createSentenceState(sentence.verbId);
    return true;
  };

  const selectTarget = (target: SentenceTarget): boolean => {
    const selected = selectSentenceTarget(grammar, sentence, target);
    if (selected.kind === "invalid") return false;
    sentence = selected.state;
    return true;
  };

  const activate = (position: Point): void => {
    pointer = position;
    base.setPointer(position);
    const uiTarget = uiTargetAt(position);
    if (uiTarget?.kind === "verb") {
      const selected = selectSentenceVerb(grammar, sentence, uiTarget.verb.id);
      if (selected.kind === "selected") sentence = selected.state;
      base.activate(position);
      return;
    }
    if (uiTarget?.kind === "inventory-slot" && uiTarget.itemId) {
      if (
        selectTarget({
          kind: "inventory-item",
          itemId: uiTarget.itemId,
          label: inventoryLabel(bundle, uiTarget.itemId),
        })
      ) {
        base.activate(position);
        executeCombinationIfComplete();
      }
      return;
    }
    if (uiTarget) {
      base.activate(position);
      return;
    }

    const target = objectTargetAt(bundle, base, position);
    if (!target || !selectTarget(target)) {
      base.activate(position);
      return;
    }
    const intent = resolveSentenceIntent(grammar, sentence);
    if (intent.kind === "room-command") {
      base.activate(position);
      sentence = createSentenceState(sentence.verbId);
      return;
    }
    if (intent.kind === "item-combination") executeCombinationIfComplete();
  };

  const createSaveGame = (): SaveGame => {
    const baseSave = base.createSaveGame();
    return createRuntimeSaveGame(bundle, base.worldState(), {
      controlledActorInstanceId: baseSave.interface.controlledActorInstanceId,
      selectedVerbId: baseSave.interface.selectedVerbId,
      selectedItemId: baseSave.interface.selectedItemId,
      statusText: baseSave.interface.statusText,
      parser: baseSave.interface.parser,
      ...(baseSave.interface.profiledCamera ? { profiledCamera: baseSave.interface.profiledCamera } : {}),
      sentence,
      itemCombinations: { usedRecipeIds: combinations.usedRecipeIds },
      ...(baseSave.investigation ? { investigation: baseSave.investigation } : {}),
      ...(baseSave.multiProtagonist ? { multiProtagonist: baseSave.multiProtagonist } : {}),
      ...(baseSave.roomScripts ? { roomScripts: baseSave.roomScripts } : {}),
    });
  };

  const restoreSaveGame = (input: unknown): number => {
    const save = loadRuntimeSaveGame(bundle, input);
    const tick = base.restoreSaveGame(save);
    sentence = save.interface.sentence ?? createSentenceState(initialVerb(bundle));
    combinations = {
      usedRecipeIds: (save.itemCombinations?.usedRecipeIds ?? []) as ItemCombinationRuntimeState["usedRecipeIds"],
    };
    return tick;
  };

  return {
    sentenceState: () => sentence,
    sentenceText: () => formatSentence(grammar, sentence),
    combinationState: () => combinations,
    controlledActorInstanceId: () => base.controlledActorInstanceId(),
    worldState: () => base.worldState(),
    createFrame: (tick) => replaceSentenceStatus(base.createFrame(tick), displayText()),
    setPointer: (position) => {
      pointer = position;
      base.setPointer(position);
    },
    setPressed: (value) => {
      pressed = value;
      base.setPressed(value);
    },
    activate,
    handleKey: (input) => base.handleKey(input),
    createSaveGame,
    restoreSaveGame,
    statusText: displayText,
    cameraState: () => base.cameraState(),
    parserState: () => base.parserState(),
    drainSceneAudioCueIds: () => base.drainSceneAudioCueIds(),
  };
};

export const createSentencePackagedRuntimeController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): SentencePackagedRuntimeController =>
  createSentencePackagedRuntimeControllerWithFactory(
    bundle,
    options,
    createBasePackagedSessionController,
  );
