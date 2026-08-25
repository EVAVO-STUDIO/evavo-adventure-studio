import { resolveDialogueView } from "@evavo/adventure-dialogue";
import type { Id, Point, Rectangle } from "@evavo/adventure-project-schema";
import type {
  BitmapTextRenderNode,
  RenderNode,
  ResolvedFrame,
  SolidRectangleRenderNode,
} from "@evavo/adventure-render-contract";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import type {
  RuntimeInvestigationState,
  RuntimeInvestigationTopicId,
} from "@evavo/adventure-scene-runtime/investigation-runtime";
import { uiSkinById, type UiColor, type UiPanelStyle } from "@evavo/adventure-ui-skin";

export interface RuntimeInvestigationTopicPanelEntry {
  readonly topicId: RuntimeInvestigationTopicId;
  readonly dialogueId: Id<"dialogue">;
  readonly dialogueChoiceId: Id<"dialogue-choice">;
  readonly speakerId: Id<"actor">;
  readonly label: string;
  readonly rect: Rectangle;
}

const contains = (rect: Rectangle, point: Point): boolean =>
  point.x >= rect.x &&
  point.y >= rect.y &&
  point.x < rect.x + rect.width &&
  point.y < rect.y + rect.height;

const alpha = (color: UiColor): number =>
  typeof color === "number" ? 1 : color[3] / 255;

const solid = (
  id: string,
  rect: Rectangle,
  color: UiColor,
  zOffset: number,
): SolidRectangleRenderNode => ({
  kind: "solid-rectangle",
  id: id as Id<"render-node">,
  order: {
    layer: "interface",
    elevation: 0,
    baselineY: rect.y + rect.height,
    zOffset,
    stableId: id,
  },
  transform: {
    position: { x: rect.x, y: rect.y },
    pivot: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotationRadians: 0,
  },
  opacity: alpha(color),
  visible: true,
  size: { width: rect.width, height: rect.height },
  color: typeof color === "number" ? color : [color[0], color[1], color[2], 255],
});

const panelNodes = (
  id: string,
  rect: Rectangle,
  style: UiPanelStyle,
  zOffset: number,
): readonly SolidRectangleRenderNode[] => {
  const nodes: SolidRectangleRenderNode[] = [solid(`${id}.fill`, rect, style.fill, zOffset)];
  const border = Math.min(style.borderWidth, Math.floor(rect.width / 2), Math.floor(rect.height / 2));
  if (border <= 0) return nodes;
  nodes.push(
    solid(`${id}.top`, { x: rect.x, y: rect.y, width: rect.width, height: border }, style.border, zOffset + 1),
    solid(
      `${id}.bottom`,
      { x: rect.x, y: rect.y + rect.height - border, width: rect.width, height: border },
      style.border,
      zOffset + 1,
    ),
    solid(`${id}.left`, { x: rect.x, y: rect.y, width: border, height: rect.height }, style.border, zOffset + 1),
    solid(
      `${id}.right`,
      { x: rect.x + rect.width - border, y: rect.y, width: border, height: rect.height },
      style.border,
      zOffset + 1,
    ),
  );
  return nodes;
};

const activePanelDialogue = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
) => {
  const active = world.story.activeDialogue;
  const panel = bundle.investigation?.topicPanel;
  if (!active || !panel) return null;
  const mapping = panel.dialogues.find((candidate) => candidate.dialogueId === active.dialogueId);
  if (!mapping) return null;
  const graph = bundle.dialogues.find((candidate) => candidate.id === active.dialogueId);
  if (!graph) return null;
  const view = resolveDialogueView(world.story, graph, active.nodeId);
  if (!view) return null;
  return { panel, mapping, graph, view };
};

export const validateInvestigationTopicPanelRuntime = (bundle: RuntimeBundle): void => {
  const panel = bundle.investigation?.topicPanel;
  if (!panel) return;
  const { nativeWidth, nativeHeight } = bundle.presentation;
  const { region } = panel;
  if (
    region.x < 0 ||
    region.y < 0 ||
    region.x + region.width > nativeWidth ||
    region.y + region.height > nativeHeight
  ) {
    throw new Error(`Investigation topic panel must stay inside the ${nativeWidth}×${nativeHeight} native canvas.`);
  }
  if (!bundle.uiSkins || !bundle.bitmapFonts) {
    throw new Error("Investigation topic panel requires a packaged UI skin and bitmap fonts.");
  }
  const actorIds = new Set(bundle.actors.map((actor) => actor.id as string));
  const dialogues = new Map(bundle.dialogues.map((dialogue) => [dialogue.id as string, dialogue] as const));
  for (const mapping of panel.dialogues) {
    if (!actorIds.has(mapping.speakerId)) {
      throw new Error(`Investigation topic-panel speaker '${mapping.speakerId}' is not a runtime actor.`);
    }
    const dialogue = dialogues.get(mapping.dialogueId);
    if (!dialogue) {
      throw new Error(`Investigation topic-panel dialogue '${mapping.dialogueId}' does not exist.`);
    }
    const choiceIds = new Set(
      dialogue.nodes.flatMap((node) => node.choices.map((choice) => choice.id as string)),
    );
    for (const response of mapping.responses) {
      if (!choiceIds.has(response.dialogueChoiceId)) {
        throw new Error(
          `Investigation topic '${response.topicId}' maps to missing dialogue choice '${response.dialogueChoiceId}'.`,
        );
      }
    }
  }
};

