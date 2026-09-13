import type {
  AudioBusId,
  AudioMixManifest,
} from "@evavo/adventure-audio";
import {
  type ActiveAudioVoice,
  type AudioCommand,
  audioVoicePlaybackOffsetMilliseconds,
} from "@evavo/adventure-audio/runtime";
import type { RuntimeAssetRecord } from "@evavo/adventure-asset-contract";
import type { Id } from "@evavo/adventure-project-schema";
import {
  planRuntimeAudioAssets,
  type RuntimeAudioAssetRequest,
} from "./assets.js";

export interface WebAudioCommandPlayerOptions {
  readonly contextFactory?: () => AudioContext;
  readonly fetcher?: typeof fetch;
  readonly onVoiceEnded?: (voiceId: Id<"audio-voice">) => void;
}

interface PlayingWebAudioVoice {
  readonly voice: ActiveAudioVoice;
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
  stopped: boolean;
}

export class WebAudioUnavailableError extends Error {
  constructor() {
    super("The Web Audio API is not available in this browser.");
    this.name = "WebAudioUnavailableError";
  }
}

export class WebAudioAssetLoadError extends Error {
  readonly request: RuntimeAudioAssetRequest;

  constructor(request: RuntimeAudioAssetRequest, cause: unknown) {
    super(
      `Could not load audio asset '${request.assetId}' from '${request.url}'.`,
      { cause },
    );
    this.name = "WebAudioAssetLoadError";
    this.request = request;
  }
}

const defaultContextFactory = (): AudioContext => {
  if (typeof AudioContext === "undefined") {
    throw new WebAudioUnavailableError();
  }
  return new AudioContext({ latencyHint: "interactive" });
};

export const webAudioIsSupported = (): boolean =>
  typeof AudioContext !== "undefined";

const configuredBus = (
  manifest: AudioMixManifest,
  busId: AudioBusId,
) => {
  const bus = manifest.buses.find((candidate) => candidate.id === busId);
  if (!bus) throw new Error(`Audio bus '${busId}' is not configured.`);
  return bus;
};

const ticksToSeconds = (ticks: number, ticksPerSecond: number): number =>
  ticks / ticksPerSecond;

const commandIdentity = (command: AudioCommand): string =>
  command.kind === "play"
    ? command.voice.id
    : command.kind === "stop"
      ? command.voiceId
      : command.bus;

const sortCommands = (commands: readonly AudioCommand[]): AudioCommand[] =>
  [...commands].sort((left, right) => {
    const tickDifference = left.atTick - right.atTick;
    if (tickDifference !== 0) return tickDifference;
    const kindDifference = left.kind.localeCompare(right.kind);
    return kindDifference !== 0
      ? kindDifference
      : commandIdentity(left).localeCompare(commandIdentity(right));
  });

const assertLogicalTick = (tick: number): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError("Web Audio logical ticks must be non-negative integers.");
  }
};

const rampAudioParam = (
  parameter: AudioParam,
  value: number,
  startTime: number,
  durationSeconds: number,
): void => {
  parameter.cancelScheduledValues(startTime);
  parameter.setValueAtTime(parameter.value, startTime);
  if (durationSeconds > 0) {
    parameter.linearRampToValueAtTime(value, startTime + durationSeconds);
  } else {
    parameter.setValueAtTime(value, startTime);
  }
};

const normalizedPlaybackOffsetSeconds = (
  voice: ActiveAudioVoice,
  buffer: AudioBuffer,
): number | null => {
  if (buffer.duration <= 0) return null;
  const raw = voice.startOffsetMilliseconds / 1000;
  if (!voice.loop) {
    return raw >= buffer.duration
      ? null
      : Math.max(0, raw);
  }
  if (voice.loop.kind === "full") {
    return Math.max(0, raw % buffer.duration);
  }
  const loopStart = Math.min(
    buffer.duration,
    voice.loop.startMilliseconds / 1000,
  );
  const loopEnd = Math.min(
    buffer.duration,
    voice.loop.endMilliseconds / 1000,
  );
  const loopLength = loopEnd - loopStart;
  if (loopLength <= 0) return loopStart;
  if (raw < loopEnd) return Math.max(0, raw);
  return loopStart + ((raw - loopStart) % loopLength);
};

