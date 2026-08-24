import type {
  AdventureCapabilityId,
  AdventureReferenceGameId,
} from "./full-game-capabilities.js";

export type AdventureSceneArchetypeId =
  | "classic-room"
  | "scrolling-exterior"
  | "hub-location"
  | "multi-level-interior"
  | "state-variant-room"
  | "dialogue-closeup"
  | "investigation-research"
  | "puzzle-closeup"
  | "travel-map"
  | "vehicle-interior"
  | "vehicle-exterior"
  | "combat-arena"
  | "action-insert"
  | "timed-danger"
  | "cinematic-inset"
  | "cutaway-montage"
  | "multi-protagonist-cross-state"
  | "day-night-location"
  | "shop-economy"
  | "training-practice"
  | "chapter-transition"
  | "failure-outcome";

export interface AdventureSceneArchetype {
  readonly id: AdventureSceneArchetypeId;
  readonly label: string;
  readonly description: string;
  readonly requiredCapabilities: readonly AdventureCapabilityId[];
  readonly authoringSurfaces: readonly string[];
  readonly referenceGames: readonly AdventureReferenceGameId[];
  readonly qaQuestions: readonly string[];
}

const archetype = (
  id: AdventureSceneArchetypeId,
  label: string,
  description: string,
  requiredCapabilities: readonly AdventureCapabilityId[],
  authoringSurfaces: readonly string[],
  referenceGames: readonly AdventureReferenceGameId[],
  qaQuestions: readonly string[],
): AdventureSceneArchetype => ({
  id,
  label,
  description,
  requiredCapabilities,
  authoringSurfaces,
  referenceGames,
  qaQuestions,
});

