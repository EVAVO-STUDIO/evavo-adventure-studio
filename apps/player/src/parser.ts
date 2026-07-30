import type { Id } from "@evavo/adventure-project-schema";
import type { RuntimeBundle } from "@evavo/adventure-runtime-bundle";
import type { InteractiveRuntimeWorldState } from "@evavo/adventure-scene-runtime/commands";
import { resolveSceneObjectHotspots } from "@evavo/adventure-scene-runtime/interactions";
import type { UiSkin } from "@evavo/adventure-ui-skin";

export interface ParserBufferState {
  readonly text: string;
  readonly history: readonly string[];
  readonly historyIndex: number | null;
  readonly draftBeforeHistory: string;
  readonly focused: boolean;
}

export type ParserKeyInput =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "backspace" }
  | { readonly kind: "delete-word" }
  | { readonly kind: "history-previous" }
  | { readonly kind: "history-next" }
  | { readonly kind: "submit" }
  | { readonly kind: "clear" }
  | { readonly kind: "focus" }
  | { readonly kind: "blur" };

export interface ParserEditResult {
  readonly state: ParserBufferState;
  readonly submitted: string | null;
  readonly handled: boolean;
}

export type ParserCommandResolution =
  | {
      readonly kind: "object-command";
      readonly verb: string;
      readonly objectInstanceId: Id<"object">;
      readonly itemId: Id<"item"> | null;
      readonly targetName: string;
    }
  | { readonly kind: "scene-look"; readonly text: string }
  | { readonly kind: "inventory"; readonly text: string }
  | { readonly kind: "help"; readonly text: string }
  | {
      readonly kind: "rejected";
      readonly reason:
        | "empty"
        | "unknown-verb"
        | "missing-target"
        | "unknown-target"
        | "ambiguous-target"
        | "unknown-item";
      readonly text: string;
    };

const MAXIMUM_PARSER_LENGTH = 120;
const MAXIMUM_HISTORY = 20;

export const createParserBufferState = (): ParserBufferState => ({
  text: "",
  history: [],
  historyIndex: null,
  draftBeforeHistory: "",
  focused: false,
});

const printableText = (value: string): string =>
  [...value]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 0x20 && codePoint !== 0x7f;
    })
    .join("");

const withoutLastCodePoint = (value: string): string => {
  const characters = [...value];
  characters.pop();
  return characters.join("");
};

const withoutLastWord = (value: string): string =>
  value.trimEnd().replace(/\S+\s*$/u, "");

const withText = (
  state: ParserBufferState,
  text: string,
): ParserBufferState => ({
  ...state,
  text: [...text].slice(0, MAXIMUM_PARSER_LENGTH).join(""),
  historyIndex: null,
  draftBeforeHistory: "",
});

export const editParserBuffer = (
  state: ParserBufferState,
  input: ParserKeyInput,
): ParserEditResult => {
  if (input.kind === "focus") {
    return { state: { ...state, focused: true }, submitted: null, handled: true };
  }
  if (input.kind === "blur") {
    return { state: { ...state, focused: false }, submitted: null, handled: true };
  }
  if (!state.focused) {
    return { state, submitted: null, handled: false };
  }

  switch (input.kind) {
    case "text": {
      const text = printableText(input.text);
      return {
        state: withText(state, `${state.text}${text}`),
        submitted: null,
        handled: text.length > 0,
      };
    }
    case "backspace":
      return {
        state: withText(state, withoutLastCodePoint(state.text)),
        submitted: null,
        handled: true,
      };
    case "delete-word":
      return {
        state: withText(state, withoutLastWord(state.text)),
        submitted: null,
        handled: true,
      };
    case "history-previous": {
      if (state.history.length === 0) {
        return { state, submitted: null, handled: true };
      }
      const historyIndex =
        state.historyIndex === null
          ? state.history.length - 1
          : Math.max(0, state.historyIndex - 1);
      return {
        state: {
          ...state,
          text: state.history[historyIndex] ?? state.text,
          historyIndex,
          draftBeforeHistory:
            state.historyIndex === null ? state.text : state.draftBeforeHistory,
        },
        submitted: null,
        handled: true,
      };
    }
    case "history-next": {
      if (state.historyIndex === null) {
        return { state, submitted: null, handled: true };
      }
      const nextIndex = state.historyIndex + 1;
      if (nextIndex >= state.history.length) {
        return {
          state: {
            ...state,
            text: state.draftBeforeHistory,
            historyIndex: null,
            draftBeforeHistory: "",
          },
          submitted: null,
          handled: true,
        };
      }
      return {
        state: {
          ...state,
          text: state.history[nextIndex] ?? state.text,
          historyIndex: nextIndex,
        },
        submitted: null,
        handled: true,
      };
    }
    case "submit": {
      const submitted = state.text.trim();
      if (!submitted) {
        return { state: withText(state, ""), submitted: null, handled: true };
      }
      const history = [
        ...state.history.filter((entry) => entry !== submitted),
        submitted,
      ].slice(-MAXIMUM_HISTORY);
      return {
        state: {
          ...state,
          text: "",
          history,
          historyIndex: null,
          draftBeforeHistory: "",
        },
        submitted,
        handled: true,
      };
    }
    case "clear":
      return {
        state: { ...withText(state, ""), focused: false },
        submitted: null,
        handled: true,
      };
    case "focus":
    case "blur":
      return { state, submitted: null, handled: true };
  }
};

