export type AdventureCapabilityCategory =
  | "scene"
  | "navigation"
  | "interaction"
  | "dialogue"
  | "progression"
  | "rpg"
  | "cinematic"
  | "multi-character"
  | "action"
  | "presentation"
  | "production";

export type AdventureCapabilityStatus = "proofed" | "implemented" | "partial" | "missing";

export type AdventureCapabilityId =
  | "fixed-room"
  | "scrolling-room"
  | "panoramic-exterior"
  | "room-state-variants"
  | "day-night-room-variants"
  | "multi-elevation-room"
  | "closeup-puzzle-view"
  | "travel-map"
  | "vehicle-scene"
  | "walk-regions"
  | "per-region-perspective"
  | "multi-plane-occlusion"
  | "stateful-navigation"
  | "preferred-approach"
  | "verb-icon-interface"
  | "context-interface"
  | "parser-intent"
  | "verb-sentence-grammar"
  | "inventory"
  | "item-on-object"
  | "item-on-item"
  | "conditional-hotspots"
  | "alternate-puzzle-solutions"
  | "timed-puzzle"
  | "score"
  | "failure-retry"
  | "in-scene-dialogue"
  | "portrait-dialogue"
  | "branching-dialogue"
  | "topic-dialogue"
  | "dialogue-fact-unlocks"
  | "chapter-day-progression"
  | "research-investigation-loop"
  | "global-progression-graph"
  | "time-of-day-clock"
  | "npc-schedules"
  | "character-stats"
  | "skills-and-practice"
  | "character-classes"
  | "skill-gated-solutions"
  | "health-stamina-mana"
  | "equipment-money"
  | "real-time-combat"
  | "character-import-export"
  | "cutscene-sequences"
  | "cinematic-insets"
  | "room-cutaways"
  | "multi-protagonist-switching"
  | "branching-route-topology"
  | "action-minigame"
  | "quick-response-sequence"
  | "deterministic-save-replay"
  | "indexed-palette-lighting"
  | "native-vga-audit"
  | "localisation"
  | "full-game-evidence";

export interface AdventureCapabilityDefinition {
  readonly id: AdventureCapabilityId;
  readonly category: AdventureCapabilityCategory;
  readonly label: string;
  readonly purpose: string;
}

const capability = (
  id: AdventureCapabilityId,
  category: AdventureCapabilityCategory,
  label: string,
  purpose: string,
): AdventureCapabilityDefinition => ({ id, category, label, purpose });

