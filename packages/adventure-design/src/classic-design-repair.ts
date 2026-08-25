export type ClassicDesignRepairId =
  | "pixel-hunting"
  | "hidden-dead-end"
  | "opaque-failure"
  | "retry-friction"
  | "repeated-busywork"
  | "single-obscure-solution"
  | "unreadable-timing"
  | "save-restriction"
  | "social-route-poisoning"
  | "procedural-trial-and-error";

export interface ClassicDesignRepairRule {
  readonly id: ClassicDesignRepairId;
  readonly legacyProblem: string;
  readonly repair: string;
  readonly preserve: readonly string[];
  readonly prohibit: readonly string[];
}

export interface ClassicDesignRepairPolicy {
  readonly id: string;
  readonly label: string;
  readonly principle: string;
  readonly rules: readonly ClassicDesignRepairRule[];
}

const sharedRules: readonly ClassicDesignRepairRule[] = [
  {
    id: "pixel-hunting",
    legacyProblem: "Important native-resolution targets can become difficult to acquire even when the player understands the scene.",
    repair: "Keep the visible target at authentic size but add authored invisible click-comfort regions and readable cursor feedback.",
    preserve: ["native object scale", "period cursor grammar", "room composition", "1x visual density"],
    prohibit: ["visible hotspot outlines", "floating interaction icons", "modern glow", "oversized replacement props"],
  },
  {
    id: "hidden-dead-end",
    legacyProblem: "A plausible earlier action can silently make later progression impossible.",
    repair: "Use progression analysis and alternate/recovery routes so a failed branch is visible, recoverable or deliberately terminal.",
    preserve: ["consequence", "branching", "failure states", "inventory logic"],
    prohibit: ["silent unwinnable state", "unannounced permanent route loss", "modern objective checklist"],
  },
  {
    id: "opaque-failure",
    legacyProblem: "The player can fail without learning which fictional or procedural rule was violated.",
    repair: "Keep authored failure but provide specific in-world feedback and retain enough state for a meaningful retry.",
    preserve: ["period narration", "comic/dramatic failure", "score consequence", "fictional stakes"],
    prohibit: ["generic ERROR message", "solution spoiler", "out-of-world tutorial overlay"],
  },
  {
    id: "retry-friction",
    legacyProblem: "Failure can force repeated traversal, dialogue or setup that the player has already mastered.",
    repair: "Use deterministic pre-action checkpoints, safe retry points and skippable completed setup while retaining the original consequence.",
    preserve: ["failure screen", "timing pressure", "danger", "sequence choreography"],
    prohibit: ["mandatory replay of solved setup", "overwriting manual saves", "save-scumming as required design"],
  },
  {
    id: "repeated-busywork",
    legacyProblem: "Known information or repeated actions can require unnecessary re-entry after the player has already demonstrated understanding.",
    repair: "Persist semantic knowledge and completed one-shot work; repeat only when the fiction meaningfully changes.",
    preserve: ["world state", "conversation continuity", "inventory consequence", "chapter structure"],
    prohibit: ["automatic puzzle solving", "quest-log replacement", "teleporting past unsolved content"],
  },
  {
    id: "single-obscure-solution",
    legacyProblem: "A puzzle may reject a sensible solution because only one arbitrary verb/item path was authored.",
    repair: "Author multiple fictionally valid solutions or explicit feedback that teaches why an alternative cannot work.",
    preserve: ["puzzle identity", "inventory economy", "character voice", "world rules"],
    prohibit: ["universal use-anything fallback", "solution highlighting", "modern hint arrow"],
  },
  {
    id: "unreadable-timing",
    legacyProblem: "A timed state can expire before the player can reasonably read or understand the scene at native scale.",
    repair: "Keep deterministic timing but separate reading/recognition time from challenge time and telegraph the active window in-world.",
    preserve: ["time pressure", "comic timing", "schedule changes", "fixed-tick determinism"],
    prohibit: ["arbitrary real-time race during text reading", "modern countdown HUD unless fictionally present"],
  },
  {
    id: "save-restriction",
    legacyProblem: "Long stretches can prohibit saves for technical rather than dramatic reasons.",
    repair: "Allow stable saves at deterministic boundaries and provide private retry checkpoints around terminal actions.",
    preserve: ["cutscene boundaries", "specialized-mode integrity", "terminal outcomes"],
    prohibit: ["saving corrupt mid-transition state", "forcing long replay after ordinary failure"],
  },
];

