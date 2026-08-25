import { evaluateCondition, type RuntimeEvent } from "@evavo/adventure-core";
import type {
  Id,
  Sequence,
  SequenceCue,
} from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  createPackagedFeatureRuntimeController,
  type PackagedFeatureRuntimeController,
} from "@evavo/adventure-runtime-controller/feature-session";
import type { PackagedRuntimeControllerOptions } from "@evavo/adventure-runtime-controller";
import { advanceProfiledRuntimeCamera } from "@evavo/adventure-runtime-controller/profiled-camera";
import {
  createSaveGame as createRuntimeSaveGame,
  loadSaveGame as loadRuntimeSaveGame,
  type SaveGame,
} from "@evavo/adventure-save-game";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import {
  skipRuntimeNarrativeSequence,
  startRuntimeNarrativeSequence,
} from "@evavo/adventure-scene-runtime/narrative";
import {
  type AudioCommand,
  type AudioRuntimeState,
  advanceAudioRuntimeState,
  completeAudioVoice,
  createInitialAudioRuntimeState,
  enterAudioScene,
  restoreAudioRuntimeCommands,
  stopAudioBus,
  triggerAudioCue,
} from "@evavo/adventure-audio/runtime";

export interface AudioNarrativeSequenceSkipResult {
  readonly kind: "skipped" | "rejected";
  readonly reason?: string;
}

export interface AudioPackagedRuntimeController
  extends PackagedFeatureRuntimeController {
  audioState(): AudioRuntimeState | null;
  drainAudioCommands(): readonly AudioCommand[];
  completeAudioVoice(voiceId: Id<"audio-voice">): void;
  startNarrativeSequence(sequenceId: Id<"sequence">): readonly RuntimeEvent[];
  skipNarrativeSequence(sequenceId: Id<"sequence">): AudioNarrativeSequenceSkipResult;
  activeBlockingSequenceId(): Id<"sequence"> | null;
}

const dialogueKey = (
  world: InteractiveRuntimeWorldState,
): string | null => {
  const active = world.story.activeDialogue;
  return active ? `${active.dialogueId}\u0000${active.nodeId}` : null;
};

const audioTrackCues = (sequence: Sequence): readonly SequenceCue[] =>
  sequence.tracks
    .filter((track) => track.kind === "audio")
    .flatMap((track) => track.cues)
    .filter(
      (cue) => cue.kind === "sound" || cue.kind === "stop-audio",
    )
    .sort((left, right) => {
      const tickDifference = left.atTick - right.atTick;
      return tickDifference !== 0
        ? tickDifference
        : left.kind.localeCompare(right.kind);
    });

const cuesInRange = (
  sequence: Sequence,
  afterTick: number,
  throughTick: number,
): readonly SequenceCue[] =>
  audioTrackCues(sequence).filter(
    (cue) => cue.atTick > afterTick && cue.atTick <= throughTick,
  );

const sequenceCuesReached = (
  bundle: RuntimeBundle,
  previous: InteractiveRuntimeWorldState,
  next: InteractiveRuntimeWorldState,
): readonly SequenceCue[] => {
  const previousById = new Map(
    previous.story.activeSequences.map(
      (active) => [active.sequenceId as string, active] as const,
    ),
  );
  const reached: SequenceCue[] = [];

  for (const active of next.story.activeSequences) {
    const sequence = bundle.sequences.find(
      (candidate) => candidate.id === active.sequenceId,
    );
    if (!sequence) continue;
    const before = previousById.get(active.sequenceId);
    if (!before) {
      reached.push(...cuesInRange(sequence, -1, active.elapsedTicks));
      continue;
    }
    if (before.iteration === active.iteration) {
      reached.push(
        ...cuesInRange(
          sequence,
          before.elapsedTicks,
          active.elapsedTicks,
        ),
      );
      continue;
    }
    reached.push(
      ...cuesInRange(
        sequence,
        before.elapsedTicks,
        sequence.durationTicks - 1,
      ),
      ...cuesInRange(sequence, -1, active.elapsedTicks),
    );
  }

  return reached;
};