export const adventureCapabilityCatalog: readonly AdventureCapabilityDefinition[] = [
  capability("fixed-room", "scene", "Fixed authored room", "Classic native room with authored visual/control/depth/interaction geometry."),
  capability("scrolling-room", "scene", "Scrolling room", "Room larger than the viewport with deterministic camera following and off-screen staging."),
  capability("panoramic-exterior", "scene", "Panoramic exterior", "Wide exterior traversal that preserves readable staging across camera movement."),
  capability("room-state-variants", "scene", "Room state variants", "Whole-room visual/interaction changes from story state without duplicating unrelated logic."),
  capability("day-night-room-variants", "scene", "Day/night variants", "Time-driven room art, lighting, inhabitants and interactions."),
  capability("multi-elevation-room", "scene", "Multi-elevation traversal", "Stairs, balconies, platforms and linked navigation elevations in one scene."),
  capability("closeup-puzzle-view", "scene", "Puzzle close-up", "Modal or cut-in detailed interaction surface for machinery, locks, maps or object manipulation."),
  capability("travel-map", "scene", "Travel/map scene", "Location graph or map used as an authored gameplay/travel surface."),
  capability("vehicle-scene", "scene", "Vehicle scene", "Vehicle interiors/exteriors, travel states and vehicle-specific interactions."),
  capability("walk-regions", "navigation", "Walk regions", "Authored walk polygons/boxes with deterministic connectivity."),
  capability("per-region-perspective", "navigation", "Per-region perspective", "Per-area scale/depth behavior comparable to classic walk-box/priority workflows."),
  capability("multi-plane-occlusion", "navigation", "Multi-plane occlusion", "Several baseline/Z foreground regions with stateful actor reveal/hide behavior."),
  capability("stateful-navigation", "navigation", "Stateful navigation", "Doors, bridges, crowds and furniture alter routes from canonical state."),
  capability("preferred-approach", "navigation", "Authored approaches", "Verb/item-aware standing positions, facing and body-clearance staging."),
  capability("verb-icon-interface", "interaction", "Verb/icon interface", "SCI-style icon verbs with period-native UI behavior."),
  capability("context-interface", "interaction", "Context interaction", "Modernized single-context interaction where a production profile requires it."),
  capability("parser-intent", "interaction", "Parser intent", "Typed command submission integrated with deterministic world actions."),
  capability("verb-sentence-grammar", "interaction", "Verb sentence grammar", "SCUMM-like verb + object + optional second-object sentence construction."),
  capability("inventory", "interaction", "Inventory", "Owned item state with UI presentation and scripted use."),
  capability("item-on-object", "interaction", "Item on object", "Inventory item used on room/NPC targets with authored approach and response."),
  capability("item-on-item", "interaction", "Item on item", "Inventory combinations and transformations."),
  capability("conditional-hotspots", "interaction", "Conditional hotspots", "Targets appear/change/disable from story/object state."),
  capability("alternate-puzzle-solutions", "interaction", "Alternate solutions", "Several valid solutions with distinct state consequences rather than cosmetic branches."),
  capability("timed-puzzle", "interaction", "Timed puzzle", "Logical-clock deadlines, countdown states and deterministic failure/recovery."),
  capability("score", "progression", "Score", "Classic one-shot score awards with stable replay/save behavior."),
  capability("failure-retry", "progression", "Failure/retry", "Game-over/failure outcomes with load/restart/private retry support."),
  capability("in-scene-dialogue", "dialogue", "In-scene dialogue", "Conversation while characters remain staged in the room."),
  capability("portrait-dialogue", "dialogue", "Portrait dialogue", "Authored close-up/portrait conversation presentation."),
  capability("branching-dialogue", "dialogue", "Branching dialogue", "Choice-driven dialogue with conditions, consequences and re-entry."),
  capability("topic-dialogue", "dialogue", "Topic dialogue", "Ask/tell topic model with discovered subjects and conditional responses."),
  capability("dialogue-fact-unlocks", "dialogue", "Dialogue fact unlocks", "Conversation/research discovers facts/topics that unlock later dialogue or actions."),
  capability("chapter-day-progression", "progression", "Chapter/day progression", "Named days/chapters with required and optional action sets and transitions."),
  capability("research-investigation-loop", "progression", "Research/investigation loop", "Evidence, research, visits and conversation facts form an investigation graph."),
  capability("global-progression-graph", "progression", "Global progression graph", "Whole-game dependencies/branches visualised and validated across rooms."),
  capability("time-of-day-clock", "progression", "Time-of-day clock", "Simulation time advances and gates world state, travel, schedules and survival needs."),
  capability("npc-schedules", "progression", "NPC schedules", "Characters move/appear/change behavior according to deterministic schedules."),
  capability("character-stats", "rpg", "Character stats", "Persistent attributes influence adventure and action outcomes."),
  capability("skills-and-practice", "rpg", "Skills and practice", "Skills improve from authored use/training rather than only story flags."),
  capability("character-classes", "rpg", "Character classes", "Class/background changes available verbs, solutions, progression and systems."),
  capability("skill-gated-solutions", "rpg", "Skill-gated solutions", "Puzzle/action resolution uses stats/skills with class-specific alternatives."),
  capability("health-stamina-mana", "rpg", "Health/stamina/mana", "Persistent survival/action resources integrated with time and combat."),
  capability("equipment-money", "rpg", "Equipment and money", "Purchases/equipment/resources affect world actions and progression."),
  capability("real-time-combat", "rpg", "Real-time combat", "Deterministic action/combat mode integrated with adventure state."),
  capability("character-import-export", "rpg", "Character import/export", "Portable character state validated across sequel/project boundaries."),
  capability("cutscene-sequences", "cinematic", "Cutscene sequences", "Deterministic camera/actor/audio choreography with skip and save-safe state."),
  capability("cinematic-insets", "cinematic", "Cinematic insets", "DGDS-style closeups/insets and editorial compositions inside gameplay."),
  capability("room-cutaways", "cinematic", "Room cutaways", "Scripted temporary views/cutaways while retaining room/world state."),
  capability("multi-protagonist-switching", "multi-character", "Multi-protagonist switching", "Several playable actors with independent location/inventory/state."),
  capability("branching-route-topology", "progression", "Branching route topology", "Major routes/acts diverge and reconverge with validated consequences."),
  capability("action-minigame", "action", "Action/minigame", "Specialized deterministic game modes embedded in adventure progression."),
  capability("quick-response-sequence", "action", "Quick-response sequence", "Timed/action insert with clear input/state/failure semantics."),
  capability("deterministic-save-replay", "production", "Deterministic saves/replays", "Mid-scene state, replay and restoration remain stable across authored systems."),
  capability("indexed-palette-lighting", "presentation", "Indexed palette lighting", "Hard and Bayer palette substitution without RGB tint/interpolation."),
  capability("native-vga-audit", "production", "Native VGA audit", "Raw 1× and integer-scale evidence prevents generic/modern retro styling."),
  capability("localisation", "production", "Localisation", "Text/UI/dialogue layout supports translated content without breaking native presentation."),
  capability("full-game-evidence", "production", "Full-game evidence", "Whole-game route/replay/screenshot evidence proves all required archetypes, not one showcase room."),
] as const;