export const adventureSceneArchetypes: readonly AdventureSceneArchetype[] = [
  archetype(
    "classic-room",
    "Classic room",
    "A fixed authored room where movement, depth, occlusion and practical interactions share one native coordinate system.",
    ["fixed-room", "walk-regions", "per-region-perspective", "multi-plane-occlusion", "preferred-approach", "conditional-hotspots"],
    ["ART", "WALK", "CONTROL", "DEPTH", "OCCLUSION", "HOTSPOTS", "APPROACH", "ACTORS"],
    ["kings-quest-v", "gabriel-knight-sins-of-the-fathers", "quest-for-glory-vga", "leisure-suit-larry-vga", "day-of-the-tentacle", "indiana-jones-fate-of-atlantis", "heart-of-china", "rise-of-the-dragon"],
    [
      "Does the room read at raw 1× before any debug overlay is shown?",
      "Can the actor reach every required interaction without body clipping?",
      "Do foreground priorities feel painted into the room rather than layered on top?",
    ],
  ),
  archetype(
    "scrolling-exterior",
    "Scrolling exterior",
    "A scene wider/taller than the viewport where camera movement is part of composition and puzzle readability.",
    ["scrolling-room", "panoramic-exterior", "walk-regions", "per-region-perspective", "multi-plane-occlusion"],
    ["ART", "CAMERA", "WALK", "DEPTH", "OCCLUSION", "ENTRY", "DEBUG"],
    ["kings-quest-v", "quest-for-glory-vga", "day-of-the-tentacle", "indiana-jones-fate-of-atlantis"],
    [
      "Do important exits/targets enter frame deliberately rather than appearing by accident during camera follow?",
      "Does perspective remain coherent across the entire scroll range?",
      "Can replay restore camera/actor state without a jump?",
    ],
  ),
  archetype(
    "hub-location",
    "Hub location",
    "A location with several exits/NPCs whose availability changes from story, time or route state.",
    ["global-progression-graph", "stateful-navigation", "conditional-hotspots", "room-state-variants"],
    ["ART", "CONTROL", "HOTSPOTS", "PROGRESSION", "NPC STATE", "DEBUG"],
    ["gabriel-knight-sins-of-the-fathers", "quest-for-glory-vga", "leisure-suit-larry-vga", "indiana-jones-fate-of-atlantis"],
    [
      "Can every exit explain why it is unavailable instead of becoming a dead hotspot?",
      "Does returning later expose changed world state cleanly?",
      "Can the whole-game graph prove there is no accidental progression lock?",
    ],
  ),
  archetype(
    "multi-level-interior",
    "Multi-level interior",
    "One room with stairs/platforms/balconies and several elevation/occlusion relationships.",
    ["multi-elevation-room", "walk-regions", "per-region-perspective", "multi-plane-occlusion", "stateful-navigation"],
    ["WALK", "CONTROL", "DEPTH", "OCCLUSION", "ENTRY", "ACTORS"],
    ["kings-quest-v", "quest-for-glory-vga", "day-of-the-tentacle", "indiana-jones-fate-of-atlantis"],
    [
      "Does changing elevation alter draw priority and perspective consistently?",
      "Can actors cross stairs/landings without scale pops?",
      "Are entrances/exits authored on the correct elevation?",
    ],
  ),
  archetype(
    "state-variant-room",
    "State-variant room",
    "A location revisited in materially different story states without copying the entire room implementation.",
    ["room-state-variants", "conditional-hotspots", "stateful-navigation", "global-progression-graph"],
    ["ART VARIANTS", "OBJECT STATE", "CONTROL", "LIGHT", "PROGRESSION"],
    ["gabriel-knight-sins-of-the-fathers", "leisure-suit-larry-vga", "rise-of-the-dragon", "day-of-the-tentacle"],
    [
      "Do changed visuals and changed interactions share the same canonical state?",
      "Can old saves migrate into the new state without stale geometry?",
      "Does the Director show the variant rather than forcing authors to infer it from flags?",
    ],
  ),
  archetype(
    "dialogue-closeup",
    "Dialogue close-up",
    "Portrait/inset conversation with choices/topics while preserving the underlying adventure state.",
    ["portrait-dialogue", "branching-dialogue", "topic-dialogue", "dialogue-fact-unlocks"],
    ["PORTRAITS", "TOPICS", "CHOICES", "FACTS", "AUDIO", "RETURN STATE"],
    ["gabriel-knight-sins-of-the-fathers", "heart-of-china", "rise-of-the-dragon"],
    [
      "Can topics be discovered, exhausted, hidden and rediscovered deterministically?",
      "Does leaving dialogue restore the room exactly?",
      "Are portrait composition and text density period-appropriate at native resolution?",
    ],
  ),
  archetype(
    "investigation-research",
    "Investigation / research",
    "Reading, research, evidence and conversation facts produce new topics, locations or chapter progress.",
    ["research-investigation-loop", "dialogue-fact-unlocks", "topic-dialogue", "chapter-day-progression", "global-progression-graph"],
    ["EVIDENCE", "FACTS", "TOPICS", "SOURCE", "PROGRESSION", "REVISIT"],
    ["gabriel-knight-sins-of-the-fathers", "indiana-jones-fate-of-atlantis"],
    [
      "Can the player understand what was learned without a modern quest checklist?",
      "Can optional research add context without blocking required progression?",
      "Do discovered facts unlock the right dialogue/location edges and no others?",
    ],
  ),
  archetype(
    "puzzle-closeup",
    "Puzzle close-up",
    "A detailed modal/cut-in interaction for locks, machinery, documents, controls or item assembly.",
    ["closeup-puzzle-view", "item-on-object", "item-on-item", "conditional-hotspots", "deterministic-save-replay"],
    ["ART", "LOCAL HOTSPOTS", "ITEM INPUT", "STATE", "RETURN", "DEBUG"],
    ["day-of-the-tentacle", "indiana-jones-fate-of-atlantis", "rise-of-the-dragon", "heart-of-china"],
    [
      "Does the close-up operate in native pixels rather than a modern high-resolution overlay?",
      "Can it save/restore mid-puzzle if the title family permits it?",
      "Does exiting preserve partial puzzle state intentionally?",
    ],
  ),
  archetype(
    "travel-map",
    "Travel map",
    "A map/location graph where discovered destinations and route choices form gameplay.",
    ["travel-map", "global-progression-graph", "branching-route-topology", "conditional-hotspots"],
    ["MAP ART", "DESTINATIONS", "ROUTES", "LOCKS", "TRANSITIONS", "STATE"],
    ["heart-of-china", "indiana-jones-fate-of-atlantis", "quest-for-glory-vga"],
    [
      "Are unavailable destinations hidden/disabled according to the reference grammar rather than modern lock icons?",
      "Can route choice produce a materially different later graph?",
      "Are travel transitions deterministic and save-safe?",
    ],
  ),
  archetype(
    "vehicle-interior",
    "Vehicle interior",
    "Cabin/cockpit/train/car scene with vehicle-specific state, controls and travel context.",
    ["vehicle-scene", "closeup-puzzle-view", "room-state-variants"],
    ["ART", "CONTROLS", "WINDOW STATE", "AUDIO", "TRAVEL STATE"],
    ["heart-of-china", "rise-of-the-dragon"],
    [
      "Does the vehicle feel like a bespoke scene rather than a normal room with a car background?",
      "Can controls affect travel/world state cleanly?",
      "Are exterior changes reflected without modern continuous 3D assumptions?",
    ],
  ),
  archetype(
    "vehicle-exterior",
    "Vehicle exterior / roadside",
    "Scene where a vehicle is a major occluding/stateful object and may lead into travel/action state.",
    ["vehicle-scene", "multi-plane-occlusion", "stateful-navigation", "quick-response-sequence"],
    ["ART", "OCCLUSION", "APPROACH", "VEHICLE STATE", "ACTION LINK"],
    ["rise-of-the-dragon", "heart-of-china"],
    [
      "Can the actor move naturally around the vehicle silhouette?",
      "Are entry/exit/action transitions staged rather than teleporting arbitrarily?",
      "Do vehicle states affect both visuals and collision/navigation?",
    ],
  ),
  archetype(
    "combat-arena",
    "Combat arena",
    "Specialized fight mode sharing stats/resources/outcome with adventure progression.",
    ["real-time-combat", "health-stamina-mana", "equipment-money", "deterministic-save-replay"],
    ["ARENA", "INPUT", "STATS", "ENEMY AI", "OUTCOME", "RETURN STATE"],
    ["quest-for-glory-vga", "indiana-jones-fate-of-atlantis"],
    [
      "Does combat consume the same stats/resources the adventure uses?",
      "Can failure/recovery return to a deterministic pre-fight state?",
      "Can alternate non-combat solutions bypass the arena where the title family expects them?",
    ],
  ),
  archetype(
    "action-insert",
    "Action / minigame insert",
    "A deterministic bespoke mode such as driving, arcade, chase or other action interruption.",
    ["action-minigame", "quick-response-sequence", "failure-retry", "deterministic-save-replay"],
    ["MODE CONTRACT", "INPUT", "CLOCK", "OUTCOME", "RETRY", "RETURN STATE"],
    ["heart-of-china", "rise-of-the-dragon", "indiana-jones-fate-of-atlantis"],
    [
      "Does the insert have an explicit deterministic state model rather than frame-time side effects?",
      "Can the player skip/bypass it only when the reference grammar allows?",
      "Does success/failure alter the main story graph correctly?",
    ],
  ),
  archetype(
    "timed-danger",
    "Timed danger",
    "Adventure scene where logical time and player actions determine failure/survival.",
    ["timed-puzzle", "failure-retry", "quick-response-sequence"],
    ["CLOCK", "WARNINGS", "ACTIONS", "FAILURE", "RETRY"],
    ["leisure-suit-larry-vga", "rise-of-the-dragon", "gabriel-knight-sins-of-the-fathers"],
    [
      "Is timing based on logical ticks rather than render FPS?",
      "Does the scene communicate danger in-world rather than with a modern countdown HUD unless historically appropriate?",
      "Is retry bounded and predictable?",
    ],
  ),
  archetype(
    "cinematic-inset",
    "Cinematic inset",
    "DGDS-style editorial close-up, insert or split composition layered into adventure flow.",
    ["cinematic-insets", "cutscene-sequences", "deterministic-save-replay"],
    ["COMPOSITION", "INSET", "CUT", "AUDIO", "RETURN"],
    ["heart-of-china", "rise-of-the-dragon"],
    [
      "Does the inset create a deliberate editorial beat rather than a generic modal card?",
      "Are hard cuts/held frames supported without modern easing by default?",
      "Can the sequence return to exactly the prior world state?",
    ],
  ),
  archetype(
    "cutaway-montage",
    "Cutaway / montage",
    "A temporary scripted view or sequence showing events elsewhere while the source room is frozen/preserved.",
    ["room-cutaways", "cutscene-sequences", "deterministic-save-replay"],
    ["SHOT LIST", "CAMERA", "ACTORS", "AUDIO", "SKIP", "RESTORE"],
    ["day-of-the-tentacle", "indiana-jones-fate-of-atlantis", "heart-of-china", "rise-of-the-dragon"],
    [
      "Can room scripts pause/resume without double-triggering?",
      "Does skip land on the same canonical post-cutscene state?",
      "Are comedy/cinematic holds authored in logical ticks?",
    ],
  ),
  archetype(
    "multi-protagonist-cross-state",
    "Multi-protagonist cross-state puzzle",
    "Several controllable actors/world states affect each other across location/time boundaries.",
    ["multi-protagonist-switching", "item-on-item", "branching-route-topology", "global-progression-graph"],
    ["PLAYABLE ACTORS", "LOCATIONS", "INVENTORIES", "SHARED FACTS", "CROSS-WORLD EFFECTS"],
    ["day-of-the-tentacle", "heart-of-china"],
    [
      "Does each protagonist retain independent location/inventory/control state?",
      "Can one protagonist alter another world without global-flag spaghetti?",
      "Can the progression graph explain cross-character dependency cycles?",
    ],
  ),
  archetype(
    "day-night-location",
    "Day/night location",
    "A location whose art, NPCs, available actions and risk change with simulation time.",
    ["time-of-day-clock", "day-night-room-variants", "npc-schedules", "room-state-variants"],
    ["CLOCK", "ART VARIANT", "NPC SCHEDULE", "LIGHT", "INTERACTIONS"],
    ["quest-for-glory-vga", "gabriel-knight-sins-of-the-fathers"],
    [
      "Does time change content through one authoritative scheduler?",
      "Can waiting/travel/rest advance time deterministically?",
      "Can saves restore the exact schedule/variant state?",
    ],
  ),
  archetype(
    "shop-economy",
    "Shop / economy",
    "Purchase/equipment scene where money/items affect future solutions and character state.",
    ["equipment-money", "inventory", "branching-dialogue", "conditional-hotspots"],
    ["STOCK", "MONEY", "DIALOGUE", "PURCHASE", "EQUIPMENT"],
    ["quest-for-glory-vga", "leisure-suit-larry-vga"],
    [
      "Are prices/resources canonical story state rather than UI-only numbers?",
      "Can purchases alter later puzzle/combat options?",
      "Does save/reload preserve stock and money exactly?",
    ],
  ),
  archetype(
    "training-practice",
    "Training / practice",
    "Repeated authored actions improve skills or stats and feed later checks.",
    ["skills-and-practice", "character-stats", "skill-gated-solutions", "time-of-day-clock"],
    ["SKILLS", "PRACTICE ACTION", "COST", "TIME", "FEEDBACK"],
    ["quest-for-glory-vga"],
    [
      "Does practice increase the correct skill from real usage rather than arbitrary XP?",
      "Does practice consume time/stamina/resources where appropriate?",
      "Are gains bounded and deterministic?",
    ],
  ),
  archetype(
    "chapter-transition",
    "Chapter / day transition",
    "A progression checkpoint that validates required actions, carries optional state and advances the world.",
    ["chapter-day-progression", "global-progression-graph", "room-state-variants"],
    ["REQUIREMENTS", "OPTIONAL", "SUMMARY", "WORLD MIGRATION", "NEXT START"],
    ["gabriel-knight-sins-of-the-fathers"],
    [
      "Are required actions encoded explicitly rather than inferred from score?",
      "Do optional discoveries persist without blocking advancement?",
      "Does the next chapter migrate rooms/NPCs/topics deterministically?",
    ],
  ),
  archetype(
    "failure-outcome",
    "Failure / outcome",
    "Period-appropriate failure/death/success surface with bounded recovery options.",
    ["failure-retry", "deterministic-save-replay"],
    ["OUTCOME", "RETRY", "LOAD", "RESTART", "TITLE"],
    ["kings-quest-v", "gabriel-knight-sins-of-the-fathers", "quest-for-glory-vga", "leisure-suit-larry-vga", "heart-of-china", "rise-of-the-dragon"],
    [
      "Does the outcome freeze the underlying simulation?",
      "Does retry restore an intentional checkpoint without corrupting player saves?",
      "Does the presentation match the title family rather than a generic modern modal?",
    ],
  ),
] as const;

export const validateAdventureSceneArchetypes = (): readonly string[] => {
  const issues: string[] = [];
  const ids = new Set<string>();
  for (const entry of adventureSceneArchetypes) {
    if (ids.has(entry.id)) issues.push(`Duplicate scene archetype '${entry.id}'.`);
    ids.add(entry.id);
    if (entry.requiredCapabilities.length === 0) issues.push(`${entry.label} has no capability requirements.`);
    if (entry.authoringSurfaces.length < 2) issues.push(`${entry.label} has too few authoring surfaces.`);
    if (entry.qaQuestions.length < 2) issues.push(`${entry.label} has too few QA questions.`);
    if (entry.referenceGames.length === 0) issues.push(`${entry.label} has no reference pressure-test.`);
  }
  return issues.sort((left, right) => left.localeCompare(right));
};
