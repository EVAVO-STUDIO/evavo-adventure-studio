import type { AdventureCapabilityId, AdventureReferenceGameId } from "./full-game-capabilities.js";

export type AdventureUpgradeEpicId =
  | "scene-camera-elevation"
  | "investigation-chapter-knowledge"
  | "scumm-sentence-object-scripting"
  | "multi-protagonist-world-state"
  | "rpg-simulation-kernel"
  | "cinematic-travel-action-modes"
  | "whole-game-branch-orchestration"
  | "full-game-proof-harness";

export interface AdventureUpgradeEpic {
  readonly id: AdventureUpgradeEpicId;
  readonly priority: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  readonly label: string;
  readonly outcome: string;
  readonly capabilities: readonly AdventureCapabilityId[];
  readonly unlocksReferenceGames: readonly AdventureReferenceGameId[];
  readonly deliverables: readonly string[];
  readonly proofScenes: readonly string[];
  readonly dependsOn: readonly AdventureUpgradeEpicId[];
}

export const adventureFullGameUpgradePlan: readonly AdventureUpgradeEpic[] = [
  {
    id: "scene-camera-elevation",
    priority: 1,
    label: "Scene camera + elevation grammar",
    outcome:
      "Make scrolling/panoramic rooms and multi-level interiors first-class Scene Director/runtime concepts rather than special camera scripts.",
    capabilities: ["scrolling-room", "panoramic-exterior", "multi-elevation-room"],
    unlocksReferenceGames: [
      "kings-quest-v",
      "quest-for-glory-vga",
      "day-of-the-tentacle",
      "indiana-jones-fate-of-atlantis",
    ],
    deliverables: [
      "Camera bounds/dead-zones authored in native room coordinates and saved/replayed deterministically.",
      "Navigation/elevation transitions with explicit stair/ladder/landing links and scale continuity.",
      "Scene Director CAMERA mode plus off-screen entry/target diagnostics.",
      "Scrolling-room evidence capture at raw viewport and full-room map scale.",
    ],
    proofScenes: [
      "KQ5-like wide painterly exterior with foreground reveals and several exits.",
      "SCUMM-like wide mansion hallway with per-region scaling and Z masks.",
      "Two-level interior with stair transition and no priority/scale pop.",
    ],
    dependsOn: [],
  },
  {
    id: "investigation-chapter-knowledge",
    priority: 2,
    label: "Investigation knowledge + chapter/day system",
    outcome:
      "Make Gabriel Knight-style facts, topics, research and day progression canonical world data instead of loose flags/dialogue conditions.",
    capabilities: [
      "topic-dialogue",
      "dialogue-fact-unlocks",
      "chapter-day-progression",
      "research-investigation-loop",
      "room-state-variants",
    ],
    unlocksReferenceGames: [
      "gabriel-knight-sins-of-the-fathers",
      "indiana-jones-fate-of-atlantis",
      "rise-of-the-dragon",
    ],
    deliverables: [
      "Fact/topic registry with provenance, discovered/exhausted state and dialogue bindings.",
      "Chapter/day contract with required actions, optional discoveries, migration actions and next-scene entry.",
      "Research-source actions that unlock facts/topics/destinations without modern quest-log semantics.",
      "Progression editor views for facts → topics → interactions → chapter completion.",
    ],
    proofScenes: [
      "GK-like shop conversation where research unlocks a new portrait topic.",
      "Library/research close-up that adds a destination and optional historical fact.",
      "Day transition revisiting two rooms with changed NPC/object/light state.",
    ],
    dependsOn: [],
  },
  {
    id: "scumm-sentence-object-scripting",
    priority: 3,
    label: "SCUMM5 sentence + room/object scripting grammar",
    outcome:
      "Support LucasArts-style verb sentences and strongly room-local scripted object behavior rather than mapping everything to Sierra-style hotspot actions.",
    capabilities: ["verb-sentence-grammar", "item-on-item", "room-cutaways", "alternate-puzzle-solutions"],
    unlocksReferenceGames: ["day-of-the-tentacle", "indiana-jones-fate-of-atlantis"],
    deliverables: [
      "Verb + target + optional secondary target sentence model with period UI rendering.",
      "Room/object script hooks for enter/exit/verb/object-state/timer events with deterministic ordering.",
      "Inventory item combination/transfer transformations with explicit failure text and ownership state.",
      "Cutaway script primitive that freezes/resumes room scripts without double-triggering.",
    ],
    proofScenes: [
      "Nine-verb SCUMM5 room with inventory sentence construction.",
      "Multi-step object puzzle using item-on-item then item-on-room-object.",
      "Comic cutaway triggered by room script and returning to exact previous state.",
    ],
    dependsOn: ["scene-camera-elevation"],
  },
  {
    id: "multi-protagonist-world-state",
    priority: 4,
    label: "Multi-protagonist world state",
    outcome:
      "Give several playable characters independent locations/inventories/control state with explicit shared facts and cross-world effects.",
    capabilities: ["multi-protagonist-switching", "branching-route-topology", "item-on-item"],
    unlocksReferenceGames: ["day-of-the-tentacle", "heart-of-china"],
    deliverables: [
      "Playable-character registry and deterministic active-character switching.",
      "Per-character scene/entrance/inventory/state saved independently.",
      "Shared-world mutation API for cross-time/cross-character puzzle consequences.",
      "Progression graph detects cross-character dependency cycles and inaccessible required items.",
    ],
    proofScenes: [
      "DOTT-like three-character state exchange across separate world variants.",
      "Heart-of-China-like protagonist switch with distinct location and inventory.",
      "Cross-character item/state dependency with save/replay round trip.",
    ],
    dependsOn: ["scumm-sentence-object-scripting"],
  },
  {
    id: "rpg-simulation-kernel",
    priority: 5,
    label: "Quest for Glory RPG simulation kernel",
    outcome:
      "Add persistent stats/classes/skills/resources/time/schedules/combat as deterministic engine systems integrated with adventure interactions.",
    capabilities: [
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
    unlocksReferenceGames: ["quest-for-glory-vga"],
    deliverables: [
      "Typed stat/resource/class/skill schemas and deterministic advancement rules.",
      "Logical world clock with rest/travel/practice costs and NPC schedules.",
      "Skill-check action primitive supporting several class-specific solutions to one obstacle.",
      "Combat-mode contract sharing health/stamina/equipment and lifecycle outcomes with adventure state.",
      "Versioned character export/import document with migration/validation.",
    ],
    proofScenes: [
      "Town location that changes NPCs and interactions morning/evening/night.",
      "Obstacle with fighter/magic/thief solution branches driven by real skills.",
      "Training scene where repeated practice grows a skill while consuming time/stamina.",
      "Combat encounter then return to the same world with resources preserved.",
    ],
    dependsOn: ["scene-camera-elevation", "whole-game-branch-orchestration"],
  },
  {
    id: "cinematic-travel-action-modes",
    priority: 6,
    label: "DGDS cinematic / travel / action mode framework",
    outcome:
      "Allow bespoke cinematic and action scene types without abandoning deterministic adventure state or forcing them into the normal room renderer.",
    capabilities: [
      "cinematic-insets",
      "travel-map",
      "vehicle-scene",
      "action-minigame",
      "quick-response-sequence",
      "timed-puzzle",
    ],
    unlocksReferenceGames: ["heart-of-china", "rise-of-the-dragon", "indiana-jones-fate-of-atlantis"],
    deliverables: [
      "Scene-mode/plugin contract with explicit input, tick, render, save, outcome and return-state hooks.",
      "Hard-cut cinematic inset/closeup sequence mode with held frames and period timing.",
      "Travel-map/location mode whose nodes/edges are progression state.",
      "Vehicle/action insert reference implementation with deterministic failure/retry.",
    ],
    proofScenes: [
      "DGDS-style city room → hard closeup inset → return to room.",
      "Travel map choosing a branch and loading a different downstream location graph.",
      "Vehicle/action insert whose failure/success changes the subsequent scene state.",
    ],
    dependsOn: ["whole-game-branch-orchestration"],
  },
  {
    id: "whole-game-branch-orchestration",
    priority: 7,
    label: "Whole-game branch orchestration",
    outcome:
      "Upgrade progression from local prerequisites into explicit acts/routes/branches/reconvergence so full games can be validated for locks and alternate paths.",
    capabilities: ["global-progression-graph", "branching-route-topology", "alternate-puzzle-solutions"],
    unlocksReferenceGames: [
      "gabriel-knight-sins-of-the-fathers",
      "day-of-the-tentacle",
      "heart-of-china",
      "rise-of-the-dragon",
      "indiana-jones-fate-of-atlantis",
      "quest-for-glory-vga",
    ],
    deliverables: [
      "Acts/chapters/routes/objectives/facts/items/scene-state nodes in one typed progression graph.",
      "Branch/reconvergence contracts including mutually-exclusive route state.",
      "Static reachability/deadlock analysis across required inventory/fact/character dependencies.",
      "Progression Studio whole-game graph and route-specific evidence requirements.",
    ],
    proofScenes: [
      "Fate-like Team/Wits/Fists branch with shared opening and reconvergent finale.",
      "DGDS branch where dialogue changes destination and later scene state.",
      "Three-character dependency graph proving every required item remains reachable.",
    ],
    dependsOn: [],
  },
  {
    id: "full-game-proof-harness",
    priority: 8,
    label: "Full-game proof harness",
    outcome:
      "Make 'supports this game family' mean complete route/archetype evidence rather than a profile card and one polished sample room.",
    capabilities: ["full-game-evidence", "deterministic-save-replay", "native-vga-audit", "localisation"],
    unlocksReferenceGames: [
      "kings-quest-v",
      "gabriel-knight-sins-of-the-fathers",
      "quest-for-glory-vga",
      "day-of-the-tentacle",
      "leisure-suit-larry-vga",
      "heart-of-china",
      "rise-of-the-dragon",
      "indiana-jones-fate-of-atlantis",
    ],
    deliverables: [
      "Reference-family evidence manifest listing required archetypes, routes, saves, replays and raw screenshots.",
      "Automated replay route runner for success/failure/alternate-path proofs.",
      "Coverage report that refuses 'full-game ready' while any required scene archetype remains unproofed.",
      "Period-native art/dialogue/UI review retained per representative scene family, not merely per asset.",
    ],
    proofScenes: [
      "Automated end-to-end success route spanning every required archetype for one reference family.",
      "Alternate/failure route replay with deterministic recovery.",
      "Raw 1× evidence gallery grouped by scene archetype and production family.",
    ],
    dependsOn: [
      "scene-camera-elevation",
      "investigation-chapter-knowledge",
      "scumm-sentence-object-scripting",
      "multi-protagonist-world-state",
      "rpg-simulation-kernel",
      "cinematic-travel-action-modes",
      "whole-game-branch-orchestration",
    ],
  },
] as const;

export const validateAdventureFullGameUpgradePlan = (): readonly string[] => {
  const issues: string[] = [];
  const ids = new Set(adventureFullGameUpgradePlan.map((epic) => epic.id));
  const priorities = new Set<number>();
  for (const epic of adventureFullGameUpgradePlan) {
    if (priorities.has(epic.priority)) issues.push(`Duplicate full-game priority ${epic.priority}.`);
    priorities.add(epic.priority);
    if (epic.capabilities.length === 0) issues.push(`${epic.label} has no capability targets.`);
    if (epic.unlocksReferenceGames.length === 0) issues.push(`${epic.label} has no reference-game pressure.`);
    if (epic.deliverables.length < 3) issues.push(`${epic.label} needs at least three concrete deliverables.`);
    if (epic.proofScenes.length < 3) issues.push(`${epic.label} needs at least three proof scenes.`);
    for (const dependency of epic.dependsOn) {
      if (!ids.has(dependency)) issues.push(`${epic.label} depends on unknown epic '${dependency}'.`);
      if (dependency === epic.id) issues.push(`${epic.label} cannot depend on itself.`);
    }
  }
  return issues.sort((left, right) => left.localeCompare(right));
};