export const classicAdventureDesignRepairPolicy: ClassicDesignRepairPolicy = {
  id: "classic-authentic-repaired-friction",
  label: "Authentic grammar, repaired friction",
  principle:
    "Preserve the original era's pixels, interface grammar, pacing language, authored consequence and world logic while removing friction that tests patience, cursor precision or foreknowledge instead of player understanding.",
  rules: sharedRules,
};

export interface ShowcaseDesignRepairProfile {
  readonly showcaseId: string;
  readonly referencePressure: string;
  readonly requiredRuleIds: readonly ClassicDesignRepairId[];
  readonly additionalRules: readonly ClassicDesignRepairRule[];
  readonly doNotModernize: readonly string[];
}

export const showcaseDesignRepairProfiles: readonly ShowcaseDesignRepairProfile[] = [
  {
    showcaseId: "open-case",
    referencePressure: "Police Quest IV / late Sierra procedural investigation",
    requiredRuleIds: [
      "pixel-hunting",
      "hidden-dead-end",
      "opaque-failure",
      "retry-friction",
      "repeated-busywork",
      "procedural-trial-and-error",
    ],
    additionalRules: [
      {
        id: "procedural-trial-and-error",
        legacyProblem: "Procedure can become memorisation of an exact click order rather than understanding why the order matters.",
        repair: "Keep procedural sequencing but make the fictional/professional reason legible through scene state, notes and specific failure feedback; retain unrelated evidence/case progress when recovering.",
        preserve: ["procedure", "evidence custody", "case consequences", "professional tone"],
        prohibit: ["quest objective checklist", "automatic procedure prompt", "silent case corruption"],
      },
    ],
    doNotModernize: [
      "Do not turn the caseboard into a modern quest tracker.",
      "Do not outline evidence or display omniscient evidence markers.",
      "Do not replace grounded interrogation with a visible morality/credibility meter.",
    ],
  },
  {
    showcaseId: "after-hours",
    referencePressure: "Leisure Suit Larry VGA / Sierra social comedy",
    requiredRuleIds: [
      "pixel-hunting",
      "hidden-dead-end",
      "opaque-failure",
      "retry-friction",
      "single-obscure-solution",
      "unreadable-timing",
      "social-route-poisoning",
    ],
    additionalRules: [
      {
        id: "social-route-poisoning",
        legacyProblem: "One awkward dialogue choice can permanently destroy a social route without the player understanding the consequence.",
        repair: "Allow embarrassment, score/time cost or changed reactions while retaining another credible recovery or alternate social route unless the fiction clearly signals a terminal choice.",
        preserve: ["awkward comedy", "social consequence", "character memory", "venue access"],
        prohibit: ["relationship meter", "best-answer highlight", "silent permanent rejection"],
      },
    ],
    doNotModernize: [
      "Do not add romance meters or approval bars.",
      "Do not flatten comic pauses into instant modern dialogue.",
      "Do not replace inventory/social puzzles with dialogue-only choice funnels.",
    ],
  },
  {
    showcaseId: "cold-meridian",
    referencePressure: "modern-retro cinematic/noir adventure",
    requiredRuleIds: [
      "pixel-hunting",
      "hidden-dead-end",
      "opaque-failure",
      "retry-friction",
      "single-obscure-solution",
      "save-restriction",
    ],
    additionalRules: [],
    doNotModernize: [
      "Do not use bloom, chromatic aberration, scanline overlays or VHS filters to manufacture atmosphere.",
      "Do not add floating quest markers or objective lists.",
      "Do not merge protagonist knowledge until an authored exchange occurs.",
      "Do not make action inserts punish the player with long no-save replay corridors.",
    ],
  },
] as const;

export const designRepairProfileForShowcase = (
  showcaseId: string,
): ShowcaseDesignRepairProfile | null =>
  showcaseDesignRepairProfiles.find((profile) => profile.showcaseId === showcaseId) ?? null;

export const validateShowcaseDesignRepairProfiles = (): readonly string[] => {
  const issues: string[] = [];
  const shared = new Set(classicAdventureDesignRepairPolicy.rules.map((rule) => rule.id));
  for (const profile of showcaseDesignRepairProfiles) {
    const additional = new Set(profile.additionalRules.map((rule) => rule.id));
    for (const ruleId of profile.requiredRuleIds) {
      if (!shared.has(ruleId) && !additional.has(ruleId)) {
        issues.push(`${profile.showcaseId} requires unknown design-repair rule '${ruleId}'.`);
      }
    }
    if (profile.doNotModernize.length === 0) {
      issues.push(`${profile.showcaseId} must declare at least one do-not-modernize rule.`);
    }
  }
  return issues.sort((left, right) => left.localeCompare(right));
};
