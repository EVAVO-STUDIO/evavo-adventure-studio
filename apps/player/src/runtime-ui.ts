import type { Id } from "@evavo/adventure-project-schema";
import type { ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import {
  appendUiSkinFrame,
  type UiAssetGeometryResolver,
  type UiInventoryEntry,
  type UiRuntimeState,
} from "@evavo/adventure-ui-skin/compose";
import { uiSkinById, type UiSkin } from "@evavo/adventure-ui-skin";
import type { SoftwareCursorState } from "./input.js";
import { appendNativeStatusPanel } from "./native-status.js";

type RuntimeAsset = RuntimeBundle["assets"][number];

const runtimeAssetsById = (
  bundle: Pick<RuntimeBundle, "assets">,
): ReadonlyMap<string, RuntimeAsset> =>
  new Map(bundle.assets.map((asset) => [asset.assetId as string, asset] as const));

export const createRuntimeUiGeometryResolver = (
  bundle: Pick<RuntimeBundle, "assets">,
): UiAssetGeometryResolver => {
  const assets = runtimeAssetsById(bundle);
  return {
    resolve: (assetId, frameId) => {
      const asset = assets.get(assetId);
      if (!asset) return null;
      if (asset.kind === "image") {
        if (frameId) return null;
        return {
          sourceRect: {
            x: 0,
            y: 0,
            width: asset.metadata.width,
            height: asset.metadata.height,
          },
          originalSize: {
            width: asset.metadata.width,
            height: asset.metadata.height,
          },
          trimOffset: { x: 0, y: 0 },
        };
      }
      if (asset.kind !== "spritesheet" || !frameId) return null;
      const frame = asset.metadata.frames.find(
        (candidate) => candidate.frameId === frameId,
      );
      return frame
        ? {
            sourceRect: frame.sourceRect,
            originalSize: frame.originalSize,
            trimOffset: frame.trimOffset,
          }
        : null;
    },
  };
};

const runtimeInventory = (
  bundle: Pick<RuntimeBundle, "inventoryItems">,
  world: InteractiveRuntimeWorldState,
): readonly UiInventoryEntry[] => {
  const items = new Map(
    bundle.inventoryItems.map((item) => [item.id as string, item] as const),
  );
  return world.story.inventory.flatMap((itemId) => {
    const item = items.get(itemId);
    return item
      ? [
          {
            itemId: item.id,
            name: item.name,
            iconAssetId: item.iconAssetId,
          },
        ]
      : [];
  });
};

const activeVerbId = (
  skin: UiSkin,
  cursorId: string,
): Id<"ui-verb"> | undefined =>
  skin.verbs.find(
    (verb) => verb.cursorId === cursorId || verb.verb === cursorId,
  )?.id;

export const runtimeUiState = (
  bundle: Pick<RuntimeBundle, "inventoryItems">,
  world: InteractiveRuntimeWorldState,
  skin: UiSkin,
  statusText: string,
  cursor: SoftwareCursorState,
): UiRuntimeState => {
  const verbId = activeVerbId(skin, cursor.cursorId);
  return {
    statusText,
    ...(verbId ? { activeVerbId: verbId } : {}),
    inventory: runtimeInventory(bundle, world),
    score: world.story.score,
    ...(skin.interactionMode === "parser-assisted"
      ? { parserText: "", parserCursorVisible: true }
      : {}),
    ...(skin.interactionMode === "verb-coin" && cursor.pressed && cursor.position
      ? { verbCoinPosition: cursor.position }
      : {}),
  };
};

export const appendRuntimeInterface = (
  frame: ResolvedFrame,
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  statusText: string,
  cursor: SoftwareCursorState,
): ResolvedFrame => {
  if (!bundle.uiSkins || !bundle.bitmapFonts) {
    return appendNativeStatusPanel(frame, bundle, statusText);
  }
  const skin = uiSkinById(bundle.uiSkins);
  return appendUiSkinFrame(
    frame,
    skin,
    bundle.bitmapFonts,
    runtimeUiState(bundle, world, skin, statusText, cursor),
    {
      assets: createRuntimeUiGeometryResolver(bundle),
      nodePrefix: "runtime.ui",
    },
  );
};