export const investigationTopicPanelEntries = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  investigation: RuntimeInvestigationState | null,
): readonly RuntimeInvestigationTopicPanelEntry[] => {
  if (!investigation) return [];
  const active = activePanelDialogue(bundle, world);
  if (!active) return [];
  const manifest = bundle.investigation!;
  const visibleChoices = new Map(
    active.view.choices
      .filter((choice) => choice.visible && choice.enabled)
      .map((choice) => [choice.id as string, choice] as const),
  );
  const topicById = new Map(manifest.topics.map((topic) => [topic.id as string, topic] as const));
  const candidates = active.mapping.responses
    .filter((response) => investigation.availableTopicIds.includes(response.topicId))
    .filter((response) => {
      const topic = topicById.get(response.topicId);
      return topic && !(topic.oneShot && investigation.usedTopicIds.includes(topic.id));
    })
    .filter((response) => visibleChoices.has(response.dialogueChoiceId))
    .slice(0, active.panel.maximumVisibleTopics);
  const totalGap = Math.max(0, candidates.length - 1) * active.panel.gap;
  const height = candidates.length > 0
    ? Math.max(1, Math.floor((active.panel.region.height - totalGap) / candidates.length))
    : active.panel.region.height;
  return candidates.map((response, index) => ({
    topicId: response.topicId,
    dialogueId: active.mapping.dialogueId,
    dialogueChoiceId: response.dialogueChoiceId,
    speakerId: active.mapping.speakerId,
    label: topicById.get(response.topicId)?.label ?? response.topicId,
    rect: {
      x: active.panel.region.x,
      y: active.panel.region.y + index * (height + active.panel.gap),
      width: active.panel.region.width,
      height,
    },
  }));
};

export const hitTestInvestigationTopicPanel = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  investigation: RuntimeInvestigationState | null,
  point: Point,
): RuntimeInvestigationTopicPanelEntry | null =>
  investigationTopicPanelEntries(bundle, world, investigation).find((entry) => contains(entry.rect, point)) ?? null;

const suppressGenericDialogueChoices = (frame: ResolvedFrame): ResolvedFrame => ({
  ...frame,
  nodes: frame.nodes.filter((node) => !String(node.id).startsWith("runtime.ui.dialogue")),
});

export const appendInvestigationTopicPanel = (
  frame: ResolvedFrame,
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  investigation: RuntimeInvestigationState | null,
): ResolvedFrame => {
  const entries = investigationTopicPanelEntries(bundle, world, investigation);
  if (entries.length === 0) return frame;
  validateInvestigationTopicPanelRuntime(bundle);
  const skin = uiSkinById(bundle.uiSkins!);
  const fontStyle = skin.fonts.dialogue ?? skin.fonts.status;
  const font = bundle.bitmapFonts!.fonts.find((candidate) => candidate.id === fontStyle.fontId);
  if (!font) throw new Error(`Investigation topic-panel font '${fontStyle.fontId}' is unavailable.`);
  const panelStyle = skin.dialogueChoices?.region.panel ?? skin.status.panel;
  const normalStyle = skin.dialogueChoices?.normal ?? panelStyle;
  const nodes: RenderNode[] = [];
  for (const [index, entry] of entries.entries()) {
    nodes.push(...panelNodes(`runtime.ui.investigation.topic.${index}`, entry.rect, normalStyle, 82));
    const text: BitmapTextRenderNode = {
      kind: "bitmap-text",
      id: `runtime.ui.investigation.topic.${index}.text` as Id<"render-node">,
      order: {
        layer: "interface",
        elevation: 0,
        baselineY: entry.rect.y + entry.rect.height,
        zOffset: 86,
        stableId: `runtime.ui.investigation.topic.${index}.text`,
      },
      transform: {
        position: {
          x: entry.rect.x + 3,
          y: entry.rect.y + Math.max(2, Math.floor((entry.rect.height - font.lineHeight) / 2)),
        },
        pivot: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotationRadians: 0,
      },
      opacity: 1,
      visible: true,
      fontAssetId: font.atlasAssetId,
      fontId: font.id,
      text: entry.label,
      maximumWidth: Math.max(1, entry.rect.width - 6),
      lineHeight: font.lineHeight,
      align: fontStyle.align,
      color: fontStyle.color,
      ...(fontStyle.outlineColor === undefined ? {} : { outlineColor: fontStyle.outlineColor }),
    };
    nodes.push(text);
  }
  const withoutChoices = suppressGenericDialogueChoices(frame);
  return { ...withoutChoices, nodes: [...withoutChoices.nodes, ...nodes] };
};
