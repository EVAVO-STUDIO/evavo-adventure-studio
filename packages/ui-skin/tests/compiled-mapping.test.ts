import { assetBuildManifestSchema } from "@evavo/adventure-asset-contract";
import { describe, expect, it } from "vitest";
import { validateCompiledUiSkinMappings } from "../src/compiled-mapping.js";
import { uiSkinManifestSchema } from "../src/index.js";

const hash = "0".repeat(64);

const compiled = assetBuildManifestSchema.parse({
  manifestVersion: 1,
  projectId: "project.ui-icons",
  compilerVersion: "test",
  fingerprint: hash,
  assets: [
    {
      assetId: "asset.icon.image",
      kind: "image",
      sourceFiles: [{ path: "art/icon.png", sha256: hash, byteLength: 1 }],
      outputFiles: [
        {
          role: "primary",
          runtimePath: "assets/icon.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "image",
        width: 16,
        height: 16,
        palette: true,
        colourCount: 8,
      },
    },
    {
      assetId: "asset.icon.atlas",
      kind: "spritesheet",
      sourceFiles: [{ path: "art/icons.aseprite", sha256: hash, byteLength: 1 }],
      outputFiles: [
        {
          role: "atlas-manifest",
          runtimePath: "assets/icons/atlas.json",
          mediaType: "application/json",
          sha256: hash,
          byteLength: 1,
        },
        {
          role: "page-000",
          runtimePath: "assets/icons/page.png",
          mediaType: "image/png",
          sha256: hash,
          byteLength: 1,
        },
      ],
      metadata: {
        kind: "spritesheet",
        pages: [{ outputRole: "page-000", width: 32, height: 16 }],
        frames: [
          {
            frameId: "frame.icon.look",
            pageOutputRole: "page-000",
            sourceRect: { x: 1, y: 1, width: 12, height: 12 },
            originalSize: { width: 16, height: 16 },
            trimOffset: { x: 2, y: 2 },
            padding: 1,
          },
        ],
      },
    },
  ],
});

const manifest = (verbs: readonly unknown[]) =>
  uiSkinManifestSchema.parse({
    manifestVersion: 1,
    projectId: "project.ui-icons",
    defaultSkinId: "ui-skin.icons",
    skins: [
      {
        id: "ui-skin.icons",
        name: "Icons",
        interactionMode: "icon-bar",
        nativeSize: { width: 320, height: 200 },
        status: {
          id: "ui-region.status",
          rect: { x: 0, y: 0, width: 320, height: 16 },
          padding: 2,
          panel: { fill: 0, border: 0xffffff, borderWidth: 1 },
        },
        verbs,
        verbBar: {
          region: {
            id: "ui-region.verbs",
            rect: { x: 0, y: 16, width: 320, height: 32 },
            padding: 2,
            panel: { fill: 0, border: 0xffffff, borderWidth: 1 },
          },
          orientation: "horizontal",
          gap: 2,
          buttonHeight: 24,
          normal: { fill: 0, border: 0xffffff, borderWidth: 1 },
          hover: { fill: 0x222222, border: 0xffffff, borderWidth: 1 },
          pressed: { fill: 0x444444, border: 0xffffff, borderWidth: 1 },
          disabled: { fill: 0, border: 0x444444, borderWidth: 1 },
        },
        fonts: {
          status: { fontId: "bitmap-font.ui", color: 0xffffff, align: "left" },
          verb: { fontId: "bitmap-font.ui", color: 0xffffff, align: "center" },
        },
      },
    ],
  });

describe("compiled interface icon mappings", () => {
  it("accepts image icons and exact spritesheet frames", () => {
    expect(
      validateCompiledUiSkinMappings(
        manifest([
          {
            id: "ui-verb.look",
            verb: "look",
            label: "LOOK",
            cursorId: "look",
            iconAssetId: "asset.icon.image",
          },
          {
            id: "ui-verb.use",
            verb: "use",
            label: "USE",
            cursorId: "use",
            iconAssetId: "asset.icon.atlas",
            iconFrameId: "frame.icon.look",
          },
        ]),
        compiled,
      ),
    ).toEqual([]);
  });

  it("rejects missing and incompatible frame identities", () => {
    const issues = validateCompiledUiSkinMappings(
      manifest([
        {
          id: "ui-verb.look",
          verb: "look",
          label: "LOOK",
          cursorId: "look",
          iconAssetId: "asset.icon.atlas",
        },
        {
          id: "ui-verb.use",
          verb: "use",
          label: "USE",
          cursorId: "use",
          iconAssetId: "asset.icon.atlas",
          iconFrameId: "frame.icon.missing",
        },
        {
          id: "ui-verb.talk",
          verb: "talk",
          label: "TALK",
          cursorId: "talk",
          iconAssetId: "asset.icon.image",
          iconFrameId: "frame.icon.look",
        },
      ]),
      compiled,
    );

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        "compiled-ui-icon-frame-required",
        "compiled-ui-icon-frame-missing",
        "compiled-ui-icon-frame-unexpected",
      ]),
    );
  });
});
