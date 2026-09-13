import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import { describePackagedFeatureSession } from "../src/feature-session.js";

const base = {
  presentation: { interactionMode: "context" },
} as unknown as RuntimeBundle;

describe("packaged feature session composition", () => {
  it("keeps ordinary projects on the base controller only", () => {
    expect(describePackagedFeatureSession(base)).toEqual({
      sentence: false,
      roomScripts: false,
      investigation: false,
      rpg: false,
      multiProtagonist: false,
      routeTopology: false,
      specializedModes: false,
      stack: ["base"],
    });
  });

  it("orders sentence, room, investigation, RPG, protagonist, route and specialized modes from inner to outer", () => {
    const bundle = {
      ...base,
      presentation: { interactionMode: "verb-list" },
      uiSkins: { manifestVersion: 1, projectId: "project.stack", defaultSkinId: "ui-skin.stack", skins: [] },
      bitmapFonts: { manifestVersion: 1, projectId: "project.stack", fonts: [] },
      roomScripts: { manifestVersion: 1, projectId: "project.stack", scripts: [] },
      investigation: {
        manifestVersion: 1,
        projectId: "project.stack",
        facts: [],
        topics: [],
        researchSources: [],
        chapters: [{ id: "chapter.one", label: "One", order: 1, objectives: [] }],
      },
      rpg: {
        manifestVersion: 1,
        projectId: "project.stack",
        minutesPerDay: 1440,
        startMinuteOfDay: 480,
        classes: [{ id: "fighter" }],
        stats: [],
        skills: [],
        resources: [],
      },
      multiProtagonist: {
        manifestVersion: 1,
        projectId: "project.stack",
        activeProtagonistId: "actor.a",
        protagonists: [],
      },
      routeTopology: {
        manifestVersion: 1,
        projectId: "project.stack",
        startNodeId: "route-node.start",
        routes: [],
        nodes: [{ id: "route-node.start", label: "Start", terminal: true, tags: [] }],
        edges: [],
      },
      specializedModes: {
        manifestVersion: 1,
        projectId: "project.stack",
        modes: [],
      },
    } as unknown as RuntimeBundle;
    expect(describePackagedFeatureSession(bundle)).toEqual({
      sentence: true,
      roomScripts: true,
      investigation: true,
      rpg: true,
      multiProtagonist: true,
      routeTopology: true,
      specializedModes: true,
      stack: [
        "base",
        "sentence",
        "room-scripts",
        "investigation",
        "rpg",
        "multi-protagonist",
        "route-topology",
        "specialized-modes",
      ],
    });
  });
});
