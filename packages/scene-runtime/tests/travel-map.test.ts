import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeAdventureRouteTopologyManifest } from "@evavo/adventure-runtime-bundle/route-topology";
import { describe, expect, it } from "vitest";
import { createAdventureRouteTopologyState } from "../src/route-topology.js";
import {
  adventureTravelDestinations,
  travelToAdventureRouteNode,
} from "../src/travel-map.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const manifest: RuntimeAdventureRouteTopologyManifest = {
  manifestVersion: 1,
  projectId: id<"project">("project.travel-map"),
  startNodeId: "route-node.office",
  routes: [],
  nodes: [
    { id: "route-node.office", label: "Office", terminal: false, tags: [] },
    { id: "route-node.library", label: "Library", sceneId: id<"scene">("scene.library"), entranceId: id<"entrance">("entrance.library"), terminal: false, tags: [] },
    { id: "route-node.airfield", label: "Airfield", sceneId: id<"scene">("scene.airfield"), entranceId: id<"entrance">("entrance.airfield"), terminal: false, tags: [] },
  ],
  edges: [
    { id: "route-edge.library", label: "Library", fromNodeId: "route-node.office", toNodeId: "route-node.library", actions: [] },
    { id: "route-edge.airfield", label: "Airfield", fromNodeId: "route-node.office", toNodeId: "route-node.airfield", when: { kind: "flag", flag: "airfieldKnown", equals: true }, actions: [] },
  ],
};

const story = (airfieldKnown = false) => ({
  schemaVersion: 1 as const,
  projectId: manifest.projectId,
  tick: 0,
  currentSceneId: id<"scene">("scene.office"),
  currentEntranceId: id<"entrance">("entrance.office"),
  flags: { airfieldKnown },
  variables: {},
  inventory: [] as Id<"item">[],
  awardedScoreIds: [] as Id<"score-award">[],
  consumedInteractionIds: [] as Id<"interaction">[],
  consumedDialogueChoiceIds: [] as Id<"dialogue-choice">[],
  activeDialogue: null,
  activeSequences: [],
  objectStates: {},
  randomStreams: { main: 1 },
  score: 0,
});

describe("route-backed travel map", () => {
  it("shows reachable and locked destinations from the same route graph", () => {
    const state = createAdventureRouteTopologyState(manifest);
    expect(adventureTravelDestinations(manifest, story(false), state)).toEqual([
      expect.objectContaining({ nodeId: "route-node.airfield", status: "locked" }),
      expect.objectContaining({ nodeId: "route-node.library", status: "available" }),
      expect.objectContaining({ nodeId: "route-node.office", status: "current" }),
    ]);
    expect(adventureTravelDestinations(manifest, story(true), state)).toEqual(
      expect.arrayContaining([expect.objectContaining({ nodeId: "route-node.airfield", status: "available" })]),
    );
  });

  it("travels through the canonical route edge and room destination", () => {
    const state = createAdventureRouteTopologyState(manifest);
    const result = travelToAdventureRouteNode(manifest, story(), state, "route-node.library");
    expect(result.kind).toBe("traversed");
    if (result.kind !== "traversed") return;
    expect(result.state.currentNodeId).toBe("route-node.library");
    expect(result.story.currentSceneId).toBe("scene.library");
    expect(result.story.currentEntranceId).toBe("entrance.library");
  });

  it("rejects locked destinations instead of bypassing their condition", () => {
    const state = createAdventureRouteTopologyState(manifest);
    expect(travelToAdventureRouteNode(manifest, story(false), state, "route-node.airfield")).toMatchObject({
      kind: "rejected",
      reason: "locked",
    });
  });
});
