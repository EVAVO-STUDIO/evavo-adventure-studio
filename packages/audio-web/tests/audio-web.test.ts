import { audioMixManifestSchema } from "@evavo/adventure-audio";
import type { AudioCommand } from "@evavo/adventure-audio/runtime";
import type { RuntimeAssetRecord } from "@evavo/adventure-asset-contract";
import type { Id } from "@evavo/adventure-project-schema";
import { describe, expect, it } from "vitest";
import {
  planRuntimeAudioAssets,
  RuntimeAudioAssetOutputError,
  WebAudioCommandPlayer,
} from "../src/index.js";

const hash = "0".repeat(64);
const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const audioAsset: RuntimeAssetRecord = {
  assetId: id<"asset">("asset.rain"),
  kind: "audio",
  outputFiles: [
    {
      role: "primary",
      runtimePath: "assets/audio/rain.ogg",
      mediaType: "audio/ogg",
      sha256: hash,
      byteLength: 100,
    },
  ],
  metadata: {
    kind: "audio",
    durationMilliseconds: 10_000,
    channels: 2,
    sampleRate: 44_100,
  },
};

const mix = audioMixManifestSchema.parse({
  manifestVersion: 1,
  projectId: "project.audio-web",
  logicalTicksPerSecond: 60,
  buses: [
    ["master", 1, 128],
    ["music", 0.8, 4],
    ["speech", 1, 4],
    ["ambience", 0.7, 16],
    ["effects", 0.9, 32],
    ["interface", 0.8, 8],
  ].map(([busId, volume, maxVoices]) => ({
    id: busId,
    volume,
    muted: false,
    maxVoices,
    stealPolicy: "lowest-priority",
  })),
  ducking: [],
  cues: [],
  soundscapes: [],
  speechBindings: [],
});

class FakeAudioParam {
  value = 1;
  readonly events: string[] = [];

  cancelScheduledValues(time: number): void {
    this.events.push(`cancel:${time}`);
  }

  setValueAtTime(value: number, time: number): void {
    this.value = value;
    this.events.push(`set:${value}:${time}`);
  }

  linearRampToValueAtTime(value: number, time: number): void {
    this.value = value;
    this.events.push(`ramp:${value}:${time}`);
  }
}

class FakeGainNode {
  readonly gain = new FakeAudioParam();
  readonly connections: unknown[] = [];

  connect(node: unknown): unknown {
    this.connections.push(node);
    return node;
  }

  disconnect(): void {}
}

class FakeBufferSource {
  buffer: AudioBuffer | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  onended: (() => void) | null = null;
  readonly starts: readonly [number, number][] = [];
  readonly stops: number[] = [];
  readonly connections: unknown[] = [];

  connect(node: unknown): unknown {
    this.connections.push(node);
    return node;
  }

  disconnect(): void {}

  start(when = 0, offset = 0): void {
    (this.starts as [number, number][]).push([when, offset]);
  }

  stop(when = 0): void {
    this.stops.push(when);
  }
}

class FakeAudioContext {
  currentTime = 5;
  state: AudioContextState = "suspended";
  readonly destination = {};
  readonly gains: FakeGainNode[] = [];
  readonly sources: FakeBufferSource[] = [];

  createGain(): GainNode {
    const node = new FakeGainNode();
    this.gains.push(node);
    return node as unknown as GainNode;
  }

  createBufferSource(): AudioBufferSourceNode {
    const source = new FakeBufferSource();
    this.sources.push(source);
    return source as unknown as AudioBufferSourceNode;
  }

  async decodeAudioData(): Promise<AudioBuffer> {
    return { duration: 10 } as AudioBuffer;
  }

  async resume(): Promise<void> {
    this.state = "running";
  }

  async close(): Promise<void> {
    this.state = "closed";
  }
}

