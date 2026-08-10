import type {
  Condition,
  Id,
  SequenceCue,
} from "@evavo/adventure-project-schema";
import {
  type AudioBusId,
  audioBusIds,
  type AudioContentBusId,
  type AudioCue,
  type AudioLoop,
  type AudioMixManifest,
  type AudioSceneLayer,
} from "./index.js";

export interface AudioBusRuntimeState {
  readonly volume: number;
  readonly muted: boolean;
}

export type AudioVoiceLoop =
  | { readonly kind: "full" }
  | ({ readonly kind: "region" } & AudioLoop)
  | null;

export type AudioVoiceOwner =
  | { readonly kind: "cue" }
  | {
      readonly kind: "scene-layer";
      readonly sceneId: Id<"scene">;
      readonly layerId: Id<"audio-scene-layer">;
      readonly restartPolicy: AudioSceneLayer["restartPolicy"];
      readonly fadeOutTicks: number;
    }
  | { readonly kind: "sequence"; readonly key: string };

export interface ActiveAudioVoice {
  readonly id: Id<"audio-voice">;
  readonly cueId: Id<"audio-cue"> | null;
  readonly assetId: Id<"asset">;
  readonly bus: AudioContentBusId;
  readonly volume: number;
  readonly priority: number;
  readonly startedAtTick: number;
  readonly startOffsetMilliseconds: number;
  readonly loop: AudioVoiceLoop;
  readonly interruptGroup: string | null;
  readonly owner: AudioVoiceOwner;
}

export interface AudioRuntimeState {
  readonly stateVersion: 1;
  readonly projectId: Id<"project">;
  readonly tick: number;
  readonly sceneId: Id<"scene">;
  readonly buses: Readonly<Record<AudioBusId, AudioBusRuntimeState>>;
  readonly voices: readonly ActiveAudioVoice[];
  readonly resumeOffsetsMilliseconds: Readonly<Record<string, number>>;
  readonly nextVoiceSerial: number;
}

export type AudioCommand =
  | {
      readonly kind: "play";
      readonly atTick: number;
      readonly fadeInTicks: number;
      readonly voice: ActiveAudioVoice;
    }
  | {
      readonly kind: "stop";
      readonly atTick: number;
      readonly voiceId: Id<"audio-voice">;
      readonly fadeOutTicks: number;
    }
  | {
      readonly kind: "set-bus";
      readonly atTick: number;
      readonly bus: AudioBusId;
      readonly effectiveVolume: number;
      readonly fadeTicks: number;
    };

export interface AudioRuntimeTransition {
  readonly state: AudioRuntimeState;
  readonly commands: readonly AudioCommand[];
}

export type AudioConditionEvaluator = (condition: Condition) => boolean;

const voiceId = (value: string): Id<"audio-voice"> =>
  value as Id<"audio-voice">;

const assertTick = (tick: number, currentTick: number): void => {
  if (!Number.isSafeInteger(tick) || tick < currentTick) {
    throw new RangeError(
      `Audio tick ${tick} must be a safe integer at or after ${currentTick}.`,
    );
  }
};

const ticksToMilliseconds = (
  ticks: number,
  ticksPerSecond: number,
): number => (ticks * 1000) / ticksPerSecond;

const cueMap = (
  manifest: AudioMixManifest,
): ReadonlyMap<string, AudioCue> =>
  new Map(manifest.cues.map((cue) => [cue.id as string, cue] as const));

const configuredBus = (
  manifest: AudioMixManifest,
  bus: AudioBusId,
) => {
  const configured = manifest.buses.find((candidate) => candidate.id === bus);
  if (!configured) {
    throw new Error(`Audio bus '${bus}' is not configured.`);
  }
  return configured;
};

const cueForId = (
  manifest: AudioMixManifest,
  cueId: Id<"audio-cue">,
): AudioCue => {
  const cue = manifest.cues.find((candidate) => candidate.id === cueId);
  if (!cue) {
    throw new Error(`Audio cue '${cueId}' does not exist.`);
  }
  return cue;
};