export type AdventureReferenceGameId =
  | "kings-quest-v"
  | "gabriel-knight-sins-of-the-fathers"
  | "quest-for-glory-vga"
  | "day-of-the-tentacle"
  | "leisure-suit-larry-vga"
  | "heart-of-china"
  | "rise-of-the-dragon"
  | "indiana-jones-fate-of-atlantis";

export interface AdventureReferenceGameCapabilityProfile {
  readonly id: AdventureReferenceGameId;
  readonly label: string;
  readonly family: "sierra-sci" | "sierra-investigation" | "sierra-rpg" | "lucasarts-scumm5" | "dynamix-dgds";
  readonly required: readonly AdventureCapabilityId[];
  readonly signature: readonly AdventureCapabilityId[];
  readonly stressScenes: readonly string[];
}

const commonClassic: readonly AdventureCapabilityId[] = [
  "fixed-room",
  "walk-regions",
  "per-region-perspective",
  "multi-plane-occlusion",
  "stateful-navigation",
  "preferred-approach",
  "inventory",
  "item-on-object",
  "conditional-hotspots",
  "cutscene-sequences",
  "deterministic-save-replay",
  "native-vga-audit",
  "full-game-evidence",
];

const reference = (
  id: AdventureReferenceGameId,
  label: string,
  family: AdventureReferenceGameCapabilityProfile["family"],
  required: readonly AdventureCapabilityId[],
  signature: readonly AdventureCapabilityId[],
  stressScenes: readonly string[],
): AdventureReferenceGameCapabilityProfile => ({
  id,
  label,
  family,
  required: [...new Set([...commonClassic, ...required])],
  signature,
  stressScenes,
});

