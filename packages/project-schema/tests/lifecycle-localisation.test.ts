import { parseAdventureProject } from "@evavo/adventure-project-schema";
import {
  extractLifecycleLocalisableText,
  lifecycleLocalisationKey,
  localisationManifestSchema,
  validateLocalisationManifest,
  validateLocalisationManifestWithSupplementalSources,
} from "@evavo/adventure-project-schema/localisation";
import { parseGameLifecycleManifest } from "@evavo/adventure-project-schema/lifecycle";
import { describe, expect, it } from "vitest";

const project = parseAdventureProject({
  schemaVersion: 1,
  id: "project.lifecycle-localisation",
  title: "Lifecycle Localisation",
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
  startSceneId: "scene.room",
  startEntranceId: "entrance.room",
  scenes: [
    {
      id: "scene.room",
      name: "Room",
      width: 320,
      height: 200,
      backgroundAssetId: "asset.room",
      navigationAreas: [],
      depthBands: [],
      occluders: [],
      hotspots: [],
      entrances: [
        {
          id: "entrance.room",
          position: { x: 20, y: 170 },
          facing: "east",
        },
      ],
      fallbackText: "Nothing happens.",
    },
  ],
  actors: [],
  dialogues: [],
  sequences: [],
  assets: [{ id: "asset.room", path: "art/room.png", kind: "image" }],
  inventoryItems: [],
});

const lifecycle = parseGameLifecycleManifest({
  manifestVersion: 1,
  projectId: project.id,
  outcomes: [
    {
      id: "outcome.case-closed",
      kind: "failure",
      priority: 20,
      when: { kind: "flag", flag: "case.failed", equals: true },
      title: "CASE CLOSED",
      message: "The ledger disappears into the rain.",
      menu: {
        allowQuickRetry: true,
        allowLoad: true,
        allowRestart: true,
        allowTitle: true,
        labels: {
          quickRetry: "QUICK RETRY",
          loadGame: "LOAD GAME",
          restartGame: "RESTART GAME",
          returnToTitle: "RETURN TO TITLE",
          back: "BACK",
        },
      },
    },
  ],
});

const lifecycleSources = extractLifecycleLocalisableText(lifecycle);

describe("lifecycle localisation sources", () => {
  it("extracts stable title, message and recovery-label keys", () => {
    expect(lifecycleSources).toHaveLength(7);
    expect(lifecycleSources.map((entry) => entry.key)).toContain(
      lifecycleLocalisationKey("outcome.case-closed", "title"),
    );
    expect(lifecycleSources.map((entry) => entry.role)).toEqual(
      expect.arrayContaining([
        "lifecycle-title",
        "lifecycle-message",
        "lifecycle-menu-label",
      ]),
    );
  });

  it("accepts lifecycle translations only when the supplemental source contract is supplied", () => {
    const manifest = localisationManifestSchema.parse({
      manifestVersion: 1,
      projectId: project.id,
      sourceLocale: "en-AU",
      locales: [
        {
          locale: "fr-FR",
          status: "release",
          entries: [
            { key: "project.title", text: "Localisation du cycle" },
            { key: "scene.room.name", text: "Pièce" },
            { key: "scene.room.fallback", text: "Rien ne se passe." },
            ...lifecycleSources.map((entry) => ({
              key: entry.key,
              text: `FR ${entry.text}`,
            })),
          ],
        },
      ],
    });

    expect(
      validateLocalisationManifest(project, manifest).some(
        (issue) =>
          issue.code === "unknown-localisation-key" &&
          issue.key === lifecycleLocalisationKey("outcome.case-closed", "title"),
      ),
    ).toBe(true);
    expect(
      validateLocalisationManifestWithSupplementalSources(
        project,
        manifest,
        lifecycleSources,
      ).filter((issue) => issue.severity === "error"),
    ).toEqual([]);
  });

  it("keeps release locales strict when lifecycle copy is missing", () => {
    const manifest = localisationManifestSchema.parse({
      manifestVersion: 1,
      projectId: project.id,
      sourceLocale: "en-AU",
      locales: [
        {
          locale: "fr-FR",
          status: "release",
          entries: [
            { key: "project.title", text: "Localisation du cycle" },
            { key: "scene.room.name", text: "Pièce" },
            { key: "scene.room.fallback", text: "Rien ne se passe." },
          ],
        },
      ],
    });

    const missing = validateLocalisationManifestWithSupplementalSources(
      project,
      manifest,
      lifecycleSources,
    ).filter(
      (issue) =>
        issue.severity === "error" &&
        issue.code === "missing-localisation-key" &&
        issue.key?.startsWith("lifecycle."),
    );
    expect(missing).toHaveLength(7);
  });
});