const selectedCueForSequenceSound = (
  bundle: RuntimeBundle,
  cue: Extract<SequenceCue, { readonly kind: "sound" }>,
) => {
  const candidates = (bundle.audioMix?.cues ?? [])
    .filter(
      (candidate) =>
        candidate.assetId === cue.assetId && candidate.bus === cue.bus,
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  return (
    candidates.find(
      (candidate) =>
        candidate.volume === cue.volume &&
        Boolean(candidate.loop) === cue.loop,
    ) ??
    candidates[0] ??
    null
  );
};

const speechCueForActiveDialogue = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
): Id<"audio-cue"> | null => {
  const active = world.story.activeDialogue;
  const mix = bundle.audioMix;
  if (!active || !mix) return null;
  const dialogue = bundle.dialogues.find(
    (candidate) => candidate.id === active.dialogueId,
  );
  const node = dialogue?.nodes.find(
    (candidate) => candidate.id === active.nodeId,
  );
  if (!node) return null;
  for (const line of node.lines) {
    const binding = mix.speechBindings.find(
      (candidate) => candidate.dialogueLineId === line.id,
    );
    if (binding) return binding.cueId;
  }
  return null;
};

const companionOptions = (save: SaveGame) => ({
  ...(save.interface.sentence ? { sentence: save.interface.sentence } : {}),
  ...(save.investigation ? { investigation: save.investigation } : {}),
  ...(save.itemCombinations ? { itemCombinations: save.itemCombinations } : {}),
  ...(save.multiProtagonist ? { multiProtagonist: save.multiProtagonist } : {}),
  ...(save.roomScripts ? { roomScripts: save.roomScripts } : {}),
  ...(save.routeTopology ? { routeTopology: save.routeTopology } : {}),
  ...(save.rpg ? { rpg: save.rpg } : {}),
  ...(save.specializedModes ? { specializedModes: save.specializedModes } : {}),
});

const internalWorldReplacementSave = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  sourceSave: SaveGame,
  interfaceState: SaveGame["interface"],
): SaveGame =>
  createRuntimeSaveGame(bundle, world, {
    controlledActorInstanceId: interfaceState.controlledActorInstanceId,
    selectedVerbId: interfaceState.selectedVerbId,
    selectedItemId: interfaceState.selectedItemId,
    statusText: interfaceState.statusText,
    parser: interfaceState.parser,
    ...(interfaceState.profiledCamera ? { profiledCamera: interfaceState.profiledCamera } : {}),
    ...companionOptions(sourceSave),
  });

