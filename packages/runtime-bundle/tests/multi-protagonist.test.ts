import { describe, expect, it } from "vitest";
import {
  runtimeMultiProtagonistManifestSchema,
  validateRuntimeMultiProtagonist,
} from "../src/multi-protagonist.js";

const manifest = () =>
  runtimeMultiProtagonistManifestSchema.parse({
    manifestVersion: 1,
    projectId: "project.multi",
    activeProtagonistId: "actor.bernard",
    protagonists: [
      {
        protagonistId: "actor.bernard",
        startSceneId: "scene.present",
        startEntranceId: "entrance.present",
        startingInventory: ["item.plan"],
      },
      {
        protagonistId: "actor.laverne",
        startSceneId: "scene.future",
        startEntranceId: "entrance.future",
        startingInventory: [],
      },
    ],
  });

const context = () => ({
  actorIds: new Set(["actor.bernard", "actor.laverne"]),
  itemIds: new Set(["item.plan"]),
  entrancesByScene: new Map<string, ReadonlySet<string>>([
    ["scene.present", new Set(["entrance.present"])],
    ["scene.future", new Set(["entrance.future"])],
  ]),
});

describe("runtime multi-protagonist manifest", () => {
  it("accepts valid independent protagonist starts", () => {
    expect(validateRuntimeMultiProtagonist(manifest(), context())).toEqual([]);
  });

  it("rejects invalid actor, entrance and inventory references", () => {
    const invalid = runtimeMultiProtagonistManifestSchema.parse({
      ...manifest(),
      protagonists: [
        manifest().protagonists[0],
        {
          protagonistId: "actor.missing",
          startSceneId: "scene.future",
          startEntranceId: "entrance.missing",
          startingInventory: ["item.missing"],
        },
      ],
    });
    expect(validateRuntimeMultiProtagonist(invalid, context())).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unknown-actor" }),
        expect.objectContaining({ code: "unknown-entrance" }),
        expect.objectContaining({ code: "unknown-item" }),
      ]),
    );
  });
});
