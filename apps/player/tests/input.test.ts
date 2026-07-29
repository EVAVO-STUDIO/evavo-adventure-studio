import { describe, expect, it } from "vitest";
import type { Id } from "@evavo/adventure-project-schema";
import {
  appendSoftwareCursor,
  createSoftwareCursorNodes,
  mapClientPointToNative,
  nativeScreenPointToWorld,
  requestedActorFromSearch,
  selectControlledActorInstance,
  walkDestinationForTarget,
} from "../src/input.js";

const id = <T extends string>(value: string) => value as Id<T>;

const actorSelectionBundle = {
  startSceneId: id<"scene">("scene.office"),
  sceneInstances: {
    manifestVersion: 1 as const,
    projectId: id<"project">("project.input"),
    objectDefinitions: [],
    scenes: [
      {
        sceneId: id<"scene">("scene.office"),
        actorInstances: [
          {
            id: id<"actor-instance">("actor-instance.detective"),
            actorId: id<"actor">("actor.detective"),
            position: { x: 40, y: 160 },
            facing: "east",
            animationState: "idle",
            mobility: "walkable" as const,
            elevation: 0,
            zOffset: 0,
            scaleMultiplier: 1,
          },
          {
            id: id<"actor-instance">("actor-instance.guard"),
            actorId: id<"actor">("actor.guard"),
            position: { x: 180, y: 160 },
            facing: "west",
            animationState: "idle",
            mobility: "fixed" as const,
            elevation: 0,
            zOffset: 0,
            scaleMultiplier: 1,
          },
        ],
        objectInstances: [],
        navigationPortals: [],
      },
    ],
  },
};

describe("packaged player input", () => {
  it("maps client coordinates through integer letterboxing", () => {
    const bounds = { left: 100, top: 50, width: 1000, height: 700 };

    expect(
      mapClientPointToNative(
        { x: 120, y: 100 },
        bounds,
        { width: 320, height: 200 },
      ),
    ).toEqual({ x: 0, y: 0 });
    expect(
      mapClientPointToNative(
        { x: 1079, y: 699 },
        bounds,
        { width: 320, height: 200 },
      ),
    ).toEqual({ x: 319, y: 199 });
    expect(
      mapClientPointToNative(
        { x: 110, y: 100 },
        bounds,
        { width: 320, height: 200 },
      ),
    ).toBeNull();
    expect(
      mapClientPointToNative(
        { x: 120, y: 80 },
        bounds,
        { width: 320, height: 200 },
      ),
    ).toBeNull();
  });

  it("maps native screen points through camera and shake into world space", () => {
    expect(
      nativeScreenPointToWorld(
        { x: 40, y: 70 },
        {
          position: { x: 100, y: 20 },
          viewport: { width: 320, height: 200 },
          shakeOffset: { x: 2, y: -1 },
        },
      ),
    ).toEqual({ x: 138, y: 91 });
  });

  it("selects the only walkable actor and rejects invalid explicit choices", () => {
    expect(selectControlledActorInstance(actorSelectionBundle, null)).toEqual({
      kind: "selected",
      actorInstanceId: "actor-instance.detective",
      explicit: false,
    });
    expect(
      selectControlledActorInstance(
        actorSelectionBundle,
        "actor-instance.detective",
      ),
    ).toEqual({
      kind: "selected",
      actorInstanceId: "actor-instance.detective",
      explicit: true,
    });
    expect(
      selectControlledActorInstance(actorSelectionBundle, "actor-instance.guard"),
    ).toMatchObject({
      kind: "invalid",
      reason: "requested-actor-is-fixed",
    });
    expect(
      selectControlledActorInstance(actorSelectionBundle, "actor-instance.missing"),
    ).toMatchObject({
      kind: "invalid",
      reason: "unknown-requested-actor",
    });
  });

  it("requires an explicit actor when several walkable placements exist", () => {
    const ambiguous = {
      ...actorSelectionBundle,
      sceneInstances: {
        ...actorSelectionBundle.sceneInstances,
        scenes: [
          {
            ...actorSelectionBundle.sceneInstances.scenes[0]!,
            actorInstances: [
              actorSelectionBundle.sceneInstances.scenes[0]!.actorInstances[0]!,
              {
                ...actorSelectionBundle.sceneInstances.scenes[0]!.actorInstances[0]!,
                id: id<"actor-instance">("actor-instance.partner"),
              },
            ],
          },
        ],
      },
    };

    expect(selectControlledActorInstance(ambiguous, null)).toEqual({
      kind: "none",
      reason: "ambiguous-walkable-actors",
      candidates: ["actor-instance.detective", "actor-instance.partner"],
    });
  });

  it("uses an object walk-to target instead of its clicked visual point", () => {
    const target = {
      objectInstanceId: id<"object">("object.office.door"),
      definitionId: id<"object-definition">("object-definition.door"),
      stateId: id<"object-state">("object-state.door.closed"),
      order: {
        layer: "world" as const,
        elevation: 0,
        baselineY: 150,
        zOffset: 0,
        stableId: "object.office.door",
      },
      hotspot: {
        id: id<"hotspot">("hotspot.object.office.door.closed"),
        name: "Door",
        shape: {
          points: [
            { x: 100, y: 80 },
            { x: 140, y: 80 },
            { x: 140, y: 150 },
            { x: 100, y: 150 },
          ],
        },
        walkTo: { x: 120, y: 160 },
        interactions: [],
      },
    };

    expect(walkDestinationForTarget(target, { x: 110, y: 90 })).toEqual({
      x: 120,
      y: 160,
    });
    expect(walkDestinationForTarget(null, { x: 110, y: 90 })).toEqual({
      x: 110,
      y: 90,
    });
  });

  it("renders distinct native software cursor shapes", () => {
    const walk = createSoftwareCursorNodes({
      position: { x: 40, y: 50 },
      cursorId: "walk",
      pressed: false,
    });
    const use = createSoftwareCursorNodes({
      position: { x: 40, y: 50 },
      cursorId: "use",
      pressed: true,
    });

    expect(walk).toHaveLength(5);
    expect(use).toHaveLength(5);
    expect(walk.map((node) => node.id)).not.toEqual(
      use.map((node) => node.id),
    );
    expect(use[0]?.transform.position).toEqual({ x: 40, y: 50 });

    const frame = appendSoftwareCursor(
      {
        frameVersion: 1,
        tick: 0,
        canvas: { width: 320, height: 200, clearColor: [0, 0, 0, 255] },
        camera: {
          position: { x: 0, y: 0 },
          viewport: { width: 320, height: 200 },
          shakeOffset: { x: 0, y: 0 },
        },
        nodes: [],
      },
      { position: { x: 10, y: 10 }, cursorId: "walk", pressed: false },
    );
    expect(frame.nodes).toHaveLength(5);
  });

  it("reads explicit actor selection from the browser query", () => {
    expect(requestedActorFromSearch("?bundle=/game.json&actor=actor-instance.hero")).toBe(
      "actor-instance.hero",
    );
    expect(requestedActorFromSearch("?bundle=/game.json")).toBeNull();
  });
});
