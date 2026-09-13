import { idSchema } from "@evavo/adventure-project-schema";
import {
  createDefaultFailureLifecycleMenu,
  parseGameLifecycleManifest,
} from "@evavo/adventure-project-schema/lifecycle";
import { describe, expect, it } from "vitest";
import { runtimeBundleSchema } from "../src/index.js";

const projectId = idSchema("project").parse("project.lifecycle-runtime");
const lifecycle = (id = projectId) =>
  parseGameLifecycleManifest({
    manifestVersion: 1,
    projectId: id,
    outcomes: [
      {
        id: "outcome.case-closed",
        kind: "failure",
        priority: 10,
        when: { kind: "flag", flag: "case.failed", equals: true },
        title: "Case Closed",
        message: "The investigation can no longer continue.",
        menu: createDefaultFailureLifecycleMenu(),
      },
    ],
  });

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

describe("runtime game lifecycle manifest", () => {
  it("accepts lifecycle data scoped to the runtime project", () => {
    expect(runtimeBundleSchema.safeParse({ ...bundleInput, lifecycle: lifecycle() }).success).toBe(true);
  });

  it("rejects lifecycle data scoped to another project", () => {
    const result = runtimeBundleSchema.safeParse({
      ...bundleInput,
      lifecycle: lifecycle(idSchema("project").parse("project.other")),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "lifecycle.projectId")).toBe(true);
    }
  });
});