export class WebAudioCommandPlayer {
  private readonly manifest: AudioMixManifest;
  private readonly requests: readonly RuntimeAudioAssetRequest[];
  private readonly contextFactory: () => AudioContext;
  private readonly fetcher: typeof fetch;
  private readonly onVoiceEnded: ((voiceId: Id<"audio-voice">) => void) | null;
  private readonly buffers = new Map<string, AudioBuffer>();
  private readonly buses = new Map<AudioBusId, GainNode>();
  private readonly voices = new Map<string, PlayingWebAudioVoice>();
  private pending: AudioCommand[] = [];
  private context: AudioContext | null = null;
  private preloadPromise: Promise<void> | null = null;
  private unlocked = false;
  private disposed = false;
  private logicalTick = 0;
  private anchorTick = 0;
  private anchorTime = 0;

  constructor(
    manifest: AudioMixManifest,
    assets: readonly RuntimeAssetRecord[],
    bundleUrl: string,
    options: WebAudioCommandPlayerOptions = {},
  ) {
    this.manifest = manifest;
    this.requests = planRuntimeAudioAssets(assets, bundleUrl);
    this.contextFactory = options.contextFactory ?? defaultContextFactory;
    this.fetcher = options.fetcher ?? fetch;
    this.onVoiceEnded = options.onVoiceEnded ?? null;
  }

  preload(): Promise<void> {
    if (this.disposed) {
      return Promise.reject(new Error("Web Audio player is disposed."));
    }
    this.preloadPromise ??= this.loadAllBuffers();
    return this.preloadPromise;
  }

  async unlock(logicalTick: number): Promise<void> {
    this.synchronize(logicalTick);
    await this.preload();
    const context = this.requireContext();
    if (context.state === "suspended") await context.resume();
    if (context.state === "closed") {
      throw new Error("Web Audio context is closed.");
    }
    this.unlocked = true;
    this.anchorTick = logicalTick;
    this.anchorTime = context.currentTime;
    this.flushPending();
  }

  synchronize(logicalTick: number): void {
    assertLogicalTick(logicalTick);
    if (logicalTick < this.logicalTick) {
      this.reset(logicalTick);
      return;
    }
    this.logicalTick = logicalTick;
  }

  reset(logicalTick: number): void {
    assertLogicalTick(logicalTick);
    this.logicalTick = logicalTick;
    this.anchorTick = logicalTick;
    this.anchorTime = this.context?.currentTime ?? 0;
    this.pending = [];
    this.stopAllImmediately();
  }

