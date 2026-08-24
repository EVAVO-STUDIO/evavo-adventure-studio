import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeAdventureRouteTopologyManifest } from "@evavo/adventure-runtime-bundle/route-topology";
import { describe, expect, it } from "vitest";
import {
  adventureRouteAtRequiredReconvergence,
  adventureRouteAtTerminal,
  availableAdventureRouteEdges,
  createAdventureRouteTopologyState,
  traverseAdventureRouteEdge,
} from "../src/route-topology.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const manifest: RuntimeAdventureRouteTopologyManifest = {
  manifestVersion: 1,
  projectId: id<"project">("project.route-runtime"),
  startNodeId: "route-node.choice",
  requiredReconvergenceNodeId: "route-node.rejoin",
  routes: [
    { id: "route.team", label: "Team" },
    { id: "route.wits", label: "Wits" },
    { id: "route.fists", label: "Fists" },
  ],
  nodes: [
    { id: "route-node.choice", label: "Choice", terminal: false, tags: [] },
    { id: "route-node.team", label: "Team", sceneId: id<"scene">("scene.team"), entranceId: id<"entrance">("entrance.team"), terminal: false, tags: [] },
    { id: "route-node.wits", label: "Wits", terminal: false, tags: [] },
    { id: "route-node.fists", label: "Fists", terminal: false, tags: [] },
    { id: "route-node.rejoin", label: "Rejoin", sceneId: id<"scene">("scene.rejoin"), entranceId: id<"entrance">("entrance.rejoin"), terminal: false, tags: [] },
    { id: "route-node.end", label: "End", terminal: true, tags: [] },
  ],
  edges: [
    {
      id: "route-edge.team",
      label: "Team",
      fromNodeId: "route-node.choice",
      toNodeId: "route-node.team",
      routeId: "route.team",
      actions: [{ kind: "set-flag", flag: "routeTeam", value: true }],
    },
    {
      id: "route-edge.wits",
      label: "Wits",
      fromNodeId: "route-node.choice",
      toNodeId: "route-node.wits",
      routeId: "route.wits",
      when: { kind: "flag", flag: "canThinkAlone", equals: true },
      actions: [],
    },
    {
      id: "route-edge.fists",
      label: "Fists",
      fromNodeId: "route-node.choice",
      toNodeId: "route-node.fists",
      routeId: "route.fists",
      actions: [],
    },
    { id: "route-edge.team-rejoin", label: "Rejoin", fromNodeId: "route-node.team", toNodeId: "route-node.rejoin", actions: [] },
    { id: "route-edge.wits-rejoin", label: "Rejoin", fromNodeId: "route-node.wits", toNodeId: "route-node.rejoin", actions: [] },
    { id: "route-edge.fists-rejoin", label: "Rejoin", fromNodeId: "route-node.fists", toNodeId: "route-node.rejoin", actions: [] },
    { id: "route-edge.end", label: "Finish", fromNodeId: "route-node.rejoin", toNodeId: "route-node.end", actions: [] },
  ],
};

const story = (flags: Readonly<Record<string, boolean>> = {}) => ({
  schemaVersion: 1 as const,
  projectId: manifest.projectId,
  tick: 0,
  currentSceneId: id<"scene">("scene.choice"),
  currentEntranceId: id<"entrance">("entrance.choice"),
  flags,
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

describe("branching route runtime", () => {
  it("offers condition-valid route choices and applies room destinations/consequences", () => {
    const state = createAdventureRouteTopologyState(manifest);
    expect(availableAdventureRouteEdges(manifest, story(), state).map((edge) => edge.id)).toEqual([
      "route-edge.fists",
      "route-edge.team",
    ]);
    expect(availableAdventureRouteEdges(manifest, story({ canThinkAlone: true }), state).map((edge) => edge.id)).toEqual([
      "route-edge.fists",
      "route-edge.team",
      "route-edge.wits",
    ]);

    const selected = traverseAdventureRouteEdge(manifest, story(), state, "route-edge.team");
    expect(selected.kind).toBe("traversed");
    if (selected.kind !== "traversed") return;
    expect(selected.state.selectedRouteIds).toEqual(["route.team"]);
    expect(selected.story.flags.routeTeam).toBe(true);
    expect(selected.story.currentSceneId).toBe("scene.team");
    expect(selected.story.currentEntranceId).toBe("entrance.team");

    const rejoined = traverseAdventureRouteEdge(manifest, selected.story, selected.state, "route-edge.team-rejoin");
    expect(rejoined.kind).toBe("traversed");
    if (rejoined.kind !== "traversed") return;
    expect(adventureRouteAtRequiredReconvergence(manifest, rejoined.state)).toBe(true);
    expect(rejoined.story.currentSceneId).toBe("scene.rejoin");

    const ended = traverseAdventureRouteEdge(manifest, rejoined.story, rejoined.state, "route-edge.end");
    expect(ended.kind).toBe("traversed");
    if (ended.kind !== "traversed") return;
    expect(adventureRouteAtTerminal(manifest, ended.state)).toBe(true);
  });

  it("rejects unavailable or out-of-position route edges", () => {
    const state = createAdventureRouteTopologyState(manifest);
    expect(traverseAdventureRouteEdge(manifest, story(), state, "route-edge.wits")).toMatchObject({
      kind: "rejected",
      reason: "condition-failed",
    });
    expect(traverseAdventureRouteEdge(manifest, story(), state, "route-edge.end")).toMatchObject({
      kind: "rejected",
      reason: "wrong-node",
    });
  });
});