export const adventureReferenceGameCapabilities: readonly AdventureReferenceGameCapabilityProfile[] = [
  reference(
    "kings-quest-v",
    "King's Quest V",
    "sierra-sci",
    ["verb-icon-interface", "score", "failure-retry", "room-state-variants", "panoramic-exterior"],
    ["verb-icon-interface", "native-vga-audit", "panoramic-exterior"],
    [
      "Painterly exterior with long traversal, creature animation and foreground depth",
      "Dense castle/interior room with inventory-object puzzle and state change",
      "Danger/failure scene with immediate save/retry lifecycle",
      "Multi-room travel sequence proving continuity rather than disconnected plates",
    ],
  ),
  reference(
    "gabriel-knight-sins-of-the-fathers",
    "Gabriel Knight: Sins of the Fathers",
    "sierra-investigation",
    [
      "verb-icon-interface",
      "score",
      "failure-retry",
      "portrait-dialogue",
      "topic-dialogue",
      "dialogue-fact-unlocks",
      "chapter-day-progression",
      "research-investigation-loop",
      "room-state-variants",
    ],
    ["topic-dialogue", "chapter-day-progression", "research-investigation-loop", "portrait-dialogue"],
    [
      "Dense shop/interior with warm/cool light families and stateful investigative targets",
      "Portrait/topic conversation where discovered subjects unlock new responses",
      "Research location that turns reading/evidence into new facts and destinations",
      "Day transition that validates required/optional actions and revisits changed rooms",
    ],
  ),
  reference(
    "quest-for-glory-vga",
    "Quest for Glory VGA",
    "sierra-rpg",
    [
      "verb-icon-interface",
      "inventory",
      "alternate-puzzle-solutions",
      "time-of-day-clock",
      "npc-schedules",
      "character-stats",
      "skills-and-practice",
      "character-classes",
      "skill-gated-solutions",
      "health-stamina-mana",
      "equipment-money",
      "real-time-combat",
      "character-import-export",
      "day-night-room-variants",
    ],
    ["character-classes", "skills-and-practice", "skill-gated-solutions", "real-time-combat", "time-of-day-clock"],
    [
      "Town hub whose NPC availability and room presentation change by time of day",
      "One obstacle solved differently by fighter, magic-user and thief capabilities",
      "Training/practice scene where repeated authored use grows skills",
      "Combat encounter sharing health/stamina/state with the adventure world",
      "Character export/import round trip retaining validated stats and class state",
    ],
  ),
  reference(
    "day-of-the-tentacle",
    "Day of the Tentacle",
    "lucasarts-scumm5",
    [
      "verb-sentence-grammar",
      "item-on-item",
      "alternate-puzzle-solutions",
      "scrolling-room",
      "room-cutaways",
      "multi-protagonist-switching",
      "branching-route-topology",
    ],
    ["verb-sentence-grammar", "multi-protagonist-switching", "room-cutaways", "item-on-item"],
    [
      "Wide walk-box room with several Z-mask crossings and scaled actors",
      "Three-character/era state puzzle where one action changes another protagonist's world",
      "Multi-step inventory combination with authored comic choreography",
      "Cutaway gag that temporarily leaves the room but preserves scripts and actor state",
    ],
  ),
  reference(
    "leisure-suit-larry-vga",
    "Leisure Suit Larry VGA",
    "sierra-sci",
    ["verb-icon-interface", "score", "failure-retry", "branching-dialogue", "timed-puzzle", "room-state-variants"],
    ["verb-icon-interface", "branching-dialogue", "score", "failure-retry"],
    [
      "Social interior with several characters, conditional dialogue and inventory interactions",
      "Timed/comedic failure sequence with period-style recovery",
      "Stateful venue whose interactables and responses change after story progress",
    ],
  ),
  reference(
    "heart-of-china",
    "Heart of China",
    "dynamix-dgds",
    [
      "branching-dialogue",
      "branching-route-topology",
      "multi-protagonist-switching",
      "cinematic-insets",
      "travel-map",
      "vehicle-scene",
      "action-minigame",
      "quick-response-sequence",
    ],
    ["multi-protagonist-switching", "branching-route-topology", "cinematic-insets", "travel-map"],
    [
      "Branch decision that materially changes later locations and available interactions",
      "Playable-character switch with separate inventory/location state",
      "Travel/map interlude leading into a radically different scene composition",
      "Cinematic inset/close-up followed by an action insert without losing adventure state",
    ],
  ),
  reference(
    "rise-of-the-dragon",
    "Rise of the Dragon",
    "dynamix-dgds",
    [
      "branching-dialogue",
      "branching-route-topology",
      "cinematic-insets",
      "vehicle-scene",
      "timed-puzzle",
      "action-minigame",
      "quick-response-sequence",
      "room-state-variants",
    ],
    ["cinematic-insets", "branching-route-topology", "timed-puzzle", "action-minigame"],
    [
      "Dark city room with aggressive foreground composition and hard editorial cut-in",
      "Timed event whose outcome changes the location graph rather than only a message",
      "Vehicle/action sequence with deterministic failure and return to adventure state",
      "Branching conversation/cutscene that changes subsequent room state",
    ],
  ),
  reference(
    "indiana-jones-fate-of-atlantis",
    "Indiana Jones and the Fate of Atlantis",
    "lucasarts-scumm5",
    [
      "verb-sentence-grammar",
      "item-on-item",
      "branching-dialogue",
      "alternate-puzzle-solutions",
      "branching-route-topology",
      "travel-map",
      "room-cutaways",
      "action-minigame",
    ],
    ["branching-route-topology", "verb-sentence-grammar", "alternate-puzzle-solutions", "travel-map"],
    [
      "SCUMM5 room with walk boxes, Z masks, item-on-object/item interactions and local scripting",
      "Major route choice that creates distinct puzzle/combat/social progression paths",
      "Travel map linking destinations whose availability changes with discovered information",
      "Action/fight insert returning deterministically to the shared story graph",
    ],
  ),
] as const;

export interface AdventureCapabilityCoverage {
  readonly id: AdventureCapabilityId;
  readonly status: AdventureCapabilityStatus;
  readonly evidence: string;
  readonly nextProof?: string;
}