  submit(
    commands: readonly AudioCommand[],
    logicalTick = this.logicalTick,
  ): void {
    this.synchronize(logicalTick);
    this.pending = sortCommands([...this.pending, ...commands]);
    if (this.unlocked) {
      void this.preload()
        .then(() => this.flushPending())
        .catch((error: unknown) => console.error(error));
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.pending = [];
    this.stopAllImmediately();
    const context = this.context;
    this.context = null;
    this.buses.clear();
    this.buffers.clear();
    if (context && context.state !== "closed") await context.close();
  }

  private async loadAllBuffers(): Promise<void> {
    const context = this.ensureContext();
    await Promise.all(
      this.requests.map(async (request) => {
        try {
          const response = await this.fetcher(request.url);
          if (!response.ok) {
            throw new Error(
              `HTTP ${response.status} ${response.statusText}`.trim(),
            );
          }
          const encoded = await response.arrayBuffer();
          const buffer = await context.decodeAudioData(encoded.slice(0));
          this.buffers.set(request.assetId, buffer);
        } catch (error) {
          throw new WebAudioAssetLoadError(request, error);
        }
      }),
    );
  }

  private ensureContext(): AudioContext {
    if (this.context) return this.context;
    const context = this.contextFactory();
    const master = context.createGain();
    const masterConfig = configuredBus(this.manifest, "master");
    master.gain.value = masterConfig.muted ? 0 : masterConfig.volume;
    master.connect(context.destination);
    this.buses.set("master", master);

    for (const busId of [
      "music",
      "speech",
      "ambience",
      "effects",
      "interface",
    ] as const) {
      const node = context.createGain();
      const configuration = configuredBus(this.manifest, busId);
      node.gain.value = configuration.muted ? 0 : configuration.volume;
      node.connect(master);
      this.buses.set(busId, node);
    }

    this.context = context;
    this.anchorTime = context.currentTime;
    return context;
  }

  private requireContext(): AudioContext {
    const context = this.context;
    if (!context) throw new Error("Web Audio context is not initialized.");
    return context;
  }

  private audioTimeForTick(tick: number): number {
    const context = this.requireContext();
    const scheduled =
      this.anchorTime +
      ticksToSeconds(
        tick - this.anchorTick,
        this.manifest.logicalTicksPerSecond,
      );
    return Math.max(context.currentTime, scheduled);
  }

  private flushPending(): void {
    if (!this.unlocked || this.pending.length === 0) return;
    const commands = this.pending;
    this.pending = [];
    for (const command of commands) this.execute(command);
  }

  private execute(command: AudioCommand): void {
    switch (command.kind) {
      case "play":
        this.play(command);
        return;
      case "stop":
        this.stop(command);
        return;
      case "set-bus":
        this.setBus(command);
        return;
    }
  }

  private play(command: Extract<AudioCommand, { readonly kind: "play" }>): void {
    const context = this.requireContext();
    const buffer = this.buffers.get(command.voice.assetId);
    if (!buffer) {
      throw new Error(
        `Decoded audio buffer '${command.voice.assetId}' is unavailable.`,
      );
    }

    const existing = this.voices.get(command.voice.id);
    if (existing) this.stopVoiceImmediately(existing);

    const late = this.logicalTick > command.voice.startedAtTick;
    const voice = late
      ? {
          ...command.voice,
          startedAtTick: this.logicalTick,
          startOffsetMilliseconds: audioVoicePlaybackOffsetMilliseconds(
            this.manifest,
            command.voice,
            this.logicalTick,
          ),
        }
      : command.voice;
    const offset = normalizedPlaybackOffsetSeconds(voice, buffer);
    if (offset === null) {
      this.onVoiceEnded?.(voice.id);
      return;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    if (voice.loop) {
      source.loop = true;
      if (voice.loop.kind === "region") {
        source.loopStart = voice.loop.startMilliseconds / 1000;
        source.loopEnd = voice.loop.endMilliseconds / 1000;
      }
    }
    const gain = context.createGain();
    const bus = this.buses.get(voice.bus);
    if (!bus) throw new Error(`Web Audio bus '${voice.bus}' is unavailable.`);
    source.connect(gain);
    gain.connect(bus);

    const when = late
      ? context.currentTime
      : this.audioTimeForTick(command.atTick);
    const fadeSeconds = ticksToSeconds(
      command.fadeInTicks,
      this.manifest.logicalTicksPerSecond,
    );
    gain.gain.setValueAtTime(fadeSeconds > 0 ? 0 : voice.volume, when);
    if (fadeSeconds > 0) {
      gain.gain.linearRampToValueAtTime(
        voice.volume,
        when + fadeSeconds,
      );
    }

    const playing: PlayingWebAudioVoice = {
      voice,
      source,
      gain,
      stopped: false,
    };
    source.onended = () => {
      if (this.voices.get(voice.id) === playing) {
        this.voices.delete(voice.id);
      }
      source.disconnect();
      gain.disconnect();
      if (!playing.stopped && !voice.loop) {
        this.onVoiceEnded?.(voice.id);
      }
    };
    this.voices.set(voice.id, playing);
    source.start(when, offset);
  }

  private stop(command: Extract<AudioCommand, { readonly kind: "stop" }>): void {
    const playing = this.voices.get(command.voiceId);
    if (!playing) return;
    const when = this.audioTimeForTick(command.atTick);
    const fadeSeconds = ticksToSeconds(
      command.fadeOutTicks,
      this.manifest.logicalTicksPerSecond,
    );
    playing.stopped = true;
    rampAudioParam(playing.gain.gain, 0, when, fadeSeconds);
    try {
      playing.source.stop(when + fadeSeconds);
    } catch {
      this.stopVoiceImmediately(playing);
    }
  }

  private setBus(
    command: Extract<AudioCommand, { readonly kind: "set-bus" }>,
  ): void {
    const bus = this.buses.get(command.bus);
    if (!bus) throw new Error(`Web Audio bus '${command.bus}' is unavailable.`);
    const when = this.audioTimeForTick(command.atTick);
    rampAudioParam(
      bus.gain,
      command.effectiveVolume,
      when,
      ticksToSeconds(
        command.fadeTicks,
        this.manifest.logicalTicksPerSecond,
      ),
    );
  }

  private stopVoiceImmediately(playing: PlayingWebAudioVoice): void {
    playing.stopped = true;
    try {
      playing.source.stop();
    } catch {
      playing.source.disconnect();
      playing.gain.disconnect();
    }
    this.voices.delete(playing.voice.id);
  }

  private stopAllImmediately(): void {
    for (const playing of this.voices.values()) {
      this.stopVoiceImmediately(playing);
    }
    this.voices.clear();
  }
}

export * from "./assets.js";