export const createAudioPackagedRuntimeController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): AudioPackagedRuntimeController => {
  const controller = createPackagedFeatureRuntimeController(bundle, options);
  const mix = bundle.audioMix ?? null;
  let commands: AudioCommand[] = [];
  let audio: AudioRuntimeState | null = null;
  let synchronizedTick = controller.worldState().story.tick;
  let activeDialogueKey = dialogueKey(controller.worldState());
  let trackedNarrativeSequenceId: Id<"sequence"> | null = null;
  let trackedNarrativeSave: SaveGame | null = null;

  const appendCommands = (next: readonly AudioCommand[]): void => {
    commands.push(...next);
  };

  const applyTransition = (
    transition: {
      readonly state: AudioRuntimeState;
      readonly commands: readonly AudioCommand[];
    },
  ): void => {
    audio = transition.state;
    appendCommands(transition.commands);
  };

  const evaluateWorldCondition = (
    world: InteractiveRuntimeWorldState,
  ) => (condition: Parameters<typeof evaluateCondition>[0]): boolean =>
    evaluateCondition(condition, world.story);

  const processSceneAudioCues = (): void => {
    const cueIds = controller.drainSceneAudioCueIds();
    if (!mix || !audio || cueIds.length === 0) return;
    const tick = controller.worldState().story.tick;
    for (const cueId of cueIds) {
      const cue = mix.cues.find((candidate) => candidate.id === cueId);
      if (cue) applyTransition(triggerAudioCue(mix, audio, cue.id, tick));
    }
  };

  if (mix) {
    audio = createInitialAudioRuntimeState(
      mix,
      controller.worldState().story.currentSceneId,
    );
    applyTransition(
      enterAudioScene(
        mix,
        audio,
        controller.worldState().story.currentSceneId,
        synchronizedTick,
        evaluateWorldCondition(controller.worldState()),
      ),
    );
    const speechCueId = speechCueForActiveDialogue(
      bundle,
      controller.worldState(),
    );
    if (speechCueId && audio) {
      applyTransition(
        triggerAudioCue(mix, audio, speechCueId, synchronizedTick),
      );
    }
  }

  const processSequenceCue = (
    cue: SequenceCue,
    tick: number,
  ): void => {
    if (!mix || !audio) return;
    if (cue.kind === "stop-audio") {
      applyTransition(
        stopAudioBus(mix, audio, cue.bus, tick, cue.fadeTicks),
      );
      return;
    }
    if (cue.kind !== "sound") return;
    const selected = selectedCueForSequenceSound(bundle, cue);
    if (selected) {
      applyTransition(triggerAudioCue(mix, audio, selected.id, tick));
    }
  };

  const synchronizeWorld = (
    previous: InteractiveRuntimeWorldState,
    next: InteractiveRuntimeWorldState,
  ): void => {
    synchronizedTick = next.story.tick;
    if (!mix || !audio) return;

    if (audio.tick < next.story.tick) {
      applyTransition(
        advanceAudioRuntimeState(mix, audio, next.story.tick),
      );
    }
    if (previous.story.currentSceneId !== next.story.currentSceneId) {
      applyTransition(
        enterAudioScene(
          mix,
          audio,
          next.story.currentSceneId,
          next.story.tick,
          evaluateWorldCondition(next),
        ),
      );
    }
    for (const cue of sequenceCuesReached(bundle, previous, next)) {
      processSequenceCue(cue, next.story.tick);
    }

    const nextDialogueKey = dialogueKey(next);
    if (nextDialogueKey !== activeDialogueKey) {
      activeDialogueKey = nextDialogueKey;
      const speechCueId = speechCueForActiveDialogue(bundle, next);
      if (speechCueId) {
        applyTransition(
          triggerAudioCue(mix, audio, speechCueId, next.story.tick),
        );
      }
    }
  };

  const aroundMutation = <T>(mutation: () => T): T => {
    const previous = controller.worldState();
    const result = mutation();
    synchronizeWorld(previous, controller.worldState());
    processSceneAudioCues();
    return result;
  };

  const activeBlockingSequenceId = (): Id<"sequence"> | null => {
    if (!trackedNarrativeSequenceId) return null;
    const active = controller
      .worldState()
      .story.activeSequences.some(
        (sequence) => sequence.sequenceId === trackedNarrativeSequenceId,
      );
    const definition = bundle.sequences.find(
      (sequence) => sequence.id === trackedNarrativeSequenceId,
    );
    return active && definition?.blocking ? trackedNarrativeSequenceId : null;
  };

  const clearTrackedNarrativeIfInactive = (): void => {
    if (
      trackedNarrativeSequenceId &&
      !controller
        .worldState()
        .story.activeSequences.some(
          (active) => active.sequenceId === trackedNarrativeSequenceId,
        )
    ) {
      trackedNarrativeSequenceId = null;
      trackedNarrativeSave = null;
    }
  };

  const replaceControllerWorld = (
    previous: InteractiveRuntimeWorldState,
    next: InteractiveRuntimeWorldState,
    runtimeEvents: readonly RuntimeEvent[],
    snapshot: SaveGame,
  ): void => {
    const camera = advanceProfiledRuntimeCamera({
      bundle,
      state: controller.cameraState(),
      previousWorld: previous,
      nextWorld: next,
      controlledActorInstanceId: controller.controlledActorInstanceId,
      runtimeEvents,
    });
    const { profiledCamera: _profiledCamera, ...withoutCamera } = snapshot.interface;
    const interfaceState = camera.state
      ? { ...withoutCamera, profiledCamera: camera.state }
      : withoutCamera;
    controller.restoreSaveGame(
      internalWorldReplacementSave(bundle, next, snapshot, interfaceState),
    );
    synchronizeWorld(previous, controller.worldState());
    processSceneAudioCues();
  };

  const startNarrativeSequence = (
    sequenceId: Id<"sequence">,
  ): readonly RuntimeEvent[] => {
    clearTrackedNarrativeIfInactive();
    if (trackedNarrativeSequenceId) {
      throw new Error(
        `Narrative sequence '${trackedNarrativeSequenceId}' is already managed by this controller.`,
      );
    }
    const snapshot = controller.createSaveGame();
    const previous = controller.worldState();
    const transition = startRuntimeNarrativeSequence(bundle, previous, sequenceId);
    replaceControllerWorld(previous, transition.state, transition.events, snapshot);
    trackedNarrativeSequenceId = sequenceId;
    trackedNarrativeSave = snapshot;
    return transition.events;
  };

  const skipNarrativeSequence = (
    sequenceId: Id<"sequence">,
  ): AudioNarrativeSequenceSkipResult => {
    clearTrackedNarrativeIfInactive();
    if (
      trackedNarrativeSequenceId !== sequenceId ||
      !trackedNarrativeSave
    ) {
      return { kind: "rejected", reason: "sequence-not-controller-started" };
    }
    const previous = controller.worldState();
    const skipped = skipRuntimeNarrativeSequence(bundle, previous, sequenceId);
    if (skipped.kind === "rejected") {
      return { kind: "rejected", reason: skipped.reason };
    }
    replaceControllerWorld(
      previous,
      skipped.state,
      skipped.events,
      trackedNarrativeSave,
    );
    trackedNarrativeSequenceId = null;
    trackedNarrativeSave = null;
    return { kind: "skipped" };
  };

  const createControllerSave = (): SaveGame => {
    const inner = controller.createSaveGame();
    return createRuntimeSaveGame(bundle, controller.worldState(), {
      controlledActorInstanceId: inner.interface.controlledActorInstanceId,
      selectedVerbId: inner.interface.selectedVerbId,
      selectedItemId: inner.interface.selectedItemId,
      statusText: inner.interface.statusText,
      parser: inner.interface.parser,
      ...(inner.interface.profiledCamera ? { profiledCamera: inner.interface.profiledCamera } : {}),
      ...companionOptions(inner),
      ...(audio ? { audio } : {}),
    });
  };

  const restoreControllerSave = (input: unknown): number => {
    const save = loadRuntimeSaveGame(bundle, input);
    const oldVoices = audio?.voices ?? [];
    const restoredTick = controller.restoreSaveGame(save);
    controller.drainSceneAudioCueIds();
    commands = oldVoices.map((voice) => ({
      kind: "stop" as const,
      atTick: restoredTick,
      voiceId: voice.id,
      fadeOutTicks: 0,
    }));

    if (!mix) {
      audio = null;
    } else if (save.audio) {
      audio = save.audio;
      appendCommands(
        restoreAudioRuntimeCommands(mix, audio, restoredTick),
      );
    } else {
      audio = createInitialAudioRuntimeState(
        mix,
        controller.worldState().story.currentSceneId,
      );
      applyTransition(
        enterAudioScene(
          mix,
          audio,
          controller.worldState().story.currentSceneId,
          restoredTick,
          evaluateWorldCondition(controller.worldState()),
        ),
      );
    }

    synchronizedTick = restoredTick;
    activeDialogueKey = dialogueKey(controller.worldState());
    trackedNarrativeSequenceId = null;
    trackedNarrativeSave = null;
    return restoredTick;
  };

  const featureApi = {
    ...(controller.activeProtagonistId
      ? { activeProtagonistId: () => controller.activeProtagonistId?.() as NonNullable<PackagedFeatureRuntimeController["activeProtagonistId"]> extends (...args: never[]) => infer R ? R : never }
      : {}),
    ...(controller.multiProtagonistState
      ? { multiProtagonistState: () => controller.multiProtagonistState?.() as NonNullable<PackagedFeatureRuntimeController["multiProtagonistState"]> extends (...args: never[]) => infer R ? R : never }
      : {}),
    ...(controller.switchProtagonist
      ? {
          switchProtagonist: (protagonistId: Parameters<NonNullable<PackagedFeatureRuntimeController["switchProtagonist"]>>[0]) =>
            aroundMutation(() => controller.switchProtagonist?.(protagonistId)),
        }
      : {}),
    ...(controller.rpgState ? { rpgState: () => controller.rpgState?.() as ReturnType<NonNullable<PackagedFeatureRuntimeController["rpgState"]>> } : {}),
    ...(controller.practiceSkill ? { practiceSkill: (skillId: string, amount?: number) => aroundMutation(() => controller.practiceSkill?.(skillId, amount)) as ReturnType<NonNullable<PackagedFeatureRuntimeController["practiceSkill"]>> } : {}),
    ...(controller.resolveSkillCheck ? { resolveSkillCheck: (check: Parameters<NonNullable<PackagedFeatureRuntimeController["resolveSkillCheck"]>>[0]) => aroundMutation(() => controller.resolveSkillCheck?.(check)) as ReturnType<NonNullable<PackagedFeatureRuntimeController["resolveSkillCheck"]>> } : {}),
    ...(controller.advanceRpgTime ? { advanceRpgTime: (minutes: number) => aroundMutation(() => controller.advanceRpgTime?.(minutes)) } : {}),
    ...(controller.restRpg ? { restRpg: (rule: Parameters<NonNullable<PackagedFeatureRuntimeController["restRpg"]>>[0]) => aroundMutation(() => controller.restRpg?.(rule)) } : {}),
    ...(controller.adjustResource ? { adjustResource: (resourceId: string, delta: number) => aroundMutation(() => controller.adjustResource?.(resourceId, delta)) } : {}),
    ...(controller.scheduleActive ? { scheduleActive: (window: Parameters<NonNullable<PackagedFeatureRuntimeController["scheduleActive"]>>[0]) => controller.scheduleActive?.(window) ?? false } : {}),
    ...(controller.createRpgImportSnapshot ? { createRpgImportSnapshot: (sourceGameId: string, tags?: readonly string[]) => controller.createRpgImportSnapshot?.(sourceGameId, tags) as ReturnType<NonNullable<PackagedFeatureRuntimeController["createRpgImportSnapshot"]>> } : {}),
    ...(controller.activeCombatState ? { activeCombatState: () => controller.activeCombatState?.() ?? null } : {}),
    ...(controller.startCombat ? { startCombat: (encounterId: string) => aroundMutation(() => controller.startCombat?.(encounterId)) as ReturnType<NonNullable<PackagedFeatureRuntimeController["startCombat"]>> } : {}),
    ...(controller.issueCombatAction ? { issueCombatAction: (action: Parameters<NonNullable<PackagedFeatureRuntimeController["issueCombatAction"]>>[0]) => aroundMutation(() => controller.issueCombatAction?.(action)) as ReturnType<NonNullable<PackagedFeatureRuntimeController["issueCombatAction"]>> } : {}),
    ...(controller.advanceCombat ? { advanceCombat: (ticks: number) => aroundMutation(() => controller.advanceCombat?.(ticks)) as ReturnType<NonNullable<PackagedFeatureRuntimeController["advanceCombat"]>> } : {}),
    ...(controller.finishCombat ? { finishCombat: () => aroundMutation(() => controller.finishCombat?.()) as ReturnType<NonNullable<PackagedFeatureRuntimeController["finishCombat"]>> } : {}),
  };

  return {
    ...controller,
    ...featureApi,
    setPointer: controller.setPointer,
    setPressed: controller.setPressed,
    activate: (position) => aroundMutation(() => controller.activate(position)),
    handleKey: (input) => aroundMutation(() => controller.handleKey(input)),
    createSaveGame: createControllerSave,
    restoreSaveGame: restoreControllerSave,
    audioState: () => audio,
    drainAudioCommands: () => {
      const drained = commands;
      commands = [];
      return drained;
    },
    completeAudioVoice: (voiceId) => {
      if (!mix || !audio) return;
      applyTransition(
        completeAudioVoice(mix, audio, voiceId, audio.tick),
      );
    },
    startNarrativeSequence,
    skipNarrativeSequence,
    activeBlockingSequenceId,
    createFrame: (tick) => {
      if (tick < synchronizedTick) {
        throw new RangeError(
          "Audio-aware player logical time cannot move backwards.",
        );
      }
      if (tick === synchronizedTick) {
        const frame = controller.createFrame(tick);
        processSceneAudioCues();
        clearTrackedNarrativeIfInactive();
        return frame;
      }
      let frame = controller.createFrame(synchronizedTick);
      for (let nextTick = synchronizedTick + 1; nextTick <= tick; nextTick += 1) {
        const before = controller.worldState();
        frame = controller.createFrame(nextTick);
        synchronizeWorld(before, controller.worldState());
        processSceneAudioCues();
        clearTrackedNarrativeIfInactive();
      }
      return frame;
    },
  };
};