export const currentAdventureCapabilityCoverage: readonly AdventureCapabilityCoverage[] = adventureCapabilityCatalog.map(
  ({ id }): AdventureCapabilityCoverage => {
    const proofed = new Set<AdventureCapabilityId>([
      "fixed-room",
      "scrolling-room",
      "walk-regions",
      "per-region-perspective",
      "multi-plane-occlusion",
      "stateful-navigation",
      "preferred-approach",
      "verb-icon-interface",
      "context-interface",
      "inventory",
      "item-on-object",
      "conditional-hotspots",
      "score",
      "failure-retry",
      "in-scene-dialogue",
      "cutscene-sequences",
      "deterministic-save-replay",
      "indexed-palette-lighting",
      "native-vga-audit",
    ]);
    const implemented = new Set<AdventureCapabilityId>([
      "multi-elevation-room",
      "parser-intent",
      "branching-dialogue",
      "portrait-dialogue",
      "room-state-variants",
      "global-progression-graph",
      "localisation",
    ]);
    const partial = new Set<AdventureCapabilityId>([
      "panoramic-exterior",
      "closeup-puzzle-view",
      "item-on-item",
      "alternate-puzzle-solutions",
      "timed-puzzle",
      "topic-dialogue",
      "dialogue-fact-unlocks",
      "chapter-day-progression",
      "research-investigation-loop",
      "travel-map",
      "vehicle-scene",
      "branching-route-topology",
      "room-cutaways",
      "cinematic-insets",
      "quick-response-sequence",
      "full-game-evidence",
    ]);
    if (proofed.has(id)) return { id, status: "proofed", evidence: "Existing runtime/editor proof and regression coverage." };
    if (implemented.has(id)) return { id, status: "implemented", evidence: "Core contracts/editor/runtime support exist, but no full stress proof yet." };
    if (partial.has(id)) return { id, status: "partial", evidence: "Some primitives exist, but the complete gameplay grammar is not yet first-class/proofed." };
    return { id, status: "missing", evidence: "No first-class end-to-end capability proof exists yet." };
  },
);

export interface AdventureFullGameReadiness {
  readonly referenceGameId: AdventureReferenceGameId;
  readonly label: string;
  readonly requiredCount: number;
  readonly proofedCount: number;
  readonly implementedCount: number;
  readonly partialCount: number;
  readonly missingCount: number;
  readonly ready: boolean;
  readonly gaps: readonly AdventureCapabilityCoverage[];
  readonly stressScenes: readonly string[];
}

const coverageById = new Map(currentAdventureCapabilityCoverage.map((entry) => [entry.id, entry] as const));

export const evaluateAdventureReferenceGameReadiness = (
  referenceGameId: AdventureReferenceGameId,
): AdventureFullGameReadiness => {
  const profile = adventureReferenceGameCapabilities.find((candidate) => candidate.id === referenceGameId);
  if (!profile) throw new Error(`Unknown adventure reference game '${referenceGameId}'.`);
  const required = profile.required.map((id) => coverageById.get(id) ?? { id, status: "missing" as const, evidence: "Capability has no coverage record." });
  const count = (status: AdventureCapabilityStatus): number => required.filter((entry) => entry.status === status).length;
  const gaps = required.filter((entry) => entry.status !== "proofed");
  return {
    referenceGameId,
    label: profile.label,
    requiredCount: required.length,
    proofedCount: count("proofed"),
    implementedCount: count("implemented"),
    partialCount: count("partial"),
    missingCount: count("missing"),
    ready: gaps.length === 0,
    gaps,
    stressScenes: profile.stressScenes,
  };
};

export const evaluateAllAdventureReferenceGames = (): readonly AdventureFullGameReadiness[] =>
  adventureReferenceGameCapabilities.map((profile) => evaluateAdventureReferenceGameReadiness(profile.id));

export const validateAdventureCapabilityMatrix = (): readonly string[] => {
  const issues: string[] = [];
  const catalog = new Set(adventureCapabilityCatalog.map((entry) => entry.id));
  const coverage = new Set(currentAdventureCapabilityCoverage.map((entry) => entry.id));
  if (catalog.size !== adventureCapabilityCatalog.length) issues.push("Capability catalog contains duplicate IDs.");
  if (coverage.size !== adventureCapabilityCatalog.length) issues.push("Capability coverage must contain exactly one record per catalog capability.");
  for (const profile of adventureReferenceGameCapabilities) {
    if (profile.required.length === 0) issues.push(`${profile.label} has no required capabilities.`);
    if (profile.stressScenes.length < 3) issues.push(`${profile.label} needs at least three full-game stress scenes.`);
    for (const id of [...profile.required, ...profile.signature]) {
      if (!catalog.has(id)) issues.push(`${profile.label} references unknown capability '${id}'.`);
    }
  }
  return issues.sort((left, right) => left.localeCompare(right));
};
