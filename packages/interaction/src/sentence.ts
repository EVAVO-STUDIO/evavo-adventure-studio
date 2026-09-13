import type { Id } from "@evavo/adventure-project-schema";

export type SentenceTargetKind = "scene-object" | "inventory-item";

export type SentenceTarget =
  | {
      readonly kind: "scene-object";
      readonly objectId: Id<"object">;
      readonly label: string;
    }
  | {
      readonly kind: "inventory-item";
      readonly itemId: Id<"item">;
      readonly label: string;
    };

export type SentenceSecondaryRule = "never" | "always" | "inventory-primary";

export interface SentenceVerbDefinition {
  readonly id: Id<"ui-verb">;
  readonly verb: string;
  readonly label: string;
  readonly primaryKinds: readonly SentenceTargetKind[];
  readonly secondaryRule: SentenceSecondaryRule;
  readonly secondaryKinds?: readonly SentenceTargetKind[];
  readonly preposition?: string;
}

export interface SentenceGrammar {
  readonly verbs: readonly SentenceVerbDefinition[];
  readonly emptyObjectText?: string;
}

export interface SentenceState {
  readonly verbId: Id<"ui-verb"> | null;
  readonly primary: SentenceTarget | null;
  readonly secondary: SentenceTarget | null;
}

export type SentenceSelectionResult =
  | { readonly kind: "selected"; readonly state: SentenceState }
  | { readonly kind: "invalid"; readonly state: SentenceState; readonly reason: string };

export type SentenceIntent =
  | {
      readonly kind: "incomplete";
      readonly state: SentenceState;
      readonly text: string;
    }
  | {
      readonly kind: "invalid";
      readonly state: SentenceState;
      readonly text: string;
      readonly reason: string;
    }
  | {
      readonly kind: "room-command";
      readonly state: SentenceState;
      readonly text: string;
      readonly verb: string;
      readonly objectInstanceId: Id<"object">;
      readonly itemId: Id<"item"> | null;
    }
  | {
      readonly kind: "item-combination";
      readonly state: SentenceState;
      readonly text: string;
      readonly verb: string;
      readonly primaryItemId: Id<"item">;
      readonly secondaryItemId: Id<"item">;
    };

export const createSentenceState = (verbId: Id<"ui-verb"> | null = null): SentenceState => ({
  verbId,
  primary: null,
  secondary: null,
});

const verbFor = (
  grammar: SentenceGrammar,
  verbId: Id<"ui-verb"> | null,
): SentenceVerbDefinition | null =>
  verbId ? (grammar.verbs.find((verb) => verb.id === verbId) ?? null) : null;

const targetKindAllowed = (
  target: SentenceTarget,
  kinds: readonly SentenceTargetKind[] | undefined,
): boolean => (kinds ?? []).includes(target.kind);

export const sentenceRequiresSecondary = (
  verb: SentenceVerbDefinition,
  primary: SentenceTarget | null,
): boolean => {
  if (!primary) return false;
  if (verb.secondaryRule === "always") return true;
  return verb.secondaryRule === "inventory-primary" && primary.kind === "inventory-item";
};

export const selectSentenceVerb = (
  grammar: SentenceGrammar,
  state: SentenceState,
  verbId: Id<"ui-verb">,
): SentenceSelectionResult => {
  if (!verbFor(grammar, verbId)) {
    return { kind: "invalid", state, reason: `Unknown sentence verb '${verbId}'.` };
  }
  return { kind: "selected", state: createSentenceState(verbId) };
};

export const selectSentenceTarget = (
  grammar: SentenceGrammar,
  state: SentenceState,
  target: SentenceTarget,
): SentenceSelectionResult => {
  const verb = verbFor(grammar, state.verbId);
  if (!verb) return { kind: "invalid", state, reason: "Select a verb before selecting an object." };

  if (!state.primary) {
    if (!targetKindAllowed(target, verb.primaryKinds)) {
      return {
        kind: "invalid",
        state,
        reason: `${verb.label} cannot use ${target.kind} as its first object.`,
      };
    }
    return {
      kind: "selected",
      state: { ...state, primary: target, secondary: null },
    };
  }

  if (!sentenceRequiresSecondary(verb, state.primary)) {
    if (!targetKindAllowed(target, verb.primaryKinds)) {
      return {
        kind: "invalid",
        state,
        reason: `${verb.label} cannot use ${target.kind} as its object.`,
      };
    }
    return {
      kind: "selected",
      state: { ...state, primary: target, secondary: null },
    };
  }

  if (!targetKindAllowed(target, verb.secondaryKinds)) {
    return {
      kind: "invalid",
      state,
      reason: `${verb.label} cannot use ${target.kind} as its second object.`,
    };
  }
  const sameInventoryItem =
    state.primary.kind === "inventory-item" &&
    target.kind === "inventory-item" &&
    state.primary.itemId === target.itemId;
  if (sameInventoryItem) {
    return { kind: "invalid", state, reason: "A sentence cannot use an inventory item on itself." };
  }
  return {
    kind: "selected",
    state: { ...state, secondary: target },
  };
};

