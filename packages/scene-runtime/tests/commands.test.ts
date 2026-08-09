import type { Id } from "@evavo/adventure-project-schema";
import { parseRuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  advanceInteractiveRuntimeWorld,
  createInitialInteractiveRuntimeWorldState,
  queueSceneObjectCommand,
} from "../src/commands.js";

const hash = "0".repeat(64);
const id = <T extends string>(value: string) => value as Id<T>;

const bundle = parseRuntimeBundle({
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.deferred-commands",
  title: "Deferred Commands",
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
  assetCompilerVersion: "0.1.0-test",
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
        palette: false,
        colourCount: 16,
      },
    },
    {
      assetId: "asset.detective",
      kind: "spritesheet",
      outputFiles: [
        {
          role: "atlas-manifest",
          runtimePath: "assets/detective/atlas.json",
          mediaType: "application/json",
          sha256: hash,
          byteLength: 1,
        },
        {
          role: "page-000",
          runtimePath: "assets/detective/page.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "spritesheet",
        pages: [{ outputRole: "page-000", width: 64, height: 64 }],
        frames: [
          {
            frameId: "frame.idle",
            pageOutputRole: "page-000",
            sourceRect: { x: 0, y: 0, width: 12, height: 20 },
            originalSize: { width: 18, height: 24 },
            trimOffset: { x: 3, y: 4 },
            padding: 1,
          },
          {
            frameId: "frame.walk",
            pageOutputRole: "page-000",
            sourceRect: { x: 12, y: 0, width: 12, height: 20 },
            originalSize: { width: 18, height: 24 },
            trimOffset: { x: 3, y: 4 },
            padding: 1,
          },
        ],
      },
    },
    {
      assetId: "asset.cabinet",
      kind: "image",
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/cabinet.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image",
        width: 20,
        height: 20,
        palette: false,
        colourCount: 8,
      },
    },
  ],
  inventoryItems: [],
  actors: [
    {
      id: "actor.detective",
      name: "Detective",
      frames: [
        {
          id: "frame.idle",
          assetId: "asset.detective",
          sourceRect: { x: 0, y: 0, width: 12, height: 20 },
          sourceSize: { width: 18, height: 24 },
          trimOffset: { x: 3, y: 4 },
          pivot: { x: 9, y: 23 },
          footPoint: { x: 9, y: 23 },
          durationTicks: 4,
          mirrorEligible: true,
        },
        {
          id: "frame.walk",
          assetId: "asset.detective",
          sourceRect: { x: 12, y: 0, width: 12, height: 20 },
          sourceSize: { width: 18, height: 24 },
          trimOffset: { x: 3, y: 4 },
          pivot: { x: 9, y: 23 },
          footPoint: { x: 9, y: 23 },
          durationTicks: 4,
          mirrorEligible: true,
        },
      ],
      animations: [
        {
          id: "animation.idle-east",
          state: "idle",
          facing: "east",
          frameIds: ["frame.idle"],
          loop: true,
          interruptible: true,
        },
        {
          id: "animation.walk-east",
          state: "walk",
          facing: "east",
          frameIds: ["frame.walk"],
          loop: true,
          interruptible: true,
        },
      ],
    },
  ],
  scenes: [
    {
      id: "scene.office",
      name: "Office",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.office",
      navigationAreas: [
        {
          id: "navigation.office",
          shape: {
            points: [
              { x: 0, y: 100 },
              { x: 320, y: 100 },
              { x: 320, y: 200 },
              { x: 0, y: 200 },
            ],
          },
          elevation: 0,
        },
      ],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.office",
          position: { x: 80, y: 120 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  dialogues: [],
  sequences: [],
  sceneInstances: {
    manifestVersion: 1,
    projectId: "project.deferred-commands",
    objectDefinitions: [
      {
        id: "object-definition.cabinet",
        name: "Cabinet",
        initialStateId: "object-state.cabinet.closed",
        states: [
          {
            id: "object-state.cabinet.closed",
            visual: {
              kind: "image",
              assetId: "asset.cabinet",
              pivot: { x: 10, y: 10 },
            },
            interactionShape: {
              points: [
                { x: 0, y: 0 },
                { x: 20, y: 0 },
                { x: 20, y: 20 },
                { x: 0, y: 20 },
              ],
            },
            walkToOffset: { x: 0, y: 20 },
            cursor: "use",
            interactions: [
              {
                id: "interaction.cabinet.open",
                verb: "use",
                actions: [
                  {
                    kind: "set-object-state",
                    objectId: "object.office.cabinet",
                    state: "object-state.cabinet.open",
                  },
                ],
              },
            ],
          },
          {
            id: "object-state.cabinet.open",
            visual: {
              kind: "image",
              assetId: "asset.cabinet",
              pivot: { x: 10, y: 10 },
            },
            interactionShape: {
              points: [
                { x: 0, y: 0 },
                { x: 20, y: 0 },
                { x: 20, y: 20 },
                { x: 0, y: 20 },
              ],
            },
            interactions: [
              {
                id: "interaction.cabinet.look",
                verb: "look",
                actions: [{ kind: "say", text: "The drawer is empty." }],
              },
            ],
          },
          {
            id: "object-state.cabinet.hidden",
            visible: false,
            interactions: [],
          },
        ],
      },
    ],
    scenes: [
      {
        sceneId: "scene.office",
        actorInstances: [
          {
            id: "actor-instance.detective",
            actorId: "actor.detective",
            position: { x: 80, y: 120 },
            facing: "east",
            animationState: "idle",
          },
        ],
        objectInstances: [
          {
            id: "object.office.cabinet",
            definitionId: "object-definition.cabinet",
            position: { x: 100, y: 100 },
          },
        ],
        navigationPortals: [],
      },
    ],
  },
});

describe("deferred object commands", () => {
  it("queues a verb, walks to the staging point, then executes on arrival", () => {
    const initial = createInitialInteractiveRuntimeWorldState(bundle);
    const queued = queueSceneObjectCommand(
      bundle,
      initial,
      id<"actor-instance">("actor-instance.detective"),
      id<"object">("object.office.cabinet"),
      "use",
    );
    expect(queued.kind).toBe("queued");
    if (queued.kind !== "queued") {
      throw new Error("Expected the object command to queue.");
    }
    expect(queued.state.pendingObjectCommands["actor-instance.detective"]).toBeDefined();
    expect(queued.state.story.objectStates["object.office.cabinet"]).toBe("object-state.cabinet.closed");

    const advanced = advanceInteractiveRuntimeWorld(bundle, queued.state, 25);
    expect(advanced.state.story.objectStates["object.office.cabinet"]).toBe("object-state.cabinet.open");
    expect(advanced.state.pendingObjectCommands["actor-instance.detective"]).toBeUndefined();
    expect(advanced.commandEvents).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "object-command-executed" })]),
    );
  });

  it("resolves immediately when an object state has no walk-to staging point", () => {
    const initial = createInitialInteractiveRuntimeWorldState(bundle);
    const opened = {
      ...initial,
      story: {
        ...initial.story,
        objectStates: {
          ...initial.story.objectStates,
          "object.office.cabinet": "object-state.cabinet.open",
        },
      },
    };
    const result = queueSceneObjectCommand(
      bundle,
      opened,
      id<"actor-instance">("actor-instance.detective"),
      id<"object">("object.office.cabinet"),
      "look",
    );

    expect(result.kind).toBe("resolved");
    if (result.kind === "resolved") {
      expect(result.event).toMatchObject({
        kind: "object-command-executed",
        runtimeEvents: expect.arrayContaining([
          expect.objectContaining({
            kind: "speech-requested",
            text: "The drawer is empty.",
          }),
          expect.objectContaining({
            kind: "interaction-completed",
            interactionId: "interaction.cabinet.look",
          }),
        ]),
      });
    }
  });

  it("aborts safely when the target becomes unavailable during approach", () => {
    const initial = createInitialInteractiveRuntimeWorldState(bundle);
    const queued = queueSceneObjectCommand(
      bundle,
      initial,
      id<"actor-instance">("actor-instance.detective"),
      id<"object">("object.office.cabinet"),
      "use",
    );
    if (queued.kind !== "queued") {
      throw new Error("Expected the object command to queue.");
    }
    const hidden = {
      ...queued.state,
      story: {
        ...queued.state.story,
        objectStates: {
          ...queued.state.story.objectStates,
          "object.office.cabinet": "object-state.cabinet.hidden",
        },
      },
    };

    const advanced = advanceInteractiveRuntimeWorld(bundle, hidden, 25);
    expect(advanced.commandEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "object-command-aborted",
          reason: "target-unavailable",
        }),
      ]),
    );
    expect(advanced.state.story.objectStates["object.office.cabinet"]).toBe("object-state.cabinet.hidden");
  });
});
