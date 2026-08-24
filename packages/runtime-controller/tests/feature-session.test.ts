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
      multiProtagonist: false,
      stack: ["base"],
    });
  });

  it("orders SCUMM sentence, room scripts and protagonist state from inner to outer", () => {
    const bundle = {
      ...base,
      presentation: { interactionMode: "verb-list" },
      uiSkins: { manifestVersion: 1, projectId: "project.stack", defaultSkinId: "ui-skin.stack", skins: [] },
      bitmapFonts: { manifestVersion: 1, projectId: "project.stack", fonts: [] },
      roomScripts: { manifestVersion: 1, projectId: "project.stack", scripts: [] },
      multiProtagonist: {
        manifestVersion: 1,
        projectId: "project.stack",
        activeProtagonistId: "actor.a",
        protagonists: [],
      },
    } as unknown as RuntimeBundle;
    expect(describePackagedFeatureSession(bundle)).toEqual({
      sentence: true,
      roomScripts: true,
      multiProtagonist: true,
      stack: ["base", "sentence", "room-scripts", "multi-protagonist"],
    });
  });
});
