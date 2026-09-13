import {
  evaluateCondition,
  type InteractionResult,
  type RuntimeState,
  runInteraction,
} from "@evavo/adventure-core";
import type { Hotspot, Id, Interaction } from "@evavo/adventure-project-schema";

export interface InteractionCommand {
  readonly actorId: Id<"actor">;
  readonly verb: string;
  readonly targetHotspotId: Id<"hotspot">;
  readonly itemId: Id<"item"> | null;
}

export interface InteractionPolicy {
  readonly selectedItemFallback: "exact-only" | "generic-verb";
}

export const defaultInteractionPolicy: InteractionPolicy = {
  selectedItemFallback: "exact-only",
};

export type InteractionFallbackReason = "target-mismatch" | "no-match" | "condition-failed" | "already-used";

export type InteractionResolution =
  | {
      readonly kind: "matched";
      readonly command: InteractionCommand;
      readonly interaction: Interaction;
    }
  | {
      readonly kind: "fallback";
      readonly command: InteractionCommand;
      readonly reason: InteractionFallbackReason;
      readonly text: string;
    };

const interactionIsConsumed = (state: RuntimeState, interaction: Interaction): boolean =>
  interaction.once === true && state.consumedInteractionIds.includes(interaction.id);

const resolveCandidateTier = (
  state: RuntimeState,
  candidates: readonly Interaction[],
):
  | { readonly kind: "matched"; readonly interaction: Interaction }
  | {
      readonly kind: "blocked";
      readonly conditionFailed: boolean;
      readonly alreadyUsed: boolean;
    } => {
  let conditionFailed = false;
  let alreadyUsed = false;

  for (const interaction of candidates) {
    if (interactionIsConsumed(state, interaction)) {
      alreadyUsed = true;
      continue;
    }

    if (interaction.when && !evaluateCondition(interaction.when, state)) {
      conditionFailed = true;
      continue;
    }

    return { kind: "matched", interaction };
  }

  return { kind: "blocked", conditionFailed, alreadyUsed };
};

const fallbackReason = (
  tiersHadCandidates: boolean,
  conditionFailed: boolean,
  alreadyUsed: boolean,
): InteractionFallbackReason => {
  if (conditionFailed) {
    return "condition-failed";
  }
  if (alreadyUsed) {
    return "already-used";
  }
  return tiersHadCandidates ? "no-match" : "no-match";
};

export const resolveHotspotCommand = (
  state: RuntimeState,
  hotspot: Hotspot,
  command: InteractionCommand,
  policy: InteractionPolicy = defaultInteractionPolicy,
  sceneFallbackText = "That does not work.",
): InteractionResolution => {
  const fallbackText = hotspot.fallbackText ?? sceneFallbackText;

  if (command.targetHotspotId !== hotspot.id) {
    return {
      kind: "fallback",
      command,
      reason: "target-mismatch",
      text: fallbackText,
    };
  }

  const verbCandidates = hotspot.interactions.filter((interaction) => interaction.verb === command.verb);
  const tiers: Interaction[][] = [];

  if (command.itemId) {
    tiers.push(verbCandidates.filter((interaction) => interaction.itemId === command.itemId));
    if (policy.selectedItemFallback === "generic-verb") {
      tiers.push(verbCandidates.filter((interaction) => interaction.itemId === undefined));
    }
  } else {
    tiers.push(verbCandidates.filter((interaction) => interaction.itemId === undefined));
  }

  let conditionFailed = false;
  let alreadyUsed = false;
  let tiersHadCandidates = false;

  for (const candidates of tiers) {
    tiersHadCandidates ||= candidates.length > 0;
    const tier = resolveCandidateTier(state, candidates);
    if (tier.kind === "matched") {
      return {
        kind: "matched",
        command,
        interaction: tier.interaction,
      };
    }
    conditionFailed ||= tier.conditionFailed;
    alreadyUsed ||= tier.alreadyUsed;
  }

  return {
    kind: "fallback",
    command,
    reason: fallbackReason(tiersHadCandidates, conditionFailed, alreadyUsed),
    text: fallbackText,
  };
};

export type ExecutedInteraction =
  | {
      readonly kind: "executed";
      readonly resolution: Extract<InteractionResolution, { readonly kind: "matched" }>;
      readonly result: Extract<InteractionResult, { readonly kind: "accepted" }>;
    }
  | {
      readonly kind: "fallback";
      readonly resolution: Extract<InteractionResolution, { readonly kind: "fallback" }>;
    }
  | {
      readonly kind: "rejected";
      readonly resolution: Extract<InteractionResolution, { readonly kind: "matched" }>;
      readonly result: Extract<InteractionResult, { readonly kind: "rejected" }>;
    };

export const executeHotspotCommand = (
  state: RuntimeState,
  hotspot: Hotspot,
  command: InteractionCommand,
  policy: InteractionPolicy = defaultInteractionPolicy,
  sceneFallbackText?: string,
): ExecutedInteraction => {
  const resolution = resolveHotspotCommand(state, hotspot, command, policy, sceneFallbackText);

  if (resolution.kind === "fallback") {
    return { kind: "fallback", resolution };
  }

  const result = runInteraction(state, resolution.interaction);
  return result.kind === "accepted"
    ? { kind: "executed", resolution, result }
    : { kind: "rejected", resolution, result };
};

export interface CursorContext {
  readonly activeVerb: string;
  readonly selectedItemId: Id<"item"> | null;
  readonly hotspot: Hotspot | null;
  readonly resolution: InteractionResolution | null;
}

export interface CursorResolution {
  readonly cursorId: string;
  readonly valid: boolean;
  readonly semanticAction: string;
}

export const resolveCursor = (context: CursorContext): CursorResolution => {
  if (!context.hotspot) {
    return {
      cursorId: context.selectedItemId ? `inventory:${context.selectedItemId}` : "walk",
      valid: true,
      semanticAction: context.selectedItemId ? "use-item" : "walk",
    };
  }

  const valid = context.resolution?.kind === "matched";
  if (context.selectedItemId) {
    return {
      cursorId: valid ? `inventory:${context.selectedItemId}` : `inventory:${context.selectedItemId}:invalid`,
      valid,
      semanticAction: "use-item",
    };
  }

  return {
    cursorId: context.hotspot.cursor ?? (valid ? context.activeVerb : `${context.activeVerb}:invalid`),
    valid,
    semanticAction: context.activeVerb,
  };
};

export const availableVerbs = (state: RuntimeState, hotspot: Hotspot): readonly string[] => {
  const verbs = new Set<string>();

  for (const interaction of hotspot.interactions) {
    if (
      !interactionIsConsumed(state, interaction) &&
      (!interaction.when || evaluateCondition(interaction.when, state))
    ) {
      verbs.add(interaction.verb);
    }
  }

  return [...verbs].sort((left, right) => left.localeCompare(right));
};
