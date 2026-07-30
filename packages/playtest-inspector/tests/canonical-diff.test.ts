import { describe, expect, it } from "vitest";
import type { Id } from "@evavo/adventure-project-schema";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { createSaveGame } from "@evavo/adventure-save-game";
import { diffCanonicalSaveGames } from "../src/canonical-diff.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;
const hash = "0".repeat(64);

const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.canonical-diff",
  title: "Canonical Diff",
  presentation: {
    nativeWidth: 320,
    nativeHeight: 200,
    interactionMode: "context",
    integerScale: true,
    textureSampling: "nearest",
    logicalTicksPerSecond: 60,
    pixelMotionPolicy: "strict",
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
      kind: "image",
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
        kind: "image",
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
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
      interactionIndex: {},
    },
  ],
  dialogues: [],
  sequences: [],
});

interface WorldOptions {
  readonly randomState?: number;
  readonly awardedScoreIds?: readonly Id<"score-award">[];
  readonly consumedInteractionIds?: readonly Id<"interaction">[];
  readonly consumedDialogueChoiceIds?: readonly Id<"dialogue-choice">[];
}

const saveWith = (options: WorldOptions = {}) =>
  createSaveGame(
    bundle,
    {
      story: {
        schemaVersion: 1,
        projectId: bundle.projectId,
        tick: 12,
        currentSceneId: bundle.startSceneId,
        currentEntranceId: bundle.startEntranceId,
        flags: {},
        variables: {},
        inventory: [],
        awardedScoreIds: options.awardedScoreIds ?? [],
        consumedInteractionIds: options.consumedInteractionIds ?? [],
        consumedDialogueChoiceIds: options.consumedDialogueChoiceIds ?? [],
        activeDialogue: null,
        activeSequences: [],
        objectStates: {},
        randomStreams: { main: options.randomState ?? 1 },
        score: 0,
      },
      actorInstances: {},
      movements: {},
      pendingObjectCommands: {},
    },
    {
      controlledActorInstanceId: null,
      selectedVerbId: null,
      selectedItemId: null,
      statusText: "READY",
      parser: { text: "", history: [] },
    },
  );

describe("canonical playtest save diff", () => {
  it("reports deterministic state omitted by the semantic summary diff", () => {
    const before = saveWith();
    const after = saveWith({
      randomState: 2,
      awardedScoreIds: [id<"score-award">("score-award.first-clue")],
      consumedInteractionIds: [
        id<"interaction">("interaction.office.door.open"),
      ],
      consumedDialogueChoiceIds: [
        id<"dialogue-choice">("dialogue-choice.receptionist.ask-key"),
      ],
    });

    const diff = diffCanonicalSaveGames(bundle, before, after);

    expect(diff).toMatchObject({
      comparisonVersion: 1,
      changed: true,
      truncated: false,
      beforeFingerprint: before.saveFingerprint,
      afterFingerprint: after.saveFingerprint,
    });
    expect(diff.entries.map((entry) => entry.path)).toEqual([
      "world.story.awardedScoreIds[0]",
      "world.story.consumedDialogueChoiceIds[0]",
      "world.story.consumedInteractionIds[0]",
      "world.story.randomStreams.main",
    ]);
    expect(diff.entries.at(-1)).toEqual({
      kind: "changed",
      path: "world.story.randomStreams.main",
      before: 1,
      after: 2,
    });
  });

  it("preserves array order instead of treating state as a set", () => {
    const first = id<"interaction">("interaction.first");
    const second = id<"interaction">("interaction.second");
    const before = saveWith({ consumedInteractionIds: [first, second] });
    const after = saveWith({ consumedInteractionIds: [second, first] });

    expect(diffCanonicalSaveGames(bundle, before, after).entries).toEqual([
      {
        kind: "changed",
        path: "world.story.consumedInteractionIds[0]",
        before: first,
        after: second,
      },
      {
        kind: "changed",
        path: "world.story.consumedInteractionIds[1]",
        before: second,
        after: first,
      },
    ]);
  });

  it("supports bounded diagnostics without claiming a complete diff", () => {
    const before = saveWith();
    const after = saveWith({
      randomState: 2,
      awardedScoreIds: [id<"score-award">("score-award.first-clue")],
      consumedInteractionIds: [id<"interaction">("interaction.first")],
      consumedDialogueChoiceIds: [
        id<"dialogue-choice">("dialogue-choice.first"),
      ],
    });

    expect(
      diffCanonicalSaveGames(bundle, before, after, { maxDifferences: 2 }),
    ).toMatchObject({
      changed: true,
      truncated: true,
      entries: [
        { path: "world.story.awardedScoreIds[0]" },
        { path: "world.story.consumedDialogueChoiceIds[0]" },
      ],
    });
    expect(diffCanonicalSaveGames(bundle, before, before)).toMatchObject({
      changed: false,
      truncated: false,
      entries: [],
    });
    expect(() =>
      diffCanonicalSaveGames(bundle, before, after, { maxDifferences: 0 }),
    ).toThrow(new RangeError("maxDifferences must be a positive integer."));
  });
});
