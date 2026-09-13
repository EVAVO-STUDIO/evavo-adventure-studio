import type { Id } from "@evavo/adventure-project-schema";
import type { ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import { describe, expect, it } from "vitest";
import {
  appendProtagonistSwitcher,
  hitTestProtagonistSwitcher,
  protagonistSwitchSlots,
  validateProtagonistSwitcherRuntime,
} from "../src/protagonist-switcher.js";

const id = <T extends string>(value: string): Id<T> => value as Id<T>;

const bundle = (overrides: Partial<RuntimeBundle> = {}) =>
  ({
    projectId: "project.switcher",
    presentation: {
      nativeWidth: 320,
      nativeHeight: 200,
      interactionMode: "verb-list",
      integerScale: true,
      textureSampling: "nearest",
      logicalTicksPerSecond: 60,
      pixelMotionPolicy: "strict",
      showScore: false,
      allowHotspotAssist: false,
    },
    actors: [
      { id: "actor.bernard", name: "Bernard" },
      { id: "actor.hoagie", name: "Hoagie" },
      { id: "actor.laverne", name: "Laverne" },
    ],
    multiProtagonist: {
      manifestVersion: 1,
      projectId: "project.switcher",
      activeProtagonistId: "actor.bernard",
      protagonists: [
        { protagonistId: "actor.bernard", startSceneId: "scene.a", startEntranceId: "entrance.a", startingInventory: [] },
        { protagonistId: "actor.hoagie", startSceneId: "scene.b", startEntranceId: "entrance.b", startingInventory: [] },
        { protagonistId: "actor.laverne", startSceneId: "scene.c", startEntranceId: "entrance.c", startingInventory: [] },
      ],
      switcher: {
        region: { x: 2, y: 180, width: 150, height: 18 },
        orientation: "horizontal",
        gap: 2,
      },
    },
    bitmapFonts: {
      manifestVersion: 1,
      projectId: "project.switcher",
      fonts: [
        {
          id: "bitmap-font.system",
          name: "System",
          atlasAssetId: "asset.font.system",
          lineHeight: 7,
          baseline: 6,
          spaceAdvance: 4,
          letterSpacing: 0,
          fallbackCodePoint: 63,
          glyphs: [],
          kernings: [],
        },
      ],
    },
    uiSkins: {
      manifestVersion: 1,
      projectId: "project.switcher",
      defaultSkinId: "ui-skin.scumm",
      skins: [
        {
          id: "ui-skin.scumm",
          name: "SCUMM",
          interactionMode: "verb-list",
          nativeSize: { width: 320, height: 200 },
          status: {
            id: "ui-region.status",
            rect: { x: 0, y: 160, width: 320, height: 18 },
            padding: 2,
            panel: { fill: 0x111111, border: 0xaaaaaa, borderWidth: 1, accent: 0xffffff },
          },
          verbs: [],
          fonts: {
            status: {
              fontId: "bitmap-font.system",
              color: 0xffffff,
              align: "center",
            },
          },
        },
      ],
    },
    ...overrides,
  }) as unknown as RuntimeBundle;

const frame: ResolvedFrame = {
  frameVersion: 1,
  tick: 0,
  canvas: { width: 320, height: 200, clearColor: [0, 0, 0, 255] },
  camera: {
    position: { x: 0, y: 0 },
    viewport: { width: 320, height: 200 },
    shakeOffset: { x: 0, y: 0 },
  },
  nodes: [],
};

describe("native protagonist switcher", () => {
  it("divides the authored native rectangle into stable protagonist slots", () => {
    const slots = protagonistSwitchSlots(bundle());
    expect(slots.map((slot) => ({ id: slot.protagonistId, label: slot.label, rect: slot.rect }))).toEqual([
      {
        id: "actor.bernard",
        label: "Bernard",
        rect: { x: 2, y: 180, width: 48, height: 18 },
      },
      {
        id: "actor.hoagie",
        label: "Hoagie",
        rect: { x: 52, y: 180, width: 48, height: 18 },
      },
      {
        id: "actor.laverne",
        label: "Laverne",
        rect: { x: 102, y: 180, width: 48, height: 18 },
      },
    ]);
  });

  it("hit-tests only the protagonist strip and returns the authored actor id", () => {
    expect(hitTestProtagonistSwitcher(bundle(), { x: 10, y: 188 })).toBe("actor.bernard");
    expect(hitTestProtagonistSwitcher(bundle(), { x: 70, y: 188 })).toBe("actor.hoagie");
    expect(hitTestProtagonistSwitcher(bundle(), { x: 140, y: 188 })).toBe("actor.laverne");
    expect(hitTestProtagonistSwitcher(bundle(), { x: 200, y: 188 })).toBeNull();
  });

  it("renders native labels and an active-character marker without altering the base frame", () => {
    const rendered = appendProtagonistSwitcher(frame, bundle(), id<"actor">("actor.hoagie"));
    expect(frame.nodes).toEqual([]);
    expect(
      rendered.nodes.some((node) => node.id === "runtime.ui.protagonist.1.active"),
    ).toBe(true);
    expect(
      rendered.nodes.find((node) => node.id === "runtime.ui.protagonist.1.label"),
    ).toMatchObject({ kind: "bitmap-text", text: "Hoagie" });
    expect(
      rendered.nodes.some((node) => node.id === "runtime.ui.protagonist.0.active"),
    ).toBe(false);
  });

  it("fails fast when the authored strip leaves the native canvas or UI resources are absent", () => {
    const outOfBounds = bundle({
      multiProtagonist: {
        ...bundle().multiProtagonist!,
        switcher: {
          region: { x: 300, y: 190, width: 40, height: 20 },
          orientation: "horizontal",
          gap: 1,
        },
      },
    });
    expect(() => validateProtagonistSwitcherRuntime(outOfBounds)).toThrow(/native canvas/u);

    expect(() =>
      validateProtagonistSwitcherRuntime(
        bundle({ bitmapFonts: undefined, uiSkins: undefined }),
      ),
    ).toThrow(/UI skin and bitmap fonts/u);
  });
});
