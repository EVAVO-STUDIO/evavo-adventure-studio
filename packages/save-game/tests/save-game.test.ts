import type { Id } from "@evavo/adventure-project-schema";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import {
  createInitialInteractiveRuntimeWorldState,
  type InteractiveRuntimeWorldState,
} from "@evavo/adventure-scene-runtime/commands";
import { describe, expect, it } from "vitest";
import {
  createSaveGame,
  loadSaveGame,
  parseSaveGame,
  runtimeBundleFingerprint,
  SaveGameCompatibilityError,
  SaveGameIntegrityError,
  SaveGamePolicyError,
  serializeSaveGame,
} from "../src/index.js";

const hash = "0".repeat(64);

const bundleInput = (title = "Save Fixture") => ({
  bundleVersion: 1 as const,
  sourceSchemaVersion: 1 as const,
  projectId: "project.save-fixture",
  title,
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context" as const,
    integerScale: true,
    textureSampling: "nearest" as const,
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict" as const,
    showScore: false,
    allowHotspotAssist: false,
  },
  startSceneId: "scene.office",
  startEntranceId: "entrance.office",
  assetManifestFingerprint: hash,
  assetCompilerVersion: "test",
  assets: [
    {
      assetId: "asset.office",
      kind: "image" as const,
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/office.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image" as const,
        width: 320,
        height: 200,
        palette: true,
        colourCount: 16,
      },
    },
  ],
  inventoryItems: [],
  actors: [],
  scenes: [
    {
      id: "scene.office",
      name: "Office",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.office",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.office",
          position: { x: 20, y: 170 },
          facing: "east" as const,
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  dialogues: [],
  sequences: [
    {
      id: "sequence.allowed",
      name: "Allowed",
      mode: "ambient" as const,
      durationTicks: 120,
      loop: false,
      blocking: false,
      savePolicy: "allowed" as const,
      skip: { allowed: false, safeAfterTick: 0, completionActions: [] },
      tracks: [],
      cueCount: 0,
    },
    {
      id: "sequence.boundary",
      name: "Boundary",
      mode: "cutscene" as const,
      durationTicks: 120,
      loop: false,
      blocking: true,
      savePolicy: "boundary-only" as const,
      skip: { allowed: true, safeAfterTick: 0, completionActions: [] },
      tracks: [],
      cueCount: 0,
    },
    {
      id: "sequence.disabled",
      name: "Disabled",
      mode: "cutscene" as const,
      durationTicks: 120,
      loop: false,
      blocking: true,
      savePolicy: "disabled" as const,
      skip: { allowed: true, safeAfterTick: 0, completionActions: [] },
      tracks: [],
      cueCount: 0,
    },
  ],
});

const bundle = parseRuntimeBundle(bundleInput());

const interfaceState = {
  controlledActorInstanceId: null,
  selectedVerbId: null,
  selectedItemId: null,
  statusText: "RAIN AGAINST THE GLASS",
  parser: {
    text: "look window",
    history: ["look desk", "inventory"],
  },
} as const;

const withActiveSequence = (
  world: InteractiveRuntimeWorldState,
  sequenceId: "sequence.allowed" | "sequence.boundary" | "sequence.disabled",
  elapsedTicks: number,
): InteractiveRuntimeWorldState => ({
  ...world,
  story: {
    ...world.story,
    activeSequences: [
      {
        sequenceId: sequenceId as Id<"sequence">,
        elapsedTicks,
        iteration: 0,
        nextCueIndexByTrack: {},
      },
    ],
  },
});

describe("save-game serialization", () => {
  it("round-trips deterministic world and deliberate interface state", () => {
    const initial = createInitialInteractiveRuntimeWorldState(bundle);
    const world: InteractiveRuntimeWorldState = {
      ...initial,
      story: {
        ...initial.story,
        tick: 42,
        flags: { second: false, first: true },
        variables: { weather: "rain", visits: 3 },
      },
    };

    const save = createSaveGame(bundle, world, interfaceState);
    const serialized = serializeSaveGame(save);
    const loaded = loadSaveGame(bundle, JSON.parse(serialized) as unknown);

    expect(loaded).toEqual(save);
    expect(loaded.world.story).toMatchObject({
      tick: 42,
      flags: { first: true, second: false },
      variables: { weather: "rain", visits: 3 },
    });
    expect(loaded.interface).toEqual(interfaceState);
    expect(loaded.bundleFingerprint).toBe(runtimeBundleFingerprint(bundle));
    expect(serialized.endsWith("\n")).toBe(true);
  });

  it("produces identical canonical bytes despite record insertion order", () => {
    const initial = createInitialInteractiveRuntimeWorldState(bundle);
    const left = createSaveGame(
      bundle,
      {
        ...initial,
        story: {
          ...initial.story,
          flags: { alpha: true, beta: false },
          variables: { one: 1, two: 2 },
        },
      },
      interfaceState,
    );
    const right = createSaveGame(
      bundle,
      {
        ...initial,
        story: {
          ...initial.story,
          flags: { beta: false, alpha: true },
          variables: { two: 2, one: 1 },
        },
      },
      interfaceState,
    );

    expect(serializeSaveGame(right)).toBe(serializeSaveGame(left));
    expect(right.saveFingerprint).toBe(left.saveFingerprint);
  });

  it("detects payload tampering before compatibility checks", () => {
    const save = createSaveGame(bundle, createInitialInteractiveRuntimeWorldState(bundle), interfaceState);

    expect(() =>
      parseSaveGame({
        ...save,
        interface: { ...save.interface, statusText: "TAMPERED" },
      }),
    ).toThrow(SaveGameIntegrityError);
  });
});

describe("save-game compatibility", () => {
  it("rejects a save from a different runtime bundle", () => {
    const save = createSaveGame(bundle, createInitialInteractiveRuntimeWorldState(bundle), interfaceState);
    const changedBundle = parseRuntimeBundle(bundleInput("Changed Build"));

    expect(() => loadSaveGame(changedBundle, save)).toThrow(SaveGameCompatibilityError);
  });

  it("rejects incompatible selected inventory and parser history", () => {
    const save = createSaveGame(bundle, createInitialInteractiveRuntimeWorldState(bundle), interfaceState);
    const incompatible = {
      ...save,
      interface: {
        ...save.interface,
        selectedItemId: "item.missing",
        parser: {
          text: "",
          history: Array.from({ length: 21 }, (_, index) => `command ${index}`),
        },
      },
    };

    expect(() => loadSaveGame(bundle, incompatible)).toThrow(SaveGameIntegrityError);
  });
});

describe("sequence save policy", () => {
  it("allows an explicitly saveable active sequence", () => {
    const world = withActiveSequence(
      createInitialInteractiveRuntimeWorldState(bundle),
      "sequence.allowed",
      64,
    );

    expect(() => createSaveGame(bundle, world, interfaceState)).not.toThrow();
  });

  it("blocks boundary-only sequences between boundaries", () => {
    const world = withActiveSequence(
      createInitialInteractiveRuntimeWorldState(bundle),
      "sequence.boundary",
      1,
    );

    expect(() => createSaveGame(bundle, world, interfaceState)).toThrow(SaveGamePolicyError);
  });

  it("blocks sequences that disable saving", () => {
    const world = withActiveSequence(
      createInitialInteractiveRuntimeWorldState(bundle),
      "sequence.disabled",
      0,
    );

    expect(() => createSaveGame(bundle, world, interfaceState)).toThrow(SaveGamePolicyError);
  });
});