const loopForCue = (cue: AudioCue): AudioVoiceLoop =>
  cue.loop ? { kind: "region", ...cue.loop } : null;

const activeAtTick = (voice: ActiveAudioVoice, tick: number): boolean =>
  voice.startedAtTick <= tick;

const effectiveBusVolume = (
  manifest: AudioMixManifest,
  state: AudioRuntimeState,
  bus: AudioBusId,
): number => {
  const runtime = state.buses[bus];
  if (runtime.muted) return 0;
  if (bus === "master") return runtime.volume;

  let duckingMultiplier = 1;
  for (const rule of manifest.ducking) {
    if (rule.targetBus !== bus) continue;
    const sourceIsActive = state.voices.some(
      (voice) =>
        voice.bus === rule.sourceBus && activeAtTick(voice, state.tick),
    );
    if (sourceIsActive) {
      duckingMultiplier = Math.min(
        duckingMultiplier,
        rule.targetVolume,
      );
    }
  }
  return runtime.volume * duckingMultiplier;
};

const duckingFadeTicks = (
  manifest: AudioMixManifest,
  before: AudioRuntimeState,
  after: AudioRuntimeState,
  bus: AudioBusId,
): number => {
  if (bus === "master") return 0;
  const beforeSources = new Set(
    before.voices
      .filter((voice) => activeAtTick(voice, before.tick))
      .map((voice) => voice.bus),
  );
  const afterSources = new Set(
    after.voices
      .filter((voice) => activeAtTick(voice, after.tick))
      .map((voice) => voice.bus),
  );
  let fadeTicks = 0;
  for (const rule of manifest.ducking) {
    if (rule.targetBus !== bus) continue;
    const wasActive = beforeSources.has(rule.sourceBus);
    const isActive = afterSources.has(rule.sourceBus);
    if (!wasActive && isActive) {
      fadeTicks = Math.max(fadeTicks, rule.attackTicks);
    } else if (wasActive && !isActive) {
      fadeTicks = Math.max(fadeTicks, rule.releaseTicks);
    }
  }
  return fadeTicks;
};

const appendChangedBusCommands = (
  manifest: AudioMixManifest,
  before: AudioRuntimeState,
  after: AudioRuntimeState,
  commands: AudioCommand[],
): void => {
  for (const bus of audioBusIds) {
    const beforeVolume = effectiveBusVolume(manifest, before, bus);
    const afterVolume = effectiveBusVolume(manifest, after, bus);
    if (Math.abs(beforeVolume - afterVolume) <= Number.EPSILON) continue;
    commands.push({
      kind: "set-bus",
      atTick: after.tick,
      bus,
      effectiveVolume: afterVolume,
      fadeTicks: duckingFadeTicks(manifest, before, after, bus),
    });
  }
};

const transitionWithDucking = (
  manifest: AudioMixManifest,
  before: AudioRuntimeState,
  after: AudioRuntimeState,
  commands: AudioCommand[],
): AudioRuntimeTransition => {
  appendChangedBusCommands(manifest, before, after, commands);
  return {
    state: after,
    commands: commands.sort((left, right) => {
      const tickDifference = left.atTick - right.atTick;
      if (tickDifference !== 0) return tickDifference;
      const kindDifference = left.kind.localeCompare(right.kind);
      if (kindDifference !== 0) return kindDifference;
      const leftId =
        left.kind === "play"
          ? left.voice.id
          : left.kind === "stop"
            ? left.voiceId
            : left.bus;
      const rightId =
        right.kind === "play"
          ? right.voice.id
          : right.kind === "stop"
            ? right.voiceId
            : right.bus;
      return leftId.localeCompare(rightId);
    }),
  };
};

