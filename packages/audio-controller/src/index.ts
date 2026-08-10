import { evaluateCondition } from "@evavo/adventure-core";
import type {
  Id,
  Sequence,
  SequenceCue,
} from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  createPackagedRuntimeController,
  type PackagedRuntimeController,
  type PackagedRuntimeControllerOptions,
} from "@evavo/adventure-runtime-controller";
import {
  createSaveGame as createRuntimeSaveGame,
  loadSaveGame as loadRuntimeSaveGame,
  type SaveGame,
} from "@evavo/adventure-save-game";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
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

export interface AudioPackagedRuntimeController
  extends PackagedRuntimeController {
  audioState(): AudioRuntimeState | null;
  drainAudioCommands(): readonly AudioCommand[];
  completeAudioVoice(voiceId: Id<"audio-voice">): void;
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

export const createAudioPackagedRuntimeController = (
  bundle: RuntimeBundle,
  options: PackagedRuntimeControllerOptions = {},
): AudioPackagedRuntimeController => {
  const controller = createPackagedRuntimeController(bundle, options);
  const mix = bundle.audioMix ?? null;
  let commands: AudioCommand[] = [];
  let audio: AudioRuntimeState | null = null;
  let synchronizedTick = controller.worldState().story.tick;
  let activeDialogueKey = dialogueKey(controller.worldState());

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
    return result;
  };

  const createControllerSave = (): SaveGame => {
    const interfaceSave = controller.createSaveGame();
    return createRuntimeSaveGame(bundle, controller.worldState(), {
      ...interfaceSave.interface,
      ...(audio ? { audio } : {}),
    });
  };

  const restoreControllerSave = (input: unknown): number => {
    const save = loadRuntimeSaveGame(bundle, input);
    const oldVoices = audio?.voices ?? [];
    const restoredTick = controller.restoreSaveGame(save);
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
    return restoredTick;
  };

  return {
    selection: controller.selection,
    controlledActorInstanceId: controller.controlledActorInstanceId,
    setPointer: controller.setPointer,
    setPressed: controller.setPressed,
    activate: (position) => aroundMutation(() => controller.activate(position)),
    handleKey: (input) =>
      aroundMutation(() => controller.handleKey(input)),
    createSaveGame: createControllerSave,
    restoreSaveGame: restoreControllerSave,
    statusText: controller.statusText,
    worldState: controller.worldState,
    cameraState: controller.cameraState,
    parserState: controller.parserState,
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
    createFrame: (tick) => {
      if (tick < synchronizedTick) {
        throw new RangeError(
          "Audio-aware player logical time cannot move backwards.",
        );
      }
      if (tick === synchronizedTick) {
        return controller.createFrame(tick);
      }

      let frame = controller.createFrame(synchronizedTick);
      for (
        let nextTick = synchronizedTick + 1;
        nextTick <= tick;
        nextTick += 1
      ) {
        const previous = controller.worldState();
        frame = controller.createFrame(nextTick);
        synchronizeWorld(previous, controller.worldState());
      }
      return frame;
    },
  };
};