export const parserKeyInputFromKeyboardEvent = (
  event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">,
): ParserKeyInput | null => {
  if (event.key === "Enter") return { kind: "submit" };
  if (event.key === "Escape") return { kind: "clear" };
  if (event.key === "Backspace") {
    return event.ctrlKey || event.metaKey
      ? { kind: "delete-word" }
      : { kind: "backspace" };
  }
  if (event.key === "ArrowUp") return { kind: "history-previous" };
  if (event.key === "ArrowDown") return { kind: "history-next" };
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  return [...event.key].length === 1 ? { kind: "text", text: event.key } : null;
};

const normalizePhrase = (value: string): string =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}\s'-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

const withoutArticle = (value: string): string =>
  value.replace(/^(?:the|a|an)\s+/u, "");

const verbAliases = (skin: UiSkin): readonly {
  readonly alias: string;
  readonly verb: string;
}[] => {
  const aliases = new Map<string, string>();
  for (const verb of skin.verbs) {
    aliases.set(normalizePhrase(verb.verb), verb.verb);
    aliases.set(normalizePhrase(verb.label), verb.verb);
  }
  const common: Readonly<Record<string, string>> = {
    "look at": "look",
    examine: "look",
    inspect: "look",
    "pick up": "take",
    get: "take",
    speak: "talk",
    "speak to": "talk",
    "talk to": "talk",
  };
  for (const [alias, verb] of Object.entries(common)) {
    if (skin.verbs.some((candidate) => candidate.verb === verb)) {
      aliases.set(alias, verb);
    }
  }
  return [...aliases]
    .map(([alias, verb]) => ({ alias, verb }))
    .sort((left, right) => right.alias.length - left.alias.length);
};

const inventoryItem = (
  bundle: Pick<RuntimeBundle, "inventoryItems">,
  world: InteractiveRuntimeWorldState,
  phrase: string,
) => {
  const normalized = withoutArticle(normalizePhrase(phrase));
  return bundle.inventoryItems.find(
    (item) =>
      world.story.inventory.includes(item.id) &&
      (withoutArticle(normalizePhrase(item.name)) === normalized ||
        normalizePhrase(item.id).endsWith(normalized)),
  );
};

export const resolveParserCommand = (
  bundle: RuntimeBundle,
  world: InteractiveRuntimeWorldState,
  skin: UiSkin,
  input: string,
): ParserCommandResolution => {
  const command = normalizePhrase(input);
  if (!command) {
    return { kind: "rejected", reason: "empty", text: "TYPE A COMMAND" };
  }
  if (command === "help" || command === "verbs") {
    return {
      kind: "help",
      text: skin.verbs.map((verb) => verb.label).join(" • ") || "NO VERBS",
    };
  }
  if (command === "inventory" || command === "inv" || command === "i") {
    const names = bundle.inventoryItems
      .filter((item) => world.story.inventory.includes(item.id))
      .map((item) => item.name.toUpperCase());
    return {
      kind: "inventory",
      text: names.length > 0 ? names.join(" • ") : "INVENTORY EMPTY",
    };
  }

  const matchedVerb = verbAliases(skin).find(
    ({ alias }) => command === alias || command.startsWith(`${alias} `),
  );
  if (!matchedVerb) {
    return {
      kind: "rejected",
      reason: "unknown-verb",
      text: "I DO NOT KNOW THAT VERB",
    };
  }

  let targetPhrase = command.slice(matchedVerb.alias.length).trim();
  targetPhrase = targetPhrase.replace(/^(?:at|to)\s+/u, "");
  if (!targetPhrase) {
    if (matchedVerb.verb === "look") {
      const scene = bundle.scenes.find(
        (candidate) => candidate.id === world.story.currentSceneId,
      );
      return {
        kind: "scene-look",
        text: scene ? scene.name.toUpperCase() : "NOTHING SPECIAL",
      };
    }
    return {
      kind: "rejected",
      reason: "missing-target",
      text: `${matchedVerb.verb.toUpperCase()} WHAT?`,
    };
  }

  let itemId: Id<"item"> | null = null;
  if (matchedVerb.verb === "use") {
    const onMatch = /^(.*?)\s+(?:on|with)\s+(.+)$/u.exec(targetPhrase);
    if (onMatch) {
      const item = inventoryItem(bundle, world, onMatch[1] ?? "");
      if (!item) {
        return {
          kind: "rejected",
          reason: "unknown-item",
          text: "YOU ARE NOT CARRYING THAT",
        };
      }
      itemId = item.id;
      targetPhrase = onMatch[2] ?? targetPhrase;
    }
  }

  const target = withoutArticle(normalizePhrase(targetPhrase));
  const hotspots = resolveSceneObjectHotspots(bundle, world);
  const exact = hotspots.filter(
    (candidate) =>
      withoutArticle(normalizePhrase(candidate.hotspot.name)) === target ||
      normalizePhrase(candidate.objectInstanceId).endsWith(target) ||
      normalizePhrase(candidate.definitionId).endsWith(target),
  );
  const candidates =
    exact.length > 0
      ? exact
      : hotspots.filter((candidate) =>
          withoutArticle(normalizePhrase(candidate.hotspot.name)).includes(target),
        );
  if (candidates.length === 0) {
    return {
      kind: "rejected",
      reason: "unknown-target",
      text: "I CANNOT SEE THAT HERE",
    };
  }
  if (candidates.length > 1) {
    return {
      kind: "rejected",
      reason: "ambiguous-target",
      text: "BE MORE SPECIFIC",
    };
  }
  const resolved = candidates[0]!;
  return {
    kind: "object-command",
    verb: matchedVerb.verb,
    objectInstanceId: resolved.objectInstanceId,
    itemId,
    targetName: resolved.hotspot.name,
  };
};