const playCommand = (atTick = 0): AudioCommand => ({
  kind: "play",
  atTick,
  fadeInTicks: 12,
  voice: {
    id: id<"audio-voice">("audio-voice.rain"),
    cueId: null,
    assetId: id<"asset">("asset.rain"),
    bus: "ambience",
    volume: 0.75,
    priority: 0,
    startedAtTick: atTick,
    startOffsetMilliseconds: 0,
    loop: null,
    interruptGroup: null,
    owner: { kind: "cue" },
  },
});

const fetcher = async (): Promise<Response> =>
  ({
    ok: true,
    status: 200,
    statusText: "OK",
    arrayBuffer: async () => new ArrayBuffer(8),
  }) as Response;

describe("runtime audio asset planning", () => {
  it("resolves primary audio outputs relative to the runtime bundle", () => {
    expect(
      planRuntimeAudioAssets(
        [audioAsset],
        "https://example.test/release/game.bundle.json",
      ),
    ).toEqual([
      {
        assetId: "asset.rain",
        runtimePath: "assets/audio/rain.ogg",
        url: "https://example.test/release/assets/audio/rain.ogg",
        mediaType: "audio/ogg",
      },
    ]);
  });

  it("rejects missing and non-audio primary outputs", () => {
    expect(() =>
      planRuntimeAudioAssets(
        [{ ...audioAsset, outputFiles: [] }],
        "https://example.test/game.bundle.json",
      ),
    ).toThrow(RuntimeAudioAssetOutputError);
    expect(() =>
      planRuntimeAudioAssets(
        [
          {
            ...audioAsset,
            outputFiles: [
              {
                ...audioAsset.outputFiles[0]!,
                mediaType: "application/octet-stream",
              },
            ],
          },
        ],
        "https://example.test/game.bundle.json",
      ),
    ).toThrow(RuntimeAudioAssetOutputError);
  });
});

describe("Web Audio command player", () => {
  it("queues commands until autoplay unlock and seeks late playback", async () => {
    const context = new FakeAudioContext();
    const ended: string[] = [];
    const player = new WebAudioCommandPlayer(
      mix,
      [audioAsset],
      "https://example.test/game.bundle.json",
      {
        contextFactory: () => context as unknown as AudioContext,
        fetcher,
        onVoiceEnded: (voiceId) => ended.push(voiceId),
      },
    );

    player.submit([playCommand(0)], 0);
    expect(context.sources).toHaveLength(0);
    await player.unlock(60);

    expect(context.sources).toHaveLength(1);
    expect(context.sources[0]?.starts).toEqual([[5, 1]]);
    context.sources[0]?.onended?.();
    expect(ended).toEqual(["audio-voice.rain"]);
    await player.dispose();
    expect(context.state).toBe("closed");
  });

  it("applies bus fades and scheduled voice stops", async () => {
    const context = new FakeAudioContext();
    const player = new WebAudioCommandPlayer(
      mix,
      [audioAsset],
      "https://example.test/game.bundle.json",
      {
        contextFactory: () => context as unknown as AudioContext,
        fetcher,
      },
    );
    await player.unlock(0);
    player.submit(
      [
        playCommand(0),
        {
          kind: "set-bus",
          atTick: 30,
          bus: "music",
          effectiveVolume: 0.35,
          fadeTicks: 30,
        },
        {
          kind: "stop",
          atTick: 60,
          voiceId: id<"audio-voice">("audio-voice.rain"),
          fadeOutTicks: 12,
        },
      ],
      0,
    );

    const musicGain = context.gains[1];
    expect(musicGain?.gain.events).toEqual(
      expect.arrayContaining(["ramp:0.35:6"]),
    );
    expect(context.sources[0]?.stops).toEqual([6.2]);
  });

  it("clears scheduled playback when logical time is restored", async () => {
    const context = new FakeAudioContext();
    const player = new WebAudioCommandPlayer(
      mix,
      [audioAsset],
      "https://example.test/game.bundle.json",
      {
        contextFactory: () => context as unknown as AudioContext,
        fetcher,
      },
    );
    await player.unlock(100);
    player.submit([playCommand(120)], 100);
    expect(context.sources).toHaveLength(1);

    player.synchronize(40);
    expect(context.sources[0]?.stops).toEqual([0]);
  });
});
