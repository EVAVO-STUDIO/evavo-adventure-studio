import { type AssetBuildManifest, parseAssetBuildManifest } from "@evavo/adventure-asset-contract";
import { type BitmapFontManifest, parseBitmapFontManifest } from "@evavo/adventure-bitmap-font";
import { type AdventureProject, parseAdventureProject } from "@evavo/adventure-project-schema";
import { parseSceneInstanceManifest, type SceneInstanceManifest } from "@evavo/adventure-scene-instances";
import { parseUiSkinManifest, type UiSkinManifest } from "@evavo/adventure-ui-skin";

export const RED_LEDGER_PLAYABLE_SLICE_PROJECT_ID = "project.red-ledger.playable-slice" as const;
export const RED_LEDGER_PLAYABLE_SLICE_DEMO_ID = "red-ledger" as const;
export const RED_LEDGER_PLAYABLE_SLICE_SOURCE_PATH =
  "apps/player/public/demos/the-red-ledger/source-manifests.json" as const;
export const RED_LEDGER_PLAYABLE_SLICE_BUNDLE_PATH =
  "apps/player/public/demos/the-red-ledger/runtime.bundle.json" as const;
export const RED_LEDGER_PLAYABLE_SLICE_PUBLIC_BUNDLE_PATH =
  "/demos/the-red-ledger/runtime.bundle.json" as const;
export const RED_LEDGER_PLAYABLE_SLICE_PROFILE_ID = "gothic-measured" as const;

export interface RedLedgerPlayableSliceSource {
  readonly project: AdventureProject;
  readonly assetManifest: AssetBuildManifest;
  readonly bitmapFonts: BitmapFontManifest;
  readonly uiSkins: UiSkinManifest;
  readonly sceneInstances: SceneInstanceManifest;
}

export class RedLedgerPlayableSliceSourceError extends Error {
  readonly path: keyof RedLedgerPlayableSliceSource | "projectId";

  constructor(path: RedLedgerPlayableSliceSourceError["path"], message: string) {
    super(message);
    this.name = "RedLedgerPlayableSliceSourceError";
    this.path = path;
  }
}

const record = (input: unknown): Readonly<Record<string, unknown>> => {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new RedLedgerPlayableSliceSourceError(
      "projectId",
      "Red Ledger playable-slice source must be an object.",
    );
  }
  return input as Readonly<Record<string, unknown>>;
};

const requireProjectIdentity = (source: RedLedgerPlayableSliceSource): RedLedgerPlayableSliceSource => {
  const projectId = source.project.id;
  if (projectId !== RED_LEDGER_PLAYABLE_SLICE_PROJECT_ID) {
    throw new RedLedgerPlayableSliceSourceError(
      "projectId",
      `Expected Red Ledger project '${RED_LEDGER_PLAYABLE_SLICE_PROJECT_ID}', ` + `received '${projectId}'.`,
    );
  }

  const manifests = [
    ["assetManifest", source.assetManifest.projectId],
    ["bitmapFonts", source.bitmapFonts.projectId],
    ["uiSkins", source.uiSkins.projectId],
    ["sceneInstances", source.sceneInstances.projectId],
  ] as const;
  for (const [path, manifestProjectId] of manifests) {
    if (manifestProjectId !== projectId) {
      throw new RedLedgerPlayableSliceSourceError(
        path,
        `Red Ledger ${path} project '${manifestProjectId}' does not match ` + `'${projectId}'.`,
      );
    }
  }
  return source;
};

export const parseRedLedgerPlayableSliceSource = (input: unknown): RedLedgerPlayableSliceSource => {
  const source = record(input);
  return requireProjectIdentity({
    project: parseAdventureProject(source["project"]),
    assetManifest: parseAssetBuildManifest(source["assetManifest"]),
    bitmapFonts: parseBitmapFontManifest(source["bitmapFonts"]),
    uiSkins: parseUiSkinManifest(source["uiSkins"]),
    sceneInstances: parseSceneInstanceManifest(source["sceneInstances"]),
  });
};
