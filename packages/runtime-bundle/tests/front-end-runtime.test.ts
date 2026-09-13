import { idSchema } from "@evavo/adventure-project-schema";
import { createDefaultClassicFrontEndManifest } from "@evavo/adventure-project-schema/front-end";
import { describe, expect, it } from "vitest";
import { runtimeBundleSchema } from "../src/index.js";

const projectId = idSchema("project").parse("project.front-end-runtime");
const bundleInput = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId,
  title: "The Red Ledger",
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
  assetManifestFingerprint: "0".repeat(64),
  assetCompilerVersion: "test",
  assets: [],
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
    },
  ],
  dialogues: [],
  sequences: [],
};

describe("runtime front-end manifest", () => {
  it("accepts a matching project-scoped front-end", () => {
    expect(
      runtimeBundleSchema.safeParse({
        ...bundleInput,
        frontEnd: createDefaultClassicFrontEndManifest(projectId),
      }).success,
    ).toBe(true);
  });

  it("rejects front-end data scoped to another project", () => {
    const otherProjectId = idSchema("project").parse("project.other");
    const result = runtimeBundleSchema.safeParse({
      ...bundleInput,
      frontEnd: createDefaultClassicFrontEndManifest(otherProjectId),
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "frontEnd.projectId")).toBe(
        true,
      );
    }
  });
});