export const createInitialAudioRuntimeState = (
  manifest: AudioMixManifest,
  sceneId: Id<"scene">,
): AudioRuntimeState => {
  const buses = Object.fromEntries(
    audioBusIds.map((bus) => {
      const configured = configuredBus(manifest, bus);
      return [
        bus,
        { volume: configured.volume, muted: configured.muted },
      ];
    }),
  ) as Record<AudioBusId, AudioBusRuntimeState>;

  return {
    stateVersion: 1,
    projectId: manifest.projectId,
    tick: 0,
    sceneId,
    buses,
    voices: [],
    resumeOffsetsMilliseconds: {},
    nextVoiceSerial: 0,
  };
};

export const audioVoicePlaybackOffsetMilliseconds = (
  manifest: AudioMixManifest,
  voice: ActiveAudioVoice,
  tick: number,
): number => {
  assertTick(tick, voice.startedAtTick);
  const elapsed = ticksToMilliseconds(
    tick - voice.startedAtTick,
    manifest.logicalTicksPerSecond,
  );
  const rawOffset = voice.startOffsetMilliseconds + elapsed;
  if (!voice.loop || voice.loop.kind === "full") return rawOffset;
  if (rawOffset < voice.loop.endMilliseconds) return rawOffset;
  const loopLength =
    voice.loop.endMilliseconds - voice.loop.startMilliseconds;
  if (loopLength <= 0) return voice.loop.startMilliseconds;
  return (
    voice.loop.startMilliseconds +
    ((rawOffset - voice.loop.startMilliseconds) % loopLength)
  );
};

