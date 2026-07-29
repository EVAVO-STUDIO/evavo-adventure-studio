import { describe, expect, it } from "vitest";
import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  ActorProjectIntegrationError,
  mergeActorsIntoProject,
  replaceActorInProject,
  validateActorProjectIntegration,
} from "../src/project-integration.js";

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.actor-integration",
  title: "Actor Integration",
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
    },
  ],
  actors: [
    {
      id: "actor.detective",
      name: "Detective",
      frames: [
        {
          id: "frame.detective.idle",
          assetId: "asset.detective",
          sourceRect: { x: 1, y: 1, width: 18, height: 30 },
          sourceSize: { width: 24, height: 36 },
          trimOffset: { x: 3, y: 4 },
          pivot: { x: 12, y: 35 },
          footPoint: { x: 12, y: 35 },
          durationTicks: 12,
          mirrorEligible: true,
        },
        {
          id: "frame.detective.talk",
          assetId: "asset.detective",
          sourceRect: { x: 22, y: 1, width: 18, height: 30 },
          sourceSize: { width: 24, height: 36 },
          trimOffset: { x: 3, y: 4 },
          pivot: { x: 12, y: 35 },
          footPoint: { x: 12, y: 35 },
          durationTicks: 8,
          mirrorEligible: true,
        },
      ],
      animations: [
        {
          id: "animation.detective.idle-east",
          state: "idle",
          facing: "east",
          frameIds: ["frame.detective.idle"],
          loop: true,
          interruptible: true,
        },
        {
          id: "animation.detective.talk-east",
          state: "talk",
          facing: "east",
          frameIds: ["frame.detective.talk"],
          loop: true,
          interruptible: true,
        },
      ],
    },
  ],
  dialogues: [
    {
      id: "dialogue.interview",
      name: "Interview",
      startNodeId: "dialogue-node.interview.start",
      nodes: [
        {
          id: "dialogue-node.interview.start",
          enterActions: [],
          lines: [
            {
              id: "dialogue-line.interview.opening",
              speakerId: "actor.detective",
              text: "Where were you?",
              animationState: "talk",
              interruptible: true,
            },
          ],
          choices: [],
          exitActions: [],
        },
      ],
    },
  ],
  sequences: [
    {
      id: "sequence.office",
      name: "Office",
      mode: "cutscene",
      durationTicks: 120,
      loop: false,
      blocking: true,
      savePolicy: "boundary-only",
      skip: { allowed: true, safeAfterTick: 0, completionActions: [] },
      tracks: [
        {
          id: "sequence-track.office.actor",
          kind: "actor",
          cues: [
            {
              kind: "actor-animation",
              atTick: 0,
              actorId: "actor.detective",
              animationState: "talk",
              facing: "east",
              awaitCompletion: false,
            },
            {
              kind: "actor-move",
              atTick: 20,
              durationTicks: 30,
              actorId: "actor.detective",
              destination: { x: 180, y: 170 },
              easing: "linear",
              faceOnArrival: "east",
            },
          ],
        },
      ],
    },
  ],
  assets: [
    { id: "asset.office", path: "art/office.png", kind: "image" },
    {
      id: "asset.detective",
      path: "art/detective.aseprite",
      kind: "spritesheet",
    },
  ],
  inventoryItems: [],
});

describe("actor project integration", () => {
  it("replaces an edited actor without changing project ordering", () => {
    const edited = {
      ...project.actors[0]!,
      name: "Detective Vale",
      frames: project.actors[0]!.frames.map((frame) =>
        frame.id === "frame.detective.talk"
          ? { ...frame, durationTicks: 10 }
          : frame,
      ),
    };

    const next = replaceActorInProject(project, edited);
    expect(next.actors[0]).toMatchObject({
      id: "actor.detective",
      name: "Detective Vale",
    });
    expect(next.actors[0]?.frames[1]?.durationTicks).toBe(10);
    expect(project.actors[0]?.name).toBe("Detective");
  });

  it("rejects removal of performance states used by dialogue", () => {
    const edited = {
      ...project.actors[0]!,
      animations: project.actors[0]!.animations.filter(
        (animation) => animation.state !== "talk",
      ),
    };

    expect(validateActorProjectIntegration(project, edited).map((issue) => issue.code)).toContain(
      "missing-dialogue-animation-state",
    );
    expect(() => replaceActorInProject(project, edited)).toThrowError(
      ActorProjectIntegrationError,
    );
  });

  it("rejects sequence facings without a matching state-facing clip", () => {
    const edited = {
      ...project.actors[0]!,
      animations: project.actors[0]!.animations.map((animation) =>
        animation.state === "talk"
          ? { ...animation, facing: "west" }
          : animation,
      ),
    };

    expect(validateActorProjectIntegration(project, edited).map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "missing-sequence-animation-facing",
      ]),
    );
  });

  it("rejects frame IDs that collide with other project entities", () => {
    const edited = {
      ...project.actors[0]!,
      frames: project.actors[0]!.frames.map((frame, index) =>
        index === 0 ? { ...frame, id: "asset.office" as typeof frame.id } : frame,
      ),
      animations: project.actors[0]!.animations.map((animation) => ({
        ...animation,
        frameIds: animation.frameIds.map((frameId) =>
          frameId === "frame.detective.idle"
            ? ("asset.office" as typeof frameId)
            : frameId,
        ),
      })),
    };

    expect(validateActorProjectIntegration(project, edited).map((issue) => issue.code)).toContain(
      "project-id-collision",
    );
  });

  it("merges all focused actor documents and rejects unknown actors", () => {
    const edited = { ...project.actors[0]!, name: "Mara Vale" };
    expect(mergeActorsIntoProject(project, [edited]).actors[0]?.name).toBe(
      "Mara Vale",
    );

    expect(() =>
      mergeActorsIntoProject(project, [
        {
          ...edited,
          id: "actor.unknown" as typeof edited.id,
        },
      ]),
    ).toThrowError(ActorProjectIntegrationError);
  });
});
