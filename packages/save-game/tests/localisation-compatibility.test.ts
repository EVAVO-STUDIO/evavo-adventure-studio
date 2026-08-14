import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { localiseRuntimeBundle } from "@evavo/adventure-runtime-bundle/localisation";
import { describe, expect, it } from "vitest";
import {
  runtimeBundleExactFingerprint,
  runtimeBundleFingerprint,
} from "../src/canonical.js";

const hash = "0".repeat(64);

const sourceBundle = {
  bundleVersion: 1,
  sourceSchemaVersion: 1,
  projectId: "project.locale-save",
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
  assetManifestFingerprint: hash,
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
} as unknown as RuntimeBundle;

const bundleWithLocalisation = {
  ...sourceBundle,
  localisation: {
    packVersion: 1,
    projectId: sourceBundle.projectId,
    sourceLocale: "en-AU",
    defaultLocale: "en-AU",
    locales: [
      {
        locale: "fr-FR",
        status: "release",
        entries: [
          { key: "project.title", text: "Le registre rouge" },
          { key: "scene.office.name", text: "Bureau" },
          { key: "scene.office.fallback", text: "Rien ne se passe." },
        ],
      },
    ],
    sourceEntries: [
      {
        key: "project.title",
        role: "project-title",
        ownerId: sourceBundle.projectId,
        sourcePath: "title",
        text: "The Red Ledger",
      },
      {
        key: "scene.office.name",
        role: "scene-name",
        ownerId: "scene.office",
        sourcePath: "scenes[0].name",
        text: "Office",
      },
      {
        key: "scene.office.fallback",
        role: "scene-fallback",
        ownerId: "scene.office",
        sourcePath: "scenes[0].fallbackText",
        text: "Nothing happens.",
      },
    ],
  },
} as RuntimeBundle;

describe("localisation-neutral save fingerprints", () => {
  it("retains the pre-localisation fingerprint and ignores selected language", () => {
    const french = localiseRuntimeBundle(bundleWithLocalisation, "fr-FR");

    expect(runtimeBundleFingerprint(bundleWithLocalisation)).toBe(
      runtimeBundleFingerprint(sourceBundle),
    );
    expect(runtimeBundleFingerprint(french)).toBe(runtimeBundleFingerprint(sourceBundle));
    expect(runtimeBundleExactFingerprint(french)).not.toBe(
      runtimeBundleExactFingerprint(bundleWithLocalisation),
    );
  });
});