const voiceStealOrder = (
  manifest: AudioMixManifest,
  bus: AudioContentBusId,
) => {
  const policy = configuredBus(manifest, bus).stealPolicy;
  return (left: ActiveAudioVoice, right: ActiveAudioVoice): number => {
    if (policy === "quietest" && left.volume !== right.volume) {
      return left.volume - right.volume;
    }
    if (policy === "lowest-priority" && left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    if (left.startedAtTick !== right.startedAtTick) {
      return left.startedAtTick - right.startedAtTick;
    }
    return left.id.localeCompare(right.id);
  };
};

const removeVoices = (
  voices: readonly ActiveAudioVoice[],
  ids: ReadonlySet<string>,
): readonly ActiveAudioVoice[] =>
  voices.filter((voice) => !ids.has(voice.id));

const stopCommandsFor = (
  voices: readonly ActiveAudioVoice[],
  atTick: number,
  fadeOutTicks: number,
): AudioCommand[] =>
  [...voices]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((voice) => ({
      kind: "stop" as const,
      atTick,
      voiceId: voice.id,
      fadeOutTicks,
    }));

const enforceVoiceLimits = (
  manifest: AudioMixManifest,
  voices: readonly ActiveAudioVoice[],
  protectedVoiceId: Id<"audio-voice">,
): readonly ActiveAudioVoice[] => {
  const protectedVoice = voices.find(
    (voice) => voice.id === protectedVoiceId,
  );
  if (!protectedVoice) return [];
  const configured = configuredBus(manifest, protectedVoice.bus);
  const busVoices = voices.filter(
    (voice) => voice.bus === protectedVoice.bus,
  );
  const excess = Math.max(0, busVoices.length - configured.maxVoices);
  if (excess === 0) return [];
  return [...busVoices]
    .filter((voice) => voice.id !== protectedVoiceId)
    .sort(voiceStealOrder(manifest, protectedVoice.bus))
    .slice(0, excess);
};

const createCueVoice = (
  cue: AudioCue,
  id: Id<"audio-voice">,
  atTick: number,
  offsetMilliseconds: number,
  owner: AudioVoiceOwner,
): ActiveAudioVoice => ({
  id,
  cueId: cue.id,
  assetId: cue.assetId,
  bus: cue.bus,
  volume: cue.volume,
  priority: cue.priority,
  startedAtTick: atTick,
  startOffsetMilliseconds: offsetMilliseconds,
  loop: loopForCue(cue),
  interruptGroup: cue.interruptGroup,
  owner,
});

export const triggerAudioCue = (
  manifest: AudioMixManifest,
  state: AudioRuntimeState,
  cueId: Id<"audio-cue">,
  atTick: number,
): AudioRuntimeTransition => {
  assertTick(atTick, state.tick);
  const cue = cueForId(manifest, cueId);
  let voices = [...state.voices];
  const commands: AudioCommand[] = [];
  const matching = voices.filter((voice) => voice.cueId === cue.id);

  if (cue.polyphony === "ignore" && matching.length > 0) {
    return {
      state: { ...state, tick: atTick },
      commands: [],
    };
  }
  if (cue.polyphony === "restart" && matching.length > 0) {
    commands.push(...stopCommandsFor(matching, atTick, cue.fadeOutTicks));
    voices = [...removeVoices(voices, new Set(matching.map((voice) => voice.id)))];
  }
  if (cue.polyphony === "overlap" && matching.length >= cue.maxInstances) {
    const toSteal = [...matching]
      .sort(voiceStealOrder(manifest, cue.bus))
      .slice(0, matching.length - cue.maxInstances + 1);
    commands.push(...stopCommandsFor(toSteal, atTick, cue.fadeOutTicks));
    voices = [...removeVoices(voices, new Set(toSteal.map((voice) => voice.id)))];
  }

  const nextSerial = state.nextVoiceSerial + 1;
  const newVoice = createCueVoice(
    cue,
    voiceId(`audio-voice.cue.${cue.id}.${nextSerial}`),
    atTick,
    cue.startOffsetMilliseconds,
    { kind: "cue" },
  );
  voices.push(newVoice);

  const busSteals = enforceVoiceLimits(manifest, voices, newVoice.id);
  if (busSteals.length > 0) {
    commands.push(...stopCommandsFor(busSteals, atTick, cue.fadeOutTicks));
    voices = [
      ...removeVoices(voices, new Set(busSteals.map((voice) => voice.id))),
    ];
  }
  commands.push({
    kind: "play",
    atTick,
    fadeInTicks: cue.fadeInTicks,
    voice: newVoice,
  });

  const after: AudioRuntimeState = {
    ...state,
    tick: atTick,
    voices,
    nextVoiceSerial: nextSerial,
  };
  return transitionWithDucking(manifest, state, after, commands);
};

export const stopAudioBus = (
  manifest: AudioMixManifest,
  state: AudioRuntimeState,
  bus: AudioContentBusId,
  atTick: number,
  fadeOutTicks = 0,
): AudioRuntimeTransition => {
  assertTick(atTick, state.tick);
  const stopped = state.voices.filter((voice) => voice.bus === bus);
  const after: AudioRuntimeState = {
    ...state,
    tick: atTick,
    voices: state.voices.filter((voice) => voice.bus !== bus),
  };
  return transitionWithDucking(
    manifest,
    state,
    after,
    stopCommandsFor(stopped, atTick, fadeOutTicks),
  );
};

export const setAudioBusRuntimeState = (
  manifest: AudioMixManifest,
  state: AudioRuntimeState,
  bus: AudioBusId,
  value: AudioBusRuntimeState,
  atTick: number,
  fadeTicks = 0,
): AudioRuntimeTransition => {
  assertTick(atTick, state.tick);
  if (
    !Number.isFinite(value.volume) ||
    value.volume < 0 ||
    value.volume > 1
  ) {
    throw new RangeError("Audio bus volume must be between 0 and 1.");
  }
  const after: AudioRuntimeState = {
    ...state,
    tick: atTick,
    buses: {
      ...state.buses,
      [bus]: { volume: value.volume, muted: value.muted },
    },
  };
  const commands: AudioCommand[] = [
    {
      kind: "set-bus",
      atTick,
      bus,
      effectiveVolume: effectiveBusVolume(manifest, after, bus),
      fadeTicks,
    },
  ];
  if (bus === "master") {
    return { state: after, commands };
  }
  return transitionWithDucking(manifest, state, after, []);
};

const desiredSceneLayers = (
  manifest: AudioMixManifest,
  sceneId: Id<"scene">,
  evaluate: AudioConditionEvaluator,
): readonly AudioSceneLayer[] =>
  [...(
    manifest.soundscapes.find(
      (soundscape) => soundscape.sceneId === sceneId,
    )?.layers ?? []
  )]
    .filter((layer) => !layer.when || evaluate(layer.when))
    .sort((left, right) => left.id.localeCompare(right.id));

export const enterAudioScene = (
  manifest: AudioMixManifest,
  state: AudioRuntimeState,
  sceneId: Id<"scene">,
  atTick: number,
  evaluate: AudioConditionEvaluator = () => true,
): AudioRuntimeTransition => {
  assertTick(atTick, state.tick);
  const desired = desiredSceneLayers(manifest, sceneId, evaluate);
  const existingSceneVoices = state.voices.filter(
    (voice) => voice.owner.kind === "scene-layer",
  );
  const retained = new Set<string>();
  const startedLayers = new Set<string>();
  const resumeOffsets = { ...state.resumeOffsetsMilliseconds };
  let voices = [...state.voices];
  const commands: AudioCommand[] = [];

  for (const layer of desired) {
    if (layer.restartPolicy !== "continue") continue;
    const reusable = existingSceneVoices
      .filter(
        (voice) =>
          voice.cueId === layer.cueId && !retained.has(voice.id),
      )
      .sort((left, right) => left.id.localeCompare(right.id))[0];
    if (!reusable) continue;
    retained.add(reusable.id);
    startedLayers.add(layer.id);
    voices = voices.map((voice) =>
      voice.id === reusable.id
        ? {
            ...voice,
            owner: {
              kind: "scene-layer",
              sceneId,
              layerId: layer.id,
              restartPolicy: layer.restartPolicy,
              fadeOutTicks: layer.fadeOutTicks,
            },
          }
        : voice,
    );
  }

  const stopped = existingSceneVoices.filter(
    (voice) => !retained.has(voice.id),
  );
  for (const voice of stopped) {
    if (
      voice.owner.kind === "scene-layer" &&
      voice.owner.restartPolicy === "resume" &&
      voice.cueId
    ) {
      resumeOffsets[voice.cueId] =
        audioVoicePlaybackOffsetMilliseconds(manifest, voice, atTick);
    }
  }
  commands.push(
    ...stopped
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((voice) => ({
        kind: "stop" as const,
        atTick,
        voiceId: voice.id,
        fadeOutTicks:
          voice.owner.kind === "scene-layer"
            ? voice.owner.fadeOutTicks
            : 0,
      })),
  );
  voices = [
    ...removeVoices(voices, new Set(stopped.map((voice) => voice.id))),
  ];

  for (const layer of desired) {
    if (startedLayers.has(layer.id)) continue;
    const cue = cueForId(manifest, layer.cueId);
    const scheduledTick = atTick + layer.startDelayTicks;
    const offset =
      layer.restartPolicy === "resume"
        ? (resumeOffsets[cue.id] ?? cue.startOffsetMilliseconds)
        : cue.startOffsetMilliseconds;
    const voice = createCueVoice(
      cue,
      voiceId(`audio-voice.scene.${sceneId}.${layer.id}`),
      scheduledTick,
      offset,
      {
        kind: "scene-layer",
        sceneId,
        layerId: layer.id,
        restartPolicy: layer.restartPolicy,
        fadeOutTicks: layer.fadeOutTicks,
      },
    );
    voices.push(voice);
    commands.push({
      kind: "play",
      atTick: scheduledTick,
      fadeInTicks: Math.max(cue.fadeInTicks, layer.fadeInTicks),
      voice,
    });
  }

  const after: AudioRuntimeState = {
    ...state,
    tick: atTick,
    sceneId,
    voices,
    resumeOffsetsMilliseconds: resumeOffsets,
  };
  return transitionWithDucking(manifest, state, after, commands);
};

export const advanceAudioRuntimeState = (
  manifest: AudioMixManifest,
  state: AudioRuntimeState,
  tick: number,
): AudioRuntimeTransition => {
  assertTick(tick, state.tick);
  const after = { ...state, tick };
  return transitionWithDucking(manifest, state, after, []);
};

export const completeAudioVoice = (
  manifest: AudioMixManifest,
  state: AudioRuntimeState,
  voice: Id<"audio-voice">,
  atTick: number,
): AudioRuntimeTransition => {
  assertTick(atTick, state.tick);
  if (!state.voices.some((candidate) => candidate.id === voice)) {
    return { state: { ...state, tick: atTick }, commands: [] };
  }
  const after: AudioRuntimeState = {
    ...state,
    tick: atTick,
    voices: state.voices.filter((candidate) => candidate.id !== voice),
  };
  return transitionWithDucking(manifest, state, after, []);
};

const triggerInlineSequenceSound = (
  manifest: AudioMixManifest,
  state: AudioRuntimeState,
  cue: Extract<SequenceCue, { readonly kind: "sound" }>,
  key: string,
): AudioRuntimeTransition => {
  assertTick(cue.atTick, state.tick);
  const serial = state.nextVoiceSerial + 1;
  const voice: ActiveAudioVoice = {
    id: voiceId(`audio-voice.sequence.${key}.${serial}`),
    cueId: null,
    assetId: cue.assetId,
    bus: cue.bus,
    volume: cue.volume,
    priority: 0,
    startedAtTick: cue.atTick,
    startOffsetMilliseconds: 0,
    loop: cue.loop ? { kind: "full" } : null,
    interruptGroup: null,
    owner: { kind: "sequence", key },
  };
  const after: AudioRuntimeState = {
    ...state,
    tick: cue.atTick,
    voices: [...state.voices, voice],
    nextVoiceSerial: serial,
  };
  return transitionWithDucking(manifest, state, after, [
    { kind: "play", atTick: cue.atTick, fadeInTicks: 0, voice },
  ]);
};

export const applySequenceAudioCue = (
  manifest: AudioMixManifest,
  state: AudioRuntimeState,
  cue: SequenceCue,
  key: string,
): AudioRuntimeTransition => {
  if (cue.kind === "sound") {
    const configured = cueMap(manifest);
    const matching = [...configured.values()]
      .filter(
        (candidate) =>
          candidate.assetId === cue.assetId &&
          candidate.bus === cue.bus &&
          candidate.volume === cue.volume &&
          Boolean(candidate.loop) === cue.loop,
      )
      .sort((left, right) => left.id.localeCompare(right.id))[0];
    return matching
      ? triggerAudioCue(manifest, state, matching.id, cue.atTick)
      : triggerInlineSequenceSound(manifest, state, cue, key);
  }
  if (cue.kind === "stop-audio") {
    return stopAudioBus(
      manifest,
      state,
      cue.bus,
      cue.atTick,
      cue.fadeTicks,
    );
  }
  return { state, commands: [] };
};

export const restoreAudioRuntimeCommands = (
  manifest: AudioMixManifest,
  state: AudioRuntimeState,
  atTick: number,
): readonly AudioCommand[] => {
  assertTick(atTick, state.tick);
  const restored = { ...state, tick: atTick };
  const commands: AudioCommand[] = audioBusIds.map((bus) => ({
    kind: "set-bus" as const,
    atTick,
    bus,
    effectiveVolume: effectiveBusVolume(manifest, restored, bus),
    fadeTicks: 0,
  }));
  for (const voice of [...state.voices].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    commands.push({
      kind: "play",
      atTick,
      fadeInTicks: 0,
      voice: {
        ...voice,
        startedAtTick: atTick,
        startOffsetMilliseconds:
          audioVoicePlaybackOffsetMilliseconds(manifest, voice, atTick),
      },
    });
  }
  return commands;
};
