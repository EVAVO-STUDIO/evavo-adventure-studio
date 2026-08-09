import type { Id, Point } from "@evavo/adventure-project-schema";
import type { ResolvedFrame } from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import { resolveActiveRuntimeDialogue } from "@evavo/adventure-scene-runtime/dialogue";
import { type UiSkin, uiSkinById } from "@evavo/adventure-ui-skin";
import {
  appendUiSkinFrame,
  type UiAssetGeometryResolver,
  type UiInventoryEntry,
  type UiRuntimeState,
} from "@evavo/adventure-ui-skin/compose";
import type { SoftwareCursorState } from "./input.js";
import { appendNativeStatusPanel } from "./native-status.js";

type RuntimeAsset = RuntimeBundle["assets"][number];

export interface RuntimeUiInteractionState {
  readonly activeVerbId?: Id<"ui-verb">;
  readonly hoveredVerbId?: Id<"ui-verb">;
  readonly selectedItemId?: Id<"item">;
  readonly verbCoinPosition?: Point;
  readonly hoveredDialogueChoiceId?: Id<"dialogue-choice">;
  readonly parserText?: string;
  readonly parserCursorVisible?: boolean;
}

const runtimeAssetsById = (bundle: Pick<RuntimeBundle, "assets">): ReadonlyMap<string, RuntimeAsset> =>
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
      const frame = asset.metadata.frames.find((candidate) => candidate.frameId === frameId);
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
  const items = new Map(bundle.inventoryItems.map((item) => [item.id as string, item] as const));
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

const cursorVerbId = (skin: UiSkin, cursorId: string): Id<"ui-verb"> | undefined =>
  skin.verbs.find((verb) => verb.cursorId === cursorId || verb.verb === cursorId)?.id;

const runtimeDialogueChoices = (
  bundle: Pick<RuntimeBundle, "dialogues">,
  world: InteractiveRuntimeWorldState,
): UiRuntimeState["dialogueChoices"] => {
  const view = resolveActiveRuntimeDialogue(bundle, world);
  return view?.choices
    .filter((choice) => choice.visible)
    .map((choice) => ({
      choiceId: choice.id,
      text: choice.text,
      enabled: choice.enabled,
    }));
};

export const runtimeUiState = (
  bundle: Pick<RuntimeBundle, "inventoryItems" | "dialogues">,
  world: InteractiveRuntimeWorldState,
  skin: UiSkin,
  statusText: string,
  cursor: SoftwareCursorState,
  interaction: RuntimeUiInteractionState = {},
): UiRuntimeState => {
  const activeVerbId = interaction.activeVerbId ?? cursorVerbId(skin, cursor.cursorId);
  const dialogueChoices = runtimeDialogueChoices(bundle, world);
  return {
    statusText,
    ...(activeVerbId ? { activeVerbId } : {}),
    ...(interaction.hoveredVerbId ? { hoveredVerbId: interaction.hoveredVerbId } : {}),
    inventory: runtimeInventory(bundle, world),
    ...(interaction.selectedItemId ? { selectedItemId: interaction.selectedItemId } : {}),
    score: world.story.score,
    ...(skin.interactionMode === "parser-assisted"
      ? {
          parserText: interaction.parserText ?? "",
          parserCursorVisible: interaction.parserCursorVisible ?? false,
        }
      : {}),
    ...(interaction.verbCoinPosition ? { verbCoinPosition: interaction.verbCoinPosition } : {}),
    ...(dialogueChoices && dialogueChoices.length > 0 ? { dialogueChoices } : {}),
    ...(interaction.hoveredDialogueChoiceId
      ? { hoveredDialogueChoiceId: interaction.hoveredDialogueChoiceId }
      : {}),
  };
};

export const appendRuntimeInterface = (
  frame: ResolvedFrame,
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  statusText: string,
  cursor: SoftwareCursorState,
  interaction: RuntimeUiInteractionState = {},
): ResolvedFrame => {
  if (!bundle.uiSkins || !bundle.bitmapFonts) {
    return appendNativeStatusPanel(frame, bundle, statusText);
  }
  const skin = uiSkinById(bundle.uiSkins);
  return appendUiSkinFrame(
    frame,
    skin,
    bundle.bitmapFonts,
    runtimeUiState(bundle, world, skin, statusText, cursor, interaction),
    {
      assets: createRuntimeUiGeometryResolver(bundle),
      nodePrefix: "runtime.ui",
    },
  );
};