const targetLabel = (target: SentenceTarget | null, fallback: string): string => target?.label ?? fallback;

export const formatSentence = (
  grammar: SentenceGrammar,
  state: SentenceState,
): string => {
  const verb = verbFor(grammar, state.verbId);
  if (!verb) return "";
  const fallback = grammar.emptyObjectText ?? "…";
  const first = targetLabel(state.primary, fallback);
  if (!sentenceRequiresSecondary(verb, state.primary)) {
    return `${verb.label} ${first}`.trim();
  }
  const preposition = verb.preposition ?? "with";
  return `${verb.label} ${first} ${preposition} ${targetLabel(state.secondary, fallback)}`.trim();
};

export const resolveSentenceIntent = (
  grammar: SentenceGrammar,
  state: SentenceState,
): SentenceIntent => {
  const text = formatSentence(grammar, state);
  const verb = verbFor(grammar, state.verbId);
  if (!verb) return { kind: "incomplete", state, text };
  if (!state.primary) return { kind: "incomplete", state, text };
  if (!targetKindAllowed(state.primary, verb.primaryKinds)) {
    return { kind: "invalid", state, text, reason: "Primary object kind is invalid for this verb." };
  }
  const needsSecondary = sentenceRequiresSecondary(verb, state.primary);
  if (needsSecondary && !state.secondary) return { kind: "incomplete", state, text };
  if (state.secondary && !targetKindAllowed(state.secondary, verb.secondaryKinds)) {
    return { kind: "invalid", state, text, reason: "Secondary object kind is invalid for this verb." };
  }

  if (!needsSecondary) {
    if (state.primary.kind === "scene-object") {
      return {
        kind: "room-command",
        state,
        text,
        verb: verb.verb,
        objectInstanceId: state.primary.objectId,
        itemId: null,
      };
    }
    return {
      kind: "incomplete",
      state,
      text,
    };
  }

  const secondary = state.secondary;
  if (!secondary) return { kind: "incomplete", state, text };
  if (state.primary.kind === "inventory-item" && secondary.kind === "scene-object") {
    return {
      kind: "room-command",
      state,
      text,
      verb: verb.verb,
      objectInstanceId: secondary.objectId,
      itemId: state.primary.itemId,
    };
  }
  if (state.primary.kind === "inventory-item" && secondary.kind === "inventory-item") {
    return {
      kind: "item-combination",
      state,
      text,
      verb: verb.verb,
      primaryItemId: state.primary.itemId,
      secondaryItemId: secondary.itemId,
    };
  }
  return {
    kind: "invalid",
    state,
    text,
    reason: "This sentence target ordering cannot be converted into a classic adventure command.",
  };
};

export const classicScumm5SentenceGrammar = (verbs: readonly {
  readonly id: Id<"ui-verb">;
  readonly verb: string;
  readonly label: string;
}[]): SentenceGrammar => ({
  emptyObjectText: "…",
  verbs: verbs.map((verb): SentenceVerbDefinition => {
    const normalized = verb.verb.toLowerCase();
    if (normalized === "use") {
      return {
        ...verb,
        primaryKinds: ["scene-object", "inventory-item"],
        secondaryRule: "inventory-primary",
        secondaryKinds: ["scene-object", "inventory-item"],
        preposition: "with",
      };
    }
    if (normalized === "give") {
      return {
        ...verb,
        primaryKinds: ["inventory-item"],
        secondaryRule: "always",
        secondaryKinds: ["scene-object"],
        preposition: "to",
      };
    }
    return {
      ...verb,
      primaryKinds: ["scene-object"],
      secondaryRule: "never",
    };
  }),
});
